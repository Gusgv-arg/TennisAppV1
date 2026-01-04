import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';
import { StaffMember } from '../../../types/staff';

export const useStaffMembers = (searchQuery?: string, showInactive: boolean = false) => {
    const { user } = useAuthStore();

    return useQuery({
        queryKey: ['staff', user?.id, searchQuery, showInactive],
        queryFn: async () => {
            if (!user?.id) return [];

            let query = supabase
                .from('staff_members')
                .select('*')
                .eq('is_active', !showInactive)
                .order('full_name', { ascending: true });

            if (searchQuery) {
                query = query.ilike('full_name', `%${searchQuery}%`);
            }

            const { data, error } = await query;

            if (error) throw error;
            return data as StaffMember[];
        },
        enabled: !!user?.id,
    });
};

export const useStaffMember = (id: string) => {
    const { user } = useAuthStore();

    return useQuery({
        queryKey: ['staff', id],
        queryFn: async () => {
            if (!id) return null;

            const { data, error } = await supabase
                .from('staff_members')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            return data as StaffMember;
        },
        enabled: !!id && !!user?.id,
    });
};
