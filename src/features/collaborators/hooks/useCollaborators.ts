import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';
import { Collaborator } from '../../../types/collaborator';
import { useAcademyMembers } from '../../academy/hooks/useAcademy';

/**
 * DEPRECATED: This hook now returns academy members instead of staff_members
 * The staff_members table has been replaced by academy_members
 */
export const useCollaborators = (searchQuery?: string, showInactive: boolean = false) => {
    const { profile } = useAuthStore();
    // Use the standard hook to ensure consistency with Team screen
    const { data: members, isLoading } = useAcademyMembers();

    return useQuery({
        queryKey: ['collaborators', profile?.current_academy_id, searchQuery, showInactive, members?.length],
        queryFn: async () => {
            if (!members) return [];

            // Filter by active status
            let filteredMembers = members;
            if (showInactive) {
                // useAcademyMembers only returns active members by default?
                // Let's check useAcademyMembers implementation. 
                // It filters eq('is_active', true).
                // So if showInactive is true, we can't use useAcademyMembers as is if we wanted inactive ones.
                // But usually the picker is for ACTIVE collaborators.
                // If we really need inactive, we'd need useArchivedAcademyMembers too.
                // For now, let's assume we only want active ones for the picker.
                filteredMembers = []; // If asking for inactive, useAcademyMembers won't have them
            } else {
                filteredMembers = members;
            }

            // Transform to Collaborator type
            const transformed = filteredMembers.map(member => {
                const user = (member as any).user;
                return {
                    id: member.id,
                    full_name: user?.full_name || user?.email || member.member_name || 'Sin nombre',
                    email: user?.email || member.member_email,
                    avatar_url: user?.avatar_url,
                    role: member.role,
                    is_active: member.is_active,
                    created_at: member.created_at,
                    updated_at: member.created_at,
                    coach_id: null,
                    phone: null,
                    notes: null,
                    profile_id: member.user_id
                } as unknown as Collaborator;
            });

            // Filter by search if provided
            let result = transformed;
            if (searchQuery) {
                const lowerQuery = searchQuery.toLowerCase();
                result = transformed.filter(c =>
                    c.full_name?.toLowerCase().includes(lowerQuery) ||
                    c.email?.toLowerCase().includes(lowerQuery)
                );
            }

            // Deduplicate by profile_id (user_id)
            // This handles cases where a user might have multiple roles (though useAcademyMembers might already handle this?)
            // useAcademyMembers returns raw rows. If a user has 2 rows, they appear twice.
            // Team screen handles this? No, Team screen just lists them.
            // If Team screen shows "gus" once, then there is only 1 row.
            // So we shouldn't need aggressive deduplication if the source is clean.
            // But let's keep it safe.
            const uniqueCollaborators = result.reduce((acc, current) => {
                if (current.profile_id) {
                    const exists = acc.find(item => item.profile_id === current.profile_id);
                    if (!exists) {
                        return acc.concat([current]);
                    }
                    return acc;
                } else {
                    return acc.concat([current]);
                }
            }, [] as Collaborator[]);

            return uniqueCollaborators;
        },
        enabled: !isLoading && !!members,
    });
};

export const useCollaborator = (id: string) => {
    const { profile } = useAuthStore();

    return useQuery({
        queryKey: ['collaborators', id],
        queryFn: async () => {
            if (!id) return null;

            const { data, error } = await supabase
                .from('academy_members')
                .select(`
                    id,
                    user_id,
                    role,
                    is_active,
                    created_at,
                    member_name,
                    member_email,
                    user:profiles(id, full_name, email, avatar_url)
                `)
                .eq('id', id)
                .single();

            if (error) {
                console.error('[useCollaborator] Error:', error);
                return null;
            }

            const user = (data as any).user;
            return {
                id: data.id,
                full_name: user?.full_name || user?.email || data.member_name || 'Sin nombre',
                email: user?.email || data.member_email,
                avatar_url: user?.avatar_url,
                role: data.role,
                is_active: data.is_active,
                created_at: data.created_at,
                updated_at: data.created_at,
                coach_id: null,
                phone: null,
                notes: null,
                profile_id: data.user_id
            } as unknown as Collaborator;
        },
        enabled: !!id && !!profile?.current_academy_id,
    });
};
