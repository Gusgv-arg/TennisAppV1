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
            if (!user?.id) {
                console.log('[useSessions] No user ID, returning empty array');
                return [];
            }

            // console.log(`[useSessions] 🔍 Fetching sessions. Global Mode: ${isGlobalView}, User: ${user.id}`);

            let rawData: any[] = [];

            if (isGlobalView) {
                // Use RPC for global view
                const { data, error } = await supabase.rpc('get_user_global_sessions', {
                    start_date: startDate,
                    end_date: endDate
                });

                if (error) {
                    console.error('[useSessions] RPC error:', error);
                    return [];
                }

                // Transform RPC result to match Session type structure
                // RPC returns flattened structure, we need to re-hydrate objects
                rawData = (data || []).map((row: any) => ({
                    ...row,
                    academy: { id: row.academy_id, name: row.academy_name },
                    coach: { full_name: row.coach_name || 'Coach' },
                    instructor: row.instructor_name ? { full_name: row.instructor_name } : null,
                    // RPC currently doesn't join players deeply, so we might need to fetch them
                    // OR update RPC to return JSONB of players. 
                    // For PoC, let's assume basic info.
                    // IMPORTANT: The current RPC definition doesn't return players JSON.
                    // We need to fetch players for these sessions or update RPC.
                    // For now, let's Map what we have. 
                    // If RPC definition was simple table return, we miss relations.
                    // Let's assume for this step we want to see the sessions first.
                    session_players: [],
                    session_attendance: []
                }));

                // TODO: Improvement - Update RPC to return players as JSONB to avoid N+1 or missing data
            } else {
                // Standard Query for local academy view
                if (!user?.user_metadata?.current_academy_id && !isGlobalView) {
                    // Fallback to fetching profile if we don't have it in store user object easily, 
                    // or just rely on what we have. 
                    // Better: Get current_academy_id from store profile
                }

                // We need profile to filter by academy
                // Accessing useAuthStore().profile inside queryFn might be stale if closures are tricky,
                // but usually fine. Let's get it from the store hook at top level.

                let query = supabase
                    .from('sessions')
                    .select(`
                        *,
                        coach:profiles(full_name),
                        academy:academies(id, name),
                        session_players(
                            subscription_id,
                            players(id, full_name, avatar_url),
                            subscription:player_subscriptions(
                                plan:pricing_plans(name)
                            )
                        ),
                        session_attendance(
                            player_id,
                            status,
                            notes
                        ),
                        class_group:class_groups(
                            id,
                            name,
                            image_url,
                            members:class_group_members(
                                player:players(id, full_name, avatar_url)
                            )
                        )
                    `)
                    .gte('scheduled_at', startDate)
                    .lte('scheduled_at', endDate)
                    .order('scheduled_at', { ascending: true });

                // STRICT FILTER: If not global, ONLY show current academy
                const currentAcademyId = useAuthStore.getState().profile?.current_academy_id;
                if (currentAcademyId) {
                    query = query.eq('academy_id', currentAcademyId);
                    console.log(`[useSessions] 🔒 Filtering by Academy ID: ${currentAcademyId}`);
                } else {
                    console.warn('[useSessions] ⚠️ No academy ID found for local filter');
                }

                const { data, error } = await query;

                if (error) {
                    console.error('[useSessions] Supabase error:', error);
                    return [];
                }
                rawData = data || [];
            }

            // Transform nested players and attendance structure to a flatter one
            // Combine players from session_players AND class_group members
            const transformedData = rawData.map(session => {
                // Get players from session_players with their assigned plan
                const sessionPlayers = session.session_players?.map((sp: any) => ({
                    ...sp.players,
                    plan_name: sp.subscription?.plan?.name
                })).filter((p: any) => p && p.id) || [];

                // Get players from class_group members 
                // Note: If they are in session_players they are already covered. 
                // We should prioritize session_players info as it has the specific plan for this session.
                const groupPlayers = session.class_group?.members?.map((m: any) => m.player).filter(Boolean) || [];

                // Merge players, prioritizing session_players (which includes plan info)
                const allPlayersMap = new Map();

                // First add group players (base)
                groupPlayers.forEach((p: any) => allPlayersMap.set(p.id, p));

                // Then overwrite/add session players (contains plan info)
                sessionPlayers.forEach((p: any) => allPlayersMap.set(p.id, p));

                const allPlayers = Array.from(allPlayersMap.values());

                return {
                    ...session,
                    players: Array.from(allPlayersMap.values()),
                    attendance: session.session_attendance || [],
                    class_group_id: session.class_group?.id || null,
                    class_group_name: session.class_group?.name || null,
                    class_group: session.class_group ? {
                        id: session.class_group.id,
                        name: session.class_group.name,
                        image_url: session.class_group.image_url,
                    } : null,
                };
            }) || [];

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
