import { calculateAngle2D, calculateAngleBetweenLines2D, calculateClockwiseAngle2D, distance2D, getAbsoluteAngleWithHorizontal, midpoint, normalizeLandmarks } from '../../../src/services/PoseAnalysis/geometry';
import { Point3D } from '../../../src/services/PoseAnalysis/types';

describe('PoseAnalysis Geometry Engine', () => {

    test('distance2D calculates exact hypotenuse', () => {
        const p1: Point3D = { x: 0, y: 0, z: 0 };
        const p2: Point3D = { x: 3, y: 4, z: 0 };
        expect(distance2D(p1, p2)).toBeCloseTo(5);
    });

    test('calculateAngle2D for a 90 degree elbow bend', () => {
        const shoulder = { x: 0, y: 0, z: 0 };
        const elbow = { x: 10, y: 0, z: 0 };
        const wrist = { x: 10, y: 10, z: 0 };

        const angle = calculateAngle2D(shoulder, elbow, wrist);
        expect(angle).toBeCloseTo(90);
    });

    test('calculateAngle2D for a fully extended arm (180 deg)', () => {
        const p1 = { x: 0, y: 0, z: 0 };
        const p2 = { x: 10, y: 0, z: 0 };
        const p3 = { x: 20, y: 0, z: 0 };

        expect(calculateAngle2D(p1, p2, p3)).toBeCloseTo(180);
    });

    test('getAbsoluteAngleWithHorizontal measures shoulder tilt', () => {
        const left = { x: 0, y: 0, z: 0 };
        const right = { x: 10, y: 10, z: 0 };

        const angle = getAbsoluteAngleWithHorizontal(left, right);
        expect(angle).toBeCloseTo(45);
    });

    test('midpoint finds exact center', () => {
        const p1 = { x: -2, y: -2, z: 0 };
        const p2 = { x: 2, y: 2, z: 0 };

        const center = midpoint(p1, p2);
        expect(center.x).toBeCloseTo(0);
        expect(center.y).toBeCloseTo(0);
    });

    test('normalizeLandmarks correctly translates and scales to local space', () => {
        const p1 = { x: 10, y: 10, z: 0 };
        const p2 = { x: 20, y: 10, z: 0 };

        const landmarks = [
            p1, p2,
            { x: 10, y: 20, z: 0 }
        ];

        const normalized = normalizeLandmarks(landmarks, 0, 1);

        expect(normalized[0].x).toBeCloseTo(-0.5);
        expect(normalized[1].x).toBeCloseTo(0.5);
        expect(normalized[2].y).toBeCloseTo(1);
    });

    // --- Nuevas pruebas para funciones v2 ---

    test('calculateClockwiseAngle2D: ángulo recto (90° CW)', () => {
        // Vertex en el centro, p1 apuntando arriba, p2 apuntando a la derecha
        const vertex = { x: 0, y: 0, z: 0 };
        const p1 = { x: 0, y: -1, z: 0 }; // Arriba en pantalla (Y decrece)
        const p2 = { x: 1, y: 0, z: 0 };  // Derecha

        const angle = calculateClockwiseAngle2D(p1, vertex, p2);
        expect(angle).toBeCloseTo(90);
    });

    test('calculateClockwiseAngle2D: línea recta (180° CW)', () => {
        const vertex = { x: 5, y: 5, z: 0 };
        const p1 = { x: 0, y: 5, z: 0 }; // Izquierda
        const p2 = { x: 10, y: 5, z: 0 }; // Derecha

        const angle = calculateClockwiseAngle2D(p1, vertex, p2);
        expect(angle).toBeCloseTo(180);
    });

    test('calculateAngleBetweenLines2D: líneas perpendiculares (CCW = 270°)', () => {
        // Línea A: horizontal hacia la derecha
        const a1 = { x: 0, y: 0, z: 0 };
        const a2 = { x: 10, y: 0, z: 0 };

        // Línea B: vertical hacia abajo (en coordenadas de pantalla, Y crece abajo)
        const b1 = { x: 5, y: 0, z: 0 };
        const b2 = { x: 5, y: 10, z: 0 };

        const angle = calculateAngleBetweenLines2D(a1, a2, b1, b2);
        // CCW de horizontal a vertical-abajo = 270° (equivalente a 90° CW)
        expect(angle).toBeCloseTo(270);
    });

    test('calculateAngleBetweenLines2D: líneas paralelas = ~0° o ~360°', () => {
        const a1 = { x: 0, y: 0, z: 0 };
        const a2 = { x: 10, y: 0, z: 0 };

        const b1 = { x: 0, y: 5, z: 0 };
        const b2 = { x: 10, y: 5, z: 0 };

        const angle = calculateAngleBetweenLines2D(a1, a2, b1, b2);
        // Paralelas misma dirección: ángulo 0 (o 360, que se normaliza a 0)
        expect(angle % 360).toBeCloseTo(0, 0);
    });
});
