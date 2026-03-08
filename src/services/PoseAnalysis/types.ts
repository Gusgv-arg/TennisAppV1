/**
 * MediaPipe Pose Landmarks Mapping
 * Basado en la especificación oficial de BlazePose (33 Keypoints)
 */
export enum Landmark {
    NOSE = 0,
    LEFT_EYE_INNER = 1,
    LEFT_EYE = 2,
    LEFT_EYE_OUTER = 3,
    RIGHT_EYE_INNER = 4,
    RIGHT_EYE = 5,
    RIGHT_EYE_OUTER = 6,
    LEFT_EAR = 7,
    RIGHT_EAR = 8,
    MOUTH_LEFT = 9,
    MOUTH_RIGHT = 10,
    LEFT_SHOULDER = 11,
    RIGHT_SHOULDER = 12,
    LEFT_ELBOW = 13,
    RIGHT_ELBOW = 14,
    LEFT_WRIST = 15,
    RIGHT_WRIST = 16,
    LEFT_PINKY = 17,
    RIGHT_PINKY = 18,
    LEFT_INDEX = 19,
    RIGHT_INDEX = 20,
    LEFT_THUMB = 21,
    RIGHT_THUMB = 22,
    LEFT_HIP = 23,
    RIGHT_HIP = 24,
    LEFT_KNEE = 25,
    RIGHT_KNEE = 26,
    LEFT_ANKLE = 27,
    RIGHT_ANKLE = 28,
    LEFT_HEEL = 29,
    RIGHT_HEEL = 30,
    LEFT_FOOT_INDEX = 31,
    RIGHT_FOOT_INDEX = 32
}

/**
 * Coordenada 2D o 3D entregada por MediaPipe.
 * x, y, z están normalizadas en el rango [0.0, 1.0] (por el ancho/alto de la imagen)
 * visibility indica la certeza de que el punto existe y no está ocluido [0.0, 1.0].
 */
export interface Point3D {
    x: number;
    y: number;
    z: number;
    visibility?: number;
    presence?: number;
}

/**
 * Un resultado de pose para un único frame (en MediaPipe Tasks).
 */
export type PoseLandmarks = Point3D[];

/**
 * Representa a un frame procesado listo para el motor geométrico.
 */
export interface ProcessedFrame {
    timestampMs: number;
    landmarks: PoseLandmarks;
}

/**
 * Fases reconocidas de la máquina de estados del saque.
 */
export enum ServePhase {
    IDLE = 'IDLE',
    SETUP = 'SETUP',
    TROPHY = 'TROPHY',
    ACCELERATION = 'ACCELERATION',
    CONTACT = 'CONTACT',
    FOLLOW_THROUGH = 'FOLLOW_THROUGH'
}

/**
 * Métricas extraídas en un frame particular.
 */
export interface ServeMetrics {
    shoulderRotationAngle: number;
    hipRotationAngle: number;
    feetRotationAngle: number; // Ángulo de la línea entre tobillos respecto a la horizontal
    kneeFlexionAngle: number;
    elbowExtensionAngle: number;
    wristVerticalVelocity: number;
    armElevationAngle: number;
}

/**
 * Flags (Fallas, Errores o Warnings) de la técnica detectados por `rules.ts`
 */
export type RuleFlag =
    | 'INSUFFICIENT_KNEE_BEND'
    | 'POOR_TROPHY_POSITION'
    | 'T_REX_ARM_CONTACT'
    | 'POOR_FOLLOW_THROUGH'
    | 'EARLY_ARM_DROP'
    | 'POOR_FOOT_ORIENTATION'     // Nueva: Pies mal perfilados
    | 'POOR_SHOULDER_ALIGNMENT'   // Nueva: Hombros mal perfilados
    | 'POOR_ORIENTATION'
    | 'UNKNOWN_ERROR';

/**
 * Reporte Final Estructurado emitido por el `ServeAnalyzer`
 */
export interface ServeAnalysisReport {
    finalScore: number;        // Weighted 0-100
    detailedMetrics: {
        footOrientationScore: number;
        shoulderOrientationScore: number;
        kneeFlexionScore: number;
        shoulderRotationScore: number;
        elbowExtensionScore: number;
        energyTransferScore: number;
    };
    categoryScores: {
        preparation: number;
        trophy: number;
        contact: number;
        energyTransfer: number;
        followThrough: number;
    };
    flags: RuleFlag[];
    confidence: number;
    // Punteros al frame exacto del evento para repetición
    keyframes: {
        trophyTimestampMs?: number;
        contactTimestampMs?: number;
    };
    coach_feedback?: string;
}

/**
 * Define el brazo dominante del jugador (vital para saber qué rodilla evaluar)
 */
export type DominantHand = 'right' | 'left';
