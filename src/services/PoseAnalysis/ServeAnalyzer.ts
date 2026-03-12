import { extractMetrics } from './metrics';
import { PhaseTracker } from './phaseTracker';
import { preprocessFrame, resetPreprocessEMA } from './preprocess';
import { evaluateServeRules } from './rules';
import { DominantHand, Landmark, PoseLandmarks, ServeAnalysisReport, ServeMetrics, ServePhase } from './types';

/**
 * Error de dominio para abortar el análisis si el video no presenta características de saque.
 */
export class MislabeledVideoError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'MislabeledVideoError';
    }
}

/**
 * Error de dominio si la cámara está del lado equivocado.
 */
export class PoseOrientationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'PoseOrientationError';
    }
}

/**
 * Evento emitido cada vez que se procesa un frame para actualizar UI (Overlays/Esqueletos).
 */
export interface FrameAnalysisResult {
    timestampMs: number;
    phase: ServePhase;
    metrics: ServeMetrics | null;
    landmarks: PoseLandmarks | null;
    poorOrientation?: boolean;
}

/**
 * Clase orquestadora (Worker).
 * Es responsable de recibir cada frame de MediaPipe, pasarlo por la matemática y 
 * retener los "Momentos de la verdad" (Keyframes) para el Rules Engine.
 */
export class ServeAnalyzer {
    private dominantHand: DominantHand;
    private tracker: PhaseTracker;
    public skipOrientationCheck: boolean = false;
    private detectedPoorOrientation: boolean = false;

    // Almacenaje de métricas en los instantes críticos (Keyframes)
    private setupMetrics: ServeMetrics | null = null;
    private trophyMetrics: ServeMetrics | null = null;
    private trophyLandmarks: PoseLandmarks | null = null;
    private contactMetrics: ServeMetrics | null = null;
    private followThroughMetrics: ServeMetrics | null = null;

    private trophyTimestamp: number | undefined;
    private contactTimestamp: number | undefined;

    // Historial temporal para calcular derivadas (velocidades)
    private previousMetrics: ServeMetrics | null = null;
    private previousLandmarks: PoseLandmarks | null = null;

    // Baseline de talones para calcular el despegue (Indicador 4)
    private heelBaselineY: number | undefined;
    private heelBaselineSamples: number = 0;
    private heelBaselineAccum: number = 0;
    private readonly HEEL_BASELINE_FRAMES = 10; // Primeros N frames para calibrar

    // Buffer para detección temprana de orientación
    private orientationBuffer: number[] = [];
    private readonly MAX_ORIENTATION_SAMPLES = 15; // ~0.5s a 30fps es suficiente para detectar perfil

    // Opciones del analyzer
    private fpsTarget: number;

    constructor(dominantHand: DominantHand = 'right', fpsTarget: number = 30) {
        this.dominantHand = dominantHand;
        this.fpsTarget = fpsTarget;
        this.tracker = new PhaseTracker();
        this.reset();
    }

    /**
     * Limpia la memoria interna para analizar un nuevo video.
     */
    public reset() {
        this.tracker.reset();
        resetPreprocessEMA();
        this.setupMetrics = null;
        this.trophyMetrics = null;
        this.trophyLandmarks = null;
        this.contactMetrics = null;
        this.followThroughMetrics = null;

        this.trophyTimestamp = undefined;
        this.contactTimestamp = undefined;
        this.previousMetrics = null;
        this.previousLandmarks = null;
        this.orientationBuffer = [];
        this.detectedPoorOrientation = false;

        // Reset heel baseline
        this.heelBaselineY = undefined;
        this.heelBaselineSamples = 0;
        this.heelBaselineAccum = 0;
    }

    /**
     * Ingresa un cuadro (Frame) crudo de MediaPipe y escupe el estado actual del análisis.
     */
    public processFrame(rawLandmarks: PoseLandmarks, timestampMs: number): FrameAnalysisResult {

        // 1. Limpieza y estandarización del esqueleto
        const cleanLandmarks = preprocessFrame(rawLandmarks);
        if (!cleanLandmarks) {
            // Frame descartado por baja visibilidad
            return {
                timestampMs,
                phase: this.tracker.getPhase(),
                metrics: null,
                landmarks: null
            };
        }

        // 2. Extraer Física (Métricas v2)
        const currentMetrics = extractMetrics(cleanLandmarks, this.dominantHand);

        // 2.5 Calibrar Heel Baseline con los primeros frames
        if (this.heelBaselineSamples < this.HEEL_BASELINE_FRAMES) {
            this.heelBaselineAccum += currentMetrics.heelLiftDelta;
            this.heelBaselineSamples++;
            if (this.heelBaselineSamples === this.HEEL_BASELINE_FRAMES) {
                this.heelBaselineY = this.heelBaselineAccum / this.HEEL_BASELINE_FRAMES;
            }
        }

        // 2.6 Detección Temprana de Orientación (Knockout en ~0.5s)
        // Lógica: En un video de perfil, la cámara está del lado del brazo dominante.
        // Para un diestro filmado correctamente: el hombro derecho (12) está MÁS CERCA de la cámara,
        // lo que significa que tiene un Z más negativo (sale "hacia" la cámara).
        // Si el hombro dominante tiene Z mucho más positivo que el otro, la cámara está del lado incorrecto.
        if (!this.skipOrientationCheck && this.orientationBuffer.length < this.MAX_ORIENTATION_SAMPLES) {
            const leftShoulder = cleanLandmarks[11];
            const rightShoulder = cleanLandmarks[12];

            if (leftShoulder && rightShoulder) {
                const Z_THRESHOLD = 0.08;
                const diff = rightShoulder.z - leftShoulder.z;

                // Para diestro: el hombro derecho debería tener Z más negativo (más cerca de cámara)
                // diff = right.z - left.z → si la cámara está del lado correcto, diff < 0
                // Si diff > threshold → la cámara está del lado equivocado
                let weight: number;
                if (this.dominantHand === 'right') {
                    weight = diff > Z_THRESHOLD ? -1 : (diff < -Z_THRESHOLD ? 1 : 0);
                } else {
                    // Zurdo: el hombro izquierdo debería estar más cerca (Z más negativo)
                    // diff = right.z - left.z → si cámara correcta, diff > 0
                    weight = diff < -Z_THRESHOLD ? -1 : (diff > Z_THRESHOLD ? 1 : 0);
                }

                this.orientationBuffer.push(weight);

                if (this.orientationBuffer.length === this.MAX_ORIENTATION_SAMPLES) {
                    const sum = this.orientationBuffer.reduce((a, b) => a + b, 0);
                    const validSamples = this.orientationBuffer.filter(v => v !== 0).length;

                    console.log(`[OrientationDetector] Hand: ${this.dominantHand} | Sum: ${sum} | Valid: ${validSamples}/${this.MAX_ORIENTATION_SAMPLES} | Buffer: [${this.orientationBuffer.join(',')}]`);

                    // Solo marcamos mala orientación si hay una mayoría CLARA de votos negativos
                    if (sum < -Math.floor(this.MAX_ORIENTATION_SAMPLES / 2) && validSamples > this.MAX_ORIENTATION_SAMPLES * 0.6) {
                        this.detectedPoorOrientation = true;
                        console.warn(`[OrientationDetector] ⚠️ Poor orientation detected! Camera appears to be on the wrong side.`);
                    } else {
                        console.log(`[OrientationDetector] ✅ Orientation looks OK.`);
                    }
                }
            }
        }

        // 3. Empujar Máquina de Estados
        const oldPhase = this.tracker.getPhase();
        const currentPhase = this.tracker.update(currentMetrics, timestampMs);

        // 4. Capturar Momentos Clave "Snapshot"
        this.captureKeyframes(oldPhase, currentPhase, currentMetrics, cleanLandmarks, timestampMs);

        this.previousMetrics = currentMetrics;
        this.previousLandmarks = cleanLandmarks;

        return {
            timestampMs,
            phase: currentPhase,
            metrics: currentMetrics,
            landmarks: cleanLandmarks,
            poorOrientation: this.detectedPoorOrientation
        };
    }

    /**
     * Examina si hubo un cambio de fase recién y se guarda la "foto" biométrica de ese instante.
     */
    private captureKeyframes(oldPhase: ServePhase, newPhase: ServePhase, metrics: ServeMetrics, landmarks: PoseLandmarks, timestamp: number) {
        // Al entrar en TROPHY, capturamos el SETUP (cómo se preparó)
        if (oldPhase === ServePhase.SETUP && newPhase === ServePhase.TROPHY) {
            this.setupMetrics = { ...this.previousMetrics! };
        }

        // Justo al entrar en aceleración, significa que ya dobló todo lo que iba a doblar
        // Ese es el "Máximo Trophy" (Maximum Load)
        if (oldPhase === ServePhase.TROPHY && newPhase === ServePhase.ACCELERATION) {
            this.trophyMetrics = { ...this.previousMetrics! }; // Guardamos el frame anterior por ser el cénit
            this.trophyLandmarks = this.previousLandmarks;
            this.trophyTimestamp = timestamp;
        }

        // Justo al cruzar al Follow Through → capturamos el impacto
        if (oldPhase === ServePhase.CONTACT && newPhase === ServePhase.FOLLOW_THROUGH) {
            this.contactMetrics = { ...this.previousMetrics! };
            this.contactTimestamp = timestamp;
        }

        // Si terminó el Follow Through a nivel inercia
        if (newPhase === ServePhase.FOLLOW_THROUGH) {
            // Actualizamos constantemente el Follow Through hasta que termine
            this.followThroughMetrics = metrics;
        }
    }

    /**
     * Emite el reporte de técnica consultándole al Juez (Rules Engine).
     * Se llama cuando el video terminó de procesarse 100%.
     */
    public generateFinalReport(): ServeAnalysisReport {
        // Penalizar o abortar si la máquina de estados nunca logró atrapar la "Fase de Trofeo".
        if (!this.trophyMetrics) {
            throw new MislabeledVideoError("El movimiento analizado no presenta las características biomecánicas de un Saque.");
        }

        const evaluation = evaluateServeRules(
            this.setupMetrics,
            this.trophyMetrics,
            this.contactMetrics,
            this.followThroughMetrics,
            this.heelBaselineY
        );

        let confidence = 1.0;

        // 1. Detección de Orientación Incorrecta (Side View Guardrail at Trophy)
        if (this.trophyLandmarks) {
            const leftShoulder = this.trophyLandmarks[11];
            const rightShoulder = this.trophyLandmarks[12];

            if (leftShoulder && rightShoulder) {
                const ORIENTATION_THRESHOLD = 0.12;
                const diff = rightShoulder.z - leftShoulder.z;

                console.log(`[OrientationCheck@Trophy] Hand: ${this.dominantHand} | R.z: ${rightShoulder.z.toFixed(3)} | L.z: ${leftShoulder.z.toFixed(3)} | Diff(R-L): ${diff.toFixed(3)} | Threshold: ±${ORIENTATION_THRESHOLD}`);

                // Diestro: hombro derecho más cerca de cámara → diff negativo → correcto
                // Si diff >> +threshold → cámara del lado equivocado
                if (this.dominantHand === 'right' && diff > ORIENTATION_THRESHOLD) {
                    evaluation.flags.push('POOR_ORIENTATION');
                    confidence -= 0.4;
                    console.warn(`[OrientationCheck@Trophy] ⚠️ RIGHT-handed but right shoulder is BEHIND (z=${rightShoulder.z.toFixed(3)}). Camera on wrong side.`);
                } else if (this.dominantHand === 'left' && diff < -ORIENTATION_THRESHOLD) {
                    evaluation.flags.push('POOR_ORIENTATION');
                    confidence -= 0.4;
                    console.warn(`[OrientationCheck@Trophy] ⚠️ LEFT-handed but left shoulder is BEHIND (z=${leftShoulder.z.toFixed(3)}). Camera on wrong side.`);
                } else {
                    console.log(`[OrientationCheck@Trophy] ✅ Orientation OK for ${this.dominantHand}-handed player.`);
                }
            }
        }

        if (!this.contactMetrics) {
            confidence -= 0.3;
        }

        return {
            strokeType: 'SERVE',
            finalScore: evaluation.finalScore,            categoryScores: evaluation.categoryScores,
            detailedMetrics: evaluation.detailedMetrics,
            flags: evaluation.flags,
            confidence: Math.max(0, confidence),
            keyframes: {
                trophyTimestampMs: this.trophyTimestamp,
                contactTimestampMs: this.contactTimestamp,
            }
        };
    }
}
