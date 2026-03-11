import { ServePhase } from './types';

/**
 * Traducción de fases técnicas a nombres amigables para el usuario (Progreso)
 */
export const PHASE_LABELS: Record<ServePhase, string> = {
    [ServePhase.IDLE]: 'Iniciando...',
    [ServePhase.SETUP]: 'Preparación',
    [ServePhase.TROPHY]: 'Armado',
    [ServePhase.ACCELERATION]: 'Impacto',
    [ServePhase.CONTACT]: 'Impacto',
    [ServePhase.FOLLOW_THROUGH]: 'Terminación'
};

/**
 * Nombres oficiales de las 4 fases del informe biomecánico v2
 */
export const CATEGORY_LABELS = {
    preparacion: 'Preparación',
    armado: 'Armado',
    impacto: 'Impacto',
    terminacion: 'Terminación'
};
