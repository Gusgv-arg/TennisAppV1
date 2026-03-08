import { RuleFlag, ServeMetrics } from './types';

export interface RuleEvaluationResult {
    flags: RuleFlag[];
    categoryScores: {
        preparation: number;   // 0-100
        trophy: number;        // 0-100
        contact: number;       // 0-100
        energyTransfer: number;// 0-100
        followThrough: number; // 0-100
    };
    finalScore: number;        // Weighted 0-100
    detailedMetrics: {
        footOrientationScore: number;
        shoulderOrientationScore: number;
        kneeFlexionScore: number;
        shoulderRotationScore: number;
        elbowExtensionScore: number;
        energyTransferScore: number;
    };
}

/**
 * Rangos ideales definidos por la literatura biomecánica del tenis
 * ajustados para un motor de detección amateur determinista.
 */
export const BIOMECHANIC_THRESHOLDS = {
    TROPHY: {
        MIN_SHOULDER_ROTATION: 40,
        IDEAL_SHOULDER_ROTATION: 70,
        MIN_FEET_ROTATION: 40,
        IDEAL_FEET_ROTATION: 70,
        MIN_KNEE_FLEXION: 110,
        IDEAL_KNEE_FLEXION: 130, // Grados (A menor ángulo > mayor flexión, 180 es parado)
        MAX_KNEE_FLEXION: 150,   // "Dobladas" significa menos de 150
        MIN_ARM_ELEVATION: 110
    },
    CONTACT: {
        MIN_ELBOW_EXTENSION: 160 // T-Rex arm es < 160
    },
    FOLLOW_THROUGH: {
        MIN_ARM_DROP_ELEVATION: 100 // El brazo debe caer bajo la línea del hombro
    }
};

/**
 * Pesos relativos de cada categoría en el cálculo final (deben sumar 1.0)
 */
export const CATEGORY_WEIGHTS = {
    preparation: 0.20,
    trophy: 0.20,
    contact: 0.20,
    energyTransfer: 0.20,
    followThrough: 0.20
};

/**
 * Normaliza un valor entre un mínimo inaceptable (0 pto) y un umbral óptimo (100 pts)
 */
function normalizeScore(value: number, worst: number, best: number): number {
    if (worst < best) {
        if (value <= worst) return 0;
        if (value >= best) return 100;
        return ((value - worst) / (best - worst)) * 100;
    } else {
        // Lógica invertida (ej. flexión de rodilla donde menor ángulo es más flexión)
        if (value >= worst) return 0;
        if (value <= best) return 100;
        return ((worst - value) / (worst - best)) * 100;
    }
}

/**
 * Evalúa las métricas capturadas y determina los errores cometidos.
 * Atención: Se deben pasar las métricas de los "Keyframes" correctos.
 * (ej, las metrics del evento 'Contact' y las del evento 'Trophy')
 */
export function evaluateServeRules(
    setupMetrics: ServeMetrics | null,
    trophyMetrics: ServeMetrics | null,
    contactMetrics: ServeMetrics | null,
    followThroughMetrics: ServeMetrics | null
): RuleEvaluationResult {
    const flags: RuleFlag[] = [];
    const scores = {
        preparation: 0,
        trophy: 0,
        contact: 0,
        energyTransfer: 0,
        followThrough: 0
    };

    // 0. Evaluar Preparación (Orientación de hombros y pies)
    if (setupMetrics) {
        const footScore = normalizeScore(setupMetrics.feetRotationAngle, 20, BIOMECHANIC_THRESHOLDS.TROPHY.IDEAL_FEET_ROTATION);
        const shoulderOrientScore = normalizeScore(setupMetrics.shoulderRotationAngle, 20, BIOMECHANIC_THRESHOLDS.TROPHY.IDEAL_SHOULDER_ROTATION);

        scores.preparation = (footScore * 0.5) + (shoulderOrientScore * 0.5);

        // Disparar Flags de Preparación
        if (setupMetrics.feetRotationAngle < BIOMECHANIC_THRESHOLDS.TROPHY.MIN_FEET_ROTATION) {
            flags.push('POOR_FOOT_ORIENTATION');
        }
        if (setupMetrics.shoulderRotationAngle < BIOMECHANIC_THRESHOLDS.TROPHY.MIN_SHOULDER_ROTATION) {
            flags.push('POOR_SHOULDER_ALIGNMENT');
        }
    } else {
        scores.preparation = 50; // Fallback si no se detectó setup
    }

    // 1. Evaluar Trophy Pose (Postura armada de fuerza)
    if (trophyMetrics) {
        // Score de la flexión de rodilla (De 170=0pts hasta 130=100pts)
        const kneeScore = normalizeScore(trophyMetrics.kneeFlexionAngle, 170, BIOMECHANIC_THRESHOLDS.TROPHY.IDEAL_KNEE_FLEXION);
        // Score de rotación de pecho (Torsión, De 20=0pts hasta 70=100pts)
        const shoulderScore = normalizeScore(trophyMetrics.shoulderRotationAngle, 20, BIOMECHANIC_THRESHOLDS.TROPHY.IDEAL_SHOULDER_ROTATION);

        scores.trophy = (kneeScore * 0.5) + (shoulderScore * 0.5);

        // Disparar Errores (Banderas/Flags)
        if (trophyMetrics.kneeFlexionAngle > BIOMECHANIC_THRESHOLDS.TROPHY.MAX_KNEE_FLEXION) {
            flags.push('INSUFFICIENT_KNEE_BEND');
        }
        if (trophyMetrics.shoulderRotationAngle < BIOMECHANIC_THRESHOLDS.TROPHY.MIN_SHOULDER_ROTATION) {
            flags.push('POOR_TROPHY_POSITION');
        }
    }

    // 2. Evaluar Instante de Contacto
    if (contactMetrics) {
        const extensionScore = normalizeScore(contactMetrics.elbowExtensionAngle, 130, 180);
        scores.contact = extensionScore;

        if (contactMetrics.elbowExtensionAngle < BIOMECHANIC_THRESHOLDS.CONTACT.MIN_ELBOW_EXTENSION) {
            flags.push('T_REX_ARM_CONTACT');
        }
    }

    // 3. Evaluar Follow Through
    if (followThroughMetrics) {
        // Si el brazo de contacto terminó cayendo o cruzando el cuerpo
        if (followThroughMetrics.armElevationAngle > BIOMECHANIC_THRESHOLDS.FOLLOW_THROUGH.MIN_ARM_DROP_ELEVATION) {
            flags.push('POOR_FOLLOW_THROUGH');
        } else {
            scores.followThrough = 100;
        }
    }

    // Transferencia de energía sintética (Para MVP asume el delta de rodillas)
    if (trophyMetrics && contactMetrics) {
        // La energía es la diferencia entre que tan abajo estaba (Trophy) y qué tan alto subió (Contact)
        const energyDelta = trophyMetrics.kneeFlexionAngle - contactMetrics.kneeFlexionAngle; // Debería ser negativo y grande
        scores.energyTransfer = normalizeScore(Math.abs(energyDelta), 5, 40);
    } else {
        scores.energyTransfer = 50; // Fallback
    }

    // Weight final establecido por el USER (Equitativo 20% cada uno)
    const finalScore =
        (scores.preparation * CATEGORY_WEIGHTS.preparation) +
        (scores.trophy * CATEGORY_WEIGHTS.trophy) +
        (scores.contact * CATEGORY_WEIGHTS.contact) +
        (scores.energyTransfer * CATEGORY_WEIGHTS.energyTransfer) +
        (scores.followThrough * CATEGORY_WEIGHTS.followThrough);

    // Métricas detalladas para el reporte
    const detailedMetrics = {
        footOrientationScore: setupMetrics ? normalizeScore(setupMetrics.feetRotationAngle, 20, BIOMECHANIC_THRESHOLDS.TROPHY.IDEAL_FEET_ROTATION) : 0,
        shoulderOrientationScore: setupMetrics ? normalizeScore(setupMetrics.shoulderRotationAngle, 20, BIOMECHANIC_THRESHOLDS.TROPHY.IDEAL_SHOULDER_ROTATION) : 0,
        kneeFlexionScore: trophyMetrics ? normalizeScore(trophyMetrics.kneeFlexionAngle, 170, BIOMECHANIC_THRESHOLDS.TROPHY.IDEAL_KNEE_FLEXION) : 0,
        shoulderRotationScore: trophyMetrics ? normalizeScore(trophyMetrics.shoulderRotationAngle, 20, BIOMECHANIC_THRESHOLDS.TROPHY.IDEAL_SHOULDER_ROTATION) : 0,
        elbowExtensionScore: contactMetrics ? normalizeScore(contactMetrics.elbowExtensionAngle, 130, 180) : 0,
        energyTransferScore: scores.energyTransfer
    };

    return {
        flags,
        categoryScores: scores,
        detailedMetrics,
        finalScore: Math.round(finalScore)
    };
}
