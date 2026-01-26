import { useAuthStore } from '@/src/store/useAuthStore';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';

export const useCancelledSessions = (startDate: string, endDate: string) => {
    const { session } = useAuthStore();

    return useQuery({
        queryKey: ['cancelled_sessions', startDate, endDate],
        queryFn: async () => {
            if (!session?.user.id) throw new Error('No user logged in');

            const { data, error } = await supabase
                .from('sessions')
                .select(`
                    *,
                    academy:academies(name),
                    instructor:collaborators(full_name)
                `)
                .not('deleted_at', 'is', null) // Filter for soft-deleted rows
                .gte('scheduled_at', startDate)
                .lte('scheduled_at', endDate)
                .order('scheduled_at', { ascending: false });

            if (error) throw error;
            return data;
        },
        enabled: !!session?.user.id && !!startDate && !!endDate,
    });
};
