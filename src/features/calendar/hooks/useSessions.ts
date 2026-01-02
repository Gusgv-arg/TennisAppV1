import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';
import { CreateSessionInput, Session, UpdateSessionInput } from '../../../types/session';

export const useSessions = (startDate: string, endDate: string) => {
    const { user } = useAuthStore();

    return useQuery({
        queryKey: ['sessions', user?.id, startDate, endDate],
        queryFn: async () => {
            if (!user?.id) {
                console.log('[useSessions] No user ID, returning empty array');
                return [];
            }

            console.log('[useSessions] Fetching sessions:', { userId: user.id, startDate, endDate });

            const { data, error } = await supabase
                .from('sessions')
                .select(`
                    *,
                    player:players(full_name)
                `)
                .eq('coach_id', user.id)
                .gte('scheduled_at', startDate)
                .lte('scheduled_at', endDate)
                .order('scheduled_at', { ascending: true });

            if (error) {
                console.error('[useSessions] Error:', error);
                throw error;
            }

            console.log('[useSessions] Fetched sessions:', data?.length, data);
            return data as Session[];
        },
        enabled: !!user?.id,
    });
};

export const useSessionMutations = () => {
    const queryClient = useQueryClient();
    const { user } = useAuthStore();

    const createSession = useMutation({
        mutationFn: async (input: CreateSessionInput) => {
            if (!user?.id) throw new Error('User not authenticated');

            const { data, error } = await supabase
                .from('sessions')
                .insert([{ ...input, coach_id: user.id }])
                .select()
                .single();

            if (error) throw error;
            return data as Session;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sessions', user?.id] });
        },
    });

    const updateSession = useMutation({
        mutationFn: async ({ id, input }: { id: string; input: UpdateSessionInput }) => {
            const { data, error } = await supabase
                .from('sessions')
                .update(input)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data as Session;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['sessions', user?.id] });
            queryClient.invalidateQueries({ queryKey: ['session', data.id] });
        },
    });

    return {
        createSession,
        updateSession,
    };
};

export const useSession = (id: string) => {
    return useQuery({
        queryKey: ['session', id],
        queryFn: async () => {
            if (!id) return null;

            const { data, error } = await supabase
                .from('sessions')
                .select(`
                    *,
                    player:players(full_name)
                `)
                .eq('id', id)
                .single();

            if (error) throw error;
            return data as Session;
        },
        enabled: !!id,
    });
};
