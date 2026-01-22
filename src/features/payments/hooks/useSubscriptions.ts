import { useAuthStore } from '@/src/store/useAuthStore';
import { PlayerSubscription } from '@/src/types/payments';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';

export function useSubscriptions(playerId?: string) {
    const queryClient = useQueryClient();
    const { profile } = useAuthStore();

    // Obtener todas las suscripciones activas del alumno
    const { data: subscriptions, isLoading } = useQuery({
        queryKey: ['player-subscriptions', playerId],
        queryFn: async () => {
            if (!playerId) return [];

            const { data, error } = await supabase
                .from('player_subscriptions')
                .select('*, plan:pricing_plans(*)')
                .eq('player_id', playerId)
                .eq('status', 'active');

            if (error) throw error;
            return data as PlayerSubscription[];
        },
        enabled: !!playerId,
    });

    // Asignar un plan al alumno
    const assignPlanMutation = useMutation({
        mutationFn: async ({
            playerId,
            planId,
            customAmount,
            notes,
            replaceExisting = false
        }: {
            playerId: string;
            planId: string;
            customAmount?: number;
            notes?: string;
            replaceExisting?: boolean;
        }) => {
            if (replaceExisting) {
                // Si se solicita, cancelamos suscripciones activas anteriores
                await supabase
                    .from('player_subscriptions')
                    .update({ status: 'cancelled', end_date: new Date().toISOString() })
                    .eq('player_id', playerId)
                    .eq('status', 'active');
            }

            const academyId = profile?.current_academy_id;

            // Creamos la nueva
            const { data, error } = await supabase
                .from('player_subscriptions')
                .insert([{
                    player_id: playerId,
                    plan_id: planId,
                    academy_id: academyId,
                    custom_amount: customAmount,
                    notes: notes,
                    status: 'active',
                    start_date: new Date().toISOString().split('T')[0]
                }])
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['player-subscriptions', playerId] });
            queryClient.invalidateQueries({ queryKey: ['player-balances'] });
            queryClient.invalidateQueries({ queryKey: ['unifiedPaymentGroupBalances'] });
        },
    });

    // Cancelar suscripción
    const cancelSubscriptionMutation = useMutation({
        mutationFn: async (subscriptionId: string) => {
            const { error } = await supabase
                .from('player_subscriptions')
                .update({ status: 'cancelled', end_date: new Date().toISOString().split('T')[0] })
                .eq('id', subscriptionId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['player-subscriptions', playerId] });
            queryClient.invalidateQueries({ queryKey: ['player-balances'] });
            queryClient.invalidateQueries({ queryKey: ['unifiedPaymentGroupBalances'] });
        },
    });

    // Consumir clase de paquete (para sesiones)
    const consumeClassesMutation = useMutation({
        mutationFn: async (playerIds: string[]) => {
            // 1. Buscamos suscripciones de tipo paquete activas con clases restantes
            const { data: packages, error: fetchError } = await supabase
                .from('player_subscriptions')
                .select('id, remaining_classes, player_id, plan:pricing_plans!inner(type)')
                .in('player_id', playerIds)
                .eq('status', 'active')
                .eq('plan.type', 'package')
                .gt('remaining_classes', 0);

            if (fetchError) throw fetchError;
            if (!packages || packages.length === 0) return;

            // 2. Restar una clase a cada suscripción encontrada
            const updates = packages.map(pkg =>
                supabase
                    .from('player_subscriptions')
                    .update({
                        remaining_classes: pkg.remaining_classes - 1,
                        status: pkg.remaining_classes - 1 === 0 ? 'completed' : 'active'
                    })
                    .eq('id', pkg.id)
            );

            await Promise.all(updates);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['player-subscriptions'] });
            queryClient.invalidateQueries({ queryKey: ['player-balances'] });
        }
    });

    return {
        subscriptions,
        subscription: subscriptions?.[0], // Retornamos el primero para compatibilidad temporal
        isLoading,
        assignPlan: assignPlanMutation.mutateAsync,
        cancelSubscription: cancelSubscriptionMutation.mutateAsync,
        consumeClasses: consumeClassesMutation.mutateAsync,
        isAssigning: assignPlanMutation.isPending,
        isCancelling: cancelSubscriptionMutation.isPending,
        isConsuming: consumeClassesMutation.isPending,
    };
}
