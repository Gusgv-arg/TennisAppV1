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

// ─── DIAGNOSTIC LOGGING ───
// Throttled gate rejection logger to avoid flooding the console
const _gateRejectionCounts: Record<string, number> = {};
function _logGateRejection(gate: string, detail: string) {
    _gateRejectionCounts[gate] = (_gateRejectionCounts[gate] || 0) + 1;
    // Log every 30th rejection per gate (and the first one)
    if (_gateRejectionCounts[gate] === 1 || _gateRejectionCounts[gate] % 30 === 0) {
        console.warn(`[Preprocess] ${gate} rejected frame #${_gateRejectionCounts[gate]}: ${detail}`);
    }
}

/** Resets gate rejection counters (call when starting a new video) */
export function resetGateDiagnostics() {
    for (const key of Object.keys(_gateRejectionCounts)) {
        delete _gateRejectionCounts[key];
    }
}

/** Returns summary of rejected frames by gate */
export function getGateDiagnostics(): Record<string, number> {
    return { ..._gateRejectionCounts };
}

// ─── CONFIG CENTRALIZADO DE CALIDAD ───
export const QUALITY_CONFIG = {
    // MediaPipe tiene 33 landmarks
    EXPECTED_LANDMARK_COUNT: 33,
    // Factor EMA. 0.35 prioriza estabilidad sobre responsividad (antes 0.5)
    EMA_ALPHA: 0.35,
    // Puntos de referencia para normalizar la escala (pelvis width/center)
    NORM_ORIGIN_1: Landmark.LEFT_HIP,
    NORM_ORIGIN_2: Landmark.RIGHT_HIP,

    // ─── Gate de Visibilidad ───
    // Core joints: nariz, hombros, caderas
    CORE_VISIBILITY_MIN: 0.50,       // Mantener en 0.50 — subir más causa rechazo excesivo
    CORE_JOINTS_REQUIRED: 4,          // de 5 core joints

    // Extremidades: codos y muñecas (4 joints)
    EXTREMITY_VISIBILITY_MIN: 0.30,
    EXTREMITY_JOINTS_REQUIRED: 2,     // de 4 extremity joints

    // ─── Tamaño del esqueleto ───
    TORSO_SIZE_MIN: 0.06,            // hombro→cadera en coordenadas normalizadas [0,1]

    // ─── Detección de Outliers Cinemáticos ───
    OUTLIER_POSITION_DELTA: 0.20,     // Salto máximo por joint regular entre frames
    OUTLIER_FAST_JOINT_DELTA: 0.30,   // Salto máximo para joints rápidos (muñecas, pies)
    OUTLIER_JOINTS_TO_DISCARD: 3,     // Mantener en 3 — bajar a 2 era demasiado agresivo

    // ─── Gate de Consistencia Anatómica ───
    // Ratio torso/piernas: en un humano adulto el torso (hombro→cadera) ÷ pierna (cadera→tobillo) es aprox 0.45-0.85
    // En perfil, la perspectiva comprime un eje y puede distorsionar los ratios significativamente
    ANATOMY_TORSO_LEG_RATIO_MIN: 0.15,
    ANATOMY_TORSO_LEG_RATIO_MAX: 2.0,
    // Ratio de simetría bilateral: |brazo_izq - brazo_der| / max(brazo_izq, brazo_der) < umbral
    // En perfil correcto, un brazo está mucho más cerca y el otro comprimido → alta asimetría es normal
    ANATOMY_BILATERAL_SYMMETRY_MAX: 0.90,

    // ─── Gate de Estabilidad Temporal del Torso ───
    TORSO_CENTER_JUMP_MAX: 0.15,      // Relajado: un jugador puede moverse rápido durante el saque

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

// Estado del centro del torso anterior para Gate 6
let previousTorsoCenter: { x: number, y: number } | null = null;

/**
 * Reinicia el filtro EMA al comenzar a analizar un video nuevo.
 */
export function resetPreprocessEMA(alpha: number = QUALITY_CONFIG.EMA_ALPHA) {
    emaState = {
        previousLandmarks: null,
        alpha
    };
    previousRawLandmarks = null;
    previousTorsoCenter = null;
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
 * Gate 5: Verificación de consistencia anatómica.
 * Descarta frames donde las proporciones del esqueleto son imposibles
 * (ej: brazo mide 3x la longitud de una pierna, indicando landmark corrupto).
 */
function checkAnatomicalPlausibility(landmarks: Point3D[]): boolean {
    const leftShoulder = landmarks[Landmark.LEFT_SHOULDER];
    const leftHip = landmarks[Landmark.LEFT_HIP];
    const leftAnkle = landmarks[Landmark.LEFT_ANKLE];
    const rightShoulder = landmarks[Landmark.RIGHT_SHOULDER];
    const rightHip = landmarks[Landmark.RIGHT_HIP];
    const rightAnkle = landmarks[Landmark.RIGHT_ANKLE];

    // Calcular longitud del torso (hombro→cadera) y pierna (cadera→tobillo)
    const torsoLenLeft = dist2D(leftShoulder, leftHip);
    const legLenLeft = dist2D(leftHip, leftAnkle);
    const torsoLenRight = dist2D(rightShoulder, rightHip);
    const legLenRight = dist2D(rightHip, rightAnkle);

    // Usar los lados con mejor visibilidad
    const leftVis = Math.min(leftShoulder.visibility ?? 0, leftHip.visibility ?? 0, leftAnkle.visibility ?? 0);
    const rightVis = Math.min(rightShoulder.visibility ?? 0, rightHip.visibility ?? 0, rightAnkle.visibility ?? 0);

    const torsoLen = leftVis > rightVis ? torsoLenLeft : torsoLenRight;
    const legLen = leftVis > rightVis ? legLenLeft : legLenRight;

    // Si pierna tiene longitud 0 o despreciable, no podemos calcular ratio
    if (legLen < 0.01 || torsoLen < 0.01) return false;

    const ratio = torsoLen / legLen;
    if (ratio < QUALITY_CONFIG.ANATOMY_TORSO_LEG_RATIO_MIN || ratio > QUALITY_CONFIG.ANATOMY_TORSO_LEG_RATIO_MAX) {
        return false; // Proporciones imposibles
    }

    // Verificar simetría bilateral: ambos brazos no deben tener longitudes radicalmente diferentes
    const leftArmLen = dist2D(leftShoulder, landmarks[Landmark.LEFT_WRIST]);
    const rightArmLen = dist2D(rightShoulder, landmarks[Landmark.RIGHT_WRIST]);
    const maxArm = Math.max(leftArmLen, rightArmLen);

    if (maxArm > 0.01) {
        const armAsymmetry = Math.abs(leftArmLen - rightArmLen) / maxArm;
        if (armAsymmetry > QUALITY_CONFIG.ANATOMY_BILATERAL_SYMMETRY_MAX) {
            return false; // Un brazo detectado absurdamente diferente al otro
        }
    }

    return true;
}

/**
 * Gate 6: Verifica que el centro del torso no salte bruscamente entre frames.
 * Detecta casos donde el modelo salta a otra persona o al fondo.
 */
function checkTorsoCenterStability(landmarks: Point3D[]): boolean {
    const leftShoulder = landmarks[Landmark.LEFT_SHOULDER];
    const rightShoulder = landmarks[Landmark.RIGHT_SHOULDER];
    const leftHip = landmarks[Landmark.LEFT_HIP];
    const rightHip = landmarks[Landmark.RIGHT_HIP];

    const currentCenter = {
        x: (leftShoulder.x + rightShoulder.x + leftHip.x + rightHip.x) / 4,
        y: (leftShoulder.y + rightShoulder.y + leftHip.y + rightHip.y) / 4
    };

    if (!previousTorsoCenter) {
        previousTorsoCenter = currentCenter;
        return true;
    }

    const dx = Math.abs(currentCenter.x - previousTorsoCenter.x);
    const dy = Math.abs(currentCenter.y - previousTorsoCenter.y);
    const jump = Math.sqrt(dx * dx + dy * dy);

    if (jump > QUALITY_CONFIG.TORSO_CENTER_JUMP_MAX) {
        // NO actualizamos previousTorsoCenter para que el siguiente frame se compare vs el último bueno
        return false;
    }

    previousTorsoCenter = currentCenter;
    return true;
}

/** Simple 2D distance helper (internal) */
function dist2D(a: Point3D, b: Point3D): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
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
 * 3. Verifica consistencia anatómica (Gate 5) y estabilidad temporal (Gate 6)
 * 4. Aplica filtro de suavizado
 * 5. Normaliza espacialmente respecto a caderas
 * @returns Un objeto con landmarks 'normalized' (para métricas), 'smoothed' (para UI) y 'frameQuality' (0-1), o null si falla.
 */
export function preprocessFrame(rawLandmarks: PoseLandmarks): { normalized: PoseLandmarks, smoothed: PoseLandmarks, frameQuality: number } | null {
    if (!rawLandmarks || rawLandmarks.length < QUALITY_CONFIG.EXPECTED_LANDMARK_COUNT) {
        // Frame defectuoso o sin cuerpo detectado
        _logGateRejection('BASIC', 'No landmarks or insufficient count');
        return null;
    }

    // ─── Gate 1: Visibilidad de Core Joints ───
    const nose = rawLandmarks[Landmark.NOSE];
    const leftShoulder = rawLandmarks[Landmark.LEFT_SHOULDER];
    const rightShoulder = rawLandmarks[Landmark.RIGHT_SHOULDER];
    const leftHip = rawLandmarks[Landmark.LEFT_HIP];
    const rightHip = rawLandmarks[Landmark.RIGHT_HIP];

    const coreJoints = [nose, leftShoulder, rightShoulder, leftHip, rightHip];
    const coreNames = ['nose', 'L_shoulder', 'R_shoulder', 'L_hip', 'R_hip'];
    let highConfidenceCoreJoints = 0;

    for (let i = 0; i < coreJoints.length; i++) {
        const joint = coreJoints[i];
        if (joint && (joint.visibility ?? 1.0) > QUALITY_CONFIG.CORE_VISIBILITY_MIN) {
            highConfidenceCoreJoints++;
        }
    }

    if (highConfidenceCoreJoints < QUALITY_CONFIG.CORE_JOINTS_REQUIRED) {
        const visDetails = coreJoints.map((j, i) => `${coreNames[i]}=${(j?.visibility ?? 0).toFixed(2)}`).join(', ');
        _logGateRejection('GATE1_VISIBILITY', `Core joints ${highConfidenceCoreJoints}/${QUALITY_CONFIG.CORE_JOINTS_REQUIRED} above ${QUALITY_CONFIG.CORE_VISIBILITY_MIN}. [${visDetails}]`);
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
        _logGateRejection('GATE2_EXTREMITIES', `Extremity joints ${highConfidenceExtremities}/${QUALITY_CONFIG.EXTREMITY_JOINTS_REQUIRED}`);
        return null;
    }

    // ─── Gate 3: Tamaño mínimo del torso ───
    if (leftShoulder && leftHip) {
        const torsoHeight = Math.abs(leftShoulder.y - leftHip.y);
        if (torsoHeight < QUALITY_CONFIG.TORSO_SIZE_MIN) {
            _logGateRejection('GATE3_TORSO_SIZE', `Torso height=${torsoHeight.toFixed(3)} < ${QUALITY_CONFIG.TORSO_SIZE_MIN}`);
            return null;
        }
    }

    // ─── Gate 4: Detección de Outliers Cinemáticos ───
    if (detectKinematicOutliers(rawLandmarks)) {
        _logGateRejection('GATE4_KINEMATIC', 'Too many joints jumped between frames');
        return null;
    }

    // ─── Gate 5: Consistencia Anatómica ───
    if (!checkAnatomicalPlausibility(rawLandmarks)) {
        _logGateRejection('GATE5_ANATOMY', 'Implausible body proportions');
        return null;
    }

    // ─── Gate 6: Estabilidad Temporal del Centro del Torso ───
    if (!checkTorsoCenterStability(rawLandmarks)) {
        _logGateRejection('GATE6_TORSO_JUMP', 'Torso center jumped too far');
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
