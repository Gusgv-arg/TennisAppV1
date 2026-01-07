import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';
import { Collaborator } from '../../../types/collaborator';

export const useCollaborators = (searchQuery?: string, showInactive: boolean = false) => {
    const { user } = useAuthStore();

    return useQuery({
        queryKey: ['collaborators', user?.id, searchQuery, showInactive],
        queryFn: async () => {
            if (!user?.id) return [];

            let query = supabase
                .from('staff_members')
                .select('*')
                .order('full_name', { ascending: true });

            // Filter by active status
            if (showInactive) {
                query = query.eq('is_active', false);
            } else {
                query = query.eq('is_active', true);
            }

            if (searchQuery) {
                query = query.ilike('full_name', `%${searchQuery}%`);
            }

            const { data, error } = await query;

            if (error) throw error;
            return data as Collaborator[];
        },
        enabled: !!user?.id,
    });
};

export const useCollaborator = (id: string) => {
    const { user } = useAuthStore();

    return useQuery({
        queryKey: ['collaborators', id],
        queryFn: async () => {
            if (!id) return null;

            const { data, error } = await supabase
                .from('staff_members')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            return data as Collaborator;
        },
        enabled: !!id && !!user?.id,
    });
};
