import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';
import { Player } from '../../../types/player';

// Define the Status type exportable if needed, or inline
export type PlayerListStatus = 'active' | 'no_plan' | 'archived';

export const usePlayers = (searchQuery?: string, status: PlayerListStatus = 'active') => {
    const { user } = useAuthStore();

    return useQuery({
        queryKey: ['players', user?.id, searchQuery, status],
        queryFn: async () => {
            if (!user?.id) return [];

            let query = supabase
                .from('players')
                .select(`
                    *,
                    player_subscriptions(
                        id,
                        status,
                        plan:pricing_plans(name)
                    )
                `)
                .order('full_name', { ascending: true });

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
            const processedData = data?.map(player => {
                // Find ALL active subscriptions (not just the first one)
                const activeSubscriptions = player.player_subscriptions?.filter(
                    (s: any) => s.status === 'active' || s.status === 'suspended'
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
                return processedData.filter(player => !player.has_plan);
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
