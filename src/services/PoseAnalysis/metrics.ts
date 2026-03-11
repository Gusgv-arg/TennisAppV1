import { calculateAngle2D, calculateAngleBetweenLines2D, calculateClockwiseAngle2D, getAbsoluteAngleWithHorizontal } from './geometry';
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
    const footOrientationAngle = getAbsoluteAngleWithHorizontal(landmarks[backFoot], landmarks[frontFoot]);

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

    const trophyAlignmentAngle = calculateAngleBetweenLines2D(
        landmarks[domShoulder], landmarks[domElbow],  // Línea A: Hombro dom → Codo dom
        landmarks[tossWrist], landmarks[tossShoulder]  // Línea B: Muñeca toss → Hombro toss
    );

    // ─── Auxiliar: Ángulo del codo dominante (Trigger Trophy a 90°) ───
    const dominantElbowAngle = calculateAngle2D(
        landmarks[domShoulder],
        landmarks[domElbow],
        landmarks[domWrist]
    );

    // ─── Indicador 4: Despegue de Talón ───
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

    // ─── Auxiliar: Elevación del brazo (para detección de fases en PhaseTracker) ───
    const domHip = dominantHand === 'right' ? Landmark.RIGHT_HIP : Landmark.LEFT_HIP;
    const armElevationAngle = calculateAngle2D(
        landmarks[domHip],
        landmarks[domShoulder],
        landmarks[domElbow]
    );

    return {
        footOrientationAngle,
        frontKneeFlexionAngle,
        trophyAlignmentAngle,
        heelLiftDelta,
        wristCrossedKnee,
        dominantElbowAngle,
        armElevationAngle
    };
}
