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

// Configuración general de preprocesado
const PREPROCESS_CONFIG = {
    // MediaPipe tiene 33 landmarks
    EXPECTED_LANDMARK_COUNT: 33,
    // Factor EMA. 0.5 un balance razonable para deportes rápidos
    EMA_ALPHA: 0.5,
    // Puntos de referencia para normalizar la escala (pelvis width/center)
    NORM_ORIGIN_1: Landmark.LEFT_HIP,
    NORM_ORIGIN_2: Landmark.RIGHT_HIP
};

// Estado EMA persistente durante toda la sesión
let emaState: EMAState = {
    previousLandmarks: null,
    alpha: PREPROCESS_CONFIG.EMA_ALPHA
};

/**
 * Reinicia el filtro EMA al comenzar a analizar un video nuevo.
 */
export function resetPreprocessEMA(alpha: number = PREPROCESS_CONFIG.EMA_ALPHA) {
    emaState = {
        previousLandmarks: null,
        alpha
    };
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
 * Pipeline completo de pre-procesamiento para un Frame crudo.
 * 1. Valida los landmarks básicos
 * 2. Aplica filtro de suavizado
 * 3. Normaliza espacialmente respecto a caderas
 * @returns Un objeto con landmarks 'normalized' (para métricas) y 'smoothed' (para UI), o null si falla.
 */
export function preprocessFrame(rawLandmarks: PoseLandmarks): { normalized: PoseLandmarks, smoothed: PoseLandmarks } | null {
    if (!rawLandmarks || rawLandmarks.length < PREPROCESS_CONFIG.EXPECTED_LANDMARK_COUNT) {
        // Frame defectuoso o sin cuerpo detectado
        return null;
    }

    // Comprobar visibilidad estructural de alta fiabilidad
    // Evita que la IA "alucine" esqueletos detectando formas en paredes o texturas vacías.
    const nose = rawLandmarks[Landmark.NOSE];
    const leftShoulder = rawLandmarks[Landmark.LEFT_SHOULDER];
    const rightShoulder = rawLandmarks[Landmark.RIGHT_SHOULDER];
    const leftHip = rawLandmarks[Landmark.LEFT_HIP];
    const rightHip = rawLandmarks[Landmark.RIGHT_HIP];

    const coreJoints = [nose, leftShoulder, rightShoulder, leftHip, rightHip];
    let highConfidenceJoints = 0;

    for (const joint of coreJoints) {
        if (joint && (joint.visibility ?? 1.0) > 0.5) {
            highConfidenceJoints++;
        }
    }

    // Requiretmos que la mayoría del core (torso/cabeza) sea claramente visible para siquiera medir ángulos
    if (highConfidenceJoints < 3) {
        return null;
    }

    // Paso 1: Smoothing temporal
    const smoothed = applyEMA(rawLandmarks);

    // Paso 2: Normalización espacial (Eje centrado en pelvis)
    // normalizeLandmarks ya devuelve un array nuevo con objetos nuevos.
    const normalized = normalizeLandmarks(smoothed, PREPROCESS_CONFIG.NORM_ORIGIN_1, PREPROCESS_CONFIG.NORM_ORIGIN_2);

    return { 
        normalized, 
        smoothed: smoothed as PoseLandmarks // Este ya es un array nuevo generado por applyEMA
    };
}
