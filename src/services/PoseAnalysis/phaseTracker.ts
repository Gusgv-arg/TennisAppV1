import { ServeMetrics, ServePhase } from './types';

// Opciones heurísticas para la máquina de estados
const PHASE_CONFIG = {
    // Timeout para volver a IDLE si se queda frisado a mitad de movimiento (Ms)
    TIMEOUT_MS: 3000
};

/**
 * Buffer circular para confirmación de transiciones.
 * Requiere que una mayoría de frames recientes cumplan la condición
 * antes de aceptar un cambio de fase — elimina transiciones espurias por ruido.
 */
interface TransitionBuffer {
    votes: boolean[];
    size: number;
    requiredMajority: number;
}

function createTransitionBuffer(size: number = 5, requiredMajority: number = 3): TransitionBuffer {
    return { votes: [], size, requiredMajority };
}

function pushVote(buffer: TransitionBuffer, vote: boolean): boolean {
    buffer.votes.push(vote);
    if (buffer.votes.length > buffer.size) {
        buffer.votes.shift();
    }
    // Solo confirmar si tenemos suficientes votos Y la mayoría cumple
    if (buffer.votes.length < buffer.requiredMajority) return false;
    const yesVotes = buffer.votes.filter(v => v).length;
    return yesVotes >= buffer.requiredMajority;
}

function resetBuffer(buffer: TransitionBuffer) {
    buffer.votes = [];
}

export class PhaseTracker {
    private currentPhase: ServePhase = ServePhase.IDLE;
    private framesInCurrentPhase: number = 0;
    private lastTimestamp: number = 0;
    private maxArmElevation: number = 0;
    private minElbowFlexionReached: boolean = false;

    // ─── Buffers de Confirmación por Transición ───
    private setupBuffer: TransitionBuffer;
    private trophyBuffer: TransitionBuffer;
    private accelerationBuffer: TransitionBuffer;
    private contactBuffer: TransitionBuffer;
    private followThroughBuffer: TransitionBuffer;

    // ─── Monotonicity Tracking ───
    // Verifica que la métrica clave siga una tendencia coherente (no solo un spike)
    private recentElbowAngles: number[] = [];
    private recentArmElevations: number[] = [];
    private readonly TREND_WINDOW = 5;

    constructor() {
        // Buffers con mayoría 3/5 = 60% de acuerdo para confirmar transición
        this.setupBuffer = createTransitionBuffer(5, 3);
        this.trophyBuffer = createTransitionBuffer(7, 4);       // Más estricto: 4/7 para TROPHY (transición más sensible)
        this.accelerationBuffer = createTransitionBuffer(5, 3);
        this.contactBuffer = createTransitionBuffer(5, 3);
        this.followThroughBuffer = createTransitionBuffer(5, 3);
    }

    public reset() {
        this.currentPhase = ServePhase.IDLE;
        this.framesInCurrentPhase = 0;
        this.lastTimestamp = 0;
        this.maxArmElevation = 0;
        this.minElbowFlexionReached = false;
        resetBuffer(this.setupBuffer);
        resetBuffer(this.trophyBuffer);
        resetBuffer(this.accelerationBuffer);
        resetBuffer(this.contactBuffer);
        resetBuffer(this.followThroughBuffer);
        this.recentElbowAngles = [];
        this.recentArmElevations = [];
    }

    public getPhase(): ServePhase {
        return this.currentPhase;
    }

    public getFramesInPhase(): number {
        return this.framesInCurrentPhase;
    }

    /**
     * Verifica si una serie de valores recientes muestra una tendencia monótona.
     * Retorna true si la dirección es coherente (ej: subiendo consistentemente).
     */
    private checkTrend(values: number[], direction: 'up' | 'down'): boolean {
        if (values.length < 3) return false;
        let coherentMoves = 0;
        const recent = values.slice(-this.TREND_WINDOW);
        for (let i = 1; i < recent.length; i++) {
            const diff = recent[i] - recent[i - 1];
            if (direction === 'up' && diff > 0) coherentMoves++;
            if (direction === 'down' && diff < 0) coherentMoves++;
        }
        // Al menos 50% de los movimientos deben ser coherentes
        return coherentMoves >= (recent.length - 1) * 0.5;
    }

    public update(metrics: ServeMetrics, currentTimestampMs: number): ServePhase {
        if (this.lastTimestamp > 0 && (currentTimestampMs - this.lastTimestamp) > PHASE_CONFIG.TIMEOUT_MS) {
            this.forcePhase(ServePhase.IDLE);
        }

        this.lastTimestamp = currentTimestampMs;
        this.framesInCurrentPhase++;

        // Actualizar pico de altura del brazo dominante para gating del follow-through
        if (metrics.armElevationAngle > this.maxArmElevation) {
            this.maxArmElevation = metrics.armElevationAngle;
        }

        // Tracking de tendencias para monotonicity check
        this.recentElbowAngles.push(metrics.dominantElbowAngle);
        this.recentArmElevations.push(metrics.armElevationAngle);
        if (this.recentElbowAngles.length > this.TREND_WINDOW * 2) {
            this.recentElbowAngles.shift();
            this.recentArmElevations.shift();
        }

        // ─── HISTÉRESIS MÍNIMA POR FASE ───
        const MIN_FRAMES_DEFAULT = 5;
        const MIN_FRAMES_TROPHY = 8;   // Más estricto para la transición Setup→Trophy

        switch (this.currentPhase) {
            case ServePhase.IDLE: {
                const meetsCondition = metrics.armElevationAngle > 25;
                const confirmed = pushVote(this.setupBuffer, meetsCondition);
                if (confirmed) {
                    this.tryTransition(ServePhase.SETUP);
                    resetBuffer(this.setupBuffer);
                }
                break;
            }

            case ServePhase.SETUP: {
                // ARMADO (TROPHY) requiere codo flexionándose Y brazo de lanzamiento arriba
                // + histéresis aumentada + confirmación multi-frame
                const meetsCondition =
                    this.framesInCurrentPhase >= MIN_FRAMES_TROPHY &&
                    metrics.dominantElbowAngle < 165 &&
                    metrics.tossArmElevationAngle > 110;

                const confirmed = pushVote(this.trophyBuffer, meetsCondition);
                if (confirmed) {
                    this.tryTransition(ServePhase.TROPHY);
                    resetBuffer(this.trophyBuffer);
                }
                break;
            }

            case ServePhase.TROPHY: {
                // Tracking de flexión: el codo DEBE bajar de 110° para validar que hubo un armado real
                if (metrics.dominantElbowAngle < 110) {
                    this.minElbowFlexionReached = true;
                }

                // ACELERACIÓN: Solo si ya llegamos al punto de flexión máxima y el codo empieza a subir
                // + monotonicity check: el codo debe estar SUBIENDO consistentemente
                const meetsCondition =
                    this.minElbowFlexionReached &&
                    this.framesInCurrentPhase >= MIN_FRAMES_DEFAULT &&
                    metrics.dominantElbowAngle > 130 &&
                    this.checkTrend(this.recentElbowAngles, 'up');

                const confirmed = pushVote(this.accelerationBuffer, meetsCondition);
                if (confirmed) {
                    this.tryTransition(ServePhase.ACCELERATION);
                    resetBuffer(this.accelerationBuffer);
                }
                break;
            }

            case ServePhase.ACCELERATION: {
                // IMPACTO: Máxima extensión del brazo (> 175)
                // + verificar que la elevación del brazo también es alta (consistencia)
                const meetsCondition =
                    this.framesInCurrentPhase >= 2 &&
                    metrics.dominantElbowAngle > 175 &&
                    metrics.armElevationAngle > 100;  // El brazo DEBE estar arriba, no a la altura de la cadera

                const confirmed = pushVote(this.contactBuffer, meetsCondition);
                if (confirmed) {
                    this.tryTransition(ServePhase.CONTACT);
                    resetBuffer(this.contactBuffer);
                }
                break;
            }

            case ServePhase.CONTACT: {
                // TERMINACIÓN: Solo si el brazo realmente llegó arriba (> 140)
                const meetsCondition =
                    this.framesInCurrentPhase >= 3 &&
                    this.maxArmElevation > 140 &&
                    (metrics.dominantElbowAngle < 160 || metrics.armElevationAngle < 120);

                const confirmed = pushVote(this.followThroughBuffer, meetsCondition);
                if (confirmed) {
                    this.tryTransition(ServePhase.FOLLOW_THROUGH);
                    resetBuffer(this.followThroughBuffer);
                }
                break;
            }

            case ServePhase.FOLLOW_THROUGH:
                break;
        }

        return this.currentPhase;
    }

    private tryTransition(nextPhase: ServePhase) {
        if (this.currentPhase !== nextPhase) {
            const esMap: Record<string, string> = {
                'IDLE': 'REPOSO',
                'SETUP': 'PREPARACIÓN',
                'TROPHY': 'ARMADO',
                'ACCELERATION': 'ACELERACIÓN',
                'CONTACT': 'IMPACTO',
                'FOLLOW_THROUGH': 'TERMINACIÓN'
            };
            console.log(`[PhaseTracker] Transición: ${esMap[this.currentPhase] || this.currentPhase} -> ${esMap[nextPhase] || nextPhase}`);
            this.currentPhase = nextPhase;
            this.framesInCurrentPhase = 0;
        }
    }

    private forcePhase(phase: ServePhase) {
        this.currentPhase = phase;
        this.framesInCurrentPhase = 0;
        this.maxArmElevation = 0;
        // Reset all transition buffers
        resetBuffer(this.setupBuffer);
        resetBuffer(this.trophyBuffer);
        resetBuffer(this.accelerationBuffer);
        resetBuffer(this.contactBuffer);
        resetBuffer(this.followThroughBuffer);
    }
}
