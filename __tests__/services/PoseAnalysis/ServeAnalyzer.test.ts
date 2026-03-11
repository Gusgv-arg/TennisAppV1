import { ServeAnalyzer } from '../../../src/services/PoseAnalysis/ServeAnalyzer';
import { Landmark, Point3D } from '../../../src/services/PoseAnalysis/types';

describe('ServeAnalyzer Orchestrator', () => {

    const createStableFrame = (): Point3D[] => {
        const frame = new Array(33).fill({ x: 0, y: 0, z: 0, visibility: 1 });
        frame[Landmark.LEFT_HIP] = { x: -5, y: 0, z: 0, visibility: 1 };
        frame[Landmark.RIGHT_HIP] = { x: 5, y: 0, z: 0, visibility: 1 };
        // Hombros
        frame[Landmark.LEFT_SHOULDER] = { x: -5, y: 20, z: 0, visibility: 1 };
        frame[Landmark.RIGHT_SHOULDER] = { x: 5, y: 20, z: 0, visibility: 1 };
        // Codo y Muñeca armada y alta
        frame[Landmark.RIGHT_ELBOW] = { x: 15, y: 15, z: 0, visibility: 1 };
        frame[Landmark.RIGHT_WRIST] = { x: 15, y: 30, z: 0, visibility: 1 };
        // Rodillas algo flexionadas
        frame[Landmark.RIGHT_KNEE] = { x: 5, y: -10, z: 0, visibility: 1 };
        frame[Landmark.RIGHT_ANKLE] = { x: 5, y: -20, z: 0, visibility: 1 };

        return frame;
    };

    /**
     * Modifica ligeramente el array de landmarks para simular la fase de Impacto
     */
    const makeContactFrame = (baseFrame: Point3D[]): Point3D[] => {
        const frame = [...baseFrame];
        // Estira todas las rodillas saltando
        frame[Landmark.RIGHT_KNEE] = { x: 5, y: -10, z: 0, visibility: 1 };
        frame[Landmark.RIGHT_ANKLE] = { x: 5, y: -25, z: 0, visibility: 1 };
        // Estira el codo apuntando al cielo
        frame[Landmark.RIGHT_ELBOW] = { x: 10, y: 30, z: 0, visibility: 1 };
        frame[Landmark.RIGHT_WRIST] = { x: 10, y: 45, z: 0, visibility: 1 };
        return frame;
    };

    test('Runs full pipeline without exceptions on valid data', () => {
        const analyzer = new ServeAnalyzer('right', 30);

        const frameData = createStableFrame();

        // Simular que el video manda 5 frames idénticos armados
        for (let i = 0; i < 5; i++) {
            const result = analyzer.processFrame(frameData, i * 33); // 33ms por frame = 30fps
            expect(result.metrics).not.toBeNull();
        }

        // Simular que de repente se estiró al cielo (Impacto)
        const contactFrame = makeContactFrame(frameData);
        for (let i = 5; i < 10; i++) {
            analyzer.processFrame(contactFrame, i * 33);
        }

        const report = analyzer.generateFinalReport();
        // The engine won't crash, but confidence might be low because fake frames
        // didn't strictly follow IDLE->SETUP->TROPHY->ACCEL->CONTACT physics.
        expect(report.confidence).toBeGreaterThanOrEqual(0);
        expect(report.keyframes).toBeDefined();
    });

    test('Throws MislabeledVideoError if video was cut before Trophy detection', () => {
        const analyzer = new ServeAnalyzer('right', 30);
        const frameData = createStableFrame();

        // Solo mandamos frames de armado, el video se corta antes de que el Trophy sea detectado
        for (let i = 0; i < 5; i++) {
            analyzer.processFrame(frameData, i * 33);
        }

        // Debe lanzar error porque nunca se capturó el Trophy keyframe
        expect(() => analyzer.generateFinalReport()).toThrow('El movimiento analizado no presenta las características biomecánicas de un Saque.');
    });

});
