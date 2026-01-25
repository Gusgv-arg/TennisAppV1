import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';
import { useViewStore } from '../../../store/useViewStore';
import { Collaborator } from '../../../types/collaborator';
import { useAcademyMembers, useGlobalAcademyMembers } from '../../academy/hooks/useAcademy';

/**
 * Hook to get collaborators (team members)
 * Adapts to Global View (all academies) or Local View (current academy)
 */
export const useCollaborators = (searchQuery?: string, showInactive: boolean = false) => {
    const { profile, user } = useAuthStore();
    const { isGlobalView } = useViewStore();

    // 1. Fetch Local Data (always enabled if single view)
    const { data: localMembers, isLoading: localLoading } = useAcademyMembers();

    // 2. Fetch Global Data (always enabled if global view)
    const { data: globalMembers, isLoading: globalLoading } = useGlobalAcademyMembers();

    // 3. Determine which source to use
    const members = isGlobalView ? globalMembers : localMembers;
    const isLoading = isGlobalView ? globalLoading : localLoading;

    return useQuery({
        queryKey: ['collaborators', user?.id, isGlobalView ? 'global' : profile?.current_academy_id, searchQuery, showInactive, members?.length],
        queryFn: async () => {
            if (!members) return [];

            // Filter by active status
            // Note: Both hooks currently return only active members by default (is_active=true)
            // If showInactive is true, we would need hooks to return inactive ones too.
            // As per current implementation, "archived" are separate.
            let filteredMembers = members;
            if (showInactive) {
                // Not supported by current hooks default behavior, return empty or implement specific logic
                filteredMembers = [];
            }

            // Transform to Collaborator type
            const transformed = filteredMembers.map(member => {
                const userData = (member as any).user;
                return {
                    id: member.id,
                    full_name: userData?.full_name || userData?.email || member.member_name || 'Sin nombre',
                    email: userData?.email || member.member_email,
                    avatar_url: userData?.avatar_url,
                    role: member.role,
                    is_active: member.is_active,
                    created_at: member.created_at,
                    updated_at: member.created_at,
                    coach_id: null,
                    phone: null,
                    notes: null,
                    profile_id: member.user_id,
                    academy_id: member.academy_id
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
            // In Global View: prevents showing the same coach twice if they are in multiple academies
            const uniqueCollaborators = result.reduce((acc, current) => {
                if (current.profile_id) {
                    const exists = acc.find(item => item.profile_id === current.profile_id);
                    if (!exists) {
                        return acc.concat([current]);
                    }
                    return acc;
                } else {
                    // For participants without user account, we can't easily deduplicate by ID.
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
