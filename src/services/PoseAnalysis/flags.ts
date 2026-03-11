import { RuleFlag } from './types';

export const FLAG_DICTIONARY: Partial<Record<RuleFlag, { title: string, subtitle: string, type: 'error' | 'warning' }>> = {
    'POOR_FOOT_ORIENTATION': {
        title: 'Pies muy Frontales',
        subtitle: 'Tus pies están mirando hacia la red. Gira los pies para quedar más de perfil (~70°) y facilitar la rotación de cadera.',
        type: 'warning'
    },
    'INSUFFICIENT_KNEE_BEND': {
        title: 'Poca Flexión de Rodilla',
        subtitle: 'Baja más el centro de gravedad flexionando la rodilla delantera (< 150°) para generar mayor impulso.',
        type: 'error'
    },
    'POOR_TROPHY_POSITION': {
        title: 'Posición de Trofeo Débil',
        subtitle: 'Busca alinear los brazos en forma de flecha (> 150°) cuando el codo llega a 90° para maximizar la carga elástica.',
        type: 'error'
    },
    'NO_JUMP': {
        title: 'Sin Despegue',
        subtitle: 'No se detectó un salto suficiente. Intenta impulsarte hacia arriba (+10 cm) para impactar la bola en el punto más alto.',
        type: 'error'
    },
    'POOR_FOLLOW_THROUGH': {
        title: 'Terminación Incompleta',
        subtitle: 'El brazo que golpea no cruzó completamente hacia la rodilla contraria. Deja que el brazo siga su trayectoria natural.',
        type: 'warning'
    },
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
