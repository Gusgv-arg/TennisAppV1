import { useMutation } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';

export interface PlayerSafetyResult {
    futureSessionCount: number;
    futureSessionIds: string[];
    balance: number;
    hasDebt: boolean;
    canArchive: boolean; // Always true for now, but good to have explicit
    canDelete: boolean;  // False if user has debt
}

export const usePlayerSafetyCheck = () => {
    return useMutation({
        mutationFn: async (playerId: string): Promise<PlayerSafetyResult> => {
            // 1. Obtener balance del alumno usando la vista
            const { data: balanceData, error: balanceError } = await supabase
                .from('player_balances')
                .select('balance')
                .eq('player_id', playerId)
                .maybeSingle();

            if (balanceError) {
                console.error('[usePlayerSafetyCheck] Error fetching balance:', balanceError);
                throw new Error('Error al verificar el estado financiero del alumno.');
            }

            const balance = balanceData?.balance || 0;
            const hasDebt = balance < 0;

            // 2. Obtener sesiones futuras programadas donde el alumno participa
            // Usamos el inicio del día local actual para incluir clases que ya pasaron hoy
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const startOfDayISO = today.toISOString();

            // Usamos inner join implícito en supabase:
            // "sessions!inner(id, scheduled_at, status, deleted_at)"
            const { data: sessionsData, error: sessionsError } = await supabase
                .from('session_players')
                .select('session_id, sessions!inner(id, scheduled_at, status, deleted_at)')
                .eq('player_id', playerId)
                .is('sessions.deleted_at', null)
                .eq('sessions.status', 'scheduled')
                .gte('sessions.scheduled_at', startOfDayISO); // gte (greater or equal) en lugar de gt

            if (sessionsError) {
                console.error('[usePlayerSafetyCheck] Error fetching future sessions:', sessionsError);
                throw new Error('Error al verificar las clases futuras del alumno.');
            }

            const futureSessionIds = (sessionsData || []).map(sp => sp.session_id);
            const futureSessionCount = futureSessionIds.length;

            return {
                futureSessionCount,
                futureSessionIds,
                balance,
                hasDebt,
                canArchive: true, // Se puede archivar, pero con advertencia
                canDelete: !hasDebt // NO se puede eliminar si hay deuda
            };
        }
    });
};
