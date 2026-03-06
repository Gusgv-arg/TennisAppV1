import { calculateAngle2D, calculateTorque, distance2D, getAbsoluteAngleWithHorizontal, midpoint, normalizeLandmarks } from '../../../src/services/PoseAnalysis/geometry';
import { Point3D } from '../../../src/services/PoseAnalysis/types';

describe('PoseAnalysis Geometry Engine', () => {

    test('distance2D calculates exact hypotenuse', () => {
        const p1: Point3D = { x: 0, y: 0, z: 0 };
        const p2: Point3D = { x: 3, y: 4, z: 0 };
        // Pitágoras 3-4-5
        expect(distance2D(p1, p2)).toBeCloseTo(5);
    });

    test('calculateAngle2D for a 90 degree elbow bend', () => {
        // Hombro
        const shoulder = { x: 0, y: 0, z: 0 };
        // Codo a la misma altura horizontal (x = 10, y = 0)
        const elbow = { x: 10, y: 0, z: 0 };
        // Muñeca doblada 90 grados exactos arriba (x = 10, y = 10)
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
        // Hombro izquierdo
        const left = { x: 0, y: 0, z: 0 };
        // Hombro derecho más alto 
        const right = { x: 10, y: 10, z: 0 };

        const angle = getAbsoluteAngleWithHorizontal(left, right);
        expect(angle).toBeCloseTo(45);
    });

    test('calculateTorque measures difference between shoulders and hips', () => {
        // Hombros inclinados 45 grados
        const leftShoulder = { x: 0, y: 0, z: 0 };
        const rightShoulder = { x: 10, y: 10, z: 0 }; // 45°

        // Caderas perfectamente horizontales
        const leftHip = { x: 0, y: 5, z: 0 };
        const rightHip = { x: 10, y: 5, z: 0 }; // 0°

        const torque = calculateTorque(leftShoulder, rightShoulder, leftHip, rightHip);
        expect(torque).toBeCloseTo(45);
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
        const p2 = { x: 20, y: 10, z: 0 }; // origin 2 (width = 10)

        const landmarks = [
            p1, p2,
            { x: 10, y: 20, z: 0 } // Punto externo
        ];

        // Normalizamos usando el index 0 y 1 como las caderas
        const normalized = normalizeLandmarks(landmarks, 0, 1);

        // La distancia entre 0 y 1 original era 10, por ende el factor de escala es 10
        // El punto 0 (10,10) - center(15,10) / 10 = X (-0.5)
        expect(normalized[0].x).toBeCloseTo(-0.5);
        expect(normalized[1].x).toBeCloseTo(0.5);

        // El punto externo que estaba a un ancho de distancia "1" hacia abajo
        // original Y=20, centro Y=10. Dif = 10 / escala 10 = Y (1)
        expect(normalized[2].y).toBeCloseTo(1);
    });
});
