import { RuleFlag, StrokeType } from './types';

export interface FlagInfo {
    title: string;
    subtitle: string;
    type: 'error' | 'warning';
}

/**
 * Diccionario de flags agrupados por golpe para fácil mantenimiento y expansión.
 */
export const STROKE_FLAGS: Record<StrokeType, Partial<Record<RuleFlag, FlagInfo>>> = {
    SERVE: {
        'POOR_FOOT_ORIENTATION': {
            title: 'Perfil',
            subtitle: 'Intenta que el ángulo que forman tus pies con la línea de fondo sea menor a 70°.',
            type: 'warning'
        },
        'INSUFFICIENT_KNEE_BEND': {
            title: 'Flexión de Rodillas',
            subtitle: 'Intenta flexionar más las rodillas para generar mayor impulso al golpear.',
            type: 'error'
        },
        'POOR_TROPHY_POSITION': {
            title: 'Posición de Trofeo',
            subtitle: 'Intenta que tu brazo de lanzamiento esté apuntando a la pelota al momento de flexionar tu codo.',
            type: 'error'
        },
        'NO_JUMP': {
            title: 'Despegue',
            subtitle: 'Intenta impulsarte hacia arriba con tus piernas para impactar la pelota en el punto más alto.',
            type: 'error'
        },
        'POOR_FOLLOW_THROUGH': {
            title: 'Terminación',
            subtitle: 'El brazo que golpea no cruzó completamente hacia la rodilla contraria. Deja que el brazo siga su trayectoria natural.',
            type: 'warning'
        }
    },
    // Preparado para el futuro
    DRIVE: {},
    BACKHAND: {},
    VOLLEY: {},
    SMASH: {}
};

/**
 * Flags que aplican a cualquier tipo de golpe (técnicos o de grabación)
 */
export const COMMON_FLAGS: Partial<Record<RuleFlag, FlagInfo>> = {
    'POOR_ORIENTATION': {
        title: 'Orientación del Video Incorrecta',
        subtitle: 'El video parece estar filmado del lado opuesto al esperado. Intenta grabar de perfil desde el lado del brazo dominante.',
        type: 'warning'
    },
    'UNKNOWN_ERROR': {
        title: 'Análisis Parcial',
        subtitle: 'La IA no pudo ver algunas fases críticas. El score final puede ser inexacto. Reintenta grabar de cuerpo entero de lado.',
        type: 'warning'
    }
};

/**
 * Helper para obtener la información de un flag basado en el golpe y fallbacks
 */
export function getFlagInfo(flag: RuleFlag, strokeType: StrokeType): FlagInfo | undefined {
    return STROKE_FLAGS[strokeType]?.[flag] || COMMON_FLAGS[flag];
}

// Mantener compatibilidad temporal con los archivos que importan FLAG_DICTIONARY directamente para el Saque
export const FLAG_DICTIONARY: Partial<Record<RuleFlag, FlagInfo>> = {
    ...STROKE_FLAGS.SERVE,
    ...COMMON_FLAGS
};
