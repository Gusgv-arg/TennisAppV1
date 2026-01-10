import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';
import { CreateSessionInput, Session, UpdateSessionInput } from '../../../types/session';
import { useSubscriptions } from '../../payments/hooks/useSubscriptions';

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
                    coach:profiles(full_name),
                    session_players(
                        players(id, full_name)
                    )
                `)
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

// Check for scheduling conflicts
// Returns: { playerConflicts: string[], locationConflict: boolean, instructorConflict: boolean }
export interface ConflictResult {
    playerConflicts: string[]; // Player IDs that have overlapping sessions
    locationConflict: boolean; // True if another session exists at same time, location and court
    instructorConflict: boolean; // True if the assigned instructor already has a session
}

export const checkSessionConflicts = async (
    coachId: string,
    playerIds: string[],
    scheduledAt: Date,
    durationMinutes: number,
    location: string | null,
    court: string | null,
    instructorId: string | null,
    excludeSessionId?: string // For edit mode, exclude the current session
): Promise<ConflictResult> => {
    const result: ConflictResult = { playerConflicts: [], locationConflict: false, instructorConflict: false };

    if (!coachId) return result;

    const sessionStart = scheduledAt.getTime();
    const sessionEnd = sessionStart + durationMinutes * 60 * 1000;

    // Fetch all sessions for the same day
    const dayStart = new Date(scheduledAt);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(scheduledAt);
    dayEnd.setHours(23, 59, 59, 999);

    // DETERMINAR EL INSTRUCTOR EFECTIVO para la nueva sesión
    const effectiveInstructorId = instructorId || coachId;

    const { data: sessions, error } = await supabase
        .from('sessions')
        .select(`
            id,
            coach_id,
            instructor_id,
            scheduled_at,
            duration_minutes,
            location,
            court,
            session_players(player_id)
        `)
        // .eq('coach_id', coachId) // ELIMINADO: ahora validamos contra TODOS los coaches
        .gte('scheduled_at', dayStart.toISOString())
        .lte('scheduled_at', dayEnd.toISOString())
        .neq('status', 'cancelled');

    if (error || !sessions) return result;

    // Filter out the current session if editing
    const otherSessions = excludeSessionId
        ? sessions.filter(s => s.id !== excludeSessionId)
        : sessions;

    const conflictingPlayerIds: Set<string> = new Set();

    for (const session of otherSessions) {
        const existingStart = new Date(session.scheduled_at).getTime();
        const existingEnd = existingStart + session.duration_minutes * 60 * 1000;

        // Check if times overlap
        const timesOverlap = sessionStart < existingEnd && sessionEnd > existingStart;

        if (!timesOverlap) continue;

        // Rule 1: Check if any player is in both sessions (same time, any location)
        const sessionPlayerIds = session.session_players?.map((sp: any) => sp.player_id) || [];
        for (const playerId of playerIds) {
            if (sessionPlayerIds.includes(playerId)) {
                conflictingPlayerIds.add(playerId);
            }
        }

        // Rule 2: Check if same instructor (regardless of location)
        const sessionEffectiveInstructorId = session.instructor_id || session.coach_id;
        if (sessionEffectiveInstructorId === effectiveInstructorId) {
            result.instructorConflict = true;
        }

        // Rule 3: Check if same location + court
        if (location && session.location &&
            location.toLowerCase().trim() === session.location.toLowerCase().trim()) {

            // Si ambas sesiones tienen cancha definida
            if (court && session.court) {
                if (court.toLowerCase().trim() === session.court.toLowerCase().trim()) {
                    result.locationConflict = true;
                }
            }
            // Si alguna de las dos NO tiene cancha, consideramos que ocupa toda la ubicación
            // o que hay un riesgo de solapamiento no gestionado.
            else if (!court || !session.court) {
                result.locationConflict = true;
            }
        }
    }

    result.playerConflicts = Array.from(conflictingPlayerIds);
    return result;
};

export const useSessionMutations = () => {
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const { consumeClasses } = useSubscriptions();

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

                // 3. Consumir clases de paquetes si los alumnos tienen
                try {
                    await consumeClasses(player_ids);
                    console.log('[createSession] Classes consumed for players');
                } catch (consumeError) {
                    console.error('[createSession] Error consuming classes:', consumeError);
                    // No cortamos el flujo por esto, la sesión ya está creada
                }
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

                    // Consumir clases para los nuevos jugadores agregados
                    try {
                        await consumeClasses(player_ids);
                    } catch (consumeError) {
                        console.error('[updateSession] Error consuming classes:', consumeError);
                    }
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
                    coach:profiles(full_name),
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
