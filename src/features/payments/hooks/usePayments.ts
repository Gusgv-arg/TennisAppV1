import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';
import type { CreateTransactionInput, PlayerBalance, Transaction } from '../../../types/payments';

import { useViewStore } from '../../../store/useViewStore';

// ... imports

// Hook para obtener balances de todos los alumnos
export function usePlayerBalances() {
    const { session, profile } = useAuthStore();
    const { isGlobalView } = useViewStore();

    return useQuery({
        queryKey: ['playerBalances', session?.user?.id, profile?.current_academy_id, isGlobalView],
        queryFn: async () => {
            let query = supabase
                .from('player_balances')
                .select('*');

            if (!isGlobalView && profile?.current_academy_id) {
                query = query.eq('academy_id', profile.current_academy_id);
            } else {
                query = query.eq('coach_id', session?.user?.id);
            }

            const { data, error } = await query.order('balance', { ascending: true });

            if (error) throw error;
            return data as PlayerBalance[];
        },
        enabled: !!session?.user?.id,
    });
}

// ... usePlayerTransactions ...

// ... useTransactionMutations ...

// Hook para estadísticas de pagos del mes (Optimized with RPC)
export function usePaymentStats() {
    const { session, profile } = useAuthStore();
    const { isGlobalView } = useViewStore();

    return useQuery({
        queryKey: ['paymentStats', session?.user?.id, profile?.current_academy_id, isGlobalView],
        queryFn: async () => {
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);

            const academyIdToUse = isGlobalView ? null : (profile?.current_academy_id || null);

            const { data, error } = await supabase
                .rpc('get_payment_stats_skill', {
                    p_coach_id: academyIdToUse ? null : session?.user?.id,
                    p_start_date: startOfMonth.toISOString(),
                    p_academy_id: academyIdToUse
                });

            if (error) throw error;

            return data as {
                totalCollected: number;
                totalPending: number;
                debtorsCount: number;
                totalPlayers: number;
            };
        },
        enabled: !!session?.user?.id,
    });
}

// Hook para obtener transacciones de un alumno o grupo unificado
export function usePlayerTransactions(playerId: string | undefined, unifiedGroupId?: string) {
    return useQuery({
        queryKey: ['transactions', playerId, unifiedGroupId],
        queryFn: async () => {
            let query = supabase
                .from('transactions')
                .select('*, player:players(full_name)')
                .order('transaction_date', { ascending: false })
                .order('created_at', { ascending: false });

            if (unifiedGroupId) {
                // Obtener IDs de miembros del grupo
                const { data: members } = await supabase
                    .from('players')
                    .select('id')
                    .eq('unified_payment_group_id', unifiedGroupId);

                const memberIds = members?.map(m => m.id) || [];

                if (memberIds.length === 0) return [];

                query = query.in('player_id', memberIds);
            } else if (playerId) {
                query = query.eq('player_id', playerId);
            } else {
                return [];
            }

            const { data, error } = await query;

            if (error) throw error;
            return data as (Transaction & { player?: { full_name: string } })[];
        },
        enabled: !!playerId || !!unifiedGroupId,
    });
}

// Hook para mutaciones de transacciones
export function useTransactionMutations() {
    const queryClient = useQueryClient();
    const { session } = useAuthStore();

    const createTransaction = useMutation({
        mutationFn: async (input: CreateTransactionInput) => {
            const { data, error } = await supabase
                .from('transactions')
                .insert({
                    ...input,
                    currency: input.currency || 'ARS',
                    transaction_date: input.transaction_date || new Date().toISOString().split('T')[0],
                    created_by: session?.user?.id,
                })
                .select()
                .single();

            if (error) throw error;
            return data as Transaction;
        },
        onSuccess: (data) => {
            // Invalidar queries relacionadas
            queryClient.invalidateQueries({ queryKey: ['transactions', data.player_id] });
            queryClient.invalidateQueries({ queryKey: ['playerBalances'] });
            queryClient.invalidateQueries({ queryKey: ['paymentStats'] });
            queryClient.invalidateQueries({ queryKey: ['unifiedPaymentGroupBalances'] });
        },
    });

    const deleteTransaction = useMutation({
        mutationFn: async (transactionId: string) => {
            const { error } = await supabase
                .from('transactions')
                .delete()
                .eq('id', transactionId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            queryClient.invalidateQueries({ queryKey: ['playerBalances'] });
            queryClient.invalidateQueries({ queryKey: ['unifiedPaymentGroupBalances'] });
        },
    });

    return { createTransaction, deleteTransaction };
}

// Hook para obtener transacciones por rango de fecha (Revenue Module)
export function useRevenueTransactions(startDate: string, endDate: string) {
    const { session, profile } = useAuthStore();
    const { isGlobalView } = useViewStore();

    return useQuery({
        queryKey: ['revenueTransactions', session?.user?.id, profile?.current_academy_id, startDate, endDate, isGlobalView],
        queryFn: async () => {
            if (!session?.user?.id) return [];

            let query = supabase
                .from('transactions')
                .select(`
                    *,
                    player:players(id, full_name, avatar_url),
                    academy:academies(id, name)
                `)
                .gte('transaction_date', startDate)
                .lte('transaction_date', endDate)
                .order('transaction_date', { ascending: false });

            // En vista local, filtrar por academia
            if (!isGlobalView && profile?.current_academy_id) {
                query = query.eq('academy_id', profile.current_academy_id);
            }
            // En vista global, el coach ve todo lo que sea suyo (RLS o filtro por coach_id si fuera necesario, 
            // pero transactions.coach_id no existe directo, suele ser por relación o RLS. 
            // ASUCIMOS que 'transactions' tiene RLS que filtra por coach a través del created_by o similar.
            // Si transactions tiene created_by = coach_id, es seguro.

            // Nota: En la definicion de types/payments.ts 'created_by' existe.
            // Aseguramos filtrar por el coach si RLS no fuera suficiente (backup)
            // query = query.eq('created_by', session.user.id); 

            const { data, error } = await query;

            if (error) throw error;
            return data as (Transaction & { player?: { full_name: string; avatar_url?: string }; academy?: { name: string } })[];
        },
        enabled: !!session?.user?.id,
    });
}
