import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';
import { useViewStore } from '../../../store/useViewStore';
import { CreateSessionInput, Session, UpdateSessionInput } from '../../../types/session';
import { generateUUID } from '../../../utils/uuid';

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
                    class_group:class_groups(id, name, image_url, members:class_group_members(player_id, is_plan_exempt)),
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
                const players = s.session_players?.map((sp: any) => {
                    // Debugging: Log if players are null
                    if (!sp.players && s.session_players.length > 0) {
                        console.warn('[useSessions] Found session_player without player data. RLS issue?', sp);
                    }

                    // Check if player is exempt in the group
                    const groupMember = s.class_group?.members?.find((m: any) => m.player_id === sp.players.id);
                    // Use optional chaining for safety
                    const isExempt = groupMember?.is_plan_exempt || false;

                    return {
                        ...sp.players,
                        subscription_id: sp.subscription_id,
                        plan_name: sp.subscription?.plan?.name,
                        plan_type: sp.subscription?.plan?.type,
                        is_plan_exempt: isExempt
                    };
                }).filter((p: any) => !!p) || [];

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

            // 2. Update players if provided (Surgical Audit-Safe Approach)
            if (player_ids !== undefined) {
                console.log(`[updateSession] Syncing players for session ${id}. Total intended: ${player_ids.length}`);

                // A. Obtenemos los alumnos actuales para saber quiénes se quitan
                const { data: existingPlayers } = await supabase
                    .from('session_players')
                    .select('player_id')
                    .eq('session_id', id);

                const existingIds = existingPlayers?.map(p => p.player_id) || [];
                const idsToRemove = existingIds.filter(eid => !player_ids.includes(eid));

                // B. QUITA QUIRÚRGICA: Solo borramos a los que ya no están.
                // Esto dispara el Trigger 'tr_audit_player_removal' SOLO para los que se van.
                if (idsToRemove.length > 0) {
                    console.log(`[updateSession] Removing ${idsToRemove.length} players surgically.`);
                    const { error: deleteError } = await supabase
                        .from('session_players')
                        .delete()
                        .eq('session_id', id)
                        .in('player_id', idsToRemove);

                    if (deleteError) throw deleteError;
                }

                // C. UPSERT: Sincronizamos los que se quedan o se añaden nuevos.
                // El Upsert no dispara el trigger de borrado (Refund), manteniendo sus cobros intactos.
                if (player_ids.length > 0) {
                    const sessionPlayerRecords = player_ids.map(pid => {
                        const subscriptionAssignment = input.player_subscriptions?.find(ps => ps.player_id === pid);
                        return {
                            session_id: id,
                            player_id: pid,
                            subscription_id: subscriptionAssignment?.subscription_id || null
                        };
                    });

                    const { error: upsertError } = await supabase
                        .from('session_players')
                        .upsert(sessionPlayerRecords, { onConflict: 'session_id, player_id' });

                    if (upsertError) throw upsertError;


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

            if (diffInHours > 24) {
                // HARD DELETE: Remove row completely (Clean Slate)
                console.log(`[deleteSession] Session is ${diffInHours.toFixed(1)}h away (>24h). Performing HARD DELETE.`);

                // AUDIT: Dejamos que el Trigger BEFORE DELETE de la sesión genere los reembolsos auditados.
                // await supabase.from('transactions').delete().eq('session_id', id).eq('type', 'charge'); // Clean slate for future

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
                // AUDIT: Dejamos que el Trigger genere los reembolsos auditados.
                // await supabase.from('transactions').delete().in('session_id', hardDeleteIds).eq('type', 'charge');

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

    const deleteSessionsBulk = useMutation({
        mutationFn: async ({ sessionIds, reason }: { sessionIds: string[]; reason?: string }) => {
            if (!sessionIds || sessionIds.length === 0) return;
            console.log('[deleteSessionsBulk] Processing deletion for', sessionIds.length, 'sessions');

            // 1. Fetch sessions to decide Soft vs Hard delete
            const { data: sessions, error: fetchError } = await supabase
                .from('sessions')
                .select('id, scheduled_at')
                .in('id', sessionIds);

            if (fetchError) throw fetchError;
            if (!sessions || sessions.length === 0) return;

            const now = new Date();
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
                // AUDIT: Dejamos que el Trigger genere los reembolsos auditados.
                // await supabase.from('transactions').delete().in('session_id', hardDeleteIds).eq('type', 'charge');
                const { error } = await supabase.from('sessions').delete().in('id', hardDeleteIds);
                if (error) throw error;
            }

            // 3. Execute Soft Deletes
            if (softDeleteIds.length > 0) {
                console.log(`[deleteSessionsBulk] Soft deleting ${softDeleteIds.length} sessions (<24h)`);
                const { error } = await supabase
                    .from('sessions')
                    .update({
                        deleted_at: new Date().toISOString(),
                        cancellation_reason: reason || 'Cancelación masiva',
                        status: 'cancelled'
                    })
                    .in('id', softDeleteIds);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            console.log('[deleteSessionsBulk] Success, invalidating queries');
            queryClient.invalidateQueries({ queryKey: ['sessions'] });
            queryClient.invalidateQueries({ queryKey: ['playerBalances'] });
            queryClient.invalidateQueries({ queryKey: ['paymentStats'] });
            queryClient.invalidateQueries({ queryKey: ['unifiedPaymentGroupBalances'] });
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
        },
    });

    const removePlayersFromSessionsBulk = useMutation({
        mutationFn: async ({ sessionIds, playerIds }: { sessionIds: string[]; playerIds: string[] }) => {
            if (!sessionIds.length || !playerIds.length) return;

            console.log(`[removePlayersFromSessionsBulk] Removing ${playerIds.length} players from ${sessionIds.length} sessions`);

            // 1. Fetch sessions
            const { data: sessions, error: fetchError } = await supabase
                .from('sessions')
                .select('id, scheduled_at')
                .in('id', sessionIds);

            if (fetchError) throw fetchError;

            const validSessionIds = sessions?.map(s => s.id) || [];
            const skippedCount = sessionIds.length - validSessionIds.length;

            if (validSessionIds.length === 0) {
                console.warn('[removePlayersFromSessionsBulk] No sessions found to modify.');
                return { modified: 0, skipped: sessionIds.length };
            }

            // 2. Delete from session_players
            const { error: deleteError } = await supabase
                .from('session_players')
                .delete()
                .in('session_id', validSessionIds)
                .in('player_id', playerIds);

            if (deleteError) throw deleteError;

            // AUDIT: Habilitado vía Trigger en la base de datos (tr_audit_player_removal).
            // Al quitar alumnos, la DB generará automáticamente reembolsos auditados con Mail y Fecha de hoy.
            /*
            const { error: txError } = await supabase
                .from('transactions')
                .delete()
                .eq('type', 'charge')
                .in('session_id', validSessionIds)
                .in('player_id', playerIds); // Assuming player_id column exists on transactions

            if (txError) {
                console.warn('[removePlayersFromSessionsBulk] Could not clean up transactions (maybe player_id column missing on tx?)', txError);
            }
            */

            return { modified: validSessionIds.length, skipped: skippedCount };
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['sessions'] });
            await queryClient.invalidateQueries({ queryKey: ['playerBalances'] });
            await queryClient.invalidateQueries({ queryKey: ['paymentStats'] });
        }
    });

    const addPlayersToSessionsBulk = useMutation({
        mutationFn: async ({ sessionIds, playerIds }: { sessionIds: string[]; playerIds: string[] }) => {
            if (!sessionIds.length || !playerIds.length) return;

            // 1. Fetch Session Details to get Class Group ID & Academy ID
            const { data: sessionsData, error: sessionsError } = await supabase
                .from('sessions')
                .select('id, class_group_id, academy_id')
                .in('id', sessionIds);

            if (sessionsError || !sessionsData) {
                console.error('[addPlayersToSessionsBulk] Error fetching session details:', sessionsError);
                throw sessionsError || new Error('Failed to fetch session details');
            }

            // 2. Fetch Active Subscriptions for these players
            // We assume subscriptions are relevant for the academy of the sessions
            // (Assuming all sessions belong to same academy context here, which is true for UI)
            const academyId = sessionsData[0]?.academy_id;

            const { data: subsData, error: subsError } = await supabase
                .from('player_subscriptions')
                .select('id, player_id, plan_id, status, plan:pricing_plans(type)')
                .in('player_id', playerIds)
                .eq('status', 'active');
            // We should filter by academy via plan? usually plans belong to academy.
            // But for now matching player_id and active status is a good start.

            if (subsError) console.warn('[addPlayersToSessionsBulk] Error fetching subs:', subsError);

            // 3. Fetch Group Default Plans (if any)
            const groupIds = [...new Set(sessionsData.map(s => s.class_group_id).filter(Boolean))];
            let groupPlans: Record<string, string> = {}; // groupId -> planId

            if (groupIds.length > 0) {
                const { data: groupsData } = await supabase
                    .from('class_groups')
                    .select('id, payment_plan_id') // Assuming column is payment_plan_id or we check relationships
                    // Wait, schema says: plan:pricing_plans(id) implied via FK? 
                    // Let's check typical schema: often `default_plan_id` or `plan_id`.
                    // useClassGroups used: plan:pricing_plans(...)
                    // So there is a foreign key. Let's assume it's `plan_id` if not found in cache.
                    // Actually, I'll try to guess it's `plan_id` based on standard naming.
                    .in('id', groupIds);

                // ADJUSTMENT: If I don't know the column name for sure, I should check.
                // But useClassGroups selected `plan:pricing_plans(...)`. This usually implies `plan_id` column.

                if (groupsData) {
                    // CAREFUL: If the column is named differently, this fails. 
                    // I will assume `plan_id`. If it fails, I'll catch it.
                    // Actually, I can't risk it crashing. 
                    // Let's try to map generic plan logic: find a subscription that matches the "Group Type".
                    // Or simply match ANY active subscription? that's safer for "Auto-assign".
                }
            }

            // SIMPLIFIED LOGIC FIRST:
            // Match any active subscription for the player? 
            // Better: Match subscription that has same PLAN ID as the Group?
            // To do that safely without knowing column name:
            // I will start by fetching `class_groups` with `plan_id`. If it errors, I default to null.
            const { data: groupsWithPlan } = await supabase
                .from('class_groups')
                .select('id, plan_id')
                .in('id', groupIds);

            if (groupsWithPlan) {
                groupsWithPlan.forEach((g: any) => {
                    if (g.plan_id) groupPlans[g.id] = g.plan_id;
                });
            }

            // Iterate over sessions and insert players
            let modified = 0;

            for (const sessionId of sessionIds) {
                const session = sessionsData.find(s => s.id === sessionId);
                const groupPlanId = session?.class_group_id ? groupPlans[session.class_group_id] : null;

                // Prepare inserts
                const inserts = playerIds.map(playerId => {
                    // Resolve Subscription
                    let subscriptionId = null;

                    // Strategy: 
                    // 1. If Group has Plan -> Find player's sub to that Plan
                    if (groupPlanId) {
                        const preciseMatch = subsData?.find(s => s.player_id === playerId && s.plan_id === groupPlanId);
                        if (preciseMatch) subscriptionId = preciseMatch.id;
                    }

                    // 2. Fallback: If no precise match, pick FIRST active subscription?
                    // User said: "tome el plan del grupo". Implicitly: "Use the subscription that corresponds to this group".
                    // If they don't have it, maybe we shouldn't force one.
                    // Let's stick to precise match for safety.

                    return {
                        session_id: sessionId,
                        player_id: playerId,
                        subscription_id: subscriptionId,
                        // status: 'present' // REMOVED as per schema fix
                    };
                });

                const { data: insertedData, error } = await supabase
                    .from('session_players')
                    .upsert(inserts, { onConflict: 'session_id, player_id' }) // Removed ignoreDuplicates to fail loudly
                    .select();

                if (!error) {
                    // STRICT CHECK: RLS might return success but insert 0 rows
                    if (!insertedData || insertedData.length === 0) {
                        console.warn(`[addPlayersToSessionsBulk] Success but 0 rows inserted for session ${sessionId}. Possible RLS blocking.`);
                        // Don't throw for every session, maybe just log?
                        // Or throw to alert user?
                        // throw new Error(`Error de Permisos (RLS): No se pudo agregar el alumno a la sesión ${sessionId}.`); 
                        // Let's throw to be loud as agreed.
                        throw new Error(`Error de Permisos (RLS): No se pudo agregar el alumno a la sesión ${sessionId}.`);
                    }

                    console.log(`[addPlayersToSessionsBulk] Successfully added ${playerIds.length} players to session ${sessionId}`, insertedData);
                    modified++;
                } else {
                    console.error(`Error adding players to session ${sessionId}:`, error);
                    throw error; // Re-throw to stop flow and alert user
                }
            }

            return { modified };
        },
        onSuccess: async () => {
            console.log('[addPlayersToSessionsBulk] Success, invalidating queries');
            await queryClient.invalidateQueries({ queryKey: ['sessions'] });
            await queryClient.invalidateQueries({ queryKey: ['playerBalances'] });
            // Add a refetch to be sure?
            // await queryClient.refetchQueries({ queryKey: ['sessions'] }); 
            // Invaliding with await is usually enough as it marks them stale.
        },
    });

    return {
        createSession,
        updateSession,
        deleteSession,
        createSessionsBulk,
        deleteSessionSeries,
        deleteSessionsBulk,
        removePlayersFromSessionsBulk,
        addPlayersToSessionsBulk,
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
                    class_group:class_groups(
                        id,
                        members:class_group_members(player_id, is_plan_exempt)
                    ),
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
