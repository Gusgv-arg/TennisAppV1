import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';
import { useViewStore } from '../../../store/useViewStore';
import { CreateSessionInput, Session, UpdateSessionInput } from '../../../types/session';
import { useSubscriptions } from '../../payments/hooks/useSubscriptions';

export const useSessions = (startDate: string, endDate: string) => {
    const { user, profile } = useAuthStore();
    const { isGlobalView } = useViewStore();

    return useQuery({
        queryKey: ['sessions', user?.id, profile?.current_academy_id, startDate, endDate, isGlobalView ? 'global' : 'local'],
        queryFn: async () => {
            if (!user?.id) return [];

            const params = {
                p_start_date: startDate,
                p_end_date: endDate,
                p_academy_id: isGlobalView ? null : profile?.current_academy_id
            };

            console.log('[useSessions] 🔍 Debug Params:', JSON.stringify(params, null, 2));
            console.log('[useSessions] 👤 User ID:', user.id);
            console.log('[useSessions] 🏢 Current Academy:', profile?.current_academy_id);
            console.log('[useSessions] 🌍 Global View:', isGlobalView);

            const { data, error } = await supabase.rpc('get_sessions_skill', params);

            if (error) {
                console.error('[useSessions] ❌ Skill error:', error);
                throw error;
            }

            console.log(`[useSessions] ✅ Received ${data?.length || 0} sessions`);
            return (data || []) as Session[];
        },
        enabled: !!user?.id,
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes, invalidate on mutation
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

            const newCourt = court ? court.toLowerCase().trim() : '';
            const existingCourt = session.court ? session.court.toLowerCase().trim() : '';

            // Case A: Both have courts defined
            if (newCourt && existingCourt) {
                if (newCourt === existingCourt) {
                    result.locationConflict = true;
                }
            }
            // Case B: Neither has court defined -> Conflict (assume general space clash)
            else if (!newCourt && !existingCourt) {
                result.locationConflict = true;
            }
            // Case C: One has court, the other doesn't -> Allow (assume specific vs general don't clash or are managed)
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

            const { player_ids, player_subscriptions, ...sessionData } = input;
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
                // Build session_players records with subscription_id if available
                const sessionPlayerRecords = player_ids.map(pid => {
                    const subscriptionAssignment = player_subscriptions?.find(ps => ps.player_id === pid);
                    return {
                        session_id: data.id,
                        player_id: pid,
                        subscription_id: subscriptionAssignment?.subscription_id || null
                    };
                });

                const { error: playersError } = await supabase
                    .from('session_players')
                    .insert(sessionPlayerRecords);

                if (playersError) {
                    console.error('[createSession] Join table error:', playersError);
                    // Even if join table fails, the session exists. 
                    // But we throw to let the UI know something went wrong.
                    throw playersError;
                }
                console.log('[createSession] Players added to join table with subscriptions');

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
            const { player_ids, player_subscriptions, ...sessionData } = input;

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

                // Insert new ones with subscription_id if available
                if (player_ids.length > 0) {
                    const sessionPlayerRecords = player_ids.map(pid => {
                        const subscriptionAssignment = input.player_subscriptions?.find(ps => ps.player_id === pid);
                        return {
                            session_id: id,
                            player_id: pid,
                            subscription_id: subscriptionAssignment?.subscription_id || null
                        };
                    });

                    const { error: insertError } = await supabase
                        .from('session_players')
                        .insert(sessionPlayerRecords);

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
            queryClient.invalidateQueries({ queryKey: ['playerBalances'] });
            queryClient.invalidateQueries({ queryKey: ['paymentStats'] });
            queryClient.invalidateQueries({ queryKey: ['unifiedPaymentGroupBalances'] });
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
                        subscription_id,
                        players(id, full_name),
                        subscription:player_subscriptions(
                            id,
                            plan:pricing_plans(name)
                        )
                    )
                `)
                .eq('id', id)
                .single();

            if (error) throw error;

            // Transform nested players
            const transformedData = {
                ...data,
                players: data.session_players?.map((sp: any) => ({
                    ...sp.players,
                    subscription_id: sp.subscription_id,
                    plan_name: sp.subscription?.plan?.name
                })).filter(Boolean) || []
            };

            return transformedData as Session;
        },
        enabled: !!id,
    });
};
