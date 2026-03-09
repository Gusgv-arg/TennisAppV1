import { ServePhase } from './types';

/**
 * Tradución de fases técnicas a nombres amigables para el usuario (Progreso)
 */
export const PHASE_LABELS: Record<ServePhase, string> = {
    [ServePhase.IDLE]: 'Esperando...',
    [ServePhase.SETUP]: 'Preparación',
    [ServePhase.TROPHY]: 'Fase de Armado (Trophy)',
    [ServePhase.ACCELERATION]: 'Aceleración',
    [ServePhase.CONTACT]: 'Punto de Impacto',
    [ServePhase.FOLLOW_THROUGH]: 'Terminación'
};

/**
 * Nombres oficiales de las categorías del informe biomecánico
 */
export const CATEGORY_LABELS = {
    preparation: 'Preparación',
    trophy: 'Fase de Armado (Trophy)',
    contact: 'Punto de Impacto',
    energyTransfer: 'Transferencia de Energía',
    followThrough: 'Terminación'
};
