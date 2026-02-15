import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';
import { CreatePlayerInput, Player, UpdatePlayerInput } from '../../../types/player';

export const usePlayerMutations = () => {
    const queryClient = useQueryClient();
    const { user, profile } = useAuthStore();

    const createPlayer = useMutation({
        mutationFn: async (input: CreatePlayerInput) => {
            if (!user?.id) throw new Error('User not authenticated');

            const academyId = profile?.current_academy_id;

            const { data, error } = await supabase
                .from('players')
                .insert([{
                    ...input,
                    coach_id: user.id,
                    academy_id: academyId
                }])
                .select()
                .single();

            if (error) throw error;
            return data as Player;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['players'] });
            // Invalidate academy specific queries if implemented later
            if (profile?.current_academy_id) {
                queryClient.invalidateQueries({ queryKey: ['players', profile.current_academy_id] });
            }
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
            queryClient.invalidateQueries({ queryKey: ['players'] });
            queryClient.invalidateQueries({ queryKey: ['player', data.id] });
        },
    });

    const archivePlayer = useMutation({
        mutationFn: async (id: string) => {
            const { data, error } = await supabase
                .from('players')
                .update({ is_archived: true })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            if (!data) throw new Error('No se pudo archivar el alumno. Verifique permisos.');
            return data;
        },
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: ['players'] });
            queryClient.invalidateQueries({ queryKey: ['player', id] });
        },
    });

    const unarchivePlayer = useMutation({
        mutationFn: async (id: string) => {
            const { data, error } = await supabase
                .from('players')
                .update({ is_archived: false })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            if (!data) throw new Error('No se pudo reactivar el alumno. Verifique permisos.');
            return data;
        },
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: ['players'] });
            queryClient.invalidateQueries({ queryKey: ['player', id] });
        },
    });

    const deletePlayer = useMutation({
        mutationFn: async (id: string) => {
            // Soft delete level 2: mark as deleted instead of removing from DB
            // This hides the record from UI but preserves all historical data
            const { data, error } = await supabase
                .from('players')
                .update({ is_deleted: true })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            if (!data) throw new Error('No se pudo eliminar el alumno. Verifique permisos.');
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['players'] });
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
