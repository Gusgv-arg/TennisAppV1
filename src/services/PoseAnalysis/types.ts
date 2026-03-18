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
 * Tipos de golpes soportados por la IA
 */
export type StrokeType = 'SERVE' | 'DRIVE' | 'BACKHAND' | 'VOLLEY' | 'SMASH';

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
 * Sistema v2: 5 indicadores biomecánicos alineados con docs/BIOMECHANICAL_SCHEMA.md
 */
export interface ServeMetrics {
    // Indicador 1: Orientación de pies (ángulo vector pie trasero→delantero vs baseline)
    footOrientationAngle: number;
    // Indicador 2: Flexión de rodilla delantera (ángulo horario Tobillo→Rodilla→Cadera)
    frontKneeFlexionAngle: number;
    // Indicador 3: Posición de Trofeo (ángulo anti-horario brazo raqueta vs brazo lanzamiento)
    trophyAlignmentAngle: number;
    // Indicador 4: Despegue del piso (diferencia Y respecto a posición inicial)
    heelLiftDelta: number;
    // Indicador 5: Terminación (¿muñeca cruzó la rodilla contraria?)
    wristCrossedKnee: boolean;
    // Auxiliar: ángulo del codo dominante (para detectar trigger Trophy a 90°)
    dominantElbowAngle: number;
    // Auxiliar: elevación del brazo dominante (para detección de fases)
    armElevationAngle: number;
    // Auxiliar: elevación del brazo de lanzamiento (para buscar el peak del Trophy)
    tossArmElevationAngle: number;
    // Auxiliar: distancia entre tobillo opuesto y muñeca dominante (para detectar el peak de impacto)
    dominantWristToAnkleDistance: number;
    // Auxiliar: distancia entre muñeca dominante y rodilla opuesta (para detectar peak de terminación)
    handToOppositeKneeDistance: number;
    // Auxiliar: distancia entre hombro y muñeca del brazo de lanzamiento (no dominante)
    tossArmDistance: number;
}

/**
 * Flags (Fallas, Errores o Warnings) de la técnica detectados por `rules.ts`
 */
export type RuleFlag =
    | 'POOR_FOOT_ORIENTATION'     // Pies demasiado frontales
    | 'INSUFFICIENT_KNEE_BEND'    // Rodilla no flexionó lo suficiente
    | 'POOR_TROPHY_POSITION'      // Posición de trofeo con poca alineación
    | 'NO_JUMP'                   // No se detectó despegue de talones
    | 'POOR_FOLLOW_THROUGH'       // Brazo no cruzó la rodilla contraria
    | 'POOR_ORIENTATION'          // Video filmado del lado equivocado
    | 'NOT_MEASURABLE_JUMP'       // No se pudo calcular el salto (falta baseline)
    | 'UNKNOWN_ERROR';

/**
 * Reporte Final Estructurado emitido por el `ServeAnalyzer`
 */
export interface ServeAnalysisReport {
    strokeType: StrokeType;
    finalScore: number;        // Weighted 0-100
    detailedMetrics: {
        footOrientationScore: number;   // Indicador 1
        kneeFlexionScore: number;       // Indicador 2
        trophyPositionScore: number;    // Indicador 3
        heelLiftScore: number;          // Indicador 4
        followThroughScore: number;     // Indicador 5
    };
    categoryScores: {
        preparacion: number;   // Fase 1 - 25%
        armado: number;        // Fase 2 - 25% (12.5% + 12.5%)
        impacto: number;       // Fase 3 - 25%
        terminacion: number;   // Fase 4 - 25%
    };
    flags: RuleFlag[];
    flagMetadata?: Record<string, { title: string, subtitle: string }>;
    confidence: number;
    // Punteros al frame exacto del evento para repetición
    keyframes: {
        setup: { timestamp: number; landmarks: PoseLandmarks | null; metrics?: ServeMetrics | null, phase?: string };
        trophy: { timestamp: number; landmarks: PoseLandmarks | null; metrics?: ServeMetrics | null, phase?: string };
        contact: { timestamp: number; landmarks: PoseLandmarks | null; metrics?: ServeMetrics | null, phase?: string };
        finish: { timestamp: number; landmarks: PoseLandmarks | null; metrics?: ServeMetrics | null, phase?: string };
    };
    ai_feedback?: {
        flags: RuleFlag[];
        keyframes: any;
        fullRawFrames?: any[];
    };
    coach_feedback?: string;
}

/**
 * Define el brazo dominante del jugador (vital para saber qué rodilla evaluar)
 */
export type DominantHand = 'right' | 'left';
