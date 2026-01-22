import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';
import { Location } from '../../../types/location';

export const useLocations = (searchQuery?: string, showArchived: boolean = false) => {
    const { user, profile } = useAuthStore();

    return useQuery({
        queryKey: ['locations', user?.id, profile?.current_academy_id, searchQuery, showArchived],
        queryFn: async () => {
            if (!user?.id) return [];

            let query = supabase
                .from('locations')
                .select('*')
                .eq('is_archived', showArchived)
                .order('name', { ascending: true });

            if (searchQuery) {
                query = query.ilike('name', `%${searchQuery}%`);
            }

            const { data, error } = await query;

            if (error) throw error;
            return data as Location[];
        },
        enabled: !!user?.id,
    });
};

export const useLocation = (id: string) => {
    const { user } = useAuthStore();

    return useQuery({
        queryKey: ['location', id],
        queryFn: async () => {
            if (!id) return null;

            const { data, error } = await supabase
                .from('locations')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            return data as Location;
        },
        enabled: !!id && !!user?.id,
    });
};
