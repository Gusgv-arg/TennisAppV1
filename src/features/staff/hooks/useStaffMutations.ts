import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';
import { CreateStaffInput, UpdateStaffInput } from '../../../types/staff';

export const useStaffMutations = () => {
    const queryClient = useQueryClient();
    const { user } = useAuthStore();

    const createStaffMember = useMutation({
        mutationFn: async (input: CreateStaffInput) => {
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
            queryClient.invalidateQueries({ queryKey: ['staff'] });
        },
    });

    const updateStaffMember = useMutation({
        mutationFn: async ({ id, input }: { id: string; input: UpdateStaffInput }) => {
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
            queryClient.invalidateQueries({ queryKey: ['staff'] });
        },
    });

    const deleteStaffMember = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('staff_members')
                .delete()
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['staff'] });
        },
    });

    const toggleStaffActive = useMutation({
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
            queryClient.invalidateQueries({ queryKey: ['staff'] });
        },
    });

    return {
        createStaffMember,
        updateStaffMember,
        deleteStaffMember,
        toggleStaffActive,
    };
};
