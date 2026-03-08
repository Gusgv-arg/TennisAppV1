import { calculateAngle2D, calculateTorque, getAbsoluteAngleWithHorizontal } from './geometry';
import { DominantHand, Landmark, PoseLandmarks, ServeMetrics } from './types';

/**
 * Extrae todas las métricas físicas de un frame procesado según si es diestro o zurdo.
 * Asume que el array "landmarks" ya está normalizado y limpiado.
 */
export function extractMetrics(landmarks: PoseLandmarks, dominantHand: DominantHand): ServeMetrics {

    // Indices anatómicos basados en la lateralidad
    const domShoulder = dominantHand === 'right' ? Landmark.RIGHT_SHOULDER : Landmark.LEFT_SHOULDER;
    const domElbow = dominantHand === 'right' ? Landmark.RIGHT_ELBOW : Landmark.LEFT_ELBOW;
    const domWrist = dominantHand === 'right' ? Landmark.RIGHT_WRIST : Landmark.LEFT_WRIST;

    // El torque/rotación del tronco requiere ambos hombros y ambas caderas
    const leftShoulder = Landmark.LEFT_SHOULDER;
    const rightShoulder = Landmark.RIGHT_SHOULDER;
    const leftHip = Landmark.LEFT_HIP;
    const rightHip = Landmark.RIGHT_HIP;

    // Para la flexión de rodilla de la pierna dominante (la que se impulsa atrás o ambas, para el saque medimos la dominante, usualmente la posterior)
    // En el saque la pierna posterior suele ser la misma del brazo dominante (ej. pie derecho atrás para diestros)
    const domHip = dominantHand === 'right' ? Landmark.RIGHT_HIP : Landmark.LEFT_HIP;
    const domKnee = dominantHand === 'right' ? Landmark.RIGHT_KNEE : Landmark.LEFT_KNEE;
    const domAnkle = dominantHand === 'right' ? Landmark.RIGHT_ANKLE : Landmark.LEFT_ANKLE;

    // 1. Flexión de Rodilla (Hip -> Knee -> Ankle)
    const kneeFlexionAngle = calculateAngle2D(
        landmarks[domHip],
        landmarks[domKnee],
        landmarks[domAnkle]
    );

    // 2. Extensión de Codo (Shoulder -> Elbow -> Wrist)
    const elbowExtensionAngle = calculateAngle2D(
        landmarks[domShoulder],
        landmarks[domElbow],
        landmarks[domWrist]
    );

    // 3. Torque (Separación Hombros y Caderas)
    // Qué tanto se rotó el pecho alejándose de la red.
    const shoulderRotationAngle = calculateTorque(
        landmarks[leftShoulder],
        landmarks[rightShoulder],
        landmarks[leftHip],
        landmarks[rightHip]
    );

    // Guardamos la rotación horizontal pura de cadera como un extra
    const hipRotationAngle = getAbsoluteAngleWithHorizontal(landmarks[leftHip], landmarks[rightHip]);

    // 6. Rotación de Pies (Tobillos)
    const leftAnkle = Landmark.LEFT_ANKLE;
    const rightAnkle = Landmark.RIGHT_ANKLE;
    const feetRotationAngle = getAbsoluteAngleWithHorizontal(landmarks[leftAnkle], landmarks[rightAnkle]);

    // 4. Elevación de Brazo (Arm Elevation)
    // El ángulo de la recta Shoulder->Elbow respecto a la vertical del torso (cadera hacia hombro)
    // Haremos uso del ángulo 2D respecto a la propia postura
    const armElevationAngle = calculateAngle2D(
        landmarks[domHip],
        landmarks[domShoulder],
        landmarks[domElbow]
    );

    // 5. Velocidad (Se calcula en el Tracker comparando con el frame anterior, por ahora devolvemos cero)
    const wristVerticalVelocity = 0;

    return {
        shoulderRotationAngle,
        hipRotationAngle,
        feetRotationAngle,
        kneeFlexionAngle,
        elbowExtensionAngle,
        armElevationAngle,
        wristVerticalVelocity
    };
}
