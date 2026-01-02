import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';
import { CreatePlayerInput, Player, UpdatePlayerInput } from '../../../types/player';

export const usePlayerMutations = () => {
    const queryClient = useQueryClient();
    const { user } = useAuthStore();

    const createPlayer = useMutation({
        mutationFn: async (input: CreatePlayerInput) => {
            if (!user?.id) throw new Error('User not authenticated');

            const { data, error } = await supabase
                .from('players')
                .insert([{ ...input, coach_id: user.id }])
                .select()
                .single();

            if (error) throw error;
            return data as Player;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['players', user?.id] });
        },
    });

    const updatePlayer = useMutation({
        mutationFn: async ({ id, input }: { id: string; input: UpdatePlayerInput }) => {
            const { data, error } = await supabase
                .from('players')
                .update(input)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data as Player;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['players', user?.id] });
            queryClient.invalidateQueries({ queryKey: ['player', data.id] });
        },
    });

    const archivePlayer = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('players')
                .update({ is_archived: true })
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: ['players', user?.id] });
            queryClient.invalidateQueries({ queryKey: ['player', id] });
        },
    });

    const unarchivePlayer = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('players')
                .update({ is_archived: false })
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: ['players', user?.id] });
            queryClient.invalidateQueries({ queryKey: ['player', id] });
        },
    });

    const deletePlayer = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('players')
                .delete()
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['players', user?.id] });
        },
    });

    return {
        createPlayer,
        updatePlayer,
        archivePlayer,
        unarchivePlayer,
        deletePlayer,
    };
};
