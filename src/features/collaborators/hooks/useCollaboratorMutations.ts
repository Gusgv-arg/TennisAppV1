import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';

/**
 * DEPRECATED: This hook is kept for backwards compatibility
 * The staff_members table has been replaced by academy_members
 * Use useMemberMutations from academy/hooks instead
 */
export const useCollaboratorMutations = () => {
    const queryClient = useQueryClient();
    const { profile } = useAuthStore();

    const createCollaborator = useMutation({
        mutationFn: async (input: any) => {
            // This functionality is now handled by academy invitation system
            console.warn('[useCollaboratorMutations] createCollaborator is deprecated. Use useMemberMutations.inviteMember instead.');
            throw new Error('Esta función está deprecada. Usa la pantalla de Equipo para invitar miembros.');
        },
    });

    const updateCollaborator = useMutation({
        mutationFn: async ({ id, input }: { id: string; input: any }) => {
            // Update the academy_member role
            const { data, error } = await supabase
                .from('academy_members')
                .update({ role: input.role })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['collaborators'] });
            queryClient.invalidateQueries({ queryKey: ['academy-members'] });
        },
    });

    const deleteCollaborator = useMutation({
        mutationFn: async (id: string) => {
            // Delete from academy_members
            const { error } = await supabase
                .from('academy_members')
                .delete()
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['collaborators'] });
            queryClient.invalidateQueries({ queryKey: ['academy-members'] });
        },
    });

    const archiveCollaborator = useMutation({
        mutationFn: async (id: string) => {
            // Set is_active to false
            const { error } = await supabase
                .from('academy_members')
                .update({ is_active: false })
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['collaborators'] });
            queryClient.invalidateQueries({ queryKey: ['academy-members'] });
        },
    });

    const restoreCollaborator = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('academy_members')
                .update({ is_active: true })
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['collaborators'] });
            queryClient.invalidateQueries({ queryKey: ['academy-members'] });
        },
    });

    return {
        createCollaborator,
        updateCollaborator,
        deleteCollaborator,
        archiveCollaborator,
        restoreCollaborator,
    };
};
