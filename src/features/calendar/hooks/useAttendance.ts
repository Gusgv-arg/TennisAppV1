import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';
import { AttendanceStatus, SessionAttendance } from '../../../types/session';

/**
 * Hook to fetch attendance records for a specific session
 */
export const useSessionAttendance = (sessionId: string) => {
    return useQuery({
        queryKey: ['session-attendance', sessionId],
        queryFn: async () => {
            if (!sessionId) return [];

            const { data, error } = await supabase
                .from('session_attendance')
                .select('*')
                .eq('session_id', sessionId);

            if (error) {
                console.error('[useSessionAttendance] Error:', error);
                return [];
            }

            return data as SessionAttendance[];
        },
        enabled: !!sessionId,
    });
};

/**
 * Hook to check if a session has any attendance records
 */
export const useHasAttendance = (sessionId: string) => {
    return useQuery({
        queryKey: ['has-attendance', sessionId],
        queryFn: async () => {
            if (!sessionId) return false;

            const { count, error } = await supabase
                .from('session_attendance')
                .select('*', { count: 'exact', head: true })
                .eq('session_id', sessionId);

            if (error) {
                console.error('[useHasAttendance] Error:', error);
                return false;
            }

            return (count || 0) > 0;
        },
        enabled: !!sessionId,
    });
};

export interface AttendanceRecord {
    player_id: string;
    status: AttendanceStatus;
    notes?: string;
}

/**
 * Hook for attendance mutations (save/update)
 */
export const useAttendanceMutations = () => {
    const queryClient = useQueryClient();
    const { user } = useAuthStore();

    const saveAttendance = useMutation({
        mutationFn: async ({
            sessionId,
            records,
        }: {
            sessionId: string;
            records: AttendanceRecord[];
        }) => {
            if (!user?.id) throw new Error('User not authenticated');

            console.log('[saveAttendance] Saving attendance for session:', sessionId, records);

            // Upsert all attendance records
            const { data, error } = await supabase
                .from('session_attendance')
                .upsert(
                    records.map(record => ({
                        session_id: sessionId,
                        player_id: record.player_id,
                        status: record.status,
                        notes: record.notes || null,
                        marked_by: user.id,
                        marked_at: new Date().toISOString(),
                    })),
                    { onConflict: 'session_id,player_id' }
                )
                .select();

            if (error) {
                console.error('[saveAttendance] Error:', error);
                throw error;
            }

            console.log('[saveAttendance] Success:', data);
            return data as SessionAttendance[];
        },
        onSuccess: (_, variables) => {
            // Invalidate related queries
            queryClient.invalidateQueries({ queryKey: ['session-attendance', variables.sessionId] });
            queryClient.invalidateQueries({ queryKey: ['has-attendance', variables.sessionId] });
            queryClient.invalidateQueries({ queryKey: ['sessions'] });
        },
    });

    return {
        saveAttendance,
    };
};
