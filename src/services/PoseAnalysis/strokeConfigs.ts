import { StrokeType } from './types';

export interface MetricDefinition {
    key: string;
    label: string;
    ref: string;
}

export interface PhaseMetricsConfig {
    preparacion: MetricDefinition[];
    armado: MetricDefinition[];
    impacto: MetricDefinition[];
    terminacion: MetricDefinition[];
}

export const STROKE_METRICS_CONFIG: Record<StrokeType, PhaseMetricsConfig> = {
    // Para el SAQUE, mantenemos las claves exactas originales para retrocompatibilidad
    SERVE: {
        preparacion: [
            { key: 'footOrientationScore', label: 'Orientación de Pies', ref: 'Perfil mínimo de 70° respecto a la línea de fondo.' }
        ],
        armado: [
            { key: 'kneeFlexionScore', label: 'Flexión de Rodilla', ref: 'Ángulo menor a 150°.' },
            { key: 'trophyPositionScore', label: 'Posición de Trofeo', ref: 'Brazo no dominante elevado y codo dominante a 90°.' }
        ],
        impacto: [
            { key: 'heelLiftScore', label: 'Despegue del piso', ref: 'Salto mínimo de 10 cm.' }
        ],
        terminacion: [
            { key: 'followThroughScore', label: 'Terminación Cruzada', ref: 'Mano dominante cruza la pierna contraria.' }
        ]
    },
    DRIVE: {
        preparacion: [
            { key: 'splitStep', label: 'Posición de Espera', ref: 'Split step y raqueta a la altura de los ojos.' }
        ],
        armado: [
            { key: 'backswing', label: 'Unit Turn', ref: 'Gira los hombros y lleva la raqueta hacia atrás.' }
        ],
        impacto: [
            { key: 'contactPoint', label: 'Punto de Impacto', ref: 'Impacto de la pelota adelante del cuerpo.' }
        ],
        terminacion: [
            { key: 'followThrough', label: 'Acompañamiento', ref: 'Brazo dominante continúa su trayectoria natural sin freno.' }
        ]
    },
    BACKHAND: {
        preparacion: [
            { key: 'splitStep', label: 'Posición de espera', ref: 'Split step y raqueta a la altura de los ojos.' }
        ],
        armado: [
            { key: 'backswing', label: 'Unit Turn', ref: 'Giro de hombros y raqueta hacia atrás.' }
        ],
        impacto: [
            { key: 'contactPoint', label: 'Punto de Impacto', ref: 'Impacto delante del cuerpo.' }
        ],
        terminacion: [
            { key: 'followThrough', label: 'Acompañamiento', ref: 'Brazo dominante continúa su trayectoria natural sin freno.' }
        ]
    },
    VOLLEY: {
        preparacion: [
            { key: 'readyPosition', label: 'Posición de Espera', ref: 'Raqueta alta y split step marcado.' }
        ],
        armado: [
            { key: 'shortBackswing', label: 'Armado Corto', ref: 'Cabeza de raqueta arriba, sin cruzar la línea de los hombros hacia atrás.' }
        ],
        impacto: [
            { key: 'block', label: 'Bloqueo Adelante', ref: 'Impacto seco y firme ("punch") frente al cuerpo, usando el peso hacia adelante.' }
        ],
        terminacion: [
            { key: 'shortFinish', label: 'Terminación Corta', ref: 'Acompañamiento muy breve, la raqueta frena casi inmediato al impacto.' }
        ]
    },
    SMASH: {
        preparacion: [
            { key: 'positioning', label: 'Posicionamiento (Pasos Cruzados)', ref: 'Ajuste rápido hacia atrás con pasos laterales/cruzados, midiendo la pelota con brazo libre.' }
        ],
        armado: [
            { key: 'trophyPosition', label: 'Armado', ref: 'Posición de trofeo o armado directo detrás de la cabeza.' }
        ],
        impacto: [
            { key: 'contactPoint', label: 'Punto de Impacto', ref: 'Impacto arriba y ligeramente adelante, brazo extendido.' }
        ],
        terminacion: [
            { key: 'followThrough', label: 'Acompañamiento', ref: 'Terminación cruzando la raqueta por delante del cuerpo.' }
        ]
    }
};
