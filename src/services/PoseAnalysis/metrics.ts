import { calculateAngle2D, calculateClockwiseAngle2D, calculateFootAngle3D, distance2D } from './geometry';
import { DominantHand, Landmark, PoseLandmarks, ServeMetrics } from './types';

/**
 * Extrae las 5 métricas biomecánicas v2 de un frame procesado.
 * Landmarks según docs/BIOMECHANICAL_SCHEMA.md
 */
export function extractMetrics(landmarks: PoseLandmarks, dominantHand: DominantHand): ServeMetrics {

    // ─── Indicador 1: Orientación de Pies ───
    // Diestro: Pie trasero (32) → Pie delantero (31). Ángulo vs baseline.
    // Zurdo:   Pie trasero (31) → Pie delantero (32). Ángulo vs baseline.
    const backFoot = dominantHand === 'right' ? Landmark.RIGHT_FOOT_INDEX : Landmark.LEFT_FOOT_INDEX;
    const frontFoot = dominantHand === 'right' ? Landmark.LEFT_FOOT_INDEX : Landmark.RIGHT_FOOT_INDEX;
    const footOrientationAngle = calculateFootAngle3D(landmarks[backFoot], landmarks[frontFoot]);

    // ─── Indicador 2: Flexión de Rodilla Delantera ───
    // Diestro: Tobillo (27) → Rodilla (25) → Cadera (23) – Sentido horario desde Línea 1
    // Zurdo:   Tobillo (28) → Rodilla (26) → Cadera (24) – Sentido horario desde Línea 1
    const frontAnkle = dominantHand === 'right' ? Landmark.LEFT_ANKLE : Landmark.RIGHT_ANKLE;
    const frontKnee = dominantHand === 'right' ? Landmark.LEFT_KNEE : Landmark.RIGHT_KNEE;
    const frontHip = dominantHand === 'right' ? Landmark.LEFT_HIP : Landmark.RIGHT_HIP;
    const frontKneeFlexionAngle = calculateClockwiseAngle2D(
        landmarks[frontAnkle],   // p1 (desde aquí)
        landmarks[frontKnee],    // vertex
        landmarks[frontHip]      // p2 (hacia aquí, sentido horario)
    );

    // ─── Indicador 3: Posición de Trofeo ───
    // Diestro: Desde línea (12-14) hasta línea (15-11) – sentido anti-horario
    // Zurdo:   Desde línea (11-13) hasta línea (16-12) – sentido anti-horario
    const domShoulder = dominantHand === 'right' ? Landmark.RIGHT_SHOULDER : Landmark.LEFT_SHOULDER;
    const domElbow = dominantHand === 'right' ? Landmark.RIGHT_ELBOW : Landmark.LEFT_ELBOW;
    const domWrist = dominantHand === 'right' ? Landmark.RIGHT_WRIST : Landmark.LEFT_WRIST;
    const tossWrist = dominantHand === 'right' ? Landmark.LEFT_WRIST : Landmark.RIGHT_WRIST;
    const tossShoulder = dominantHand === 'right' ? Landmark.LEFT_SHOULDER : Landmark.RIGHT_SHOULDER;

    const trophyAlignmentAngle = calculateAngle2D(
        landmarks[domElbow],        // p1: Codo dominante
        landmarks[tossShoulder],    // vertex: Hombro no dominante
        landmarks[tossWrist]        // p2: Muñeca no dominante
    );

    // ─── Auxiliar: Ángulo del codo dominante (Trigger Trophy a 90°) ───
    const dominantElbowAngle = calculateAngle2D(
        landmarks[domShoulder],
        landmarks[domElbow],
        landmarks[domWrist]
    );

    // ─── Indicador 4: Despegue del piso ───
    // Se calcula la diferencia Y promedio de los talones respecto a su posición
    // Esto se compara contra el baseline en ServeAnalyzer; aquí solo extraemos el Y actual
    const leftHeel = landmarks[Landmark.LEFT_HEEL];
    const rightHeel = landmarks[Landmark.RIGHT_HEEL];
    const heelLiftDelta = (leftHeel.y + rightHeel.y) / 2; // Valor absoluto Y; el delta se calcula en ServeAnalyzer

    // ─── Indicador 5: Terminación ───
    // Diestro: Muñeca derecha (16) debe pasar la línea de la rodilla izquierda (25)
    // Zurdo:   Muñeca izquierda (15) debe pasar la línea de la rodilla derecha (26)
    const wristForCross = landmarks[domWrist];
    const kneeForCross = dominantHand === 'right' ? landmarks[Landmark.LEFT_KNEE] : landmarks[Landmark.RIGHT_KNEE];
    // "Pasar" = la muñeca está más abajo (y mayor) que la rodilla en coordenadas MediaPipe
    const wristCrossedKnee = wristForCross.y > kneeForCross.y;

    // ─── Auxiliar: Elevación del brazo dominante (para detección de fases) ───
    const domHip = dominantHand === 'right' ? Landmark.RIGHT_HIP : Landmark.LEFT_HIP;
    const armElevationAngle = calculateAngle2D(
        landmarks[domHip],
        landmarks[domShoulder],
        landmarks[domElbow]
    );

    // ─── Auxiliar: Elevación del brazo de lanzamiento (para buscar el peak del Trophy) ───
    const tossWristPoint = dominantHand === 'right' ? Landmark.LEFT_WRIST : Landmark.RIGHT_WRIST;
    const tossHip = dominantHand === 'right' ? Landmark.LEFT_HIP : Landmark.RIGHT_HIP;
    const tossArmElevationAngle = calculateAngle2D(
        landmarks[tossHip],
        landmarks[tossShoulder],
        landmarks[tossWristPoint]
    );

    // ─── Auxiliar: Distancia tobillo opuesto - muñeca dominante (Trigger Impacto) ───
    const dominantWristToAnkleDistance = distance2D(landmarks[frontAnkle], landmarks[domWrist]);

    // ─── Auxiliar: Distancia muñeca dominante - rodilla opuesta (Trigger Terminación) ───
    const handToOppositeKneeDistance = distance2D(landmarks[domWrist], landmarks[frontKnee]);

    // ─── Auxiliar: Distancia hombro - muñeca de lanzamiento (para monitoreo del armado) ───
    const tossArmDistance = distance2D(landmarks[tossShoulder], landmarks[tossWristPoint]);

    return {
        footOrientationAngle,
        frontKneeFlexionAngle,
        trophyAlignmentAngle,
        heelLiftDelta,
        wristCrossedKnee,
        dominantElbowAngle,
        armElevationAngle,
        tossArmElevationAngle,
        dominantWristToAnkleDistance,
        handToOppositeKneeDistance,
        tossArmDistance
    };
}
