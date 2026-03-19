import { preprocessFrame, resetPreprocessEMA } from '../../../src/services/PoseAnalysis/preprocess';
import { Landmark, Point3D } from '../../../src/services/PoseAnalysis/types';

describe('PoseAnalysis Preprocess Engine', () => {

    beforeEach(() => {
        // Reiniciar el estado del EMA y outlier tracker antes de cada test
        resetPreprocessEMA(0.5); // alpha = 0.5
    });

    // Helper: Crea un frame dummy con 33 landmarks válidos en coordenadas normalizadas [0,1]
    // con las caderas separadas y torso de tamaño adecuado
    const createDummyFrame = (
        hipWidth: number = 0.15,
        centerX: number = 0.5,
        centerY: number = 0.5
    ): Point3D[] => {
        const frame: Point3D[] = new Array(33).fill(null).map(() => ({
            x: centerX, y: centerY, z: 0, visibility: 1.0, presence: 1.0
        }));

        // Caderas separadas por hipWidth
        frame[Landmark.LEFT_HIP] = { x: centerX - (hipWidth / 2), y: centerY, z: 0, visibility: 1, presence: 1 };
        frame[Landmark.RIGHT_HIP] = { x: centerX + (hipWidth / 2), y: centerY, z: 0, visibility: 1, presence: 1 };

        // Hombros arriba de las caderas (torso height = 0.2, bien por encima del mínimo 0.12)
        frame[Landmark.LEFT_SHOULDER] = { x: centerX - (hipWidth / 2), y: centerY - 0.2, z: 0, visibility: 1, presence: 1 };
        frame[Landmark.RIGHT_SHOULDER] = { x: centerX + (hipWidth / 2), y: centerY - 0.2, z: 0, visibility: 1, presence: 1 };

        // Nariz arriba
        frame[Landmark.NOSE] = { x: centerX, y: centerY - 0.3, z: 0, visibility: 1, presence: 1 };

        // Codos y muñecas visibles
        frame[Landmark.LEFT_ELBOW] = { x: centerX - 0.1, y: centerY - 0.1, z: 0, visibility: 0.9, presence: 1 };
        frame[Landmark.RIGHT_ELBOW] = { x: centerX + 0.1, y: centerY - 0.1, z: 0, visibility: 0.9, presence: 1 };
        frame[Landmark.LEFT_WRIST] = { x: centerX - 0.15, y: centerY, z: 0, visibility: 0.8, presence: 1 };
        frame[Landmark.RIGHT_WRIST] = { x: centerX + 0.15, y: centerY, z: 0, visibility: 0.8, presence: 1 };

        return frame;
    };

    test('returns null if frame has insufficient landmarks', () => {
        const result = preprocessFrame([{ x: 0, y: 0, z: 0 }]);
        expect(result).toBeNull();
    });

    test('returns null if core joints have low visibility', () => {
        const frame = createDummyFrame();
        // Ocultar caderas y hombros (4 de 5 core joints)
        frame[Landmark.LEFT_HIP].visibility = 0.1;
        frame[Landmark.RIGHT_HIP].visibility = 0.1;
        frame[Landmark.LEFT_SHOULDER].visibility = 0.2;
        frame[Landmark.RIGHT_SHOULDER].visibility = 0.2;

        const result = preprocessFrame(frame);
        expect(result).toBeNull();
    });

    test('returns null if torso is too small (player too far)', () => {
        const frame = createDummyFrame();
        // Hombros casi al mismo nivel que caderas (torso muy pequeño < 0.12)
        frame[Landmark.LEFT_SHOULDER].y = frame[Landmark.LEFT_HIP].y - 0.05;
        frame[Landmark.RIGHT_SHOULDER].y = frame[Landmark.RIGHT_HIP].y - 0.05;

        const result = preprocessFrame(frame);
        expect(result).toBeNull();
    });

    test('valid frame returns normalized data with frameQuality', () => {
        const frame = createDummyFrame();
        const result = preprocessFrame(frame);

        expect(result).not.toBeNull();
        if (result) {
            expect(result.normalized).toBeDefined();
            expect(result.smoothed).toBeDefined();
            expect(result.frameQuality).toBeGreaterThan(0.5);
            expect(result.frameQuality).toBeLessThanOrEqual(1.0);
        }
    });

    test('normalizes scale and centers to pelvis', () => {
        const frame = createDummyFrame(0.15, 0.5, 0.5);

        const result = preprocessFrame(frame);
        expect(result).not.toBeNull();

        if (result) {
            const leftHip = result.normalized[Landmark.LEFT_HIP];
            const rightHip = result.normalized[Landmark.RIGHT_HIP];

            // Caderas deben estar centradas simétricamente en X
            expect(leftHip.x).toBeCloseTo(-0.5, 0);
            expect(rightHip.x).toBeCloseTo(0.5, 0);
        }
    });

    test('applies EMA smoothing correctly across frames', () => {
        const frame1 = createDummyFrame();
        preprocessFrame(frame1); // Primer frame, sin smoothing

        // Frame 2: muevo la muñeca derecha drásticamente pero dentro del threshold de outlier
        const frame2 = createDummyFrame();
        frame2[Landmark.RIGHT_WRIST] = { x: 0.7, y: 0.5, z: 0, visibility: 0.9, presence: 1 };

        const result = preprocessFrame(frame2);
        expect(result).not.toBeNull();

        if (result) {
            // Con alpha = 0.5, el smoothed debe estar entre el valor original y el nuevo
            const smoothedWrist = result.smoothed[Landmark.RIGHT_WRIST];
            // La muñeca original estaba en ~0.65, la nueva en 0.7 → promedio ~0.675
            expect(smoothedWrist.x).toBeGreaterThan(0.6);
            expect(smoothedWrist.x).toBeLessThan(0.75);
        }
    });

    test('detects kinematic outlier when many joints jump at once', () => {
        const frame1 = createDummyFrame(0.15, 0.5, 0.5);
        preprocessFrame(frame1);

        // Frame 2: todas las articulaciones saltan a posiciones completamente diferentes
        const frame2 = createDummyFrame(0.15, 0.9, 0.9); // Todo se mueve 0.4 en X e Y

        const result = preprocessFrame(frame2);
        // Debería ser rechazado por outlier cinemático (muchos joints saltaron)
        expect(result).toBeNull();
    });
});
