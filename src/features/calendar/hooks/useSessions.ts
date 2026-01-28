import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';
import { useViewStore } from '../../../store/useViewStore';
import { CreateSessionInput, Session, UpdateSessionInput } from '../../../types/session';
import { generateUUID } from '../../../utils/uuid';
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
                    instructor:academy_members(id, member_name, user:profiles(full_name)),
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
                            plan:pricing_plans(name, type)
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
                    plan_name: sp.subscription?.plan?.name,
                    plan_type: sp.subscription?.plan?.type
                })).filter((p: any) => !!p) || [];

                return {
                    ...s,
                    players,
                    // Handle instructor from academy_members
                    instructor: s.instructor ? {
                        id: s.instructor_id,
                        full_name: s.instructor.user?.full_name || s.instructor.member_name || 'Instructor'
                    } : null,
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
        onSuccess: async () => {
            console.log('[createSession] Success, invalidating queries');
            await queryClient.invalidateQueries({ queryKey: ['sessions'] });
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

            // Calculate hours between now and the session
            const diffInMs = sessionDate.getTime() - now.getTime();
            const diffInHours = diffInMs / (1000 * 60 * 60);

            // LOGIC: 
            // 1. If it's more than 24 hours away -> HARD DELETE
            // 2. If it's less than 24 hours away or in the past -> SOFT DELETE (Mark cancelled)

            if (diffInHours > 24 && !reason) {
                // HARD DELETE: Remove row completely (Clean Slate)
                console.log(`[deleteSession] Session is ${diffInHours.toFixed(1)}h away (>24h). Performing HARD DELETE.`);

                // 1. Delete associated charges FIRST to prevent audit triggers from creating ghost refunds
                await supabase.from('transactions').delete().eq('session_id', id).eq('type', 'charge'); // Clean slate for future

                // 2. Delete the session
                const { error } = await supabase
                    .from('sessions')
                    .delete()
                    .eq('id', id);

                if (error) throw error;
            } else {
                // SOFT DELETE: Mark as cancelled
                // The DB Trigger 'tr_audit_session_soft_delete' automatically creates the refund
                // to compensate existing debt when deleted_at is set.
                console.log(`[deleteSession] Session is ${diffInHours.toFixed(1)}h away (<=24h or past). Performing SOFT DELETE.`);

                const { error } = await supabase
                    .from('sessions')
                    .update({
                        deleted_at: new Date().toISOString(),
                        cancellation_reason: reason || 'Cancelación tardía',
                        status: 'cancelled'
                    })
                    .eq('id', id);

                if (error) throw error;
            }

            // Note: We NO LONGER blindly delete charges here. 
            // - Hard Delete: cleaned them up explicitly.
            // - Soft Delete: preserved them and added refunds.

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

    const createSessionsBulk = useMutation({
        mutationFn: async (inputs: CreateSessionInput[]) => {
            if (!user?.id) throw new Error('User not authenticated');
            if (inputs.length === 0) return [];

            console.log(`[createSessionsBulk] Starting bulk creation for ${inputs.length} sessions`);

            // 1. Prepare data with client-side IDs
            const sessionsToInsert: any[] = [];
            const playersToInsert: any[] = [];
            const playerIdsToConsume: Set<string> = new Set();

            inputs.forEach(input => {
                const sessionId = generateUUID();
                const { player_ids, player_subscriptions, ...sessionData } = input;

                // Session Data
                sessionsToInsert.push({
                    ...sessionData,
                    id: sessionId,
                    coach_id: user.id
                });

                // Players Data
                if (player_ids && player_ids.length > 0) {
                    player_ids.forEach(pid => {
                        playerIdsToConsume.add(pid);
                        const subscriptionAssignment = player_subscriptions?.find(ps => ps.player_id === pid);
                        playersToInsert.push({
                            session_id: sessionId,
                            player_id: pid,
                            subscription_id: subscriptionAssignment?.subscription_id || null
                        });
                    });
                }
            });

            // 2. Batch Insert Sessions
            const { error: sessionError } = await supabase
                .from('sessions')
                .insert(sessionsToInsert);

            if (sessionError) {
                console.error('[createSessionsBulk] Session batch error:', sessionError);
                throw sessionError;
            }

            // 3. Batch Insert Players
            if (playersToInsert.length > 0) {
                const { error: playersError } = await supabase
                    .from('session_players')
                    .insert(playersToInsert);

                if (playersError) {
                    console.error('[createSessionsBulk] Players batch error:', playersError);
                    // Sessions were created, so we might land in inconsistent state. 
                    // Ideally we'd use a transaction or RLS wouldn't allow incomplete states, but simplified for now.
                    throw playersError;
                }

                // 4. Consume classes (all unique players involved)
                try {
                    const uniquePlayers = Array.from(playerIdsToConsume);
                    // Consume 1 class per SESSION per PLAYER? 
                    // Actually consumeClasses consumes 1 class. If a player is in 10 sessions, they should consume 10 classes.
                    // The current consumeClasses hook takes [ids] and consumes 1 class for each ID efficiently (batch).
                    // So we must call it multiple times or update it to support "count".
                    // Current consumeClassesLogic:
                    // "2. Restar una clase a cada suscripción encontrada" -> it iterates over unique subscriptions.
                    // Implementation limitation: It consumes 1 class per active package found for the list of players.
                    // If I pass [p1, p1, p1], `in('player_id', ...)` will return the subscription once.
                    // And the logic `updates = packages.map(...)` updates it once.
                    // TODO: For bulk, this logic falls short if we want to consume N classes.
                    // For now, we will simplify: We won't auto-consume for bulk future classes to avoid draining packages instantly.
                    // Or we could loop. Given packages are rare, looping consumeClasses is acceptable for now or just skipping.
                    // Decision: Skip auto-consume for bulk future scheduling to prevent confusion/errors until logic supports 'amount'.
                    // Or better: Only consume for the FIRST session if it's today? 
                    // Let's Skip for now and add a TODO comment. Most coaches schedule future classes without debiting immediately.
                    console.log('[createSessionsBulk] Skipping auto-consume for bulk creation (Todo: Support multi-class consumption)');
                } catch (e) {
                    console.error(e);
                }
            }

            console.log('[createSessionsBulk] Success');
            return sessionsToInsert.map(s => ({ ...s } as Session));
        },
        onSuccess: async () => {
            console.log('[createSessionsBulk] Success, invalidating queries');
            await queryClient.invalidateQueries({ queryKey: ['sessions'] });
        }
    });

    const deleteSessionSeries = useMutation({
        mutationFn: async ({ recurrenceGroupId, reason }: { recurrenceGroupId: string; reason?: string }) => {
            if (!recurrenceGroupId) return;
            console.log('[deleteSessionSeries] Processing series:', recurrenceGroupId);

            // 1. Fetch all future sessions in this group
            const now = new Date();
            const { data: sessions, error: fetchError } = await supabase
                .from('sessions')
                .select('id, scheduled_at')
                .eq('recurrence_group_id', recurrenceGroupId)
                .gte('scheduled_at', now.toISOString()) // Only future ones
                .neq('status', 'cancelled')
                .is('deleted_at', null);

            if (fetchError) throw fetchError;
            if (!sessions || sessions.length === 0) return;

            const hardDeleteIds: string[] = [];
            const softDeleteIds: string[] = [];

            sessions.forEach(s => {
                const sessionDate = new Date(s.scheduled_at);
                const diffInHours = (sessionDate.getTime() - now.getTime()) / (1000 * 60 * 60);

                if (diffInHours > 24) {
                    hardDeleteIds.push(s.id);
                } else {
                    softDeleteIds.push(s.id);
                }
            });

            // 2. Execute Hard Deletes
            if (hardDeleteIds.length > 0) {
                console.log(`[deleteSessionSeries] Hard deleting ${hardDeleteIds.length} sessions (>24h)`);
                // cleanup transactions first
                await supabase.from('transactions').delete().in('session_id', hardDeleteIds).eq('type', 'charge');

                await supabase.from('sessions').delete().in('id', hardDeleteIds);
            }

            // 3. Execute Soft Deletes
            if (softDeleteIds.length > 0) {
                console.log(`[deleteSessionSeries] Soft deleting ${softDeleteIds.length} sessions (<24h)`);
                await supabase
                    .from('sessions')
                    .update({
                        deleted_at: new Date().toISOString(),
                        cancellation_reason: reason || 'Cancelación de serie',
                        status: 'cancelled'
                    })
                    .in('id', softDeleteIds);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sessions'] });
            queryClient.invalidateQueries({ queryKey: ['playerBalances'] });
            queryClient.invalidateQueries({ queryKey: ['paymentStats'] });
        },
    });

    return {
        createSession,
        updateSession,
        deleteSession,
        createSessionsBulk,
        deleteSessionSeries,
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
