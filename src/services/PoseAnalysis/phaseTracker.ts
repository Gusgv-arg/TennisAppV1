import { ServeMetrics, ServePhase } from './types';

// Opciones heurísticas para la máquina de estados
const PHASE_CONFIG = {
    // Número mínimo de frames para confirmar un cambio de estado (Histeresis)
    MIN_FRAMES_IN_STATE: 1,
    // Altura mínima del brazo de golpeo respecto a la cadera para considerarlo armado
    TROPHY_ELEVATION_THRESHOLD: 60, // Bajamos de 80 a 60 para captar el armado antes (especialmente si el loop empieza bajo)
    // Ángulo del codo que dispara el Trophy trigger (Acompaña la aceleración del brazo)
    TROPHY_ELBOW_TRIGGER: 160, 
    // Timeout para volver a IDLE si se queda frisado a mitad de movimiento (Ms)
    TIMEOUT_MS: 3000
};

export class PhaseTracker {
    private currentPhase: ServePhase = ServePhase.IDLE;
    private framesInCurrentPhase: number = 0; // Se restauró esta propiedad
    private lastTimestamp: number = 0;
    private maxArmElevation: number = 0; 
    private minElbowFlexionReached: boolean = false; // Gating para asegurar que hubo un "loop" antes de acelerar

    constructor() { }

    public reset() {
        this.currentPhase = ServePhase.IDLE;
        this.framesInCurrentPhase = 0;
        this.lastTimestamp = 0;
        this.maxArmElevation = 0;
        this.minElbowFlexionReached = false;
    }

    public getPhase(): ServePhase {
        return this.currentPhase;
    }

    public getFramesInPhase(): number {
        return this.framesInCurrentPhase;
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

        // HISTERESIS: Mínimo de cuadros para considerar un cambio de fase real (30 fps -> ~160ms)
        const MIN_FRAMES = 5;

        switch (this.currentPhase) {
            case ServePhase.IDLE:
                if (metrics.armElevationAngle > 25) { 
                    this.tryTransition(ServePhase.SETUP);
                }
                break;

            case ServePhase.SETUP:
                // ARMADO (TROPHY) requiere codo flexionándose Y brazo de lanzamiento arriba
                if (this.framesInCurrentPhase >= MIN_FRAMES &&
                    metrics.dominantElbowAngle < 165 && 
                    metrics.tossArmElevationAngle > 110) {
                    this.tryTransition(ServePhase.TROPHY);
                }
                break;

            case ServePhase.TROPHY:
                // Tracking de flexión: el codo DEBE bajar de 110° para validar que hubo un armado real
                if (metrics.dominantElbowAngle < 110) {
                    this.minElbowFlexionReached = true;
                }

                // ACELERACIÓN: Solo si ya llegamos al punto de flexión máxima y el codo empieza a subir
                if (this.minElbowFlexionReached && 
                    this.framesInCurrentPhase >= MIN_FRAMES &&
                    metrics.dominantElbowAngle > 130) {
                    this.tryTransition(ServePhase.ACCELERATION);
                }
                break;

            case ServePhase.ACCELERATION:
                // IMPACTO: Máxima extensión del brazo (> 175)
                if (this.framesInCurrentPhase >= 2 && 
                    metrics.dominantElbowAngle > 175) {
                    this.tryTransition(ServePhase.CONTACT);
                }
                break;

            case ServePhase.CONTACT:
                // TERMINACIÓN: Solo si el brazo realmente llegó arriba (> 140)
                if (this.framesInCurrentPhase >= 3 && 
                    this.maxArmElevation > 140 && 
                    (metrics.dominantElbowAngle < 160 || metrics.armElevationAngle < 120)) {
                    this.tryTransition(ServePhase.FOLLOW_THROUGH);
                }
                break;

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
    }
}
