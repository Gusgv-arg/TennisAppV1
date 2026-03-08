import { extractMetrics } from './metrics';
import { PhaseTracker } from './phaseTracker';
import { preprocessFrame, resetPreprocessEMA } from './preprocess';
import { evaluateServeRules } from './rules';
import { DominantHand, PoseLandmarks, ServeAnalysisReport, ServeMetrics, ServePhase } from './types';

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
    private trophyMetrics: ServeMetrics | null = null;
    private trophyLandmarks: PoseLandmarks | null = null;
    private contactMetrics: ServeMetrics | null = null;
    private followThroughMetrics: ServeMetrics | null = null;

    private trophyTimestamp: number | undefined;
    private contactTimestamp: number | undefined;

    // Historial temporal para calcular derivadas (velocidades)
    private previousMetrics: ServeMetrics | null = null;
    private previousLandmarks: PoseLandmarks | null = null;

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

        // 2. Extraer Física (Ángulos)
        const currentMetrics = extractMetrics(cleanLandmarks, this.dominantHand);

        // 2.5 Detección Temprana de Orientación (Knockout en ~0.5s)
        if (!this.skipOrientationCheck && this.orientationBuffer.length < this.MAX_ORIENTATION_SAMPLES) {
            const leftShoulder = cleanLandmarks[11];
            const rightShoulder = cleanLandmarks[12];

            if (leftShoulder && rightShoulder) {
                // Buffer de orientación
                const Z_THRESHOLD = 0.1;
                const diff = rightShoulder.z - leftShoulder.z;
                const weight = this.dominantHand === 'right' ? (diff < -Z_THRESHOLD ? 1 : (diff > Z_THRESHOLD ? -1 : 0)) : (diff > Z_THRESHOLD ? 1 : (diff < -Z_THRESHOLD ? -1 : 0));

                this.orientationBuffer.push(weight);

                if (timestampMs % 500 === 0) { // Log every ~0.5s of video
                    console.log(`[OrientationDebug] Hand: ${this.dominantHand} | R_z: ${rightShoulder.z.toFixed(3)} | L_z: ${leftShoulder.z.toFixed(3)} | Diff: ${diff.toFixed(3)} | Weight: ${weight}`);
                }

                // Si llenamos el buffer, evaluar mayoría
                if (this.orientationBuffer.length === this.MAX_ORIENTATION_SAMPLES) {
                    const sum = this.orientationBuffer.reduce((a, b) => a + b, 0);
                    const validSamples = this.orientationBuffer.filter(v => v !== 0).length;

                    console.log(`[OrientationDebug] Buffer Full. Sum: ${sum} | Valid Samples: ${validSamples}`);

                    if (sum < 0 && validSamples > this.MAX_ORIENTATION_SAMPLES / 2) {
                        // Mayoría de frames indican lado incorrecto
                        this.detectedPoorOrientation = true;
                        console.warn(`[OrientationDetector] Poor orientation detected!`);
                    }
                }
            }
        }

        // Calcular derivadas de nivel superior (Velocity)
        if (this.previousMetrics) {
            // Un cálculo muy simplista: diferencia angular en el tiempo.
            // Para "Wrist Vertical Velocity" idealmente mediríamos el Y global de la mano, 
            // pero para esta Demo de PRD usaremos el cambio de elevación del brazo como proxy de velocidad.
            const elevationDelta = currentMetrics.armElevationAngle - this.previousMetrics.armElevationAngle;
            // Velocity = distance / time (time en segundos para lecturas racionales)
            const timeDeltaSec = (1000 / this.fpsTarget) / 1000;
            currentMetrics.wristVerticalVelocity = elevationDelta / timeDeltaSec;
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
        // Justo al entrar en aceleración, significa que ya dobló todo lo que iba a doblar y bajó la raqueta
        // Ese es el "Máximo Trophy" (Maximum Load)
        if (oldPhase === ServePhase.TROPHY && newPhase === ServePhase.ACCELERATION) {
            this.trophyMetrics = { ...this.previousMetrics! }; // Guardamos el frame anterior por ser el cénit
            this.trophyLandmarks = this.previousLandmarks;
            this.trophyTimestamp = timestamp;
        }

        // Justo al cruzar al Follow Through, significa que ya pegó y el codo empezó a doblarse / brazo a bajar
        // Ese es el "Impacto"
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
        const evaluation = evaluateServeRules(
            this.trophyMetrics,
            this.contactMetrics,
            this.followThroughMetrics
        );

        let confidence = 1.0;

        // Penalizar o abortar si la máquina de estados nunca logró atrapar la "Fase de Trofeo".
        // Si no hay trofeo, es altamente probable que el usuario subió un video de otro golpe (Ej: un Drive)
        if (!this.trophyMetrics) {
            throw new MislabeledVideoError("El movimiento analizado no presenta las características biomecánicas de un Saque.");
        }

        // 1. Detección de Orientación Incorrecta (Side View Guardrail)
        if (this.trophyLandmarks) {
            const leftShoulder = this.trophyLandmarks[11];
            const rightShoulder = this.trophyLandmarks[12];

            const ORIENTATION_THRESHOLD = 0.15;
            const diff = rightShoulder.z - leftShoulder.z;

            console.log(`[OrientationFinal] Trophy Z Diff: ${diff.toFixed(3)} | Threshold: ${ORIENTATION_THRESHOLD}`);

            if (this.dominantHand === 'right') {
                if (leftShoulder && rightShoulder && diff > ORIENTATION_THRESHOLD) {
                    evaluation.flags.push('POOR_ORIENTATION');
                    confidence -= 0.4;
                }
            } else {
                if (leftShoulder && rightShoulder && diff < -ORIENTATION_THRESHOLD) {
                    evaluation.flags.push('POOR_ORIENTATION');
                    confidence -= 0.4;
                }
            }
        }

        if (!this.contactMetrics) {
            confidence -= 0.3;
        }

        return {
            finalScore: evaluation.finalScore,
            categoryScores: evaluation.categoryScores,
            flags: evaluation.flags,
            confidence: Math.max(0, confidence),
            keyframes: {
                trophyTimestampMs: this.trophyTimestamp,
                contactTimestampMs: this.contactTimestamp,
            }
        };
    }
}
