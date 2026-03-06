import { BIOMECHANIC_THRESHOLDS, evaluateServeRules } from '../../../src/services/PoseAnalysis/rules';
import { ServeMetrics } from '../../../src/services/PoseAnalysis/types';

describe('PoseAnalysis Rules Engine', () => {

    test('detects perfectly timed serve metrics with no flags and height score', () => {
        const excellentTrophy: ServeMetrics = {
            kneeFlexionAngle: BIOMECHANIC_THRESHOLDS.TROPHY.IDEAL_KNEE_FLEXION, // Perfect
            shoulderRotationAngle: BIOMECHANIC_THRESHOLDS.TROPHY.IDEAL_SHOULDER_ROTATION, // Perfect
            elbowExtensionAngle: 90,
            armElevationAngle: 150,
            hipRotationAngle: 0,
            wristVerticalVelocity: 0
        };

        const excellentContact: ServeMetrics = {
            kneeFlexionAngle: 175, // Piernas extendidas al saltar
            shoulderRotationAngle: 10,
            elbowExtensionAngle: 180, // Brazo estirado a full (Sin T-Rex)
            armElevationAngle: 170,
            hipRotationAngle: 0,
            wristVerticalVelocity: 0
        };

        const excellentFollow: ServeMetrics = {
            kneeFlexionAngle: 160,
            shoulderRotationAngle: 90,
            elbowExtensionAngle: 100,
            armElevationAngle: 15, // Brazo cruzó el tren inferior
            hipRotationAngle: 0,
            wristVerticalVelocity: 0
        };

        const result = evaluateServeRules(excellentTrophy, excellentContact, excellentFollow);

        expect(result.flags.length).toBe(0);
        expect(result.categoryScores.trophy).toBe(100);
        expect(result.categoryScores.contact).toBe(100);
        expect(result.finalScore).toBeGreaterThan(90); // El saque debiese ser casi perfecto
    });

    test('detects INSUFFICIENT_KNEE_BEND flag on stiff legs', () => {
        /**
         * Simula un aficionado que no dobla las piernas (Rodilla en 175 grados, casi parado)
         */
        const stiffTrophy: ServeMetrics = {
            kneeFlexionAngle: 175, // Muy rectas
            shoulderRotationAngle: BIOMECHANIC_THRESHOLDS.TROPHY.IDEAL_SHOULDER_ROTATION,
            elbowExtensionAngle: 90,
            armElevationAngle: 150,
            hipRotationAngle: 0,
            wristVerticalVelocity: 0
        };
        const defaultContact: ServeMetrics = { ...stiffTrophy, elbowExtensionAngle: 180 };

        const result = evaluateServeRules(stiffTrophy, defaultContact, null);

        expect(result.flags).toContain('INSUFFICIENT_KNEE_BEND');
        expect(result.categoryScores.trophy).toBeLessThan(60); // Rotó bien, pero rodillas son un desastre
    });

    test('detects T_REX_ARM_CONTACT when hitting with bent elbow', () => {
        /**
         * Simula pegarle a la pelota bajito porque no extendió el brazo -> T-Rex Arm.
         */
        const poorContact: ServeMetrics = {
            kneeFlexionAngle: 175,
            shoulderRotationAngle: 10,
            elbowExtensionAngle: 140, // < 160 (Límite para brazo contraído)
            armElevationAngle: 140,
            hipRotationAngle: 0,
            wristVerticalVelocity: 0
        };

        const okTrophy: ServeMetrics = { ...poorContact, kneeFlexionAngle: 110, shoulderRotationAngle: 70 };

        const result = evaluateServeRules(okTrophy, poorContact, null);
        expect(result.flags).toContain('T_REX_ARM_CONTACT');
        expect(result.categoryScores.contact).toBeLessThan(30);
    });
});
