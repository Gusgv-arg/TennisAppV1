import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';
import { usePaymentSettings } from './usePaymentSettings';

/**
 * Hook para facturación automática basada en clases agendadas.
 * 
 * Lógica de facturación:
 * 
 * 1. PLAN POR CLASE (per_class):
 *    - Se genera cargo por cada clase agendada con fecha <= hoy
 *    - Usa el subscription_id guardado en session_players
 *    - Independiente de asistencia (devengado)
 * 
 * 2. PLAN MENSUAL (monthly):
 *    - Se genera cargo a MES VENCIDO (después de que termine el mes)
 *    - Condición: al menos 1 clase en ese mes
 */
export function useAutoBilling() {
    const { session } = useAuthStore();
    const queryClient = useQueryClient();
    const { isSimplifiedMode } = usePaymentSettings();

    const runAutoBilling = useMutation({
        mutationFn: async () => {
            if (!session?.user?.id) return;

            const now = new Date();
            const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
            const currentMonth = now.getMonth() + 1;
            const currentYear = now.getFullYear();

            console.log('[useAutoBilling] Running auto-billing...');

            // ===========================================
            // PROCESAR CLASES CON subscription_id ASIGNADO
            // ===========================================
            await processSessionBilling(session.user.id, today, now, currentMonth, currentYear, isSimplifiedMode);

            console.log('[useAutoBilling] Auto-billing completed');
        },
        onSuccess: () => {
            // Invalidar balances e historial para refrescar la UI
            queryClient.invalidateQueries({ queryKey: ['playerBalances'] });
            queryClient.invalidateQueries({ queryKey: ['paymentStats'] });
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            queryClient.invalidateQueries({ queryKey: ['unifiedPaymentGroupBalances'] });
        }
    });

    return {
        runAutoBilling: runAutoBilling.mutate,
        isExecuting: runAutoBilling.isPending
    };
}

/**
 * Procesa facturación para sesiones que tienen subscription_id asignado
 * Genera cargo según el tipo de plan (per_class o monthly)
 */
async function processSessionBilling(
    coachId: string,
    today: string,
    now: Date,
    currentMonth: number,
    currentYear: number,
    isSimplifiedMode: boolean
) {
    const stats = {
        found: 0,
        perClass: 0,
        monthly: 0,
        chargesCreated: 0,
        errors: [] as string[]
    };

    // Obtener sesiones con subscription_id que no están canceladas y con fecha <= hoy
    const { data: sessionPlayers, error: spError } = await supabase
        .from('session_players')
        .select(`
            session_id,
            player_id,
            subscription_id,
            session:sessions!inner(id, scheduled_at, status, coach_id),
            subscription:player_subscriptions(id, custom_amount, plan:pricing_plans(id, name, type, amount, prices:pricing_plan_prices(*)))
        `)
        .eq('session.coach_id', coachId)
        .neq('session.status', 'cancelled')
        .lte('session.scheduled_at', `${today}T23:59:59`)
        .not('subscription_id', 'is', null);

    if (spError) {
        console.error('[useAutoBilling] Error fetching session_players:', spError);
        stats.errors.push(`Fetch error: ${spError.message}`);
        return stats;
    }

    if (!sessionPlayers || sessionPlayers.length === 0) {
        console.log('[useAutoBilling] No sessions with subscriptions found');
        return stats;
    }

    stats.found = sessionPlayers.length;

    // Agrupar por tipo de plan
    const perClassSessions: any[] = [];
    const monthlySessions: any[] = [];

    for (const sp of sessionPlayers) {
        const sub = sp.subscription as any;
        if (!sub?.plan) continue;

        if (sub.plan.type === 'per_class') {
            perClassSessions.push(sp);
        } else if (sub.plan.type === 'monthly') {
            monthlySessions.push(sp);
        }
    }

    stats.perClass = perClassSessions.length;
    stats.monthly = monthlySessions.length;

    // ===========================================
    // 1. PROCESAR PLANES "POR CLASE"
    // ===========================================
    for (const sp of perClassSessions) {
        try {
            const sessionData = sp.session as any;
            const sub = sp.subscription as any;

            // Verificar si ya existe cargo para esta sesión
            const { data: existingCharge, error: chargeError } = await supabase
                .from('transactions')
                .select('id')
                .eq('player_id', sp.player_id)
                .eq('session_id', sp.session_id)
                .eq('type', 'charge')
                .limit(1)
                .maybeSingle();

            if (chargeError) {
                console.error(`[useAutoBilling] Error checking charge for session ${sp.session_id}:`, chargeError);
                stats.errors.push(`Check error ${sp.session_id}: ${chargeError.message}`);
                continue;
            }

            if (!existingCharge) {
                // Determinar el monto
                let amount = isSimplifiedMode ? 1 : sub.custom_amount;

                if (!isSimplifiedMode && !amount) {
                    const sessionDate = new Date(sessionData.scheduled_at);
                    const validPrices = sub.plan.prices
                        ?.filter((p: any) => new Date(p.valid_from) <= sessionDate)
                        .sort((a: any, b: any) => new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime());

                    // Try to find valid price for date, otherwise fallback to:
                    // 1. Plan base amount
                    // 2. Oldest price available (if session is before first price)
                    // 3. 0 as last resort to ensure transaction is created
                    if (validPrices && validPrices.length > 0) {
                        amount = validPrices[0].amount;
                    } else {
                        // Fallback: Check if there are ANY prices
                        const allPrices = sub.plan.prices?.sort((a: any, b: any) => new Date(a.valid_from).getTime() - new Date(b.valid_from).getTime());
                        amount = sub.plan.amount || allPrices?.[0]?.amount || 0;
                        console.warn(`[useAutoBilling] No valid price found for date ${sessionData.scheduled_at}. Using fallback amount: ${amount}`);
                    }
                }

                const sessionDateStr = new Date(sessionData.scheduled_at).toLocaleDateString('es-AR');

                const { error: insertError } = await supabase
                    .from('transactions')
                    .insert([{
                        player_id: sp.player_id,
                        subscription_id: sp.subscription_id,
                        session_id: sp.session_id,
                        type: 'charge',
                        amount: amount,
                        description: `Clase ${sessionDateStr} - ${sub.plan.name}`,
                        transaction_date: now.toISOString(),
                    }]);

                if (insertError) {
                    console.error(`[useAutoBilling] Error creating per_class charge:`, insertError);
                    stats.errors.push(`Insert error ${sp.session_id}: ${insertError.message}`);
                } else {
                    console.log(`[useAutoBilling] Generated per_class charge of $${amount} for player ${sp.player_id}, session ${sp.session_id}`);
                    stats.chargesCreated++;
                }
            }
        } catch (e: any) {
            stats.errors.push(`Exception in per_class loop: ${e.message}`);
        }
    }

    // ===========================================
    // 2. PROCESAR PLANES MENSUALES (a mes vencido)
    // ===========================================
    // Agrupar sesiones mensuales por jugador + subscription + mes
    const monthlyByKey: Map<string, { player_id: string; subscription_id: string; sub: any; month: number; year: number }> = new Map();

    for (const sp of monthlySessions) {
        const sessionData = sp.session as any;
        const sessionDate = new Date(sessionData.scheduled_at);
        const month = sessionDate.getMonth() + 1;
        const year = sessionDate.getFullYear();

        // Solo procesar meses PASADOS
        if (year > currentYear || (year === currentYear && month >= currentMonth)) {
            continue;
        }

        const key = `${sp.player_id}-${sp.subscription_id}-${year}-${month}`;
        if (!monthlyByKey.has(key)) {
            monthlyByKey.set(key, {
                player_id: sp.player_id,
                subscription_id: sp.subscription_id,
                sub: sp.subscription,
                month,
                year
            });
        }
    }

    // Para cada combinación única, verificar si ya tiene cargo mensual
    for (const entry of monthlyByKey.values()) {
        try {
            const { data: existingCharge, error: chargeError } = await supabase
                .from('transactions')
                .select('id')
                .eq('player_id', entry.player_id)
                .eq('subscription_id', entry.subscription_id)
                .eq('type', 'charge')
                .eq('billing_month', entry.month)
                .eq('billing_year', entry.year)
                .limit(1)
                .maybeSingle();

            if (chargeError) {
                console.error(`[useAutoBilling] Error checking monthly charge:`, chargeError);
                stats.errors.push(`Check monthly error: ${chargeError.message}`);
                continue;
            }

            if (!existingCharge) {
                const sub = entry.sub as any;

                // Determinar el monto usando el precio vigente del último día del mes
                let amount = isSimplifiedMode ? 1 : sub.custom_amount;

                if (!isSimplifiedMode && !amount) {
                    const lastDayOfMonth = new Date(entry.year, entry.month, 0);
                    const sortedPrices = sub.plan.prices
                        ?.filter((p: any) => new Date(p.valid_from) <= lastDayOfMonth)
                        .sort((a: any, b: any) => new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime());

                    amount = sortedPrices?.[0]?.amount || sub.plan.amount;
                }

                const monthName = new Date(entry.year, entry.month - 1, 1).toLocaleString('es-AR', { month: 'long' });

                const { error: insertError } = await supabase
                    .from('transactions')
                    .insert([{
                        player_id: entry.player_id,
                        subscription_id: entry.subscription_id,
                        type: 'charge',
                        amount: amount,
                        description: `Cuota mensual - ${sub.plan.name} (${monthName} ${entry.year})`,
                        transaction_date: now.toISOString(),
                        billing_month: entry.month,
                        billing_year: entry.year
                    }]);

                if (insertError) {
                    console.error(`[useAutoBilling] Error creating monthly charge:`, insertError);
                    stats.errors.push(`Insert monthly error: ${insertError.message}`);
                } else {
                    console.log(`[useAutoBilling] Generated monthly charge of $${amount} for player ${entry.player_id}, ${monthName} ${entry.year}`);
                    stats.chargesCreated++;
                }
            }
        } catch (e: any) {
            stats.errors.push(`Exception in monthly loop: ${e.message}`);
        }
    }

    return stats;
}
