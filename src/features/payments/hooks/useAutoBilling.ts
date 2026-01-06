import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';

export function useAutoBilling() {
    const { session } = useAuthStore();
    const queryClient = useQueryClient();

    const runAutoBilling = useMutation({
        mutationFn: async () => {
            if (!session?.user?.id) return;

            const now = new Date();
            const currentMonth = now.getMonth() + 1;
            const currentYear = now.getFullYear();
            // Primer día del mes actual a las 00:00:00
            const monthStart = new Date(currentYear, currentMonth - 1, 1).toISOString();

            // 1. Obtener suscripciones mensuales activas del coach
            // Usamos inner join con pricing_plans para filtrar por tipo 'monthly' y coach_id
            // También traemos el historial de precios del plan
            const { data: subscriptions, error: subError } = await supabase
                .from('player_subscriptions')
                .select('*, plan:pricing_plans!inner(*, prices:pricing_plan_prices(*))')
                .eq('status', 'active')
                .eq('plan.type', 'monthly')
                .eq('plan.coach_id', session.user.id);

            if (subError) {
                console.error('[useAutoBilling] Error fetching subscriptions:', subError);
                throw subError;
            }

            if (!subscriptions || subscriptions.length === 0) return;

            // 2. Para cada alumno con suscripción activa, verificar si ya tiene el cargo de este mes
            for (const sub of subscriptions) {
                const { data: existingCharge, error: chargeError } = await supabase
                    .from('transactions')
                    .select('id')
                    .eq('player_id', sub.player_id)
                    .eq('type', 'charge')
                    .eq('billing_month', currentMonth)
                    .eq('billing_year', currentYear)
                    .limit(1)
                    .maybeSingle();

                if (chargeError) {
                    console.error(`[useAutoBilling] Error checking charge for player ${sub.player_id}:`, chargeError);
                    continue;
                }

                if (!existingCharge) {
                    // Determinar el monto del cargo
                    let amount = sub.custom_amount;

                    if (!amount) {
                        // Buscar el precio vigente para la fecha actual en el historial
                        // Ordenamos por valid_from desc y tomamos el primero que sea <= hoy
                        const sortedPrices = sub.plan.prices
                            ?.filter((p: any) => new Date(p.valid_from) <= now)
                            .sort((a: any, b: any) => new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime());

                        amount = sortedPrices?.[0]?.amount || sub.plan.amount;
                    }

                    const monthName = now.toLocaleString('es-AR', { month: 'long' });

                    const { error: insertError } = await supabase
                        .from('transactions')
                        .insert([{
                            player_id: sub.player_id,
                            coach_id: session.user.id,
                            type: 'charge',
                            amount: amount,
                            description: `Cargo mensual automático - ${monthName} ${currentYear}`,
                            transaction_date: now.toISOString(),
                            billing_month: currentMonth,
                            billing_year: currentYear
                        }]);

                    if (insertError) {
                        console.error(`[useAutoBilling] Error creating charge for player ${sub.player_id}:`, insertError);
                    } else {
                        console.log(`[useAutoBilling] Generated charge of $${amount} for player ${sub.player_id}`);
                    }
                }
            }
        },
        onSuccess: () => {
            // Invalidar balances e historial para refrescar la UI
            queryClient.invalidateQueries({ queryKey: ['player-balances'] });
            queryClient.invalidateQueries({ queryKey: ['payment-stats'] });
            queryClient.invalidateQueries({ queryKey: ['player-transactions'] });
        }
    });

    return {
        runAutoBilling: runAutoBilling.mutate,
        isExecuting: runAutoBilling.isPending
    };
}
