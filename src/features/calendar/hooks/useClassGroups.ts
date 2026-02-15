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
                        plan_id,
                        is_plan_exempt,
                        player:players(id, full_name),
                        plan:pricing_plans(id, name)
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
                        plan_id,
                        is_plan_exempt,
                        player:players(id, full_name),
                        plan:pricing_plans(id, name)
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

            const { member_ids, members, ...groupData } = input;

            // 1. Create the group
            const { data: group, error } = await supabase
                .from('class_groups')
                .insert([{ ...groupData, coach_id: user.id }])
                .select()
                .single();

            if (error) throw error;

            // 2. Add members if provided
            // Support both legacy member_ids (string[]) and new members (GroupMemberInput[])
            const membersToInsert = [];
            if (input.members && input.members.length > 0) {
                membersToInsert.push(...input.members.map(m => ({
                    group_id: group.id,
                    player_id: m.player_id,
                    plan_id: m.plan_id === 'none_explicit' ? null : m.plan_id,
                    is_plan_exempt: m.plan_id === 'none_explicit' || m.is_plan_exempt
                })));
            } else if (member_ids && member_ids.length > 0) {
                // Legacy support
                membersToInsert.push(...member_ids.map(pid => ({
                    group_id: group.id,
                    player_id: pid,
                    plan_id: null
                })));
            }

            if (membersToInsert.length > 0) {
                const { error: membersError } = await supabase
                    .from('class_group_members')
                    .insert(membersToInsert);

                if (membersError) {
                    console.error('[createGroup] Error adding members:', membersError);
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
            const { member_ids, members, ...groupData } = input;

            // 1. Update group data
            if (Object.keys(groupData).length > 0) {
                const { error } = await supabase
                    .from('class_groups')
                    .update(groupData)
                    .eq('id', id);

                if (error) throw error;
            }

            // 2. Update members if provided
            // Determine if we need to update members. Check both fields.
            const hasMemberUpdate = members !== undefined || member_ids !== undefined;

            if (hasMemberUpdate) {
                // Delete existing members
                await supabase
                    .from('class_group_members')
                    .delete()
                    .eq('group_id', id);

                // Prepare new members
                const membersToInsert = [];
                if (members && members.length > 0) {
                    membersToInsert.push(...members.map(m => ({
                        group_id: id,
                        player_id: m.player_id,
                        plan_id: m.plan_id === 'none_explicit' ? null : m.plan_id,
                        is_plan_exempt: m.plan_id === 'none_explicit' || m.is_plan_exempt
                    })));
                } else if (member_ids && member_ids.length > 0) {
                    membersToInsert.push(...member_ids.map(pid => ({
                        group_id: id,
                        player_id: pid,
                        plan_id: null
                    })));
                }

                if (membersToInsert.length > 0) {
                    const { error: membersError } = await supabase
                        .from('class_group_members')
                        .insert(membersToInsert);

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
            const { data, error } = await supabase
                .from('class_groups')
                .update({ is_active: false })
                .eq('id', id)
                .select()
                .maybeSingle();

            if (error) throw error;
            if (!data) throw new Error('No se pudo archivar el grupo. Verifique permisos.');
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['class-groups'] });
        },
    });

    const unarchiveGroup = useMutation({
        mutationFn: async (id: string) => {
            const { data, error } = await supabase
                .from('class_groups')
                .update({ is_active: true })
                .eq('id', id)
                .select()
                .maybeSingle();

            if (error) throw error;
            if (!data) throw new Error('No se pudo restaurar el grupo. Verifique permisos.');
            return data;
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
            const { data, error } = await supabase
                .from('class_groups')
                .update({ is_deleted: true })
                .eq('id', id)
                .select()
                .maybeSingle();

            if (error) throw error;
            if (!data) throw new Error('No se pudo eliminar el grupo. Verifique permisos.');
            return data;
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
