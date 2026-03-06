import { ServeMetrics, ServePhase } from './types';

// Opciones heurísticas para la máquina de estados
const PHASE_CONFIG = {
    // Número mínimo de frames para confirmar un cambio de estado (Histeresis)
    MIN_FRAMES_IN_STATE: 1,
    // Velocidad de muñeca que consideramos "Impacto/Aceleración"
    MIN_WRIST_VELOCITY_FOR_ACCEL: 0.1,
    // Altura mínima del brazo de golpeo respecto a la cadera para considerarlo armado
    TROPHY_ELEVATION_THRESHOLD: 110,
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
                // Si el jugador eleva ligeramente el brazo y empieza a perfilarse, pasa a SETUP
                if (metrics.armElevationAngle > 30 && metrics.shoulderRotationAngle > 10) {
                    this.tryTransition(ServePhase.SETUP);
                }
                break;

            case ServePhase.SETUP:
                // Si el brazo de golpeo supera la línea de los hombros y las rodillas se flexionan
                if (metrics.armElevationAngle > PHASE_CONFIG.TROPHY_ELEVATION_THRESHOLD && metrics.kneeFlexionAngle <= 165) {
                    this.tryTransition(ServePhase.TROPHY);
                }
                break;

            case ServePhase.TROPHY:
                // Aceleración detectada cuando las rodillas empiezan a extenderse violentamente y 
                // hay velocidad vertical de muñeca.
                if (metrics.kneeFlexionAngle > 150 && metrics.wristVerticalVelocity > PHASE_CONFIG.MIN_WRIST_VELOCITY_FOR_ACCEL) {
                    this.tryTransition(ServePhase.ACCELERATION);
                }
                break;

            case ServePhase.ACCELERATION:
                // El impacto (CONTACT) es el momento de máxima extensión del codo en la parte más alta.
                // Generalmente Codo > 160 grados.
                if (metrics.elbowExtensionAngle > 160) {
                    this.tryTransition(ServePhase.CONTACT);
                }
                break;

            case ServePhase.CONTACT:
                // Una fracción de segundo después del contacto, el codo se relaja y baja
                // o la raqueta cruza el cuerpo (rotación baja o velocidad de muñeca negativa) 
                // Por ahora una métrica sencilla: codo baja o rotación sobrepasa.
                if (metrics.elbowExtensionAngle < 155 || metrics.armElevationAngle < 100) {
                    this.tryTransition(ServePhase.FOLLOW_THROUGH);
                }
                break;

            case ServePhase.FOLLOW_THROUGH:
                // Al finalizar (brazo caído y rotado), vuelta forzosa a IDLE en N frames por default si no se mueve
                // En un feed de video grabado, simplemente terminamos aquí.
                break;
        }

        return this.currentPhase;
    }

    private tryTransition(nextPhase: ServePhase) {
        // En un motor real podríamos esperar N frames consecutivos aprobatorios, 
        // pero con videos a baja escala aceptamos la transición inmediata.
        this.currentPhase = nextPhase;
        this.framesInCurrentPhase = 0;
    }

    private forcePhase(phase: ServePhase) {
        this.currentPhase = phase;
        this.framesInCurrentPhase = 0;
    }
}
