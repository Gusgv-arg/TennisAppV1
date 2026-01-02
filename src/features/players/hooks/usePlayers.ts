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
                .select('*')
                .eq('coach_id', user.id)
                .eq('is_archived', showArchived)
                .order('full_name', { ascending: true });

            if (searchQuery) {
                query = query.ilike('full_name', `%${searchQuery}%`);
            }

            const { data, error } = await query;

            if (error) throw error;
            return data as Player[];
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
