import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';
import { AcademySettings } from '../../../types/academy';
import { useCurrentAcademy } from '../../academy/hooks/useAcademy';

interface PaymentSettings {
    payments_enabled: boolean;
    payments_simplified: boolean;
    billing_enabled_at?: string;
}

export function usePaymentSettings() {
    const { session } = useAuthStore();
    const { data: currentAcademy } = useCurrentAcademy();
    const queryClient = useQueryClient();

    // Get academy settings - both settings are per-academy
    const academySettings = currentAcademy?.settings as AcademySettings | undefined;

    const settings: PaymentSettings = {
        // Both settings come from academy settings (per-academy)
        payments_enabled: academySettings?.payments_enabled ?? true,
        payments_simplified: academySettings?.payments_simplified ?? false,
        billing_enabled_at: academySettings?.billing_enabled_at,
    };

    const enablePaymentsMutation = useMutation({
        mutationFn: async ({ simplified }: { simplified: boolean }) => {
            if (!session?.user?.id) throw new Error('No user session');
            if (!currentAcademy?.id) throw new Error('No academy selected');

            // Update academy settings (both payments_enabled and payments_simplified)
            // Save current timestamp as the billing start date
            const { error } = await supabase
                .from('academies')
                .update({
                    settings: {
                        ...academySettings,
                        payments_enabled: true,
                        payments_simplified: simplified,
                        billing_enabled_at: new Date().toISOString(),
                    },
                })
                .eq('id', currentAcademy.id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['academies'] });
        },
    });

    const disablePaymentsMutation = useMutation({
        mutationFn: async () => {
            if (!session?.user?.id) throw new Error('No user session');
            if (!currentAcademy?.id) throw new Error('No academy selected');

            // Update academy settings (payments_enabled)
            const { error } = await supabase
                .from('academies')
                .update({
                    settings: {
                        ...academySettings,
                        payments_enabled: false,
                    },
                })
                .eq('id', currentAcademy.id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['academies'] });
        },
    });

    return {
        isEnabled: settings.payments_enabled,
        isSimplifiedMode: settings.payments_simplified,
        billingEnabledAt: settings.billing_enabled_at,
        academyId: currentAcademy?.id,
        enablePayments: enablePaymentsMutation.mutateAsync,
        disablePayments: disablePaymentsMutation.mutateAsync,
        isEnabling: enablePaymentsMutation.isPending,
        isDisabling: disablePaymentsMutation.isPending,
    };
}

