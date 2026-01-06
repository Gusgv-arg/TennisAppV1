import { PlayerSubscription } from '@/src/types/payments';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';

export function useSubscriptions(playerId?: string) {
    const queryClient = useQueryClient();

    // Obtener suscripción activa del alumno
    const { data: subscription, isLoading } = useQuery({
        queryKey: ['player-subscription', playerId],
        queryFn: async () => {
            if (!playerId) return null;

            const { data, error } = await supabase
                .from('player_subscriptions')
                .select('*, plan:pricing_plans(*)')
                .eq('player_id', playerId)
                .eq('status', 'active')
                .maybeSingle();

            if (error) throw error;
            return data as PlayerSubscription;
        },
        enabled: !!playerId,
    });

    // Asignar un plan al alumno
    const assignPlanMutation = useMutation({
        mutationFn: async ({
            playerId,
            planId,
            customAmount,
            notes
        }: {
            playerId: string;
            planId: string;
            customAmount?: number;
            notes?: string
        }) => {
            // Primero cancelamos suscripciones activas anteriores si existen
            await supabase
                .from('player_subscriptions')
                .update({ status: 'cancelled', end_date: new Date().toISOString() })
                .eq('player_id', playerId)
                .eq('status', 'active');

            // Creamos la nueva
            const { data, error } = await supabase
                .from('player_subscriptions')
                .insert([{
                    player_id: playerId,
                    plan_id: planId,
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
            queryClient.invalidateQueries({ queryKey: ['player-subscription', playerId] });
            queryClient.invalidateQueries({ queryKey: ['player-balances'] });
        },
    });

    // Cancelar suscripción
    const cancelSubscriptionMutation = useMutation({
        mutationFn: async (subscriptionId: string) => {
            const { error } = await supabase
                .from('player_subscriptions')
                .update({ status: 'cancelled', end_date: new Date().toISOString() })
                .eq('id', subscriptionId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['player-subscription', playerId] });
            queryClient.invalidateQueries({ queryKey: ['player-balances'] });
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
            queryClient.invalidateQueries({ queryKey: ['player-subscription'] });
            queryClient.invalidateQueries({ queryKey: ['player-balances'] });
        }
    });

    return {
        subscription,
        isLoading,
        assignPlan: assignPlanMutation.mutateAsync,
        cancelSubscription: cancelSubscriptionMutation.mutateAsync,
        consumeClasses: consumeClassesMutation.mutateAsync,
        isAssigning: assignPlanMutation.isPending,
        isCancelling: cancelSubscriptionMutation.isPending,
        isConsuming: consumeClassesMutation.isPending,
    };
}
