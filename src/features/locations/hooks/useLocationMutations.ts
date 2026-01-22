import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';
import { CreateLocationInput, Location, UpdateLocationInput } from '../../../types/location';

export const useLocationMutations = () => {
    const queryClient = useQueryClient();
    const { user, profile } = useAuthStore();

    const createLocation = useMutation({
        mutationFn: async (input: CreateLocationInput) => {
            if (!user?.id) throw new Error('User not authenticated');

            const { data, error } = await supabase
                .from('locations')
                .insert([{ ...input, coach_id: user.id, academy_id: profile?.current_academy_id }])
                .select()
                .single();

            if (error) throw error;
            return data as Location;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['locations', user?.id] });
        },
    });

    const updateLocation = useMutation({
        mutationFn: async ({ id, input }: { id: string; input: UpdateLocationInput }) => {
            const { data, error } = await supabase
                .from('locations')
                .update(input)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data as Location;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['locations', user?.id] });
            queryClient.invalidateQueries({ queryKey: ['location', data.id] });
        },
    });

    const archiveLocation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('locations')
                .update({ is_archived: true })
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: ['locations', user?.id] });
            queryClient.invalidateQueries({ queryKey: ['location', id] });
        },
    });

    const unarchiveLocation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('locations')
                .update({ is_archived: false })
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: ['locations', user?.id] });
            queryClient.invalidateQueries({ queryKey: ['location', id] });
        },
    });

    const deleteLocation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('locations')
                .delete()
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['locations', user?.id] });
        },
    });

    return {
        createLocation,
        updateLocation,
        archiveLocation,
        unarchiveLocation,
        deleteLocation,
    };
};
