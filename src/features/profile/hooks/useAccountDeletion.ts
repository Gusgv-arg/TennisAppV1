import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';

interface SoleOwnedAcademy {
    id: string;
    name: string;
    member_count: number;
}

interface DeletionResult {
    success: boolean;
    error?: string;
    message?: string;
    deletion_scheduled_at?: string;
    archived_academies?: number;
    owned_academy_ids?: string[];
}

export const useAccountDeletion = () => {
    const { user, profile, signOut } = useAuthStore();
    const queryClient = useQueryClient();

    // Check if deletion is pending
    const isDeletionPending = !!profile?.deletion_scheduled_at;
    const deletionScheduledAt = profile?.deletion_scheduled_at
        ? new Date(profile.deletion_scheduled_at)
        : null;

    // Calculate days remaining
    const daysRemaining = deletionScheduledAt
        ? Math.max(0, Math.ceil((deletionScheduledAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : null;

    // Get sole-owned academies (for showing warning)
    const soleOwnedAcademiesQuery = useQuery({
        queryKey: ['soleOwnedAcademies', user?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .rpc('get_sole_owned_academies');

            if (error) throw error;
            return data as SoleOwnedAcademy[];
        },
        enabled: !!user?.id,
    });

    // Request account deletion
    const requestDeletion = useMutation({
        mutationFn: async (archiveAcademies: boolean = false) => {
            const { data, error } = await supabase
                .rpc('request_account_deletion', {
                    p_archive_academies: archiveAcademies
                });

            if (error) throw error;
            return data as DeletionResult;
        },
        onSuccess: async (data) => {
            if (data.success) {
                // Invalidate queries and sign out
                queryClient.invalidateQueries({ queryKey: ['profile'] });
                await signOut();
            }
        },
    });

    // Cancel pending deletion
    const cancelDeletion = useMutation({
        mutationFn: async (): Promise<DeletionResult> => {
            const { data, error } = await supabase
                .rpc('cancel_account_deletion', {}, { head: false, count: 'exact' });

            if (error) throw error;
            return data as DeletionResult;
        },
        onSuccess: async (result) => {
            if (result.success) {
                // Refresh profile data from DB
                const { data: updatedProfile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user?.id)
                    .single();

                if (updatedProfile) {
                    // Update authStore with fresh profile
                    const authStore = useAuthStore.getState();
                    authStore.setProfile(updatedProfile);
                }

                // Also invalidate queries
                queryClient.invalidateQueries({ queryKey: ['profile'] });
                queryClient.invalidateQueries({ queryKey: ['academies'] });
            }
        },
    });

    return {
        // State
        isDeletionPending,
        deletionScheduledAt,
        daysRemaining,
        soleOwnedAcademies: soleOwnedAcademiesQuery.data || [],
        hasSoleOwnedAcademies: (soleOwnedAcademiesQuery.data?.length || 0) > 0,
        isLoadingAcademies: soleOwnedAcademiesQuery.isLoading,

        // Actions
        requestDeletion,
        cancelDeletion,
    };
};
