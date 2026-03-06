import { preprocessFrame, resetPreprocessEMA } from '../../../src/services/PoseAnalysis/preprocess';
import { Landmark, Point3D } from '../../../src/services/PoseAnalysis/types';

describe('PoseAnalysis Preprocess Engine', () => {

    beforeEach(() => {
        // Reiniciar el estado del EMA antes de cada test para evitar contaminación cruzada
        resetPreprocessEMA(0.5); // alpha = 0.5
    });

    // Helper: Crea un frame dummy con 33 landmarks válidos y las caderas separadas adecuadamente
    const createDummyFrame = (hipWidth: number, offsetX: number = 0, offsetY: number = 0): Point3D[] => {
        const frame = new Array(33).fill({ x: 0, y: 0, z: 0, visibility: 1 });

        // Poner las caderas centradas pero separadas por hipWidth, con el offset
        frame[Landmark.LEFT_HIP] = { x: offsetX - (hipWidth / 2), y: offsetY, z: 0, visibility: 1 };
        frame[Landmark.RIGHT_HIP] = { x: offsetX + (hipWidth / 2), y: offsetY, z: 0, visibility: 1 };

        // Poner la muñeca en algún lado
        frame[Landmark.RIGHT_WRIST] = { x: offsetX + 10, y: offsetY + 20, z: 0, visibility: 1 };

        return frame;
    };

    test('returns null if frame has insufficient landmarks', () => {
        const result = preprocessFrame([{ x: 0, y: 0, z: 0 }]);
        expect(result).toBeNull();
    });

    test('returns null if hips are not visible', () => {
        const frame = createDummyFrame(10);
        // Ocultar caderas
        frame[Landmark.LEFT_HIP].visibility = 0.1;
        frame[Landmark.RIGHT_HIP].visibility = 0.1;

        const result = preprocessFrame(frame);
        expect(result).toBeNull();
    });

    test('normalizes scale and centers to pelvis', () => {
        // Frame con las caderas desplazadas en (100, 100) y separadas por 50 pixeles
        const frame = createDummyFrame(50, 100, 100);

        const result = preprocessFrame(frame);

        expect(result).not.toBeNull();
        if (result) {
            // El centro exacto entre ambas caderas debe convertirse en (0,0) escalado a 1
            const leftHip = result[Landmark.LEFT_HIP];
            const rightHip = result[Landmark.RIGHT_HIP];

            // Verificamos que se haya centrado
            // Cadera izq (100 - 25 = 75) original. Centro 100. (75 - 100) / 50 = -0.5
            expect(leftHip.x).toBeCloseTo(-0.5);
            // Cadera der (100 + 25 = 125) original. Centro 100. (125 - 100) / 50 = 0.5
            expect(rightHip.x).toBeCloseTo(0.5);

            // Ambas deben estar en Y = 0 local
            expect(leftHip.y).toBeCloseTo(0);
            expect(rightHip.y).toBeCloseTo(0);
        }
    });

    test('applies EMA smoothing correctly across frames', () => {
        const frame1 = createDummyFrame(10, 0, 0); // Muñeca en (10, 20)

        // Proceso el frame 1 (sin smoothing ya que es el primero)
        preprocessFrame(frame1);

        // Frame 2, el jugador se desplazó violentamente (ruido), muñeca ahora en (30, 40)
        // Las caderas se mantienen igual para no afectar la escala en este test
        const frame2 = createDummyFrame(10, 0, 0);
        frame2[Landmark.RIGHT_WRIST] = { x: 30, y: 40, z: 0, visibility: 1 };

        // Como alpha es 0.5, esperamos que el EMA haga un promedio (10 + 30) / 2 = 20
        // (y en Y: 20 + 40 / 2 = 30)

        // Cuidado: preprocessFrame devuelve coordenadas normalizadas (divididas por el hip width = 10)
        // Coordenada esperada NO normalizada = x:20, y:30
        // Coordenada esperada normalizada = x: 20/10 = 2, y: 30/10 = 3

        const result = preprocessFrame(frame2);
        expect(result).not.toBeNull();

        if (result) {
            expect(result[Landmark.RIGHT_WRIST].x).toBeCloseTo(2);
            expect(result[Landmark.RIGHT_WRIST].y).toBeCloseTo(3);
        }
    });
});
