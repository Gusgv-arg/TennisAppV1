import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';
import { useViewStore } from '../../../store/useViewStore';
import { ClassGroup, CreateClassGroupInput, UpdateClassGroupInput } from '../../../types/classGroups';

export const useClassGroups = (status: 'active' | 'archived' | 'all' = 'active') => {
    const { user, profile } = useAuthStore();
    const { isGlobalView } = useViewStore();
    const academyId = profile?.current_academy_id;

    return useQuery({
        queryKey: ['class-groups', user?.id, status, academyId, isGlobalView],
        queryFn: async () => {
            if (!user?.id) return [];

            let query = supabase
                .from('class_groups')
                .select(`
                    *,
                    image_url,
                    plan:pricing_plans(id, name, type),
                    members:class_group_members(
                        player_id,
                        joined_at,
                        player:players(id, full_name)
                    )
                `);

            // Academy Filter
            if (isGlobalView) {
                // In global view, show all groups the coach owns (across all academies)
                query = query.eq('coach_id', user.id);
            } else if (academyId) {
                // In academy view, show groups for this academy
                query = query.eq('academy_id', academyId);
            } else {
                // Fallback for independent coaches
                query = query.eq('coach_id', user.id);
            }

            if (status !== 'all') {
                query = query.eq('is_active', status === 'active');
            }

            // Always filter out permanently deleted groups
            query = query.eq('is_deleted', false);

            const { data, error } = await query.order('name');

            if (error) {
                console.error('[useClassGroups] Error:', error);
                return [];
            }

            // Transform to add member_count
            return (data || []).map(group => ({
                ...group,
                member_count: group.members?.length || 0
            })) as ClassGroup[];
        },
        enabled: !!user?.id,
    });
};

export const useClassGroup = (id: string) => {
    return useQuery({
        queryKey: ['class-group', id],
        queryFn: async () => {
            if (!id) return null;

            const { data, error } = await supabase
                .from('class_groups')
                .select(`
                    *,
                    plan:pricing_plans(id, name, type),
                    members:class_group_members(
                        player_id,
                        joined_at,
                        player:players(id, full_name)
                    )
                `)
                .eq('id', id)
                .eq('is_deleted', false)
                .single();

            if (error) throw error;
            return data as ClassGroup;
        },
        enabled: !!id,
    });
};

export const useClassGroupMutations = () => {
    const queryClient = useQueryClient();
    const { user } = useAuthStore();

    const createGroup = useMutation({
        mutationFn: async (input: CreateClassGroupInput) => {
            if (!user?.id) throw new Error('Not authenticated');

            const { member_ids, ...groupData } = input;

            // 1. Create the group
            const { data: group, error } = await supabase
                .from('class_groups')
                .insert([{ ...groupData, coach_id: user.id }])
                .select()
                .single();

            if (error) throw error;

            // 2. Add members if provided
            if (member_ids && member_ids.length > 0) {
                const { error: membersError } = await supabase
                    .from('class_group_members')
                    .insert(member_ids.map(pid => ({
                        group_id: group.id,
                        player_id: pid
                    })));

                if (membersError) {
                    console.error('[createGroup] Error adding members:', membersError);
                    // Don't throw - group was created successfully
                }
            }

            return group as ClassGroup;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['class-groups'] });
        },
    });

    const updateGroup = useMutation({
        mutationFn: async ({ id, input }: { id: string; input: UpdateClassGroupInput }) => {
            const { member_ids, ...groupData } = input;

            // 1. Update group data
            if (Object.keys(groupData).length > 0) {
                const { error } = await supabase
                    .from('class_groups')
                    .update(groupData)
                    .eq('id', id);

                if (error) throw error;
            }

            // 2. Update members if provided
            if (member_ids !== undefined) {
                // Delete existing members
                await supabase
                    .from('class_group_members')
                    .delete()
                    .eq('group_id', id);

                // Insert new members
                if (member_ids.length > 0) {
                    const { error: membersError } = await supabase
                        .from('class_group_members')
                        .insert(member_ids.map(pid => ({
                            group_id: id,
                            player_id: pid
                        })));

                    if (membersError) throw membersError;
                }
            }
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['class-groups'] });
            queryClient.invalidateQueries({ queryKey: ['class-group', variables.id] });
        },
    });

    const archiveGroup = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('class_groups')
                .update({ is_active: false })
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['class-groups'] });
        },
    });

    const unarchiveGroup = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('class_groups')
                .update({ is_active: true })
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['class-groups'] });
        },
    });

    const deleteGroup = useMutation({
        mutationFn: async (id: string) => {
            // Soft delete level 2: mark as deleted instead of removing from DB
            // This hides the group from UI but preserves session history
            // Note: Group members (players) are NOT affected
            const { error } = await supabase
                .from('class_groups')
                .update({ is_deleted: true })
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['class-groups'] });
        },
    });

    return {
        createGroup,
        updateGroup,
        deleteGroup,
        archiveGroup,
        unarchiveGroup,
    };
};
