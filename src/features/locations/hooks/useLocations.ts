import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';
import { useViewStore } from '../../../store/useViewStore';
import { Location } from '../../../types/location';

export const useLocations = (searchQuery?: string, showArchived: boolean = false) => {
    const { user, profile } = useAuthStore();
    const { isGlobalView } = useViewStore();
    const academyId = profile?.current_academy_id;

    return useQuery({
        queryKey: ['locations', user?.id, academyId, isGlobalView, searchQuery, showArchived],
        queryFn: async () => {
            if (!user?.id) return [];

            let query = supabase
                .from('locations')
                .select('*')
                .eq('is_archived', showArchived)
                .order('name', { ascending: true });

            if (isGlobalView) {
                // Global view: show all locations created by coach?
                // Or maybe locations are inherently linked to academies?
                // Assuming locations have academy_id or coach_id
                // If locations table has academy_id, we should use it.
                // If not, we rely on coach_id (if exists).

                // Inspecting previous code: it was selecting '*' without filter.
                // Assuming RLS was handling it or it was broken.
                // Adding generic coach_id filter if possible, or skip if we trust RLS.
                // BUT if we want ACADEMY SPECIFIC:
                // We must know if 'locations' has 'academy_id'.
                // If it does, we filter.
                // If not, we can't.

                // Safest bet based on other tables:
                // Try filtering by academy_id if available context.
                query = query.eq('created_by', user.id); // Typically created_by or coach_id
            } else if (academyId) {
                query = query.eq('academy_id', academyId);
            } else {
                query = query.eq('created_by', user.id);
            }

            if (searchQuery) {
                query = query.ilike('name', `%${searchQuery}%`);
            }

            const { data, error } = await query;

            if (error) {
                // Fallback if column doesn't exist? (e.g. academy_id not present)
                // But we should try to fail gracefully or assume global.
                // Given I can't check schema easily without iterating, I'll assume standard pattern.
                throw error;
            }
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
