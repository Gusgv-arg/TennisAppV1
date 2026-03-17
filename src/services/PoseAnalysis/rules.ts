import { RuleFlag, ServeMetrics } from './types';

/**
 * Resultado de la evaluación de reglas biomecánicas v2.
 * 4 fases × 25% = 100%. Fase Armado contiene 2 indicadores a 12.5% c/u.
 */
export interface RuleEvaluationResult {
    flags: RuleFlag[];
    categoryScores: {
        preparacion: number;   // 0-100
        armado: number;        // 0-100
        impacto: number;       // 0-100
        terminacion: number;   // 0-100
    };
    finalScore: number;        // Weighted 0-100
    detailedMetrics: {
        footOrientationScore: number;
        kneeFlexionScore: number;
        trophyPositionScore: number;
        heelLiftScore: number;
        followThroughScore: number;
    };
}

/**
 * Umbrales biomecánicos v2 (docs/BIOMECHANICAL_SCHEMA.md)
 */
export const BIOMECHANIC_THRESHOLDS = {
    FEET: {
        TARGET_ANGLE: 70,          // Objetivo: <= 70° para 100%
        LIMIT_ANGLE: 130,          // Límite: >= 130° para 0%
        MIN_ACCEPTABLE: 30         // Mínimo histórico para flag
    },
    KNEE: {
        TARGET_FLEXION: 150,       // Ideal: <= 150° = 100%
        LIMIT_FLEXION: 170         // Límite: >= 170° = 0%
    },
    TROPHY: {
        TARGET_ALIGNMENT: 150,     // Ideal: <= 150° = 100%
        LIMIT_ALIGNMENT: 170,     // Límite: >= 170° = 0%
        ELBOW_TRIGGER: 90          
    },
    HEEL_LIFT: {
        TARGET_DELTA: 0.05,        // Target (~10cm = 100%)
        MIN_DELTA: 0.01            
    }
};

/**
 * Pesos relativos de cada fase (4 × 25% = 100%)
 */
export const CATEGORY_WEIGHTS = {
    preparacion: 0.25,
    armado: 0.25,
    impacto: 0.25,
    terminacion: 0.25
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
 * Evalúa las métricas capturadas en los Keyframes y genera el informe.
 * 
 * @param setupMetrics - Métricas del frame de Preparación (pies)
 * @param trophyMetrics - Métricas del frame Trophy (rodilla + alineación)
 * @param contactMetrics - Métricas del frame de Impacto (salto)
 * @param followThroughMetrics - Métricas del frame de Terminación (cruce brazo)
 * @param heelBaselineY - Posición Y promedio de los talones al inicio del video (baseline)
 */
export function evaluateServeRules(
    setupMetrics: ServeMetrics | null,
    trophyMetrics: ServeMetrics | null,
    contactMetrics: ServeMetrics | null,
    followThroughMetrics: ServeMetrics | null,
    heelBaselineY?: number
): RuleEvaluationResult {
    const flags: RuleFlag[] = [];
    const scores = {
        preparacion: 0,
        armado: 0,
        impacto: 0,
        terminacion: 0
    };

    // Métricas detalladas individuales
    let footOrientationScore = 0;
    let kneeFlexionScore = 0;
    let trophyPositionScore = 0;
    let heelLiftScore = 0;
    let followThroughScore = 0;

    // ─── Fase 1: Preparación (25%) ───
    // Indicador 1: Orientación de pies → objetivo ~70°
    if (setupMetrics) {
        footOrientationScore = normalizeScore(
            setupMetrics.footOrientationAngle,
            BIOMECHANIC_THRESHOLDS.FEET.LIMIT_ANGLE, // 130 (0%)
            BIOMECHANIC_THRESHOLDS.FEET.TARGET_ANGLE  // 70 (100%)
        );
        scores.preparacion = footOrientationScore;

        // Si el ángulo es demasiado alto (> 110), avisamos de sobre-rotación o posición incorrecta
        if (setupMetrics.footOrientationAngle > 110) {
            flags.push('POOR_FOOT_ORIENTATION');
        }
    } else {
        scores.preparacion = 50; // Fallback si no se detectó setup
    }

    // ─── Fase 2: Armado (25% = 12.5% rodilla + 12.5% trofeo) ───
    if (trophyMetrics) {
        // Indicador 2: Flexión de rodilla delantera → <= 150° (100%), >= 170° (0%)
        kneeFlexionScore = normalizeScore(
            trophyMetrics.frontKneeFlexionAngle,
            BIOMECHANIC_THRESHOLDS.KNEE.LIMIT_FLEXION, // 170
            BIOMECHANIC_THRESHOLDS.KNEE.TARGET_FLEXION // 150
        );

        if (trophyMetrics.frontKneeFlexionAngle > BIOMECHANIC_THRESHOLDS.KNEE.TARGET_FLEXION) {
            flags.push('INSUFFICIENT_KNEE_BEND');
        }

        // Indicador 3: Posición de Trofeo → <= 150° (100%), >= 170° (0%)
        trophyPositionScore = normalizeScore(
            trophyMetrics.trophyAlignmentAngle,
            BIOMECHANIC_THRESHOLDS.TROPHY.LIMIT_ALIGNMENT, // 170
            BIOMECHANIC_THRESHOLDS.TROPHY.TARGET_ALIGNMENT  // 150
        );

        if (trophyMetrics.trophyAlignmentAngle > 160) {
            flags.push('POOR_TROPHY_POSITION');
        }

        // Score de fase = promedio de los dos indicadores
        scores.armado = (kneeFlexionScore + trophyPositionScore) / 2;
    }

    // ─── Fase 3: Impacto (25%) ───
    // Indicador 4: Despegue de talón → > 10cm
    if (contactMetrics && heelBaselineY !== undefined) {
        // En MediaPipe Y crece hacia abajo, así que un salto significa que Y disminuye
        const liftDelta = heelBaselineY - contactMetrics.heelLiftDelta;
        heelLiftScore = normalizeScore(
            liftDelta,
            BIOMECHANIC_THRESHOLDS.HEEL_LIFT.MIN_DELTA,
            BIOMECHANIC_THRESHOLDS.HEEL_LIFT.TARGET_DELTA
        );
        scores.impacto = heelLiftScore;

        if (liftDelta < BIOMECHANIC_THRESHOLDS.HEEL_LIFT.MIN_DELTA) {
            flags.push('NO_JUMP');
        }
    } else if (contactMetrics) {
        // Sin baseline, no podemos medir el salto con certeza
        scores.impacto = 50;
        heelLiftScore = 50;
    }

    // ─── Fase 4: Terminación (25%) ───
    // Indicador 5: Muñeca cruza rodilla contraria → boolean
    if (followThroughMetrics) {
        if (followThroughMetrics.wristCrossedKnee) {
            followThroughScore = 100;
            scores.terminacion = 100;
        } else {
            followThroughScore = 30; // Intentó pero no cruzó
            scores.terminacion = 30;
            flags.push('POOR_FOLLOW_THROUGH');
        }
    }

    // ─── Score Final Ponderado ───
    const finalScore =
        (scores.preparacion * CATEGORY_WEIGHTS.preparacion) +
        (scores.armado * CATEGORY_WEIGHTS.armado) +
        (scores.impacto * CATEGORY_WEIGHTS.impacto) +
        (scores.terminacion * CATEGORY_WEIGHTS.terminacion);

    const detailedMetrics = {
        footOrientationScore,
        kneeFlexionScore,
        trophyPositionScore,
        heelLiftScore,
        followThroughScore
    };

    // ─── Resumen de Consola para Verificación ───
    const heelDelta = (contactMetrics && heelBaselineY !== undefined)
        ? (heelBaselineY - contactMetrics.heelLiftDelta)
        : null;

    console.log('\n╔══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                    RESUMEN BIOMECÁNICO DEL SAQUE                           ║');
    console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
    console.log('║ Fase          │ Indicador          │ Referencia │ Alumno   │ Score │ Aporta ║');
    console.log('╠══════════════════════════════════════════════════════════════════════════════╣');

    // Fase 1
    const footVal = setupMetrics ? `${setupMetrics.footOrientationAngle.toFixed(1)}°` : 'N/D';
    const footContrib = (footOrientationScore * CATEGORY_WEIGHTS.preparacion).toFixed(1);
    console.log(`║ Preparación   │ Orient. Pies       │ <= 70°     │ ${footVal.padEnd(8)} │ ${Math.round(footOrientationScore).toString().padStart(3)}%  │ ${footContrib.padStart(4)}%  ║`);

    // Fase 2a
    const kneeVal = trophyMetrics ? `${trophyMetrics.frontKneeFlexionAngle.toFixed(1)}°` : 'N/D';
    const kneeContrib = (kneeFlexionScore * 0.125).toFixed(1); // 12.5%
    console.log(`║ Armado        │ Flex. Rodilla       │ <= 150°    │ ${kneeVal.padEnd(8)} │ ${Math.round(kneeFlexionScore).toString().padStart(3)}%  │ ${kneeContrib.padStart(4)}%  ║`);

    // Fase 2b
    const trophyVal = trophyMetrics ? `${trophyMetrics.trophyAlignmentAngle.toFixed(1)}°` : 'N/D';
    const trophyContrib = (trophyPositionScore * 0.125).toFixed(1); // 12.5%
    console.log(`║ Armado        │ Pos. Trofeo        │ <= 150°    │ ${trophyVal.padEnd(8)} │ ${Math.round(trophyPositionScore).toString().padStart(3)}%  │ ${trophyContrib.padStart(4)}%  ║`);

    // Fase 3
    const heelVal = heelDelta !== null ? `${(heelDelta * 100).toFixed(1)}cm` : 'N/D';
    const heelContrib = (heelLiftScore * CATEGORY_WEIGHTS.impacto).toFixed(1);
    console.log(`║ Impacto       │ Despegue Talón     │ > 10cm     │ ${heelVal.padEnd(8)} │ ${Math.round(heelLiftScore).toString().padStart(3)}%  │ ${heelContrib.padStart(4)}%  ║`);

    // Fase 4
    const followVal = followThroughMetrics ? (followThroughMetrics.wristCrossedKnee ? 'Sí' : 'No') : 'N/D';
    const followContrib = (followThroughScore * CATEGORY_WEIGHTS.terminacion).toFixed(1);
    console.log(`║ Terminación   │ Cruce Brazo        │ Sí         │ ${followVal.padEnd(8)} │ ${Math.round(followThroughScore).toString().padStart(3)}%  │ ${followContrib.padStart(4)}%  ║`);

    console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
    console.log(`║ SCORE FINAL: ${Math.round(finalScore)}%                                                          ║`);
    console.log(`║ Flags: ${flags.length > 0 ? flags.join(', ') : 'Ninguno'}`.padEnd(79) + '║');
    console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

    return {
        flags,
        categoryScores: scores,
        detailedMetrics,
        finalScore: Math.round(finalScore)
    };
}
