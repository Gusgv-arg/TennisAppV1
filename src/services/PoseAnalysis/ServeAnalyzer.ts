import { extractMetrics } from './metrics';
import { PhaseTracker } from './phaseTracker';
import { preprocessFrame, resetPreprocessEMA, resetGateDiagnostics, getGateDiagnostics } from './preprocess';
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
 * Error de dominio para abortar análisis por calidad insuficiente.
 * Diferente de MislabeledVideoError: aquí sí hay un golpe pero no se puede analizar con fiabilidad.
 */
export class PoorQualityAbortError extends Error {
    public readonly reason: 'low_accept_ratio' | 'phase_stagnation' | 'skeleton_inconsistent' | 'orientation_wrong';
    constructor(message: string, reason: PoorQualityAbortError['reason']) {
        super(message);
        this.name = 'PoorQualityAbortError';
        this.reason = reason;
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

    // ─── Multi-Signal Orientation Detection ───
    private orientationSignals: {
        zDepth: number[];      // Señal 1: diff Z entre hombros
        shoulderRatio: number[]; // Señal 2: ratio ancho hombros / ancho caderas
        visibilityAsym: number[]; // Señal 3: asimetría de visibilidad brazos
    } = { zDepth: [], shoulderRatio: [], visibilityAsym: [] };
    private readonly MAX_ORIENTATION_SAMPLES = 25; // ~0.8s a 30fps para más certeza (antes 15)

    // ─── Quality Tracking ───
    private totalFramesReceived: number = 0;
    private acceptedFrames: number = 0;
    private frameQualitySum: number = 0;
    private firstTimestampMs: number | undefined;

    // ─── Abort Intelligence ───
    private consecutiveRejectedFrames: number = 0;
    private maxConsecutiveRejected: number = 0;
    private lastPhaseChangeTimestampMs: number | undefined;

    // ─── Skeleton Consistency Tracking ───
    private torsoCenters: { x: number, y: number }[] = [];
    private readonly TORSO_VARIANCE_WINDOW = 30; // últimos 30 frames aceptados

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
        resetGateDiagnostics();
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


        this.finishLandmarks = null;
        this.finishMetrics = null;
        this.finishTimestamp = 0;
        this.finishSnapshot = undefined;

        this.previousMetrics = null;
        this.previousLandmarks = null;
        this.previousTimestampMs = undefined;
        this.previousSnapshotUrl = undefined;

        this.orientationSignals = { zDepth: [], shoulderRatio: [], visibilityAsym: [] };
        this.detectedPoorOrientation = false;
        this.maxTossArmElevation = -1;
        this.trophyLocked = false;
        this.maxImpactExtension = -1;
        this.impactLocked = false;
        this.bestTrophyElbowDiff = Infinity;
        this.bestFollowThroughDist = Infinity;
        this.finishLocked = false;

        this.heelBaselineY = undefined;
        this.heelBaselineSamples = 0;
        this.heelBaselineAccum = 0;

        this.totalFramesReceived = 0;
        this.acceptedFrames = 0;
        this.frameQualitySum = 0;
        this.firstTimestampMs = undefined;

        this.consecutiveRejectedFrames = 0;
        this.maxConsecutiveRejected = 0;
        this.lastPhaseChangeTimestampMs = undefined;

        this.torsoCenters = [];
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
            // Frame descartado por baja visibilidad, tamaño, outlier cinemático, anatomía imposible, o salto de torso
            this.consecutiveRejectedFrames++;
            if (this.consecutiveRejectedFrames > this.maxConsecutiveRejected) {
                this.maxConsecutiveRejected = this.consecutiveRejectedFrames;
            }
            return {
                timestampMs,
                phase: this.tracker.getPhase(),
                metrics: null,
                landmarks: null
            };
        }

        // Frame aceptado: reset del contador consecutivo
        this.consecutiveRejectedFrames = 0;

        const { normalized, smoothed, frameQuality } = preprocessed;

        // Tracking de calidad: contar frame aceptado y acumular calidad
        this.acceptedFrames++;
        this.frameQualitySum += frameQuality;

        // Track torso center for skeleton consistency
        this.trackTorsoCenter(normalized);

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

        // 2.6 Detección Multi-Signal de Orientación
        if (!this.skipOrientationCheck && this.orientationSignals.zDepth.length < this.MAX_ORIENTATION_SAMPLES) {
            this.collectOrientationSignal(normalized);
        }

        // 3. Empujar Máquina de Estados
        const oldPhase = this.tracker.getPhase();
        const currentPhase = this.tracker.update(currentMetrics, timestampMs);

        // Track phase changes for stagnation detection
        if (oldPhase !== currentPhase) {
            this.lastPhaseChangeTimestampMs = timestampMs;
        }

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

    /**
     * Recolecta señales multi-modal para determinar la orientación del video.
     * Combina 3 señales independientes para mayor robustez:
     * 1. Diferencia Z entre hombros (profundidad)
     * 2. Ratio ancho hombros / ancho caderas (compresión por perspectiva)
     * 3. Asimetría de visibilidad entre brazos (brazo lejano oculto)
     */
    private collectOrientationSignal(landmarks: PoseLandmarks) {
        const leftShoulder = landmarks[11]; // LEFT_SHOULDER
        const rightShoulder = landmarks[12]; // RIGHT_SHOULDER
        const leftHip = landmarks[23]; // LEFT_HIP
        const rightHip = landmarks[24]; // RIGHT_HIP
        const leftWrist = landmarks[15]; // LEFT_WRIST
        const rightWrist = landmarks[16]; // RIGHT_WRIST

        if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) return;

        // ─── Signal 1: Z-Depth Difference ───
        // MediaPipe Z: negative = closer to camera.
        // For a right-handed player filmed from their RIGHT side (correct):
        //   - Right shoulder is CLOSER to camera → rightZ more negative → zDiff < 0
        //   - This is the CORRECT orientation, so negative zDiff = vote GOOD (+1)
        // For a right-handed player filmed from their LEFT side (incorrect):
        //   - Left shoulder is CLOSER → leftZ more negative → zDiff > 0
        //   - This is INCORRECT, so positive zDiff = vote BAD (-1)
        const Z_THRESHOLD = 0.08;
        const zDiff = rightShoulder.z - leftShoulder.z;
        let zVote: number;
        if (this.dominantHand === 'right') {
            // Correct: right shoulder closer (zDiff < 0). Incorrect: left shoulder closer (zDiff > 0).
            zVote = zDiff < -Z_THRESHOLD ? 1 : (zDiff > Z_THRESHOLD ? -1 : 0);
        } else {
            // Correct for lefty: left shoulder closer (zDiff > 0). Incorrect: right shoulder closer (zDiff < 0).
            zVote = zDiff > Z_THRESHOLD ? 1 : (zDiff < -Z_THRESHOLD ? -1 : 0);
        }
        this.orientationSignals.zDepth.push(zVote);

        // ─── Signal 2: Shoulder-to-Hip Width Ratio ───
        // En perfil, uno de los ejes se comprime. Si el ratio difiere mucho de 1.0,
        // la persona está de perfil. Esto NO indica si el perfil es correcto o incorrecto.
        const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);
        const hipWidth = Math.abs(rightHip.x - leftHip.x);
        // En vista frontal, shoulderWidth y hipWidth son relativamente similares.
        // En perfil, ambos se comprimen pero shoulders más (cambia la rotación de la persona).
        // Un ratio < 0.7 o > 1.4 sugiere perfil fuerte.
        const widthRatio = hipWidth > 0.01 ? shoulderWidth / hipWidth : 1.0;
        this.orientationSignals.shoulderRatio.push(widthRatio);

        // ─── Signal 3: Visibility Asymmetry ───
        // When filmed from the correct side, the DOMINANT arm/wrist is closer to camera
        // and should have HIGHER visibility. The non-dominant arm is further and occluded.
        // For right-handed filmed from right: right wrist MORE visible → CORRECT
        if (leftWrist && rightWrist) {
            const leftVis = leftWrist.visibility ?? 0;
            const rightVis = rightWrist.visibility ?? 0;
            let visVote: number;
            if (this.dominantHand === 'right') {
                // Correct: rightWrist more visible (dominant arm closer to camera)
                visVote = (rightVis - leftVis) > 0.15 ? 1 : ((leftVis - rightVis) > 0.15 ? -1 : 0);
            } else {
                visVote = (leftVis - rightVis) > 0.15 ? 1 : ((rightVis - leftVis) > 0.15 ? -1 : 0);
            }
            this.orientationSignals.visibilityAsym.push(visVote);
        }

        // ─── Evaluate when we have enough samples ───
        if (this.orientationSignals.zDepth.length === this.MAX_ORIENTATION_SAMPLES) {
            this.evaluateOrientationMultiSignal();
        }
    }

    /**
     * Evalúa las 3 señales de orientación con voto de mayoría ponderado.
     * Aborta directamente si la orientación es claramente incorrecta.
     */
    private evaluateOrientationMultiSignal() {
        // Signal 1: Z-Depth vote
        const zSum = this.orientationSignals.zDepth.reduce((a, b) => a + b, 0);
        const zValidSamples = this.orientationSignals.zDepth.filter(v => v !== 0).length;
        const zScore = zValidSamples > this.MAX_ORIENTATION_SAMPLES * 0.4
            ? (zSum < -Math.floor(this.MAX_ORIENTATION_SAMPLES / 3) ? -1 : (zSum > Math.floor(this.MAX_ORIENTATION_SAMPLES / 3) ? 1 : 0))
            : 0; // Inconcluso si muy pocos votos válidos

        // Signal 2: Shoulder ratio (solo indica si es perfil, no si es correcto)
        const avgRatio = this.orientationSignals.shoulderRatio.reduce((a, b) => a + b, 0) / this.orientationSignals.shoulderRatio.length;
        const isStrongProfile = avgRatio < 0.75 || avgRatio > 1.3;

        // Signal 3: Visibility asymmetry vote
        const visSum = this.orientationSignals.visibilityAsym.reduce((a, b) => a + b, 0);
        const visValidSamples = this.orientationSignals.visibilityAsym.filter(v => v !== 0).length;
        const visScore = visValidSamples > this.MAX_ORIENTATION_SAMPLES * 0.3
            ? (visSum < -Math.floor(this.MAX_ORIENTATION_SAMPLES / 4) ? -1 : (visSum > Math.floor(this.MAX_ORIENTATION_SAMPLES / 4) ? 1 : 0))
            : 0;

        // ─── Weighted Majority Vote ───
        // Z-depth peso 0.4, Visibility peso 0.4, Profile detection peso 0.2
        const weightedScore = zScore * 0.4 + visScore * 0.4;

        // Condición de abort: score negativo Y al menos una señal es claramente negativa
        // Y no estamos en un perfil ambiguo (frontal)
        const isOrientationBad = weightedScore < -0.3 && (zScore === -1 || visScore === -1);

        if (isOrientationBad) {
            this.detectedPoorOrientation = true;
            console.warn(`[ServeAnalyzer] Orientación incorrecta detectada. Z-score=${zScore}, Vis-score=${visScore}, AvgRatio=${avgRatio.toFixed(2)}, StrongProfile=${isStrongProfile}`);
        } else {
            console.log(`[ServeAnalyzer] Orientación OK. Z-score=${zScore}, Vis-score=${visScore}, AvgRatio=${avgRatio.toFixed(2)}`);
        }
    }

    /**
     * Trackea el centro del torso para calcular varianza (skeleton consistency).
     */
    private trackTorsoCenter(landmarks: PoseLandmarks) {
        const ls = landmarks[11]; // LEFT_SHOULDER
        const rs = landmarks[12]; // RIGHT_SHOULDER
        const lh = landmarks[23]; // LEFT_HIP
        const rh = landmarks[24]; // RIGHT_HIP

        if (ls && rs && lh && rh) {
            const center = {
                x: (ls.x + rs.x + lh.x + rh.x) / 4,
                y: (ls.y + rs.y + lh.y + rh.y) / 4
            };
            this.torsoCenters.push(center);
            if (this.torsoCenters.length > this.TORSO_VARIANCE_WINDOW) {
                this.torsoCenters.shift();
            }
        }
    }

    /**
     * Calcula la desviación estándar del centro del torso.
     * Alta varianza = el modelo cambia constantemente (no hay tracking estable).
     */
    private getTorsoCenterVariance(): number {
        if (this.torsoCenters.length < 10) return 0;

        const meanX = this.torsoCenters.reduce((s, c) => s + c.x, 0) / this.torsoCenters.length;
        const meanY = this.torsoCenters.reduce((s, c) => s + c.y, 0) / this.torsoCenters.length;

        const variance = this.torsoCenters.reduce((s, c) => {
            const dx = c.x - meanX;
            const dy = c.y - meanY;
            return s + dx * dx + dy * dy;
        }, 0) / this.torsoCenters.length;

        return Math.sqrt(variance); // Desviación estándar
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

            // Una vez que detectamos cruce, lo lockeamos como definitivo
            // (user request: si se detecta que cruza, eso es inamovible)
            if (isCrossed && this.finishMetrics?.wristCrossedKnee) {
                this.finishLocked = true;
            }

            if (this.tracker.getFramesInPhase() > 45) {
                this.finishLocked = true;
            }
        }
    }

    /**
     * Sistema de abort inteligente multi-criterio.
     * Retorna un motivo de abort o null si el análisis debe continuar.
     */
    public shouldAbortProcessing(currentTimestampMs: number): { abort: boolean, reason?: PoorQualityAbortError['reason'], message?: string } {
        if (this.firstTimestampMs === undefined) {
            return { abort: false };
        }

        const elapsedMs = currentTimestampMs - this.firstTimestampMs;

        // ─── Criterio 1: Accept Ratio muy bajo (< 30%) después de 2s ───
        if (elapsedMs > 2000) {
            const acceptRatio = this.acceptedFrames / this.totalFramesReceived;
            if (acceptRatio < 0.30) {
                const gateDiag = getGateDiagnostics();
                console.warn(`[ServeAnalyzer] Abort: Accept ratio ${(acceptRatio * 100).toFixed(1)}% < 30% after ${elapsedMs}ms. Gate rejections:`, gateDiag);
                return {
                    abort: true,
                    reason: 'low_accept_ratio',
                    message: `La IA no pudo identificar el cuerpo del jugador con suficiente fiabilidad (solo ${Math.round(acceptRatio * 100)}% de los frames fueron procesables). Intenta filmar más cerca y con mejor iluminación.`
                };
            }
        }

        // ─── Criterio 2: Fase estancada en IDLE > 4s ───
        if (elapsedMs > 4000 && this.tracker.getPhase() === ServePhase.IDLE) {
            console.warn(`[ServeAnalyzer] Abort: Still in IDLE after ${elapsedMs}ms`);
            return {
                abort: true,
                reason: 'phase_stagnation',
                message: 'No se detectó movimiento de saque en los primeros 4 segundos del video. Verifica que el video contiene el golpe esperado.'
            };
        }

        // ─── Criterio 3: Orientación ───
        // NOTA: La orientación basada en Z monocular es inherentemente ruidosa.
        // Se mantiene como WARNING solamente (no abort) para evitar falsos positivos.
        // La flag poorOrientation se incluye en el reporte final para que la UI la muestre.

        // ─── Criterio 4: Skeleton inconsistente ───
        // DESHABILITADO: La varianza global del torso NO es un buen indicador para saques.
        // Durante CONTACT → FOLLOW_THROUGH el jugador rota 90-180°, produciendo varianzas
        // legítimas de 0.4+. El Gate 6 (salto frame-a-frame del torso en preprocess.ts)
        // ya cubre el caso de detección de otra persona o salto a otro cuerpo.
        // La varianza del torso se loguea como diagnóstico pero NO aborta.
        if (elapsedMs > 3000 && this.torsoCenters.length >= 10) {
            const torsoVariance = this.getTorsoCenterVariance();
            if (torsoVariance > 0.30) {
                console.log(`[ServeAnalyzer] Info: High torso variance (${torsoVariance.toFixed(3)}) — normal for serve motion, NOT aborting.`);
            }
        }

        return { abort: false };
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
            this.finishMetrics
        ].filter(Boolean).length;
        const phaseCompleteness = phasesDetected / 4;

        // ─── Confidence Score ───
        // Fórmula simplificada: basada en datos concretos sin penalizaciones especulativas.
        // acceptRatio y phaseCompleteness son los indicadores más fiables.
        let confidence = acceptRatio * 0.35 + avgQuality * 0.25 + phaseCompleteness * 0.35;

        // Penalización leve por gaps consecutivos muy largos (> 50 frames = ~1.7s sin cuerpo)
        // Esto captura videos donde hay secciones significativas sin detección
        if (this.maxConsecutiveRejected > 50) {
            const gapPenalty = Math.min(0.10, (this.maxConsecutiveRejected - 50) * 0.002);
            confidence -= gapPenalty;
        }

        // NOTA: NO penalizamos por torso variance. Durante un saque, el jugador
        // salta 30-50cm, rota 90-180° y se inclina hacia adelante. Una varianza
        // de 5+ es completamente normal y NO indica mala calidad.

        confidence = Math.max(0, Math.min(1, confidence));

        // ─── Confidence Guard ───
        // poorQuality solo si: aceptamos muy pocos frames O la confianza general es muy baja
        const poorQuality = acceptRatio < 0.30 || confidence < 0.35;

        const torsoVariance = this.getTorsoCenterVariance();
        console.log(`[ServeAnalyzer] Quality: acceptRatio=${(acceptRatio * 100).toFixed(1)}% (${this.acceptedFrames}/${this.totalFramesReceived}), avgQuality=${(avgQuality * 100).toFixed(1)}%, phases=${phasesDetected}/4, confidence=${(confidence * 100).toFixed(1)}%, maxGap=${this.maxConsecutiveRejected}, torsoVar=${torsoVariance.toFixed(3)}, poorQuality=${poorQuality}`);
        console.log(`[ServeAnalyzer] Gate rejections:`, getGateDiagnostics());

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
            this.finishMetrics,   // UNIFICADO: mismo objeto que el keyframe snapshot
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
