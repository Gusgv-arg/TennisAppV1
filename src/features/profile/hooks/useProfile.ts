import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';
import { Profile, UpdateProfileInput } from '../../../types/profile';

export const useProfile = () => {
    const { user } = useAuthStore();

    return useQuery({
        queryKey: ['profile', user?.id],
        queryFn: async () => {
            if (!user?.id) return null;

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error) throw error;
            return data as Profile;
        },
        enabled: !!user?.id,
    });
};

export const useProfileMutations = () => {
    const queryClient = useQueryClient();
    const { user, setProfile } = useAuthStore();

    const updateProfile = useMutation({
        mutationFn: async (input: UpdateProfileInput) => {
            if (!user?.id) throw new Error('User not authenticated');

            console.log('[useProfile] Mutation function called', { input, userId: user.id });

            // Avoid recursive updated_at if passed in input, though we set it explicitly
            const { updated_at, ...cleanInput } = input as any;

            const { data, error } = await supabase
                .from('profiles')
                .update({ ...cleanInput, updated_at: new Date().toISOString() })
                .eq('id', user.id)
                .select()
                .single();

            if (error) {
                console.error('[useProfile] Supabase update error:', error);
                throw error;
            }

            console.log('[useProfile] Supabase update success:', data);
            return data as Profile;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
            // Update the auth store with new profile data
            setProfile(data);
        },
    });

    return {
        updateProfile,
    };
};
