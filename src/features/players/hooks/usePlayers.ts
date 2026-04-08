import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';
import { useViewStore } from '../../../store/useViewStore';
import { Player } from '../../../types/player';

// Define the Status type exportable if needed, or inline
export type PlayerListStatus = 'active' | 'no_plan' | 'archived';

export const usePlayers = (searchQuery?: string, status: PlayerListStatus = 'active') => {
    const { user, profile } = useAuthStore();
    const academyId = profile?.current_academy_id;

    const { isGlobalView } = useViewStore();

    return useQuery({
        queryKey: ['players', user?.id, academyId, searchQuery, status, isGlobalView],
        queryFn: async () => {
            if (!user?.id) return [];

            let query = supabase
                .from('players')
                .select(`
                    *,
                    player_subscriptions(
                        id,
                        status,
                        custom_amount,
                        notes,
                        plan:pricing_plans(id, name, is_active)
                    )
                `)
                .order('full_name', { ascending: true });

            // Academy Isolation Logic
            if (isGlobalView) {
                // In Global View, we want all players the user has access to.
                // Since RLS policies usually restrict access to academies the user is a member of,
                // we might not need an explicit filter here if RLS handles it.
                // However, to be safe and explicit (and if RLS allows more than we want),
                // we should probably filter by the academies the user is a member of.
                // For now, let's assume RLS or the fact that we are querying 'players' 
                // which are linked to academies the user is in (via academy_members check usually) is enough.
                // But wait, 'players' table usually has 'academy_id'.
                // If we don't filter by academy_id, we get all players.
                // We rely on RLS to ensure we only see players from academies we are part of.
            } else if (academyId) {
                query = query.eq('academy_id', academyId);
            } else {
                // Independent Coach fallback
                query = query.eq('coach_id', user.id);
            }

            // Base archival filter
            if (status === 'archived') {
                query = query.eq('is_archived', true);
            } else {
                query = query.eq('is_archived', false);
            }

            // Always filter out permanently deleted records
            query = query.eq('is_deleted', false);

            if (searchQuery) {
                query = query.ilike('full_name', `%${searchQuery}%`);
            }

            const { data, error } = await query;

            if (error) throw error;

            // Process subscriptions to find ALL active ones
            const processedData = data?.map((player: any) => {
                // Find ALL active subscriptions (not just the first one)
                const activeSubscriptions = player.player_subscriptions?.filter(
                    (s: any) => s.status === 'active' || s.status === 'paused'
                ) || [];

                return {
                    ...player,
                    active_subscription: activeSubscriptions[0] || null, // Compatibilidad con código existente
                    active_subscriptions: activeSubscriptions, // NUEVO: Array con TODAS las suscripciones
                    has_plan: activeSubscriptions.length > 0
                };
            });

            // "Activos" tab now shows ALL non-archived players (Activos + Sin Plan + En Pausa DB)
            if (status === 'active') {
                return processedData;
            }

            // "Sin Plan" tab shows Non-archived players with NO plan
            if (status === 'no_plan') {
                return processedData.filter((player: any) => !player.has_plan);
            }

            // "Archivados" (Already filtered by query)
            return processedData;
        },
        enabled: !!user?.id,
    });
};

export const usePlayer = (id: string) => {
    const { user } = useAuthStore();

    return useQuery({
        queryKey: ['player', id],
        queryFn: async () => {
            if (!id) return null;

            const { data, error } = await supabase
                .from('players')
                .select('*')
                .eq('id', id)
                .eq('is_deleted', false)
                .single();

            if (error) throw error;
            return data as Player;
        },
        enabled: !!id && !!user?.id,
    });
};

export const usePlayerClassHistory = (playerId: string, startDate: string, endDate: string) => {
    return useQuery({
        queryKey: ['player-class-history', playerId, startDate, endDate],
        queryFn: async () => {
            if (!playerId) return [];

            console.log('[usePlayerClassHistory] Fetching history for:', playerId, startDate, endDate);

            // Fetch sessions where the player is present through session_players
            const { data, error } = await supabase
                .from('sessions')
                .select(`
                    *,
                    class_group:class_groups(name),
                    coach:profiles!coach_id(full_name),
                    attendance:session_attendance(status, notes, player_id),
                    players:session_players!inner(player_id)
                `)
                .eq('session_players.player_id', playerId)
                .is('deleted_at', null)
                .gte('scheduled_at', startDate)
                .lte('scheduled_at', endDate)
                .order('scheduled_at', { ascending: false });

            if (error) {
                console.error('[usePlayerClassHistory] Error:', error);
                throw error;
            }

            // Filter attendance records to only include this player's status
            const processedSessions = (data || []).map((session: any) => {
                const playerAttendance = session.attendance?.find((a: any) => a.player_id === playerId);
                return {
                    ...session,
                    player_attendance: playerAttendance || null
                };
            });

            return processedSessions;
        },
        enabled: !!playerId && !!startDate && !!endDate,
    });
};

