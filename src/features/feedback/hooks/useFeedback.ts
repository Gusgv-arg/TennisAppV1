import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';
import type { CreateFeedbackInput, Feedback } from '../../../types/feedback';

export function useFeedback() {
    const { session } = useAuthStore();

    return useQuery({
        queryKey: ['feedback', session?.user?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('feedback')
                .select('*')
                .eq('user_id', session?.user?.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as Feedback[];
        },
        enabled: !!session?.user?.id,
    });
}

export function useFeedbackMutations() {
    const queryClient = useQueryClient();
    const { session, profile } = useAuthStore();

    const createFeedback = useMutation({
        mutationFn: async (input: CreateFeedbackInput) => {
            if (!session?.user?.id) throw new Error('Not authenticated');

            const { data, error } = await supabase
                .from('feedback')
                .insert({
                    user_id: session.user.id,
                    ...input,
                })
                .select()
                .single();

            if (error) throw error;

            // Increment feedback count in profile
            await supabase
                .from('profiles')
                .update({
                    beta_feedback_count: (profile?.beta_feedback_count || 0) + 1
                })
                .eq('id', session.user.id);

            return data as Feedback;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['feedback'] });
        },
    });

    return { createFeedback };
}
