import { RuleFlag } from './types';

export const FLAG_DICTIONARY: Partial<Record<RuleFlag, { title: string, subtitle: string, type: 'error' | 'warning' }>> = {
    'INSUFFICIENT_KNEE_BEND': {
        title: 'Poca Flexión de Rodillas',
        subtitle: 'Baja más el centro de gravedad en la fase de armado (Trophy) para generar mayor energía elástica.',
        type: 'error'
    },
    'POOR_TROPHY_POSITION': {
        title: 'Rotación de Hombros Incompleta',
        subtitle: 'Dale la espalda a la red un poco más. Tu rotación coxa-hombro es menor al rango profesional (40°).',
        type: 'error'
    },
    'T_REX_ARM_CONTACT': {
        title: 'Impacto Bajo (T-Rex Arm)',
        subtitle: 'Estás pegando con el codo demasiado doblado. Intenta impactar la bola en el punto más alto posible, extendiendo el brazo 180°.',
        type: 'error'
    },
    'POOR_FOLLOW_THROUGH': {
        title: 'Terminación Corta',
        subtitle: 'El brazo de golpeo no está cruzando completamente hacia tu lado contrario después del impacto. Frena tu raqueta muy pronto.',
        type: 'warning'
    },
    'EARLY_ARM_DROP': {
        title: 'Caída de Brazo Prematura',
        subtitle: 'El brazo de la raqueta bajó o perdió tensión antes de iniciar la fase explosiva hacia la bola. Intenta mantener la estructura de "Trophy" un instante más.',
        type: 'error'
    },
    'POOR_FOOT_ORIENTATION': {
        title: 'Pies muy Frontales',
        subtitle: 'Tus pies están mirando hacia la red. Gira el pie trasero para quedar más de perfil y facilitar la rotación de cadera.',
        type: 'warning'
    },
    'POOR_SHOULDER_ALIGNMENT': {
        title: 'Hombros de Frente',
        subtitle: 'Estás iniciando el saque con el pecho mirando a la red. Gira los hombros (~70°) para generar mayor palanca en el giro.',
        type: 'error'
    },
    'UNKNOWN_ERROR': {
        title: 'Análisis Parcial',
        subtitle: 'La IA no pudo ver algunas fases críticas. El score final puede ser inexacto. Reintenta grabar de cuerpo entero de lado.',
        type: 'warning'
    }
};
