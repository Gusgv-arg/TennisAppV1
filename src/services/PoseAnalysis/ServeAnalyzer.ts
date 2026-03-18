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
    private setupLandmarks: PoseLandmarks | null = null;
    private setupTimestamp: number | undefined;

    private trophyMetrics: ServeMetrics | null = null;
    private trophyLandmarks: PoseLandmarks | null = null;
    private trophyTimestamp: number | undefined;
    private maxTossArmElevation: number = -1;
    private trophyLocked: boolean = false;

    private contactMetrics: ServeMetrics | null = null;
    private contactLandmarks: PoseLandmarks | null = null;
    private contactTimestamp: number | undefined;
    private maxImpactExtension: number = -1;
    private impactLocked: boolean = false;

    // Rastrear el mejor candidato para Armado durante toda la fase
    private bestTrophyElbowDiff: number = Infinity;

    private followThroughMetrics: ServeMetrics | null = null;
    private finishTimestamp: number | undefined;

    // Historial temporal para calcular derivadas (velocidades)
    private previousMetrics: ServeMetrics | null = null;
    private previousLandmarks: PoseLandmarks | null = null;
    private previousTimestampMs: number | undefined;

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
        this.setupLandmarks = null;
        this.setupTimestamp = undefined;
        this.trophyMetrics = null;
        this.trophyLandmarks = null;
        this.trophyTimestamp = undefined;
        this.contactMetrics = null;
        this.contactLandmarks = null;
        this.contactTimestamp = undefined;
        this.followThroughMetrics = null;
        this.finishTimestamp = undefined;
        this.previousMetrics = null;
        this.previousLandmarks = null;
        this.previousTimestampMs = undefined;
        this.orientationBuffer = [];
        this.detectedPoorOrientation = false;
        this.maxTossArmElevation = -1;
        this.trophyLocked = false;
        this.maxImpactExtension = -1;
        this.impactLocked = false;
        this.bestTrophyElbowDiff = Infinity;

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
        const preprocessed = preprocessFrame(rawLandmarks);
        if (!preprocessed) {
            // Frame descartado por baja visibilidad
            return {
                timestampMs,
                phase: this.tracker.getPhase(),
                metrics: null,
                landmarks: null
            };
        }

        const { normalized, smoothed } = preprocessed;

        // 2. Extraer Física (Métricas v2)
        const currentMetrics = extractMetrics(normalized, this.dominantHand);

        // 2.5 Calibrar Heel Baseline con los primeros frames (IDLE o SETUP)
        // Eliminamos la restricción estricta de IDLE para captar el piso aunque el video empiece con movimiento
        const phaseBeforeUpdate = this.tracker.getPhase();
        const isSteadyPhase = (phaseBeforeUpdate === ServePhase.IDLE || phaseBeforeUpdate === ServePhase.SETUP);

        if (isSteadyPhase && this.heelBaselineSamples < this.HEEL_BASELINE_FRAMES) {
            this.heelBaselineAccum += currentMetrics.heelLiftDelta;
            this.heelBaselineSamples++;
            if (this.heelBaselineSamples === this.HEEL_BASELINE_FRAMES) {
                this.heelBaselineY = this.heelBaselineAccum / this.HEEL_BASELINE_FRAMES;
                console.log(`[ServeAnalyzer] Baseline Calibrado: Y=${this.heelBaselineY.toFixed(4)} (Fase: ${phaseBeforeUpdate})`);
            }
        }

        // 2.6 Detección Temprana de Orientación (Knockout en ~0.5s)
        // Lógica: En un video de perfil, la cámara está del lado del brazo dominante.
        // Para un diestro filmado correctamente: el hombro derecho (12) está MÁS CERCA de la cámara,
        // lo que significa que tiene un Z más negativo (sale "hacia" la cámara).
        // Si el hombro dominante tiene Z mucho más positivo que el otro, la cámara está del lado incorrecto.
        if (!this.skipOrientationCheck && this.orientationBuffer.length < this.MAX_ORIENTATION_SAMPLES) {
            const leftShoulder = normalized[11];
            const rightShoulder = normalized[12];

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
        this.captureKeyframes(oldPhase, currentPhase, currentMetrics, smoothed, timestampMs);

        this.previousMetrics = currentMetrics;
        this.previousLandmarks = smoothed.map(p => ({ ...p })); // Clonado preventivo para Look-back
        this.previousTimestampMs = timestampMs;

        return {
            timestampMs,
            phase: currentPhase,
            metrics: currentMetrics,
            landmarks: smoothed,
            poorOrientation: this.detectedPoorOrientation
        };
    }

    /**
     * Examina si hubo un cambio de fase recién y se guarda la "foto" biométrica de ese instante.
     */
    private captureKeyframes(oldPhase: ServePhase, newPhase: ServePhase, metrics: ServeMetrics, landmarks: PoseLandmarks, timestamp: number) {
        // [AUDITORIA] Log frame-a-frame solicitado por el usuario para debug de precisión
        console.log(`[FRAME] t=${timestamp}ms | Codo=${metrics.dominantElbowAngle.toFixed(1)}° | Elev=${metrics.armElevationAngle.toFixed(1)}° | Fase=${newPhase}`);

        // AL INICIAR EL MOVIMIENTO (IDLE -> SETUP):
        // Capturamos el estado inicial de "Preparación"
        if (oldPhase === ServePhase.IDLE && newPhase === ServePhase.SETUP) {
            this.setupTimestamp = timestamp;
            this.setupLandmarks = landmarks;
            this.setupMetrics = { ...metrics };
            this.maxTossArmElevation = -1;
            this.trophyLocked = false;
            this.maxImpactExtension = -1;
            this.impactLocked = false;
            console.log(`[ServeAnalyzer] snapshot PREPARACIÓN (Inicio): t=${this.setupTimestamp}ms`);
        }

        // Al entrar en TROPHY, significa que la preparación terminó. 
        if (oldPhase === ServePhase.SETUP && newPhase === ServePhase.TROPHY) {
            console.log(`[ServeAnalyzer] fin PREPARACIÓN y comienzo ARMADO: t=${timestamp}ms`);
            
            // Garantizar que el baseline esté calibrado aunque la preparación haya sido corta
            if (this.heelBaselineY === undefined && this.heelBaselineSamples > 0) {
                this.heelBaselineY = this.heelBaselineAccum / this.heelBaselineSamples;
                console.log(`[ServeAnalyzer] Baseline forzado al terminar SETUP: Y=${this.heelBaselineY.toFixed(4)} (Samples: ${this.heelBaselineSamples})`);
            }
        }

        // BUSQUEDA DE POSICIÓN DE TROFEO (ARMADO): 
        // Nuevo gatillo: Buscamos el momento exacto en que el codo dominante cruza los 90°.
        if (newPhase === ServePhase.TROPHY && !this.trophyLocked) {
            const currentElbowAngle = metrics.dominantElbowAngle;
            const targetAngle = 90;
            const currentDiff = Math.abs(currentElbowAngle - targetAngle);

            // 1. RASTREO CONTINUO (Best candidate so far during the phase)
            // Esto asegura que siempre tengamos el "mejor esfuerzo" si nunca llega a 90°
            if (currentDiff < this.bestTrophyElbowDiff) {
                this.bestTrophyElbowDiff = currentDiff;
                this.trophyMetrics = { ...metrics };
                this.trophyLandmarks = landmarks.map(p => ({ ...p }));
                this.trophyTimestamp = timestamp;
            }

            // 2. GATILLO DE CRUCE DE REFERENCIA (Locking behavior)
            if (currentElbowAngle <= targetAngle) {
                const prevElbowAngle = this.previousMetrics?.dominantElbowAngle || 180;
                const prevDiff = Math.abs(prevElbowAngle - targetAngle);

                // Ecuación "Best-Fit": comparamos con el snap anterior
                if (this.previousMetrics && prevDiff < currentDiff && prevElbowAngle > targetAngle) {
                    console.log(`[MATH] 🎯 DISPARO ARMADO (Best-Fit Anterior)`);
                    this.trophyMetrics = { ...this.previousMetrics };
                    this.trophyLandmarks = this.previousLandmarks?.map(p => ({ ...p })) || [];
                    this.trophyTimestamp = this.previousTimestampMs;
                } else {
                    console.log(`[MATH] 🎯 DISPARO ARMADO (Best-Fit Actual)`);
                }
                
                // Formato de log solicitado por el usuario
                console.log(`-Angulo del codo: ${currentElbowAngle.toFixed(1)}°`);
                console.log(`-Referencia: 90°`);
                console.log(`-Angulo del snap: ${this.trophyMetrics?.dominantElbowAngle.toFixed(1)}°`);

                this.trophyLocked = true; 
            }
        }

        // BLOQUEO (LOCK) DE ARMADO: Cerramos la búsqueda cuando el jugador empieza a acelerar.
        if (oldPhase === ServePhase.TROPHY && newPhase === ServePhase.ACCELERATION) {
            this.trophyLocked = true;
            
            if (this.trophyLandmarks) {
                const snapWrist = this.trophyLandmarks![this.dominantHand === 'right' ? Landmark.RIGHT_WRIST : Landmark.LEFT_WRIST];
                console.log(`[MATH] Snapshot Final Armado BLOQUEADO (@${this.trophyTimestamp}ms): Wrist(${snapWrist?.x.toFixed(3)},${snapWrist?.y.toFixed(3)})`);
            }
        }

        // Al entrar en aceleración, confirmamos el snapshot final con el formato pedido por el usuario
        if (oldPhase === ServePhase.TROPHY && newPhase === ServePhase.ACCELERATION) {
            console.log(`--------------------------------------------------`);
            console.log(`[ServeAnalyzer] ✅ SNAPSHOT ARMADO (TROPHY) FINALIZADO`);
            console.log(`> Codo Dominante en snap: ${this.trophyMetrics?.dominantElbowAngle.toFixed(1)}° (Objetivo: 90°)`);
            console.log(`> Timestamp del snap: ${this.trophyTimestamp}ms`);
            console.log(`> Otras métricas en snap: FlexRodi=${this.trophyMetrics?.frontKneeFlexionAngle.toFixed(1)}°, Alineac=${this.trophyMetrics?.trophyAlignmentAngle.toFixed(1)}°`);
            console.log(`--------------------------------------------------`);
        }

        // BUSQUEDA DE IMPACTO: 
        // Monitoreamos la extensión máxima (Tobillo opuesto -> Muñeca dom)
        // El disparo es al detectar una caída del 5% del pico de extensión.
        if ((newPhase === ServePhase.ACCELERATION || newPhase === ServePhase.CONTACT) && !this.impactLocked) {
            const currentExtension = metrics.impactExtensionDistance;
            
            // Log frame-by-frame as requested by the user
            console.log(`[MATH] Impact Tracking | t=${timestamp}ms | Ext: ${currentExtension.toFixed(3)} | Pico: ${this.maxImpactExtension.toFixed(3)}`);

            // 1. RASTREO DE PICO DE EXTENSIÓN
            if (currentExtension > this.maxImpactExtension) {
                this.maxImpactExtension = currentExtension;
                // Backup provisional del pico
                this.contactMetrics = { ...metrics };
                this.contactLandmarks = landmarks.map(p => ({ ...p }));
                this.contactTimestamp = timestamp;
            }

            // 2. DISPARADOR POR CAÍDA DEL 3% (Ajustado a la baja para evitar retraso)
            const extensionDropThreshold = this.maxImpactExtension * 0.97;
            if (this.maxImpactExtension > 0.5 && currentExtension <= extensionDropThreshold) {
                // Ecuación "Best-Fit": ¿Era mejor el frame anterior?
                const prevExtension = this.previousMetrics?.impactExtensionDistance || 0;
                const currentDiff = Math.abs(currentExtension - extensionDropThreshold);
                const prevDiff = Math.abs(prevExtension - extensionDropThreshold);

                if (this.previousMetrics && prevDiff < currentDiff && prevExtension > extensionDropThreshold) {
                    console.log(`[MATH] 🎯 DISPARO IMPACTO (Best-Fit Anterior) | Umbral: ${extensionDropThreshold.toFixed(3)} | Prev: ${prevExtension.toFixed(3)} (Diff: ${prevDiff.toFixed(3)}) | Actual: ${currentExtension.toFixed(3)} (Diff: ${currentDiff.toFixed(3)}) | t=${this.previousTimestampMs}ms`);
                    this.contactMetrics = { ...this.previousMetrics };
                    this.contactLandmarks = this.previousLandmarks?.map(p => ({ ...p })) || [];
                    this.contactTimestamp = this.previousTimestampMs;
                } else {
                    console.log(`[MATH] 🎯 DISPARO IMPACTO (Best-Fit Actual) | Umbral: ${extensionDropThreshold.toFixed(3)} | Actual: ${currentExtension.toFixed(3)} (Diff: ${currentDiff.toFixed(3)}) | t=${timestamp}ms`);
                    this.contactMetrics = { ...metrics };
                    this.contactLandmarks = landmarks.map(p => ({ ...p }));
                    this.contactTimestamp = timestamp;
                }
                
                // Auditoría final del punto de impacto elegido para el reporte
                const wrist = this.contactLandmarks![this.dominantHand === 'right' ? Landmark.RIGHT_WRIST : Landmark.LEFT_WRIST];
                console.log(`[MATH] Snapshot Final Impacto (@${this.contactTimestamp}ms): Wrist X=${wrist?.x.toFixed(4)}, Y=${wrist?.y.toFixed(4)}`);
                
                this.impactLocked = true;
            }
        }

        // Justo al cruzar al Follow Through → capturamos el impacto (Solo si no se bloqueó dinámicamente)
        if (oldPhase === ServePhase.CONTACT && newPhase === ServePhase.FOLLOW_THROUGH && !this.impactLocked) {
             this.contactMetrics = { ...metrics };
             this.contactLandmarks = landmarks.map(p => ({ ...p }));
             this.contactTimestamp = timestamp;
             console.log(`[ServeAnalyzer] snapshot IMPACTO (Fallback Transición): t=${timestamp}ms`);
        }

        // Si terminó el Follow Through a nivel inercia
        if (newPhase === ServePhase.FOLLOW_THROUGH) {
            // Actualizamos constantemente el Follow Through hasta que termine
            this.followThroughMetrics = metrics;
            // Guardamos el último frame como el punto de "Terminación" de la técnica
            this.finishTimestamp = timestamp;
        }
    }

    /**
     * Emite el reporte de técnica consultándole al Juez (Rules Engine).
     * Se llama cuando el video terminó de procesarse 100%.
     */
    public generateFinalReport(): ServeAnalysisReport {
        console.log(`[ServeAnalyzer] Generando Reporte Final...`);
        console.log(`[ServeAnalyzer] Timestamps: Setup=${this.setupTimestamp}, Trophy=${this.trophyTimestamp}, Contact=${this.contactTimestamp}, Finish=${this.finishTimestamp}`);
        
        // RELAXED GUARDRAIL: Solo abortamos si falta ABSOLUTAMENTE TODO.
        // Si al menos tenemos un impacto, entregamos el reporte como "Best Effort".
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
            finalScore: evaluation.finalScore,
            categoryScores: evaluation.categoryScores,
            detailedMetrics: evaluation.detailedMetrics,
            flags: evaluation.flags,
            confidence: Math.max(0, confidence),
            keyframes: {
                setup: { timestamp: this.setupTimestamp || 0, landmarks: this.setupLandmarks },
                trophy: { timestamp: this.trophyTimestamp || 0, landmarks: this.trophyLandmarks },
                contact: { timestamp: this.contactTimestamp || 0, landmarks: this.contactLandmarks },
                finish: { timestamp: this.finishTimestamp || 0, landmarks: null }
            },
        };
    }
}
