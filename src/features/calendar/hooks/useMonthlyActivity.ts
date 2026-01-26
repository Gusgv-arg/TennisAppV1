import { useAuthStore } from '@/src/store/useAuthStore';
import { useViewStore } from '@/src/store/useViewStore';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';

export const useMonthlyActivity = (startDate: string, endDate: string) => {
    const { session, profile } = useAuthStore();
    const { isGlobalView } = useViewStore();

    return useQuery({
        queryKey: ['monthly_activity', startDate, endDate, isGlobalView ? 'global' : profile?.current_academy_id],
        queryFn: async () => {
            if (!session?.user.id) throw new Error('No user logged in');

            // Ensure explicit null if global or undefined
            const academyId = (!isGlobalView && profile?.current_academy_id) ? profile.current_academy_id : null;

            console.log('[useMonthlyActivity] Fetching with RPC:', {
                p_start_date: startDate,
                p_end_date: endDate,
                p_academy_id: academyId,
                isGlobal: isGlobalView
            });

            // Call the custom RPC (returns JSONB with pre-joined data)
            const { data, error } = await supabase
                .rpc('get_monthly_activity', {
                    p_start_date: startDate,
                    p_end_date: endDate,
                    p_academy_id: academyId
                });

            if (error) {
                console.error('[useMonthlyActivity] Error:', error);
                throw error;
            }

            console.log('[useMonthlyActivity] Fetched sessions:', data?.length);
            return data;
        },
        enabled: !!session?.user.id && !!startDate && !!endDate,
    });
};
