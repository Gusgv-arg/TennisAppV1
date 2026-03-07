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
 * Evento emitido cada vez que se procesa un frame para actualizar UI (Overlays/Esqueletos).
 */
export interface FrameAnalysisResult {
    timestampMs: number;
    phase: ServePhase;
    metrics: ServeMetrics | null;
    landmarks: PoseLandmarks | null;
}

/**
 * Clase orquestadora (Worker).
 * Es responsable de recibir cada frame de MediaPipe, pasarlo por la matemática y 
 * retener los "Momentos de la verdad" (Keyframes) para el Rules Engine.
 */
export class ServeAnalyzer {
    private dominantHand: DominantHand;
    private tracker: PhaseTracker;

    // Almacenaje de métricas en los instantes críticos (Keyframes)
    private trophyMetrics: ServeMetrics | null = null;
    private contactMetrics: ServeMetrics | null = null;
    private followThroughMetrics: ServeMetrics | null = null;

    private trophyTimestamp: number | undefined;
    private contactTimestamp: number | undefined;

    // Historial temporal para calcular derivadas (velocidades)
    private previousMetrics: ServeMetrics | null = null;

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
        this.contactMetrics = null;
        this.followThroughMetrics = null;

        this.trophyTimestamp = undefined;
        this.contactTimestamp = undefined;
        this.previousMetrics = null;
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
        this.captureKeyframes(oldPhase, currentPhase, currentMetrics, timestampMs);

        this.previousMetrics = currentMetrics;

        return {
            timestampMs,
            phase: currentPhase,
            metrics: currentMetrics,
            landmarks: cleanLandmarks
        };
    }

    /**
     * Examina si hubo un cambio de fase recién y se guarda la "foto" biométrica de ese instante.
     */
    private captureKeyframes(oldPhase: ServePhase, newPhase: ServePhase, metrics: ServeMetrics, timestamp: number) {
        // Justo al entrar en aceleración, significa que ya dobló todo lo que iba a doblar y bajó la raqueta
        // Ese es el "Máximo Trophy" (Maximum Load)
        if (oldPhase === ServePhase.TROPHY && newPhase === ServePhase.ACCELERATION) {
            this.trophyMetrics = { ...this.previousMetrics! }; // Guardamos el frame anterior por ser el cénit
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
