import { evaluateServeRules } from '../../../src/services/PoseAnalysis/rules';
import { ServeMetrics } from '../../../src/services/PoseAnalysis/types';

/**
 * Helper para construir un ServeMetrics con valores por defecto
 */
function makeMetrics(overrides: Partial<ServeMetrics> = {}): ServeMetrics {
    return {
        footOrientationAngle: 70,
        frontKneeFlexionAngle: 130,
        trophyAlignmentAngle: 160,
        heelLiftDelta: 0.5,
        wristCrossedKnee: true,
        dominantElbowAngle: 90,
        armElevationAngle: 150,
        tossArmElevationAngle: 120,
        dominantWristToAnkleDistance: 0.8,
        handToOppositeKneeDistance: 0.3,
        tossArmDistance: 0.5,
        ...overrides
    };
}

describe('PoseAnalysis Rules Engine v2 (5 Indicadores)', () => {

    test('Saque perfecto: 0 flags, score alto, pesos correctos (25% c/u)', () => {
        const setupMetrics = makeMetrics({ footOrientationAngle: 70 });
        const trophyMetrics = makeMetrics({ frontKneeFlexionAngle: 120, trophyAlignmentAngle: 140 });
        const contactMetrics = makeMetrics({ heelLiftDelta: 0.45 }); // Saltó
        const followMetrics = makeMetrics({ wristCrossedKnee: true });

        const heelBaseline = 0.5; // Baseline Y = 0.5, contact Y = 0.45 → delta = 0.05

        const result = evaluateServeRules(setupMetrics, trophyMetrics, contactMetrics, followMetrics, heelBaseline);

        expect(result.flags.length).toBe(0);
        expect(result.categoryScores.preparacion).toBe(100);
        expect(result.categoryScores.armado).toBeGreaterThan(90);
        expect(result.categoryScores.terminacion).toBe(100);
        expect(result.finalScore).toBeGreaterThan(90);
    });

    test('INSUFFICIENT_KNEE_BEND cuando rodilla > 150°', () => {
        const trophyMetrics = makeMetrics({ frontKneeFlexionAngle: 175 }); // Pierna casi recta

        const result = evaluateServeRules(null, trophyMetrics, null, null);

        expect(result.flags).toContain('INSUFFICIENT_KNEE_BEND');
        expect(result.detailedMetrics.kneeFlexionScore).toBeLessThan(20);
    });

    test('POOR_FOOT_ORIENTATION cuando pies > 110°', () => {
        const setupMetrics = makeMetrics({ footOrientationAngle: 120 }); // Demasiado abierto

        const result = evaluateServeRules(setupMetrics, null, null, null);

        expect(result.flags).toContain('POOR_FOOT_ORIENTATION');
        expect(result.categoryScores.preparacion).toBeLessThan(30);
    });

    test('POOR_TROPHY_POSITION cuando alineación > 160°', () => {
        const trophyMetrics = makeMetrics({ trophyAlignmentAngle: 165 }); // Brazos desalineados

        const result = evaluateServeRules(null, trophyMetrics, null, null);

        expect(result.flags).toContain('POOR_TROPHY_POSITION');
        expect(result.detailedMetrics.trophyPositionScore).toBeLessThan(30);
    });

    test('NO_JUMP cuando no hay despegue suficiente', () => {
        const contactMetrics = makeMetrics({ heelLiftDelta: 0.5 }); // Mismo nivel que baseline
        const heelBaseline = 0.5; // No hubo salto (baseline == actual)

        const result = evaluateServeRules(null, null, contactMetrics, null, heelBaseline);

        expect(result.flags).toContain('NO_JUMP');
        expect(result.detailedMetrics.heelLiftScore).toBe(0);
    });

    test('POOR_FOLLOW_THROUGH cuando muñeca no cruza rodilla', () => {
        const followMetrics = makeMetrics({ wristCrossedKnee: false });

        const result = evaluateServeRules(null, null, null, followMetrics);

        expect(result.flags).toContain('POOR_FOLLOW_THROUGH');
        expect(result.categoryScores.terminacion).toBe(30); // Penalización pero no 0
    });

    test('Pesos suman exactamente 100 con scores de 100', () => {
        const setupMetrics = makeMetrics({ footOrientationAngle: 70 });
        const trophyMetrics = makeMetrics({ frontKneeFlexionAngle: 120, trophyAlignmentAngle: 140 });
        const contactMetrics = makeMetrics({ heelLiftDelta: 0.45 });
        const followMetrics = makeMetrics({ wristCrossedKnee: true });
        const heelBaseline = 0.5;

        const result = evaluateServeRules(setupMetrics, trophyMetrics, contactMetrics, followMetrics, heelBaseline);

        // Con todo perfecto, el score final debería ser 100
        expect(result.finalScore).toBe(100);
    });
});
