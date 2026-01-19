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
 *    - Independiente de asistencia (devengado)
 *    - Monto = precio del plan por clase
 * 
 * 2. PLAN MENSUAL (monthly):
 *    - Se genera cargo a MES VENCIDO (después de que termine el mes)
 *    - Condición: al menos 1 clase en ese mes
 *    - Monto = precio mensual del plan
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
            // 1. PROCESAR PLANES "POR CLASE" (per_class)
            // ===========================================
            await processPerClassBilling(session.user.id, today, now, isSimplifiedMode);

            // ===========================================
            // 2. PROCESAR PLANES MENSUALES (monthly)
            // ===========================================
            await processMonthlyBilling(session.user.id, currentMonth, currentYear, now, isSimplifiedMode);

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
 * Procesa facturación para planes "por clase" (per_class)
 * Genera cargo por cada clase con fecha <= hoy que no tenga cargo asociado
 */
async function processPerClassBilling(
    coachId: string,
    today: string,
    now: Date,
    isSimplifiedMode: boolean
) {
    // Obtener suscripciones per_class activas
    const { data: subscriptions, error: subError } = await supabase
        .from('player_subscriptions')
        .select('*, plan:pricing_plans!inner(*, prices:pricing_plan_prices(*))')
        .eq('status', 'active')
        .eq('plan.type', 'per_class')
        .eq('plan.coach_id', coachId);

    if (subError) {
        console.error('[useAutoBilling] Error fetching per_class subscriptions:', subError);
        return;
    }

    if (!subscriptions || subscriptions.length === 0) return;

    for (const sub of subscriptions) {
        // Buscar sesiones del jugador con fecha <= hoy que NO tengan cargo
        const { data: uncharged, error: sessionsError } = await supabase
            .from('session_players')
            .select(`
                session_id,
                player_id,
                session:sessions!inner(id, scheduled_at, status, coach_id)
            `)
            .eq('player_id', sub.player_id)
            .eq('session.coach_id', coachId)
            .neq('session.status', 'cancelled')
            .lte('session.scheduled_at', `${today}T23:59:59`);

        if (sessionsError) {
            console.error(`[useAutoBilling] Error fetching sessions for player ${sub.player_id}:`, sessionsError);
            continue;
        }

        if (!uncharged || uncharged.length === 0) continue;

        // Para cada sesión, verificar si ya existe cargo y crear si no
        for (const sp of uncharged) {
            const sessionData = sp.session as any;

            // Verificar si ya existe cargo para esta sesión
            const { data: existingCharge, error: chargeError } = await supabase
                .from('transactions')
                .select('id')
                .eq('player_id', sub.player_id)
                .eq('session_id', sp.session_id)
                .eq('type', 'charge')
                .limit(1)
                .maybeSingle();

            if (chargeError) {
                console.error(`[useAutoBilling] Error checking charge for session ${sp.session_id}:`, chargeError);
                continue;
            }

            if (!existingCharge) {
                // Determinar el monto
                let amount = isSimplifiedMode ? 1 : sub.custom_amount;

                if (!isSimplifiedMode && !amount) {
                    const sessionDate = new Date(sessionData.scheduled_at);
                    const sortedPrices = sub.plan.prices
                        ?.filter((p: any) => new Date(p.valid_from) <= sessionDate)
                        .sort((a: any, b: any) => new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime());

                    amount = sortedPrices?.[0]?.amount || sub.plan.amount;
                }

                const sessionDateStr = new Date(sessionData.scheduled_at).toLocaleDateString('es-AR');

                const { error: insertError } = await supabase
                    .from('transactions')
                    .insert([{
                        player_id: sub.player_id,
                        subscription_id: sub.id,
                        session_id: sp.session_id,
                        type: 'charge',
                        amount: amount,
                        description: `Clase ${sessionDateStr} - ${sub.plan.name}`,
                        transaction_date: now.toISOString(),
                    }]);

                if (insertError) {
                    console.error(`[useAutoBilling] Error creating per_class charge:`, insertError);
                } else {
                    console.log(`[useAutoBilling] Generated per_class charge of $${amount} for player ${sub.player_id}, session ${sp.session_id}`);
                }
            }
        }
    }
}

/**
 * Procesa facturación para planes mensuales (monthly)
 * Genera cargo para meses PASADOS donde el jugador tuvo al menos 1 clase
 */
async function processMonthlyBilling(
    coachId: string,
    currentMonth: number,
    currentYear: number,
    now: Date,
    isSimplifiedMode: boolean
) {
    // Obtener suscripciones mensuales activas
    const { data: subscriptions, error: subError } = await supabase
        .from('player_subscriptions')
        .select('*, plan:pricing_plans!inner(*, prices:pricing_plan_prices(*))')
        .eq('status', 'active')
        .eq('plan.type', 'monthly')
        .eq('plan.coach_id', coachId);

    if (subError) {
        console.error('[useAutoBilling] Error fetching monthly subscriptions:', subError);
        return;
    }

    if (!subscriptions || subscriptions.length === 0) return;

    for (const sub of subscriptions) {
        // Buscar meses PASADOS donde el jugador tuvo clases
        // Limitamos a los últimos 12 meses para no ir muy atrás
        const oneYearAgo = new Date(currentYear - 1, currentMonth - 1, 1);

        const { data: sessions, error: sessionsError } = await supabase
            .from('session_players')
            .select(`
                session:sessions!inner(scheduled_at, status, coach_id)
            `)
            .eq('player_id', sub.player_id)
            .eq('session.coach_id', coachId)
            .neq('session.status', 'cancelled')
            .gte('session.scheduled_at', oneYearAgo.toISOString());

        if (sessionsError) {
            console.error(`[useAutoBilling] Error fetching sessions for monthly billing:`, sessionsError);
            continue;
        }

        if (!sessions || sessions.length === 0) continue;

        // Agrupar sesiones por mes
        const sessionsByMonth: Map<string, boolean> = new Map();
        for (const sp of sessions) {
            const sessionData = sp.session as any;
            const sessionDate = new Date(sessionData.scheduled_at);
            const monthKey = `${sessionDate.getFullYear()}-${sessionDate.getMonth() + 1}`;
            sessionsByMonth.set(monthKey, true);
        }

        // Para cada mes con clases, verificar si es un mes PASADO y si ya tiene cargo
        for (const monthKey of sessionsByMonth.keys()) {
            const [yearStr, monthStr] = monthKey.split('-');
            const year = parseInt(yearStr);
            const month = parseInt(monthStr);

            // Solo procesar meses PASADOS (no el mes actual)
            if (year > currentYear || (year === currentYear && month >= currentMonth)) {
                continue;
            }

            // Verificar si ya existe cargo para este mes
            const { data: existingCharge, error: chargeError } = await supabase
                .from('transactions')
                .select('id')
                .eq('player_id', sub.player_id)
                .eq('subscription_id', sub.id)
                .eq('type', 'charge')
                .eq('billing_month', month)
                .eq('billing_year', year)
                .limit(1)
                .maybeSingle();

            if (chargeError) {
                console.error(`[useAutoBilling] Error checking monthly charge:`, chargeError);
                continue;
            }

            if (!existingCharge) {
                // Determinar el monto usando el precio vigente del último día del mes
                let amount = isSimplifiedMode ? 1 : sub.custom_amount;

                if (!isSimplifiedMode && !amount) {
                    const lastDayOfMonth = new Date(year, month, 0); // Último día del mes
                    const sortedPrices = sub.plan.prices
                        ?.filter((p: any) => new Date(p.valid_from) <= lastDayOfMonth)
                        .sort((a: any, b: any) => new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime());

                    amount = sortedPrices?.[0]?.amount || sub.plan.amount;
                }

                const monthName = new Date(year, month - 1, 1).toLocaleString('es-AR', { month: 'long' });

                const { error: insertError } = await supabase
                    .from('transactions')
                    .insert([{
                        player_id: sub.player_id,
                        subscription_id: sub.id,
                        type: 'charge',
                        amount: amount,
                        description: `Cuota mensual - ${sub.plan.name} (${monthName} ${year})`,
                        transaction_date: now.toISOString(),
                        billing_month: month,
                        billing_year: year
                    }]);

                if (insertError) {
                    console.error(`[useAutoBilling] Error creating monthly charge:`, insertError);
                } else {
                    console.log(`[useAutoBilling] Generated monthly charge of $${amount} for player ${sub.player_id}, ${monthName} ${year}`);
                }
            }
        }
    }
}
