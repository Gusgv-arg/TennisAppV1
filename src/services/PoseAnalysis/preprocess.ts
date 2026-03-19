import { normalizeLandmarks } from './geometry';
import { Landmark, Point3D, PoseLandmarks } from './types';

/**
 * Exponential Moving Average (EMA) state.
 * Útil para suavizar el "Jitter" (temblor) de los landmarks devueltos por la IA frame a frame.
 */
interface EMAState {
    previousLandmarks: Point3D[] | null;
    alpha: number; // Factor de suavizado (0 a 1). Más cercano a 0: más suave pero más lag. Cercano a 1: sin lag pero más ruidoso.
}

// ─── CONFIG CENTRALIZADO DE CALIDAD ───
export const QUALITY_CONFIG = {
    // MediaPipe tiene 33 landmarks
    EXPECTED_LANDMARK_COUNT: 33,
    // Factor EMA. 0.5 un balance razonable para deportes rápidos
    EMA_ALPHA: 0.5,
    // Puntos de referencia para normalizar la escala (pelvis width/center)
    NORM_ORIGIN_1: Landmark.LEFT_HIP,
    NORM_ORIGIN_2: Landmark.RIGHT_HIP,

    // ─── Gate de Visibilidad ───
    // Core joints: nariz, hombros, caderas
    CORE_VISIBILITY_MIN: 0.50,
    CORE_JOINTS_REQUIRED: 4,          // de 5 core joints

    // Extremidades: codos y muñecas (4 joints)
    EXTREMITY_VISIBILITY_MIN: 0.30,
    EXTREMITY_JOINTS_REQUIRED: 2,     // de 4 extremity joints

    // ─── Tamaño del esqueleto ───
    TORSO_SIZE_MIN: 0.06,            // hombro→cadera en coordenadas normalizadas [0,1]

    // ─── Detección de Outliers Cinemáticos ───
    OUTLIER_POSITION_DELTA: 0.20,     // Salto máximo por joint regular entre frames
    OUTLIER_FAST_JOINT_DELTA: 0.30,   // Salto máximo para joints rápidos (muñecas, pies)
    OUTLIER_JOINTS_TO_DISCARD: 3,     // Si N+ joints saltan → descartar frame

    // ─── Frame Quality ───
    // Los 13 joints principales para calcular quality score
    QUALITY_JOINTS: [
        Landmark.NOSE,
        Landmark.LEFT_SHOULDER, Landmark.RIGHT_SHOULDER,
        Landmark.LEFT_ELBOW, Landmark.RIGHT_ELBOW,
        Landmark.LEFT_WRIST, Landmark.RIGHT_WRIST,
        Landmark.LEFT_HIP, Landmark.RIGHT_HIP,
        Landmark.LEFT_KNEE, Landmark.RIGHT_KNEE,
        Landmark.LEFT_ANKLE, Landmark.RIGHT_ANKLE
    ] as number[],

    // Joints que se mueven rápido (threshold más relajado para outliers)
    FAST_JOINTS: new Set([
        Landmark.LEFT_WRIST, Landmark.RIGHT_WRIST,
        Landmark.LEFT_ANKLE, Landmark.RIGHT_ANKLE,
        Landmark.LEFT_FOOT_INDEX, Landmark.RIGHT_FOOT_INDEX
    ] as number[])
};

// Estado EMA persistente durante toda la sesión
let emaState: EMAState = {
    previousLandmarks: null,
    alpha: QUALITY_CONFIG.EMA_ALPHA
};

// Estado del frame anterior para detección de outliers cinemáticos
let previousRawLandmarks: Point3D[] | null = null;

/**
 * Reinicia el filtro EMA al comenzar a analizar un video nuevo.
 */
export function resetPreprocessEMA(alpha: number = QUALITY_CONFIG.EMA_ALPHA) {
    emaState = {
        previousLandmarks: null,
        alpha
    };
    previousRawLandmarks = null;
}

/**
 * Aplica el suavizado EMA a un array de puntos completo.
 */
function applyEMA(current: Point3D[]): Point3D[] {
    // Clonación profunda inicial para romper cualquier vínculo con el buffer de memoria
    // del motor de visión (Provider) que suele ser reutilizado entre frames.
    const currentClone: Point3D[] = current.map(p => ({
        x: p.x,
        y: p.y,
        z: p.z || 0,
        visibility: p.visibility ?? 1.0,
        presence: p.presence ?? 1.0
    }));

    if (!emaState.previousLandmarks) {
        emaState.previousLandmarks = currentClone;
        return currentClone;
    }

    const smoothed: Point3D[] = [];
    const len = Math.min(current.length, emaState.previousLandmarks.length);

    for (let i = 0; i < len; i++) {
        const currPoint = current[i];
        const prevPoint = emaState.previousLandmarks[i];

        // Mezclamos (1-a) * Prev + a * Current
        const smoothedPoint: Point3D = {
            x: emaState.alpha * currPoint.x + (1 - emaState.alpha) * prevPoint.x,
            y: emaState.alpha * currPoint.y + (1 - emaState.alpha) * prevPoint.y,
            z: emaState.alpha * currPoint.z + (1 - emaState.alpha) * prevPoint.z,
            visibility: currPoint.visibility,
            presence: currPoint.presence
        };
        smoothed.push(smoothedPoint);
    }

    emaState.previousLandmarks = smoothed;
    return smoothed;
}

/**
 * Detecta outliers cinemáticos comparando posiciones frame a frame.
 * Retorna true si el frame debe ser descartado por contener saltos absurdos.
 */
function detectKinematicOutliers(currentLandmarks: Point3D[]): boolean {
    if (!previousRawLandmarks) {
        // Primer frame, no hay referencia — no podemos detectar outliers
        return false;
    }

    const len = Math.min(currentLandmarks.length, previousRawLandmarks.length);
    let jumpingJoints = 0;

    for (let i = 0; i < len; i++) {
        const curr = currentLandmarks[i];
        const prev = previousRawLandmarks[i];

        const dx = Math.abs(curr.x - prev.x);
        const dy = Math.abs(curr.y - prev.y);
        const delta = Math.sqrt(dx * dx + dy * dy);

        const threshold = QUALITY_CONFIG.FAST_JOINTS.has(i)
            ? QUALITY_CONFIG.OUTLIER_FAST_JOINT_DELTA
            : QUALITY_CONFIG.OUTLIER_POSITION_DELTA;

        if (delta > threshold) {
            jumpingJoints++;
        }
    }

    return jumpingJoints >= QUALITY_CONFIG.OUTLIER_JOINTS_TO_DISCARD;
}

/**
 * Calcula un score de calidad (0-1) para el frame basado en visibility y tamaño del esqueleto.
 */
function calculateFrameQuality(landmarks: Point3D[]): number {
    // Promedio de visibility de los 13 joints principales
    let visibilitySum = 0;
    let validCount = 0;

    for (const idx of QUALITY_CONFIG.QUALITY_JOINTS) {
        if (idx < landmarks.length && landmarks[idx]) {
            visibilitySum += (landmarks[idx].visibility ?? 0);
            validCount++;
        }
    }

    const avgVisibility = validCount > 0 ? visibilitySum / validCount : 0;

    // Factor de tamaño del torso (0-1). Si el torso ocupa >= 25% de la imagen, factor = 1
    const leftShoulder = landmarks[Landmark.LEFT_SHOULDER];
    const leftHip = landmarks[Landmark.LEFT_HIP];
    let sizeFactor = 1.0;
    if (leftShoulder && leftHip) {
        const torsoSize = Math.abs(leftShoulder.y - leftHip.y);
        sizeFactor = Math.min(1.0, torsoSize / 0.25); // Normalizar: 0.25 = torso ideal
    }

    return avgVisibility * 0.7 + sizeFactor * 0.3;
}

/**
 * Pipeline completo de pre-procesamiento para un Frame crudo.
 * 1. Valida los landmarks básicos
 * 2. Verifica visibilidad, tamaño y outliers cinemáticos
 * 3. Aplica filtro de suavizado
 * 4. Normaliza espacialmente respecto a caderas
 * @returns Un objeto con landmarks 'normalized' (para métricas), 'smoothed' (para UI) y 'frameQuality' (0-1), o null si falla.
 */
export function preprocessFrame(rawLandmarks: PoseLandmarks): { normalized: PoseLandmarks, smoothed: PoseLandmarks, frameQuality: number } | null {
    if (!rawLandmarks || rawLandmarks.length < QUALITY_CONFIG.EXPECTED_LANDMARK_COUNT) {
        // Frame defectuoso o sin cuerpo detectado
        return null;
    }

    // ─── Gate 1: Visibilidad de Core Joints ───
    const nose = rawLandmarks[Landmark.NOSE];
    const leftShoulder = rawLandmarks[Landmark.LEFT_SHOULDER];
    const rightShoulder = rawLandmarks[Landmark.RIGHT_SHOULDER];
    const leftHip = rawLandmarks[Landmark.LEFT_HIP];
    const rightHip = rawLandmarks[Landmark.RIGHT_HIP];

    const coreJoints = [nose, leftShoulder, rightShoulder, leftHip, rightHip];
    let highConfidenceCoreJoints = 0;

    for (const joint of coreJoints) {
        if (joint && (joint.visibility ?? 1.0) > QUALITY_CONFIG.CORE_VISIBILITY_MIN) {
            highConfidenceCoreJoints++;
        }
    }

    if (highConfidenceCoreJoints < QUALITY_CONFIG.CORE_JOINTS_REQUIRED) {
        return null;
    }

    // ─── Gate 2: Visibilidad de Extremidades (codos + muñecas) ───
    const extremityJoints = [
        rawLandmarks[Landmark.LEFT_ELBOW],
        rawLandmarks[Landmark.RIGHT_ELBOW],
        rawLandmarks[Landmark.LEFT_WRIST],
        rawLandmarks[Landmark.RIGHT_WRIST]
    ];
    let highConfidenceExtremities = 0;

    for (const joint of extremityJoints) {
        if (joint && (joint.visibility ?? 1.0) > QUALITY_CONFIG.EXTREMITY_VISIBILITY_MIN) {
            highConfidenceExtremities++;
        }
    }

    if (highConfidenceExtremities < QUALITY_CONFIG.EXTREMITY_JOINTS_REQUIRED) {
        return null;
    }

    // ─── Gate 3: Tamaño mínimo del torso ───
    if (leftShoulder && leftHip) {
        const torsoHeight = Math.abs(leftShoulder.y - leftHip.y);
        if (torsoHeight < QUALITY_CONFIG.TORSO_SIZE_MIN) {
            return null;
        }
    }

    // ─── Gate 4: Detección de Outliers Cinemáticos ───
    if (detectKinematicOutliers(rawLandmarks)) {
        // No actualizamos previousRawLandmarks para que el próximo frame
        // se compare contra el último frame bueno
        return null;
    }

    // Actualizar referencia para el próximo frame
    previousRawLandmarks = rawLandmarks.map(p => ({
        x: p.x, y: p.y, z: p.z || 0,
        visibility: p.visibility, presence: p.presence
    }));

    // ─── Calcular calidad del frame ───
    const frameQuality = calculateFrameQuality(rawLandmarks);

    // Paso 1: Smoothing temporal
    const smoothed = applyEMA(rawLandmarks);

    // Paso 2: Normalización espacial (Eje centrado en pelvis)
    // normalizeLandmarks ya devuelve un array nuevo con objetos nuevos.
    const normalized = normalizeLandmarks(smoothed, QUALITY_CONFIG.NORM_ORIGIN_1, QUALITY_CONFIG.NORM_ORIGIN_2);

    return {
        normalized,
        smoothed: smoothed as PoseLandmarks, // Este ya es un array nuevo generado por applyEMA
        frameQuality
    };
}
