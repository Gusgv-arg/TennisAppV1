import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';
import { CreateCollaboratorInput, UpdateCollaboratorInput } from '../../../types/collaborator';

export const useCollaboratorMutations = () => {
    const queryClient = useQueryClient();
    const { user } = useAuthStore();

    const createCollaborator = useMutation({
        mutationFn: async (input: CreateCollaboratorInput) => {
            const { data, error } = await supabase
                .from('staff_members')
                .insert({
                    ...input,
                    coach_id: user!.id,
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['collaborators'] });
        },
    });

    const updateCollaborator = useMutation({
        mutationFn: async ({ id, input }: { id: string; input: UpdateCollaboratorInput }) => {
            const { data, error } = await supabase
                .from('staff_members')
                .update(input)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['collaborators'] });
        },
    });

    const deleteCollaborator = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('staff_members')
                .delete()
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['collaborators'] });
        },
    });

    const toggleCollaboratorActive = useMutation({
        mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
            const { data, error } = await supabase
                .from('staff_members')
                .update({ is_active })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['collaborators'] });
        },
    });

    return {
        createCollaborator,
        updateCollaborator,
        deleteCollaborator,
        toggleCollaboratorActive,
    };
};
