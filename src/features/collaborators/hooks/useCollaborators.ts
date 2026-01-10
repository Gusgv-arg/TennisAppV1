import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';
import { Collaborator } from '../../../types/collaborator';

/**
 * DEPRECATED: This hook now returns academy members instead of staff_members
 * The staff_members table has been replaced by academy_members
 */
export const useCollaborators = (searchQuery?: string, showInactive: boolean = false) => {
    const { profile } = useAuthStore();

    return useQuery({
        queryKey: ['collaborators', profile?.current_academy_id, searchQuery, showInactive],
        queryFn: async () => {
            if (!profile?.current_academy_id) return [];

            // Query academy_members instead of staff_members
            let query = supabase
                .from('academy_members')
                .select(`
                    id,
                    user_id,
                    role,
                    is_active,
                    created_at,
                    user:profiles(id, full_name, email, avatar_url)
                `)
                .eq('academy_id', profile.current_academy_id)
                .order('created_at', { ascending: false });

            // Filter by active status
            if (showInactive) {
                query = query.eq('is_active', false);
            } else {
                query = query.eq('is_active', true);
            }

            const { data, error } = await query;

            if (error) {
                console.error('[useCollaborators] Error:', error);
                return [];
            }

            // Transform to match old Collaborator type
            const transformed = data?.map(member => {
                const user = (member as any).user;
                return {
                    id: member.id,
                    full_name: user?.full_name || user?.email || 'Sin nombre',
                    email: user?.email,
                    avatar_url: user?.avatar_url,
                    role: member.role,
                    is_active: member.is_active,
                    created_at: member.created_at,
                    updated_at: member.created_at, // Use created_at as fallback
                    // Legacy fields
                    coach_id: null,
                    phone: null,
                    notes: null,
                    profile_id: member.user_id
                } as unknown as Collaborator;
            }) || [];

            // Filter by search if provided
            if (searchQuery) {
                const lowerQuery = searchQuery.toLowerCase();
                return transformed.filter(c =>
                    c.full_name?.toLowerCase().includes(lowerQuery) ||
                    c.email?.toLowerCase().includes(lowerQuery)
                );
            }

            return transformed;
        },
        enabled: !!profile?.current_academy_id,
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
                full_name: user?.full_name || user?.email || 'Sin nombre',
                email: user?.email,
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
