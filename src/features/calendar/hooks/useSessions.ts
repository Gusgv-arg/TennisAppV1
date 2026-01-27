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

            console.log('[useSessions] 🔍 Fetching sessions (Client Side)...');

            let query = supabase
                .from('sessions')
                .select(`
                    *,
                    coach:profiles!coach_id(full_name, avatar_url),
                    academy:academies(id, name),
                    class_group:class_groups(id, name, image_url),
                    session_players(
                        subscription_id,
                        players(
                            id, 
                            full_name, 
                            avatar_url, 
                            contact_email
                        ),
                        subscription:player_subscriptions(
                            id,
                            plan:pricing_plans(name)
                        )
                    ),
                    attendance:session_attendance(*)
                `)
                .gte('scheduled_at', startDate)
                .lte('scheduled_at', endDate)
                .order('scheduled_at', { ascending: true });

            if (!isGlobalView && profile?.current_academy_id) {
                query = query.eq('academy_id', profile.current_academy_id);
            }

            const { data, error } = await query;

            if (error) {
                console.error('[useSessions] ❌ Fetch error:', error);
                throw error;
            }

            // Transform nested data to match Session interface
            const sessions: Session[] = (data || []).map((s: any) => {
                // Flatten players
                const players = s.session_players?.map((sp: any) => ({
                    ...sp.players,
                    subscription_id: sp.subscription_id,
                    plan_name: sp.subscription?.plan?.name
                })).filter((p: any) => !!p) || [];

                return {
                    ...s,
                    players,
                    // Handle instructor if needed (simplified for now as usually coach or academy member)
                    instructor: s.instructor_id ? { id: s.instructor_id, full_name: 'Instructor' } : null,
                };
            });

            console.log(`[useSessions] ✅ Received ${sessions.length} sessions`);
            return sessions;
        },
        enabled: !!user?.id,
        staleTime: 1000 * 60 * 5,
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
        .neq('status', 'cancelled')
        .is('deleted_at', null); // Exclude soft-deleted sessions

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

                // FIX: Also delete any existing CHARGES (transactions) associated with this session.
                // This ensures that if a player changes plan (Hourly -> Monthly), the old hourly charge is removed.
                // Logic: Delete all 'charge' transactions for this session. Triggers (or auto-billing) will recreate valid ones for new players if needed.
                const { error: deleteTxError } = await supabase
                    .from('transactions')
                    .delete()
                    .eq('session_id', id)
                    .eq('type', 'charge'); // Only delete CHARGES, not payments

                if (deleteTxError) {
                    console.error('[updateSession] Error cleaning up old transactions:', deleteTxError);
                    // We don't throw here to avoid blocking the UI update, but it's a potential issue.
                }

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
        mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
            console.log('[deleteSession] Processing deletion for:', id);

            // 1. Fetch session date to decide Soft vs Hard delete
            const { data: sessionData, error: fetchError } = await supabase
                .from('sessions')
                .select('scheduled_at')
                .eq('id', id)
                .single();

            if (fetchError) throw fetchError;

            const now = new Date();
            const sessionDate = new Date(sessionData.scheduled_at);
            const isPast = sessionDate < now;

            if (isPast || reason) {
                // SOFT DELETE: Update deleted_at AND cancellation_reason
                // We perform a soft delete if the session is in the past OR if a reason is explicitly provided
                console.log(`[deleteSession] ${isPast ? 'Session is in PAST' : 'Reason provided'}. Performing SOFT DELETE.`);
                const { error } = await supabase
                    .from('sessions')
                    .update({
                        deleted_at: new Date().toISOString(),
                        cancellation_reason: reason || null,
                        status: 'cancelled'
                    })
                    .eq('id', id);

                if (error) throw error;

                // Cleanup charges on cancellation
                await supabase.from('transactions').delete().eq('session_id', id).eq('type', 'charge');
            } else {
                // HARD DELETE: Remove row
                console.log('[deleteSession] Session is in FUTURE. Performing HARD DELETE.');
                // session_players will be deleted automatically due to ON DELETE CASCADE
                const { error } = await supabase
                    .from('sessions')
                    .delete()
                    .eq('id', id);

                if (error) throw error;

                // Cleanup charges on hard delete
                await supabase.from('transactions').delete().eq('session_id', id).eq('type', 'charge');
            }

            console.log('[deleteSession] Session processed successfully');
        },
        onSuccess: () => {
            console.log('[deleteSession] Success, invalidating queries');
            queryClient.invalidateQueries({ queryKey: ['sessions'] });
            queryClient.invalidateQueries({ queryKey: ['playerBalances'] });
            queryClient.invalidateQueries({ queryKey: ['paymentStats'] });
            queryClient.invalidateQueries({ queryKey: ['unifiedPaymentGroupBalances'] });
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
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
