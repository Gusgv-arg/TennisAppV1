import { useCurrentAcademy } from '@/src/features/academy/hooks/useAcademy';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';
import { CreatePricingPlanInput, PricingPlan } from '../../../types/payments';

export function usePricingPlans() {
    const queryClient = useQueryClient();
    const { session } = useAuthStore();
    const { data: currentAcademy } = useCurrentAcademy();

    // Obtener todos los planes de la academia (o del coach si no hay academia)
    const { data: plans, isLoading } = useQuery({
        queryKey: ['pricing-plans', currentAcademy?.id || session?.user?.id],
        queryFn: async () => {
            if (!session?.user?.id) return [];

            let query = supabase
                .from('pricing_plans')
                .select('*, prices:pricing_plan_prices(*)')
                .order('created_at', { ascending: false });

            // Si hay academia, filtrar por academy_id
            if (currentAcademy?.id) {
                query = query.eq('academy_id', currentAcademy.id);
            } else {
                // Si no (modo legacy/personal), filtrar por coach_id
                query = query.eq('coach_id', session.user.id);
            }

            const { data, error } = await query;

            if (error) throw error;

            // Ordenar precios por fecha de vigencia descendente para cada plan
            const plansWithSortedPrices = (data as PricingPlan[]).map(plan => ({
                ...plan,
                prices: plan.prices?.sort((a, b) =>
                    new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime()
                )
            }));

            return plansWithSortedPrices;
        },
        enabled: !!session?.user?.id,
    });

    // Crear un nuevo plan con su primer precio
    const createPlanMutation = useMutation({
        mutationFn: async (plan: CreatePricingPlanInput) => {
            if (!session?.user?.id) throw new Error('No session');

            // 1. Crear el plan
            const planData: any = { ...plan, coach_id: session.user.id };

            // Asignar academy_id si está disponible
            if (currentAcademy?.id) {
                planData.academy_id = currentAcademy.id;
            }

            const { data: newPlan, error: planError } = await supabase
                .from('pricing_plans')
                .insert([planData])
                .select()
                .single();

            if (planError) throw planError;

            // 2. Crear el primer registro de precio con la fecha actual
            const { error: priceError } = await supabase
                .from('pricing_plan_prices')
                .insert([{
                    plan_id: newPlan.id,
                    amount: plan.amount,
                    valid_from: new Date().toISOString(),
                    created_by: session.user.id
                }]);

            if (priceError) throw priceError;
            return newPlan;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pricing-plans'] });
        },
    });

    // Agregar un nuevo precio al historial
    const createPriceMutation = useMutation({
        mutationFn: async ({ planId, amount, valid_from }: { planId: string; amount: number; valid_from: string }) => {
            if (!session?.user?.id) throw new Error('No session');

            const { data, error } = await supabase
                .from('pricing_plan_prices')
                .insert([{
                    plan_id: planId,
                    amount,
                    valid_from,
                    created_by: session.user.id
                }])
                .select()
                .single();

            if (error) throw error;

            // Opcional: Actualizar el monto "cache" en la tabla principal
            await supabase
                .from('pricing_plans')
                .update({ amount, price_updated_at: new Date().toISOString() })
                .eq('id', planId);

            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pricing-plans'] });
        },
    });

    // Actualizar metadatos de un plan
    const updatePlanMutation = useMutation({
        mutationFn: async ({ id, updates }: { id: string; updates: Partial<PricingPlan> }) => {
            const { data, error } = await supabase
                .from('pricing_plans')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pricing-plans'] });
        },
    });

    // Sincronizar precio con todos los alumnos suscritos (resetear custom_amount)
    const syncSubscriptionsPriceMutation = useMutation({
        mutationFn: async ({ planId }: { planId: string }) => {
            const { error } = await supabase
                .from('player_subscriptions')
                .update({ custom_amount: null })
                .eq('plan_id', planId)
                .eq('status', 'active');

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['player_subscriptions'] });
            queryClient.invalidateQueries({ queryKey: ['player-balances'] });
        }
    });

    // Archivar un plan (Soft Delete)
    const togglePlanStatusMutation = useMutation({
        mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
            const { error } = await supabase
                .from('pricing_plans')
                .update({ is_active })
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pricing-plans'] });
        },
    });

    // Eliminar un precio del historial
    const deletePriceMutation = useMutation({
        mutationFn: async (priceId: string) => {
            const { error } = await supabase
                .from('pricing_plan_prices')
                .delete()
                .eq('id', priceId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pricing-plans'] });
        },
    });

    // Eliminar un plan permanentemente (Solo si es necesario, pero mantenemos la lógica)
    const deletePlanMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('pricing_plans')
                .delete()
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pricing-plans'] });
        },
    });

    return {
        plans,
        isLoading,
        createPlan: createPlanMutation.mutateAsync,
        updatePlan: updatePlanMutation.mutateAsync,
        deletePlan: deletePlanMutation.mutateAsync,
        togglePlanStatus: togglePlanStatusMutation.mutateAsync,
        createPrice: createPriceMutation.mutateAsync,
        deletePrice: deletePriceMutation.mutateAsync,
        syncSubscriptionsPrice: syncSubscriptionsPriceMutation.mutateAsync,
        isCreating: createPlanMutation.isPending,
        isUpdating: updatePlanMutation.isPending,
        isDeleting: deletePlanMutation.isPending,
        isTogglingStatus: togglePlanStatusMutation.isPending,
        isCreatingPrice: createPriceMutation.isPending,
        isDeletingPrice: deletePriceMutation.isPending,
        isSyncing: syncSubscriptionsPriceMutation.isPending,
    };
}
