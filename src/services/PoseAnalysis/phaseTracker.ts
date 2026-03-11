import { ServeMetrics, ServePhase } from './types';

// Opciones heurísticas para la máquina de estados
const PHASE_CONFIG = {
    // Número mínimo de frames para confirmar un cambio de estado (Histeresis)
    MIN_FRAMES_IN_STATE: 1,
    // Altura mínima del brazo de golpeo respecto a la cadera para considerarlo armado
    TROPHY_ELEVATION_THRESHOLD: 110,
    // Ángulo del codo que dispara el Trophy trigger (90° según esquema)
    TROPHY_ELBOW_TRIGGER: 100, // Usamos 100° con margen de tolerancia
    // Timeout para volver a IDLE si se queda frisado a mitad de movimiento (Ms)
    TIMEOUT_MS: 3000
};

export class PhaseTracker {
    private currentPhase: ServePhase = ServePhase.IDLE;
    private framesInCurrentPhase: number = 0;
    private lastTimestamp: number = 0;

    constructor() { }

    /**
     * Resetea el tracking para un nuevo video.
     */
    public reset() {
        this.currentPhase = ServePhase.IDLE;
        this.framesInCurrentPhase = 0;
        this.lastTimestamp = 0;
    }

    /**
     * Devuelve la fase actual confirmada
     */
    public getPhase(): ServePhase {
        return this.currentPhase;
    }

    /**
     * Lógica iterativa que se ejecuta en CADA cuadro procesado.
     * Evalúa las métricas del jugador y decide si transiciona a la fase siguiente.
     * No se permite retroceder (excepto a IDLE por timeout).
     */
    public update(metrics: ServeMetrics, currentTimestampMs: number): ServePhase {
        // Validación de timeout de inactividad
        if (this.lastTimestamp > 0 && (currentTimestampMs - this.lastTimestamp) > PHASE_CONFIG.TIMEOUT_MS) {
            this.forcePhase(ServePhase.IDLE);
        }

        this.lastTimestamp = currentTimestampMs;
        this.framesInCurrentPhase++;

        // Máquina de estados unidireccional (Saque)
        switch (this.currentPhase) {

            case ServePhase.IDLE:
                // Si el jugador eleva el brazo, pasa a SETUP
                if (metrics.armElevationAngle > 30) {
                    this.tryTransition(ServePhase.SETUP);
                }
                break;

            case ServePhase.SETUP:
                // Si el brazo de golpeo supera la línea de los hombros → TROPHY
                if (metrics.armElevationAngle > PHASE_CONFIG.TROPHY_ELEVATION_THRESHOLD) {
                    this.tryTransition(ServePhase.TROPHY);
                }
                break;

            case ServePhase.TROPHY:
                // Aceleración detectada cuando el codo del brazo dominante se extiende
                // más allá del trigger de 90° → el jugador empieza a lanzar hacia la bola
                if (metrics.dominantElbowAngle > PHASE_CONFIG.TROPHY_ELBOW_TRIGGER) {
                    this.tryTransition(ServePhase.ACCELERATION);
                }
                break;

            case ServePhase.ACCELERATION:
                // El impacto (CONTACT) es el momento de máxima extensión del codo.
                // Codo cercano a 170° indica extensión casi completa
                if (metrics.dominantElbowAngle > 160) {
                    this.tryTransition(ServePhase.CONTACT);
                }
                break;

            case ServePhase.CONTACT:
                // Después del contacto, el codo se relaja y el brazo baja
                if (metrics.dominantElbowAngle < 155 || metrics.armElevationAngle < 100) {
                    this.tryTransition(ServePhase.FOLLOW_THROUGH);
                }
                break;

            case ServePhase.FOLLOW_THROUGH:
                // Terminal state
                break;
        }

        return this.currentPhase;
    }

    private tryTransition(nextPhase: ServePhase) {
        this.currentPhase = nextPhase;
        this.framesInCurrentPhase = 0;
    }

    private forcePhase(phase: ServePhase) {
        this.currentPhase = phase;
        this.framesInCurrentPhase = 0;
    }
}
