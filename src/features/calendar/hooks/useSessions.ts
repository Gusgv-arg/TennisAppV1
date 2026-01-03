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

            console.log('[useSessions] Fetching sessions for range:', { startDate, endDate });

            const { data, error } = await supabase
                .from('sessions')
                .select(`
                    *,
                    session_players(
                        players(id, full_name)
                    )
                `)
                .eq('coach_id', user.id)
                .gte('scheduled_at', startDate)
                .lte('scheduled_at', endDate)
                .order('scheduled_at', { ascending: true });

            if (error) {
                console.error('[useSessions] Supabase error:', error);
                // Return empty array instead of throwing to prevent complete UI crash
                // and allow developer to see the error in logs
                return [];
            }

            // Transform nested players structure to a flatter one
            const transformedData = data?.map(session => ({
                ...session,
                players: session.session_players?.map((sp: any) => sp.players).filter(Boolean) || []
            })) || [];

            console.log(`[useSessions] Fetched ${transformedData.length} sessions`);
            return transformedData as Session[];
        },
        enabled: !!user?.id,
        staleTime: 0, // Ensure we always get fresh data on refetch
    });
};

export const useSessionMutations = () => {
    const queryClient = useQueryClient();
    const { user } = useAuthStore();

    const createSession = useMutation({
        mutationFn: async (input: CreateSessionInput) => {
            if (!user?.id) throw new Error('User not authenticated');

            const { player_ids, ...sessionData } = input;
            console.log('[createSession] Starting creation for players:', player_ids);

            // 1. Create the session
            const { data, error } = await supabase
                .from('sessions')
                .insert([{ ...sessionData, coach_id: user.id }])
                .select()
                .single();

            if (error) {
                console.error('[createSession] Session table error:', error);
                throw error;
            }

            console.log('[createSession] Session created with ID:', data.id);

            // 2. Add players to session_players if any
            if (player_ids && player_ids.length > 0) {
                const { error: playersError } = await supabase
                    .from('session_players')
                    .insert(player_ids.map(pid => ({ session_id: data.id, player_id: pid })));

                if (playersError) {
                    console.error('[createSession] Join table error:', playersError);
                    // Even if join table fails, the session exists. 
                    // But we throw to let the UI know something went wrong.
                    throw playersError;
                }
                console.log('[createSession] Players added to join table');
            }

            return data as Session;
        },
        onSuccess: () => {
            console.log('[createSession] Success, invalidating queries');
            queryClient.invalidateQueries({ queryKey: ['sessions'] });
        },
    });

    const updateSession = useMutation({
        mutationFn: async ({ id, input }: { id: string; input: UpdateSessionInput }) => {
            const { player_ids, ...sessionData } = input;

            // 1. Update the session details
            const { data, error } = await supabase
                .from('sessions')
                .update(sessionData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            // 2. Update players if provided
            if (player_ids !== undefined) {
                // Delete existing ones
                const { error: deleteError } = await supabase
                    .from('session_players')
                    .delete()
                    .eq('session_id', id);

                if (deleteError) throw deleteError;

                // Insert new ones
                if (player_ids.length > 0) {
                    const { error: insertError } = await supabase
                        .from('session_players')
                        .insert(player_ids.map(pid => ({ session_id: id, player_id: pid })));

                    if (insertError) throw insertError;
                }
            }

            return data as Session;
        },
        onSuccess: (data) => {
            console.log('[updateSession] Success, invalidating queries for session:', data.id);
            queryClient.invalidateQueries({ queryKey: ['sessions'] });
            queryClient.invalidateQueries({ queryKey: ['session', data.id] });
        },
    });

    const deleteSession = useMutation({
        mutationFn: async (id: string) => {
            console.log('[deleteSession] Deleting session:', id);

            // session_players will be deleted automatically due to ON DELETE CASCADE
            const { error } = await supabase
                .from('sessions')
                .delete()
                .eq('id', id);

            if (error) {
                console.error('[deleteSession] Error:', error);
                throw error;
            }

            console.log('[deleteSession] Session deleted successfully');
        },
        onSuccess: () => {
            console.log('[deleteSession] Success, invalidating queries');
            queryClient.invalidateQueries({ queryKey: ['sessions'] });
        },
    });

    return {
        createSession,
        updateSession,
        deleteSession,
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
                    session_players(
                        players(id, full_name)
                    )
                `)
                .eq('id', id)
                .single();

            if (error) throw error;

            // Transform nested players
            const transformedData = {
                ...data,
                players: data.session_players?.map((sp: any) => sp.players).filter(Boolean) || []
            };

            return transformedData as Session;
        },
        enabled: !!id,
    });
};
