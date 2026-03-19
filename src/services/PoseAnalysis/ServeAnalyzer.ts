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
    snapshotUrl?: string;
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
    private setupLandmarks: PoseLandmarks | null = null;
    private setupTimestamp: number | undefined;
    private setupSnapshot: string | undefined;

    private trophyMetrics: ServeMetrics | null = null;
    private trophyLandmarks: PoseLandmarks | null = null;
    private trophyTimestamp: number | undefined;
    private trophySnapshot: string | undefined;
    private maxTossArmElevation: number = -1;
    private trophyLocked: boolean = false;

    private contactMetrics: ServeMetrics | null = null;
    private contactLandmarks: PoseLandmarks | null = null;
    private contactTimestamp: number | undefined;
    private contactSnapshot: string | undefined;
    private maxImpactExtension: number = -1;
    private impactLocked: boolean = false;

    // Rastrear el mejor candidato para Armado durante toda la fase
    private bestTrophyElbowDiff: number = Infinity;

    private followThroughMetrics: ServeMetrics | null = null;
    private finishLandmarks: PoseLandmarks | null = null;
    private finishMetrics: ServeMetrics | null = null;
    private finishTimestamp: number = 0;
    private finishSnapshot: string | undefined;
    private finishLocked: boolean = false;

    // Rastrear el mejor candidato para Terminación (Cruce de cuerpo)
    private bestFollowThroughDist: number = Infinity;

    // Historial temporal para calcular derivadas (velocidades)
    private previousMetrics: ServeMetrics | null = null;
    private previousLandmarks: PoseLandmarks | null = null;
    private previousTimestampMs: number | undefined;
    private previousSnapshotUrl: string | undefined;

    // Baseline de talones para calcular el despegue (Indicador 4)
    private heelBaselineY: number | undefined;
    private heelBaselineSamples: number = 0;
    private heelBaselineAccum: number = 0;
    private readonly HEEL_BASELINE_FRAMES = 10; // Primeros N frames para calibrar

    // Buffer para detección temprana de orientación
    private orientationBuffer: number[] = [];
    private readonly MAX_ORIENTATION_SAMPLES = 15; // ~0.5s a 30fps es suficiente para detectar perfil

    // ─── Quality Tracking ───
    private totalFramesReceived: number = 0;
    private acceptedFrames: number = 0;
    private frameQualitySum: number = 0;
    private firstTimestampMs: number | undefined;

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
        this.setupLandmarks = null;
        this.setupTimestamp = undefined;
        this.setupSnapshot = undefined;

        this.trophyMetrics = null;
        this.trophyLandmarks = null;
        this.trophyTimestamp = undefined;
        this.trophySnapshot = undefined;

        this.contactMetrics = null;
        this.contactLandmarks = null;
        this.contactTimestamp = undefined;
        this.contactSnapshot = undefined;

        this.followThroughMetrics = null;
        this.finishLandmarks = null;
        this.finishMetrics = null;
        this.finishTimestamp = 0;
        this.finishSnapshot = undefined;

        this.previousMetrics = null;
        this.previousLandmarks = null;
        this.previousTimestampMs = undefined;
        this.previousSnapshotUrl = undefined;

        this.orientationBuffer = [];
        this.detectedPoorOrientation = false;
        this.maxTossArmElevation = -1;
        this.trophyLocked = false;
        this.maxImpactExtension = -1;
        this.impactLocked = false;
        this.bestTrophyElbowDiff = Infinity;
        this.bestFollowThroughDist = Infinity;

        this.heelBaselineY = undefined;
        this.heelBaselineSamples = 0;
        this.heelBaselineAccum = 0;

        this.totalFramesReceived = 0;
        this.acceptedFrames = 0;
        this.frameQualitySum = 0;
        this.firstTimestampMs = undefined;
    }

    /**
     * Ingresa un cuadro (Frame) crudo de MediaPipe y escupe el estado actual del análisis.
     */
    public processFrame(rawLandmarks: PoseLandmarks, timestampMs: number, snapshotUrl?: string): FrameAnalysisResult {

        if (this.firstTimestampMs === undefined) {
            this.firstTimestampMs = timestampMs;
        }

        // Tracking de calidad: contar TODOS los frames que llegan
        this.totalFramesReceived++;

        // 1. Limpieza y estandarización del esqueleto
        const preprocessed = preprocessFrame(rawLandmarks);
        if (!preprocessed) {
            // Frame descartado por baja visibilidad, tamaño, o outlier cinemático
            return {
                timestampMs,
                phase: this.tracker.getPhase(),
                metrics: null,
                landmarks: null
            };
        }

        const { normalized, smoothed, frameQuality } = preprocessed;

        // Tracking de calidad: contar frame aceptado y acumular calidad
        this.acceptedFrames++;
        this.frameQualitySum += frameQuality;

        // 2. Extraer Física (Métricas v2)
        const currentMetrics = extractMetrics(normalized, this.dominantHand);

        // 2.5 Calibrar Heel Baseline con los primeros frames (IDLE o SETUP)
        const phaseBeforeUpdate = this.tracker.getPhase();
        const isSteadyPhase = (phaseBeforeUpdate === ServePhase.IDLE || phaseBeforeUpdate === ServePhase.SETUP);

        if (isSteadyPhase && this.heelBaselineSamples < this.HEEL_BASELINE_FRAMES) {
            this.heelBaselineAccum += currentMetrics.heelLiftDelta;
            this.heelBaselineSamples++;
            if (this.heelBaselineSamples === this.HEEL_BASELINE_FRAMES) {
                this.heelBaselineY = this.heelBaselineAccum / this.HEEL_BASELINE_FRAMES;
            }
        }

        // 2.6 Detección Temprana de Orientación
        if (!this.skipOrientationCheck && this.orientationBuffer.length < this.MAX_ORIENTATION_SAMPLES) {
            const leftShoulder = normalized[11];
            const rightShoulder = normalized[12];

            if (leftShoulder && rightShoulder) {
                const Z_THRESHOLD = 0.08;
                const diff = rightShoulder.z - leftShoulder.z;
                let weight: number;
                if (this.dominantHand === 'right') {
                    // Diestro grabado desde la derecha (pecho a cámara, brazo izquierdo al frente): 
                    // hombro izq más cerca (z negativo) -> diff > 0 es CORRECTO (1).
                    weight = diff > Z_THRESHOLD ? 1 : (diff < -Z_THRESHOLD ? -1 : 0);
                } else {
                    weight = diff < -Z_THRESHOLD ? 1 : (diff > Z_THRESHOLD ? -1 : 0);
                }
                this.orientationBuffer.push(weight);

                if (this.orientationBuffer.length === this.MAX_ORIENTATION_SAMPLES) {
                    const sum = this.orientationBuffer.reduce((a, b) => a + b, 0);
                    const validSamples = this.orientationBuffer.filter(v => v !== 0).length;
                    if (sum < -Math.floor(this.MAX_ORIENTATION_SAMPLES / 2) && validSamples > this.MAX_ORIENTATION_SAMPLES * 0.6) {
                        this.detectedPoorOrientation = true;
                    }
                }
            }
        }

        // 3. Empujar Máquina de Estados
        const oldPhase = this.tracker.getPhase();
        const currentPhase = this.tracker.update(currentMetrics, timestampMs);

        // 4. Capturar Momentos Clave "Snapshot"
        this.captureKeyframes(oldPhase, currentPhase, currentMetrics, smoothed, timestampMs, snapshotUrl);

        this.previousMetrics = currentMetrics;
        this.previousLandmarks = smoothed.map(p => ({ ...p }));
        this.previousTimestampMs = timestampMs;
        this.previousSnapshotUrl = snapshotUrl;

        return {
            timestampMs,
            phase: currentPhase,
            metrics: currentMetrics,
            landmarks: smoothed,
            snapshotUrl,
            poorOrientation: this.detectedPoorOrientation
        };
    }

    private captureKeyframes(oldPhase: ServePhase, newPhase: ServePhase, metrics: ServeMetrics, landmarks: PoseLandmarks, timestamp: number, snapshotUrl?: string) {
        if (oldPhase === ServePhase.IDLE && newPhase === ServePhase.SETUP) {
            this.setupTimestamp = timestamp;
            this.setupLandmarks = JSON.parse(JSON.stringify(landmarks));
            this.setupMetrics = { ...metrics };
            this.setupSnapshot = snapshotUrl;
        }

        if (newPhase === ServePhase.TROPHY && !this.trophyLocked) {
            const currentElbowAngle = metrics.dominantElbowAngle;
            const targetAngle = 90;
            const currentDiff = Math.abs(currentElbowAngle - targetAngle);

            if (currentDiff < this.bestTrophyElbowDiff) {
                this.bestTrophyElbowDiff = currentDiff;
                this.trophyMetrics = { ...metrics };
                this.trophyLandmarks = JSON.parse(JSON.stringify(landmarks));
                this.trophyTimestamp = timestamp;
                this.trophySnapshot = snapshotUrl;
            }
        }

        if (oldPhase === ServePhase.TROPHY && newPhase !== ServePhase.TROPHY) {
            this.trophyLocked = true;
        }

        if ((newPhase === ServePhase.ACCELERATION || newPhase === ServePhase.CONTACT) && !this.impactLocked) {
            const currentExtension = metrics.dominantWristToAnkleDistance;
            if (currentExtension > this.maxImpactExtension) {
                this.maxImpactExtension = currentExtension;
                this.contactMetrics = { ...metrics };
                this.contactLandmarks = JSON.parse(JSON.stringify(landmarks));
                this.contactTimestamp = timestamp;
                this.contactSnapshot = snapshotUrl;
            }

            const extensionDropThreshold = this.maxImpactExtension * 0.97;
            if (this.maxImpactExtension > 0.5 && currentExtension <= extensionDropThreshold) {
                const prevExtension = this.previousMetrics?.dominantWristToAnkleDistance || 0;
                const currentDiff = Math.abs(currentExtension - extensionDropThreshold);
                const prevDiff = Math.abs(prevExtension - extensionDropThreshold);

                if (this.previousMetrics && prevDiff < currentDiff && prevExtension > extensionDropThreshold) {
                    this.contactMetrics = { ...this.previousMetrics };
                    this.contactLandmarks = JSON.parse(JSON.stringify(this.previousLandmarks || []));
                    this.contactTimestamp = this.previousTimestampMs;
                    this.contactSnapshot = this.previousSnapshotUrl;
                } else {
                    this.contactMetrics = { ...metrics };
                    this.contactLandmarks = landmarks.map(p => ({ ...p }));
                    this.contactTimestamp = timestamp;
                    this.contactSnapshot = snapshotUrl;
                }
                this.impactLocked = true;
            }
        }

        if (this.tracker.getPhase() === ServePhase.FOLLOW_THROUGH && !this.finishLocked) {
            const currentCrossDist = metrics.handToOppositeKneeDistance;
            const wasCrossed = this.finishMetrics?.wristCrossedKnee;
            const isCrossed = metrics.wristCrossedKnee;

            // Prioritizamos un frame donde sí cruzó. 
            // Si ya tenemos uno que cruzó, solo lo cambiamos por otro que cruce y tenga mejor distancia.
            // Si no tenemos uno que cruce, lo cambiamos si el nuevo cruza O tiene mejor distancia.
            const shouldUpdate =
                (isCrossed && !wasCrossed) ||
                (isCrossed === !!wasCrossed && currentCrossDist < this.bestFollowThroughDist);

            if (shouldUpdate) {
                this.bestFollowThroughDist = currentCrossDist;
                this.finishTimestamp = timestamp;
                this.finishLandmarks = JSON.parse(JSON.stringify(landmarks));
                this.finishMetrics = JSON.parse(JSON.stringify(metrics));
                this.finishSnapshot = snapshotUrl;
            }
            if (this.tracker.getFramesInPhase() > 45) {
                this.finishLocked = true;
            }
        }

        if (newPhase === ServePhase.FOLLOW_THROUGH) {
            // Priorizamos registrar el frame donde sí hubo cruce para asegurar consistencia en el reporte
            // Una vez que detectamos un cruce en la fase, lo mantenemos como el "estado" de la terminación
            if (!this.followThroughMetrics || (metrics.wristCrossedKnee && !this.followThroughMetrics.wristCrossedKnee)) {
                this.followThroughMetrics = metrics;
            } else if (!this.followThroughMetrics) {
                this.followThroughMetrics = metrics;
            }
        }
    }

    /**
     * Permite abortar el análisis tempranamente si el video parece ser un "falso positivo"
     * o si la calidad es sistemáticamente imposible.
     * Retorna `true` si después de suficientes muestras de TIEMPO (ej. 2 segundos)
     * el ratio de aceptación es extremadamente bajo.
     */
    public shouldAbortProcessing(currentTimestampMs: number): boolean {
        if (this.firstTimestampMs === undefined) {
            return false;
        }

        // Necesitamos al menos 2 segundos continuos de video para dar oportunidad a que el jugador entre en cuadro, especialmente en cámara lenta.
        const elapsedMs = currentTimestampMs - this.firstTimestampMs;
        if (elapsedMs < 2000) {
            return false;
        }

        const acceptRatio = this.acceptedFrames / this.totalFramesReceived;

        // Si el ratio es desastroso (< 25%), cortamos ahora mismo.
        if (acceptRatio < 0.25) {
            console.warn(`[ServeAnalyzer] Abortando proceso temprano! Calidad paupérrima detectada. Frames totales: ${this.totalFramesReceived}, Ratio: ${(acceptRatio * 100).toFixed(1)}%, Elapsed: ${elapsedMs}ms`);
            return true;
        }

        return false;
    }

    public generateFinalReport(): ServeAnalysisReport {
        const acceptRatio = this.totalFramesReceived > 0
            ? this.acceptedFrames / this.totalFramesReceived
            : 0;

        const avgQuality = this.acceptedFrames > 0
            ? this.frameQualitySum / this.acceptedFrames
            : 0;

        // Phase completeness: cuántas fases tienen keyframes
        const phasesDetected = [
            this.setupMetrics,
            this.trophyMetrics,
            this.contactMetrics,
            this.followThroughMetrics
        ].filter(Boolean).length;
        const phaseCompleteness = phasesDetected / 4;

        const confidence = acceptRatio * 0.4 + avgQuality * 0.4 + phaseCompleteness * 0.2;
        const poorQuality = acceptRatio < 0.30;

        console.log(`[ServeAnalyzer] Quality: acceptRatio=${(acceptRatio * 100).toFixed(1)}% (${this.acceptedFrames}/${this.totalFramesReceived}), avgQuality=${(avgQuality * 100).toFixed(1)}%, phases=${phasesDetected}/4, confidence=${(confidence * 100).toFixed(1)}%, poorQuality=${poorQuality}`);

        // ─── Si la calidad es pobre → Reporte en blanco ───
        if (poorQuality) {
            console.warn('[ServeAnalyzer] Video de baja calidad detectado. Generando reporte en blanco para revisión manual.');
            return {
                strokeType: 'SERVE',
                finalScore: 0,
                categoryScores: {
                    preparacion: 0,
                    armado: 0,
                    impacto: 0,
                    terminacion: 0
                },
                detailedMetrics: {
                    footOrientationScore: 0,
                    kneeFlexionScore: 0,
                    trophyPositionScore: 0,
                    heelLiftScore: 0,
                    followThroughScore: 0
                },
                flags: [],
                confidence: Math.max(0, confidence),
                poorQuality: true,
                keyframes: {
                    setup: { timestamp: 0, landmarks: null, phase: ServePhase.SETUP },
                    trophy: { timestamp: 0, landmarks: null, phase: ServePhase.TROPHY },
                    contact: { timestamp: 0, landmarks: null, phase: ServePhase.CONTACT },
                    finish: { timestamp: 0, landmarks: null, phase: ServePhase.FOLLOW_THROUGH },
                },
                heelBaselineY: this.heelBaselineY
            };
        }

        // ─── Flujo normal: calidad suficiente ───
        if (!this.trophyMetrics && !this.contactMetrics) {
            throw new MislabeledVideoError("El movimiento analizado no presenta las características biomecánicas mínimas de un saque (ni armado ni impacto detectados).");
        }

        const evaluation = evaluateServeRules(
            this.setupMetrics,
            this.trophyMetrics,
            this.contactMetrics,
            this.followThroughMetrics,
            this.heelBaselineY
        );

        return {
            strokeType: 'SERVE',
            finalScore: evaluation.finalScore,
            categoryScores: evaluation.categoryScores,
            detailedMetrics: evaluation.detailedMetrics,
            flags: evaluation.flags,
            confidence: Math.max(0, confidence),
            poorQuality: false,
            keyframes: {
                setup: {
                    timestamp: this.setupTimestamp || 0,
                    landmarks: this.setupLandmarks,
                    metrics: this.setupMetrics,
                    phase: ServePhase.SETUP,
                    snapshotUrl: this.setupSnapshot
                },
                trophy: {
                    timestamp: this.trophyTimestamp || 0,
                    landmarks: this.trophyLandmarks,
                    metrics: this.trophyMetrics,
                    phase: ServePhase.TROPHY,
                    snapshotUrl: this.trophySnapshot
                },
                contact: {
                    timestamp: this.contactTimestamp || 0,
                    landmarks: this.contactLandmarks,
                    metrics: this.contactMetrics,
                    phase: ServePhase.CONTACT,
                    snapshotUrl: this.contactSnapshot
                },
                finish: {
                    timestamp: this.finishTimestamp || 0,
                    landmarks: this.finishLandmarks,
                    metrics: this.finishMetrics,
                    phase: ServePhase.FOLLOW_THROUGH,
                    snapshotUrl: this.finishSnapshot
                },
            },
            heelBaselineY: this.heelBaselineY
        };
    }
}
