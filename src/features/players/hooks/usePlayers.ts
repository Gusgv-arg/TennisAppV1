import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';
import { Player } from '../../../types/player';

export const usePlayers = (searchQuery?: string, showArchived: boolean = false) => {
    const { user } = useAuthStore();

    return useQuery({
        queryKey: ['players', user?.id, searchQuery, showArchived],
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
                .eq('is_archived', showArchived)
                .eq('player_subscriptions.status', 'active')
                .order('full_name', { ascending: true });

            if (searchQuery) {
                query = query.ilike('full_name', `%${searchQuery}%`);
            }

            const { data, error } = await query;

            if (error) throw error;

            // Post-procesar para tener una sola suscripción activa (si existe)
            const processedData = data?.map(player => ({
                ...player,
                active_subscription: player.player_subscriptions?.[0] || null
            }));

            return processedData as any[];
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
                .single();

            if (error) throw error;
            return data as Player;
        },
        enabled: !!id && !!user?.id,
    });
};
