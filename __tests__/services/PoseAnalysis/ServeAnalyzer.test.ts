import { ServeAnalyzer } from '../../../src/services/PoseAnalysis/ServeAnalyzer';
import { Landmark, Point3D } from '../../../src/services/PoseAnalysis/types';

describe('ServeAnalyzer Orchestrator', () => {

    /**
     * Crea un frame con landmarks en coordenadas normalizadas [0,1] que pasan todos los quality gates.
     * Simula un jugador de pie con brazo levantado (postura de armado).
     */
    const createStableFrame = (): Point3D[] => {
        const frame: Point3D[] = new Array(33).fill(null).map(() => ({
            x: 0.5, y: 0.5, z: 0, visibility: 1.0, presence: 1.0
        }));

        frame[Landmark.LEFT_HIP] = { x: 0.45, y: 0.6, z: 0, visibility: 1, presence: 1 };
        frame[Landmark.RIGHT_HIP] = { x: 0.55, y: 0.6, z: 0, visibility: 1, presence: 1 };
        frame[Landmark.LEFT_SHOULDER] = { x: 0.45, y: 0.4, z: 0, visibility: 1, presence: 1 };
        frame[Landmark.RIGHT_SHOULDER] = { x: 0.55, y: 0.4, z: 0, visibility: 1, presence: 1 };
        frame[Landmark.NOSE] = { x: 0.5, y: 0.3, z: 0, visibility: 1, presence: 1 };
        frame[Landmark.RIGHT_ELBOW] = { x: 0.6, y: 0.35, z: 0, visibility: 0.9, presence: 1 };
        frame[Landmark.RIGHT_WRIST] = { x: 0.6, y: 0.25, z: 0, visibility: 0.8, presence: 1 };
        frame[Landmark.LEFT_ELBOW] = { x: 0.35, y: 0.35, z: 0, visibility: 0.9, presence: 1 };
        frame[Landmark.LEFT_WRIST] = { x: 0.3, y: 0.4, z: 0, visibility: 0.8, presence: 1 };
        frame[Landmark.RIGHT_KNEE] = { x: 0.55, y: 0.75, z: 0, visibility: 1, presence: 1 };
        frame[Landmark.RIGHT_ANKLE] = { x: 0.55, y: 0.9, z: 0, visibility: 1, presence: 1 };
        frame[Landmark.LEFT_KNEE] = { x: 0.45, y: 0.75, z: 0, visibility: 1, presence: 1 };
        frame[Landmark.LEFT_ANKLE] = { x: 0.45, y: 0.9, z: 0, visibility: 1, presence: 1 };
        frame[Landmark.LEFT_HEEL] = { x: 0.43, y: 0.92, z: 0, visibility: 0.9, presence: 1 };
        frame[Landmark.RIGHT_HEEL] = { x: 0.57, y: 0.92, z: 0, visibility: 0.9, presence: 1 };
        frame[Landmark.LEFT_FOOT_INDEX] = { x: 0.42, y: 0.93, z: 0, visibility: 0.9, presence: 1 };
        frame[Landmark.RIGHT_FOOT_INDEX] = { x: 0.58, y: 0.93, z: 0, visibility: 0.9, presence: 1 };

        return frame;
    };

    /**
     * Crea un frame con brazos completamente abajo (no hay saque).
     */
    const createIdleFrame = (): Point3D[] => {
        const frame: Point3D[] = new Array(33).fill(null).map(() => ({
            x: 0.5, y: 0.6, z: 0, visibility: 1.0, presence: 1.0
        }));

        frame[Landmark.NOSE] = { x: 0.5, y: 0.3, z: 0, visibility: 1, presence: 1 };
        frame[Landmark.LEFT_SHOULDER] = { x: 0.45, y: 0.4, z: 0, visibility: 1, presence: 1 };
        frame[Landmark.RIGHT_SHOULDER] = { x: 0.55, y: 0.4, z: 0, visibility: 1, presence: 1 };
        frame[Landmark.LEFT_HIP] = { x: 0.45, y: 0.6, z: 0, visibility: 1, presence: 1 };
        frame[Landmark.RIGHT_HIP] = { x: 0.55, y: 0.6, z: 0, visibility: 1, presence: 1 };
        frame[Landmark.RIGHT_ELBOW] = { x: 0.56, y: 0.5, z: 0, visibility: 1, presence: 1 };
        frame[Landmark.RIGHT_WRIST] = { x: 0.56, y: 0.58, z: 0, visibility: 1, presence: 1 };
        frame[Landmark.LEFT_ELBOW] = { x: 0.44, y: 0.5, z: 0, visibility: 1, presence: 1 };
        frame[Landmark.LEFT_WRIST] = { x: 0.44, y: 0.58, z: 0, visibility: 1, presence: 1 };
        frame[Landmark.RIGHT_KNEE] = { x: 0.55, y: 0.75, z: 0, visibility: 1, presence: 1 };
        frame[Landmark.LEFT_KNEE] = { x: 0.45, y: 0.75, z: 0, visibility: 1, presence: 1 };
        frame[Landmark.RIGHT_ANKLE] = { x: 0.55, y: 0.9, z: 0, visibility: 1, presence: 1 };
        frame[Landmark.LEFT_ANKLE] = { x: 0.45, y: 0.9, z: 0, visibility: 1, presence: 1 };
        frame[Landmark.LEFT_HEEL] = { x: 0.43, y: 0.92, z: 0, visibility: 0.9, presence: 1 };
        frame[Landmark.RIGHT_HEEL] = { x: 0.57, y: 0.92, z: 0, visibility: 0.9, presence: 1 };
        frame[Landmark.LEFT_FOOT_INDEX] = { x: 0.42, y: 0.93, z: 0, visibility: 0.9, presence: 1 };
        frame[Landmark.RIGHT_FOOT_INDEX] = { x: 0.58, y: 0.93, z: 0, visibility: 0.9, presence: 1 };

        return frame;
    };

    test('processFrame accepts valid frames and rejects bad ones', () => {
        const analyzer = new ServeAnalyzer('right', 30);
        const frameData = createStableFrame();

        // Frames de calidad alta deben ser aceptados
        for (let i = 0; i < 10; i++) {
            const result = analyzer.processFrame(frameData, i * 33);
            expect(result.metrics).not.toBeNull();
        }
    });

    test('Generates poorQuality blank report when most frames are rejected', () => {
        const analyzer = new ServeAnalyzer('right', 30);

        const badFrame: Point3D[] = new Array(33).fill(null).map(() => ({
            x: 0.5, y: 0.5, z: 0, visibility: 0.1, presence: 0.1
        }));

        for (let i = 0; i < 20; i++) {
            analyzer.processFrame(badFrame, i * 33);
        }

        const report = analyzer.generateFinalReport();
        expect(report.poorQuality).toBe(true);
        expect(report.finalScore).toBe(0);
        expect(report.flags).toEqual([]);
        expect(report.categoryScores.preparacion).toBe(0);
        expect(report.categoryScores.armado).toBe(0);
        expect(report.categoryScores.impacto).toBe(0);
        expect(report.categoryScores.terminacion).toBe(0);
    });

    test('Throws MislabeledVideoError when quality is OK but no serve phases detected', () => {
        const analyzer = new ServeAnalyzer('right', 30);
        const frame = createIdleFrame();

        for (let i = 0; i < 30; i++) {
            analyzer.processFrame(frame, i * 33);
        }

        expect(() => analyzer.generateFinalReport()).toThrow();
    });

});
