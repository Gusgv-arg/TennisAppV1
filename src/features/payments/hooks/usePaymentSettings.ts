import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';

interface PaymentSettings {
    payments_enabled: boolean;
    payments_simplified: boolean;
    payments_enabled_at: string | null;
}

export function usePaymentSettings() {
    const { session, profile, setProfile } = useAuthStore();
    const queryClient = useQueryClient();

    const settings: PaymentSettings = {
        payments_enabled: profile?.payments_enabled || false,
        payments_simplified: profile?.payments_simplified || false,
        payments_enabled_at: profile?.payments_enabled_at || null,
    };

    const enablePaymentsMutation = useMutation({
        mutationFn: async ({ simplified }: { simplified: boolean }) => {
            if (!session?.user?.id) throw new Error('No user session');

            const { data, error } = await supabase
                .from('profiles')
                .update({
                    payments_enabled: true,
                    payments_simplified: simplified,
                    payments_enabled_at: new Date().toISOString(),
                })
                .eq('id', session.user.id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            // Actualizar profile en el store
            if (data) {
                setProfile(data);
            }
            queryClient.invalidateQueries({ queryKey: ['profile'] });
        },
    });

    const disablePaymentsMutation = useMutation({
        mutationFn: async () => {
            if (!session?.user?.id) throw new Error('No user session');

            const { data, error } = await supabase
                .from('profiles')
                .update({
                    payments_enabled: false,
                    payments_simplified: false,
                    payments_enabled_at: null,
                })
                .eq('id', session.user.id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            if (data) {
                setProfile(data);
            }
            queryClient.invalidateQueries({ queryKey: ['profile'] });
        },
    });

    return {
        isEnabled: settings.payments_enabled,
        isSimplifiedMode: settings.payments_simplified,
        enabledAt: settings.payments_enabled_at,
        enablePayments: enablePaymentsMutation.mutateAsync,
        disablePayments: disablePaymentsMutation.mutateAsync,
        isEnabling: enablePaymentsMutation.isPending,
        isDisabling: disablePaymentsMutation.isPending,
    };
}
