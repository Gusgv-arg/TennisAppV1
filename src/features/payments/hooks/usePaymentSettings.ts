import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';
import { AcademySettings } from '../../../types/academy';
import { useCurrentAcademy } from '../../academy/hooks/useAcademy';

interface PaymentSettings {
    payments_enabled: boolean;
    payments_simplified: boolean;
}

export function usePaymentSettings() {
    const { session, profile, setProfile } = useAuthStore();
    const { data: currentAcademy } = useCurrentAcademy();
    const queryClient = useQueryClient();

    // Get academy settings - payments_enabled is per-academy
    const academySettings = currentAcademy?.settings as AcademySettings | undefined;

    const settings: PaymentSettings = {
        // payments_enabled comes from academy settings (per-academy)
        payments_enabled: academySettings?.payments_enabled ?? true,
        // payments_simplified remains per-user preference
        payments_simplified: profile?.payments_simplified || false,
    };

    const enablePaymentsMutation = useMutation({
        mutationFn: async ({ simplified }: { simplified: boolean }) => {
            if (!session?.user?.id) throw new Error('No user session');
            if (!currentAcademy?.id) throw new Error('No academy selected');

            // Update academy settings (payments_enabled)
            const { error: academyError } = await supabase
                .from('academies')
                .update({
                    settings: {
                        ...academySettings,
                        payments_enabled: true,
                    },
                })
                .eq('id', currentAcademy.id);

            if (academyError) throw academyError;

            // Update user simplified mode preference
            const { data, error } = await supabase
                .from('profiles')
                .update({
                    payments_simplified: simplified,
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
            queryClient.invalidateQueries({ queryKey: ['academies'] });
            queryClient.invalidateQueries({ queryKey: ['profile'] });
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
        enablePayments: enablePaymentsMutation.mutateAsync,
        disablePayments: disablePaymentsMutation.mutateAsync,
        isEnabling: enablePaymentsMutation.isPending,
        isDisabling: disablePaymentsMutation.isPending,
    };
}

