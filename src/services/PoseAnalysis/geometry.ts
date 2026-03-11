import { Point3D } from './types';

/**
 * Calcula la distancia Euclidiana en 2D (solo x e y)
 * Utiliza solo X/Y porque la cámara monocromática común tiene un eje Z (profundidad) ruidoso.
 */
export function distance2D(p1: Point3D, p2: Point3D): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calcula el ángulo interno (0 a 180 grados) formado por tres puntos p1, p2, p3 
 * donde p2 es el vértice. Se proyecta en 2D.
 * Útil para: codo, rodilla, etc.
 */
export function calculateAngle2D(p1: Point3D, p2: Point3D, p3: Point3D): number {
    // Vector p2 -> p1
    const vx1 = p1.x - p2.x;
    const vy1 = p1.y - p2.y;

    // Vector p2 -> p3
    const vx2 = p3.x - p2.x;
    const vy2 = p3.y - p2.y;

    // Producto escalar
    const dotProduct = vx1 * vx2 + vy1 * vy2;

    // Magnitudes
    const mag1 = Math.sqrt(vx1 * vx1 + vy1 * vy1);
    const mag2 = Math.sqrt(vx2 * vx2 + vy2 * vy2);

    // Evitar división por cero si dos puntos se superponen accidentalmente
    if (mag1 === 0 || mag2 === 0) return 0;

    let cosine = dotProduct / (mag1 * mag2);

    // Precisión de coma flotante
    cosine = Math.max(-1, Math.min(1, cosine));

    // Convertir de radianes a grados
    return Math.acos(cosine) * (180 / Math.PI);
}

/**
 * Calcula el ángulo absoluto de una línea respecto a la horizontal pura [0, 180°].
 * Útil para medir la rotación pura de los hombros (shoulder to shoulder) respecto al piso.
 */
export function getAbsoluteAngleWithHorizontal(leftPoint: Point3D, rightPoint: Point3D): number {
    const dx = rightPoint.x - leftPoint.x;
    const dy = rightPoint.y - leftPoint.y;

    let radians = Math.atan2(dy, dx);
    let degrees = radians * (180 / Math.PI);

    // Devolvemos la elevación positiva
    return Math.abs(degrees);
}

/**
 * Calcula la diferencia angular entre la recta A y la recta B.
 * Se utiliza para medir la separación Hombros-Caderas en el Trophy pose (Torque).
 */
export function calculateTorque(leftShoulder: Point3D, rightShoulder: Point3D, leftHip: Point3D, rightHip: Point3D): number {
    const shoulderAngle = getAbsoluteAngleWithHorizontal(leftShoulder, rightShoulder);
    const hipAngle = getAbsoluteAngleWithHorizontal(leftHip, rightHip);

    return Math.abs(shoulderAngle - hipAngle);
}

/**
 * Obtiene el punto medio exacto entre dos puntos. 
 * Muy usado para encontrar el "Centro del Pecho" (entre hombros) o la "Pelvis" (entre caderas)
 */
export function midpoint(p1: Point3D, p2: Point3D): Point3D {
    return {
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p2.y) / 2,
        z: (p1.z + p2.z) / 2, // Se mantiene z sólo como referencia
        visibility: ((p1.visibility ?? 1) + (p2.visibility ?? 1)) / 2
    };
}

/**
 * Calcula el ángulo en sentido horario (clockwise) desde el vector (vertex→p1) hacia (vertex→p2).
 * Rango: [0, 360). Se usa para la flexión de rodilla delantera.
 * En MediaPipe, Y crece hacia abajo, lo cual invierte el sentido matemático.
 */
export function calculateClockwiseAngle2D(p1: Point3D, vertex: Point3D, p2: Point3D): number {
    // Vector vertex -> p1
    const v1x = p1.x - vertex.x;
    const v1y = p1.y - vertex.y;

    // Vector vertex -> p2
    const v2x = p2.x - vertex.x;
    const v2y = p2.y - vertex.y;

    // Ángulo de cada vector respecto al eje X positivo
    const angle1 = Math.atan2(v1y, v1x);
    const angle2 = Math.atan2(v2y, v2x);

    // Diferencia en sentido horario (en coordenadas de pantalla donde Y baja)
    let diff = (angle2 - angle1) * (180 / Math.PI);
    if (diff < 0) diff += 360;

    return diff;
}

/**
 * Calcula el ángulo en sentido anti-horario entre dos líneas.
 * Línea A: lineA_start → lineA_end
 * Línea B: lineB_start → lineB_end
 * Se mide desde la dirección de la Línea A hacia la Línea B en sentido anti-horario.
 * Rango: [0, 360). Se usa para la posición de trofeo.
 */
export function calculateAngleBetweenLines2D(
    lineA_start: Point3D, lineA_end: Point3D,
    lineB_start: Point3D, lineB_end: Point3D
): number {
    // Dirección de la línea A
    const dxA = lineA_end.x - lineA_start.x;
    const dyA = lineA_end.y - lineA_start.y;

    // Dirección de la línea B
    const dxB = lineB_end.x - lineB_start.x;
    const dyB = lineB_end.y - lineB_start.y;

    const angleA = Math.atan2(dyA, dxA);
    const angleB = Math.atan2(dyB, dxB);

    // Anti-horario: desde A hacia B (en coordenadas de pantalla, invertido)
    let diff = (angleA - angleB) * (180 / Math.PI);
    if (diff < 0) diff += 360;

    return diff;
}

/**
 * Normaliza las coordenadas de un set de puntos para que el centro (ej: Pelvis) sea (0,0)
 * y reescala basándose en una distancia de referencia (ej: Ancho de Caderas = 1 unidad).
 * Esto permite comparar métricas entre un video tomado de lejos y otro de cerca.
 */
export function normalizeLandmarks(landmarks: Point3D[], originIndex1: number, originIndex2: number): Point3D[] {
    if (landmarks.length === 0) return [];

    const origin1 = landmarks[originIndex1];
    const origin2 = landmarks[originIndex2];

    const center = midpoint(origin1, origin2);

    // Usamos el ancho entre estos dos puntos como Scale Base (Ej: Hombros o Caderas)
    let scale = distance2D(origin1, origin2);
    if (scale < 0.0001) scale = 1; // Safeguard divisor 0

    return landmarks.map(point => ({
        x: (point.x - center.x) / scale,
        y: (point.y - center.y) / scale,
        z: (point.z - center.z) / scale,
        visibility: point.visibility,
        presence: point.presence
    }));
}
