import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';
import type { CreateTransactionInput, PlayerBalance, Transaction } from '../../../types/payments';

// Hook para obtener balances de todos los alumnos
export function usePlayerBalances() {
    const { session } = useAuthStore();

    return useQuery({
        queryKey: ['playerBalances', session?.user?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('player_balances')
                .select('*')
                .eq('coach_id', session?.user?.id)
                .order('balance', { ascending: true }); // Morosos primero

            if (error) throw error;
            return data as PlayerBalance[];
        },
        enabled: !!session?.user?.id,
    });
}

// Hook para obtener transacciones de un alumno
export function usePlayerTransactions(playerId: string | undefined) {
    return useQuery({
        queryKey: ['transactions', playerId],
        queryFn: async () => {
            if (!playerId) return [];

            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('player_id', playerId)
                .order('transaction_date', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as Transaction[];
        },
        enabled: !!playerId,
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
        },
    });

    return { createTransaction, deleteTransaction };
}

// Hook para estadísticas de pagos del mes
export function usePaymentStats() {
    const { session } = useAuthStore();
    const queryClient = useQueryClient();

    return useQuery({
        queryKey: ['paymentStats', session?.user?.id],
        queryFn: async () => {
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);
            const startOfMonthStr = startOfMonth.toISOString().split('T')[0];

            // Obtener todos los players del coach
            const { data: players, error: playersError } = await supabase
                .from('players')
                .select('id')
                .eq('coach_id', session?.user?.id);

            if (playersError) throw playersError;

            const playerIds = players?.map(p => p.id) || [];

            if (playerIds.length === 0) {
                return {
                    totalCollected: 0,
                    totalPending: 0,
                    debtorsCount: 0,
                    totalPlayers: 0,
                };
            }

            // Total cobrado este mes
            const { data: payments, error: paymentsError } = await supabase
                .from('transactions')
                .select('amount')
                .eq('type', 'payment')
                .in('player_id', playerIds)
                .gte('transaction_date', startOfMonthStr);

            if (paymentsError) throw paymentsError;

            // Balances para calcular pendiente
            const { data: balances, error: balancesError } = await supabase
                .from('player_balances')
                .select('balance')
                .eq('coach_id', session?.user?.id);

            if (balancesError) throw balancesError;

            const totalCollected = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
            const totalPending = balances?.reduce((sum, b) => {
                return sum + (b.balance < 0 ? Math.abs(b.balance) : 0);
            }, 0) || 0;
            const debtorsCount = balances?.filter(b => b.balance < 0).length || 0;
            const totalPlayers = balances?.length || 0;

            return {
                totalCollected,
                totalPending,
                debtorsCount,
                totalPlayers,
            };
        },
        enabled: !!session?.user?.id,
    });
}
