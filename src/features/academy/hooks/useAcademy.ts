import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/src/services/supabaseClient';
import { Academy, AcademyMember, CreateAcademyInput, UpdateAcademyInput } from '@/src/types/academy';

// Query key factory
export const academyKeys = {
    all: ['academies'] as const,
    lists: () => [...academyKeys.all, 'list'] as const,
    list: (filters?: string) => [...academyKeys.lists(), { filters }] as const,
    details: () => [...academyKeys.all, 'detail'] as const,
    detail: (id: string) => [...academyKeys.details(), id] as const,
    current: () => [...academyKeys.all, 'current'] as const,
    members: (academyId: string) => [...academyKeys.all, academyId, 'members'] as const,
};

/**
 * Get all academies the current user belongs to
 */
export function useUserAcademies() {
    return useQuery({
        queryKey: academyKeys.lists(),
        queryFn: async (): Promise<Academy[]> => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const { data, error } = await supabase
                .from('academy_members')
                .select(`
                    academy:academies(*)
                `)
                .eq('user_id', user.id)
                .eq('is_active', true);

            if (error) throw error;

            // Extract academies from the join - academy is a single object, not array
            return (data || [])
                .map((m: any) => m.academy as Academy)
                .filter((a): a is Academy => a !== null);
        },
    });
}

/**
 * Get the current active academy
 */
export function useCurrentAcademy() {
    return useQuery({
        queryKey: academyKeys.current(),
        queryFn: async (): Promise<Academy | null> => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;

            // First get the current_academy_id from profile
            const { data: profile } = await supabase
                .from('profiles')
                .select('current_academy_id')
                .eq('id', user.id)
                .single();

            if (!profile?.current_academy_id) return null;

            // Then get the academy details
            const { data, error } = await supabase
                .from('academies')
                .select('*')
                .eq('id', profile.current_academy_id)
                .single();

            if (error) throw error;
            return data;
        },
    });
}

/**
 * Get current user's membership in the current academy
 */
export function useCurrentAcademyMember() {
    return useQuery({
        queryKey: [...academyKeys.current(), 'member'],
        queryFn: async (): Promise<AcademyMember | null> => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;

            // Get profile with current academy
            const { data: profile } = await supabase
                .from('profiles')
                .select('current_academy_id')
                .eq('id', user.id)
                .single();

            if (!profile?.current_academy_id) return null;

            // Get membership
            const { data, error } = await supabase
                .from('academy_members')
                .select('*')
                .eq('user_id', user.id)
                .eq('academy_id', profile.current_academy_id)
                .eq('is_active', true)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            return data;
        },
    });
}

/**
 * Get all members of the current academy
 */
export function useAcademyMembers(academyId?: string) {
    return useQuery({
        queryKey: academyKeys.members(academyId || 'current'),
        queryFn: async (): Promise<AcademyMember[]> => {
            let targetAcademyId = academyId;

            if (!targetAcademyId) {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return [];

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('current_academy_id')
                    .eq('id', user.id)
                    .single();

                targetAcademyId = profile?.current_academy_id;
            }

            if (!targetAcademyId) return [];

            // Get members
            const { data: members, error } = await supabase
                .from('academy_members')
                .select('*')
                .eq('academy_id', targetAcademyId)
                .eq('is_active', true)
                .order('role', { ascending: true });

            if (error) throw error;
            if (!members) return [];

            // Get user profiles for each member
            const userIds = members.map(m => m.user_id);
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, email, full_name, avatar_url')
                .in('id', userIds);

            // Merge profiles into members
            return members.map(member => ({
                ...member,
                user: profiles?.find(p => p.id === member.user_id) || null
            })) as AcademyMember[];
        },
        enabled: true,
    });
}

/**
 * Mutations for academy operations
 */
export function useAcademyMutations() {
    const queryClient = useQueryClient();

    // Create a new academy
    const createAcademy = useMutation({
        mutationFn: async (input: CreateAcademyInput): Promise<Academy> => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // Generate slug if not provided
            const slug = input.slug || input.name
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .substring(0, 50);

            // Create academy
            const { data: academy, error: academyError } = await supabase
                .from('academies')
                .insert({
                    name: input.name,
                    slug,
                    logo_url: input.logo_url,
                    created_by: user.id,
                })
                .select()
                .single();

            if (academyError) throw academyError;

            // Add creator as owner
            const { error: memberError } = await supabase
                .from('academy_members')
                .insert({
                    academy_id: academy.id,
                    user_id: user.id,
                    role: 'owner',
                    accepted_at: new Date().toISOString(),
                });

            if (memberError) throw memberError;

            // Set as current academy
            await supabase
                .from('profiles')
                .update({ current_academy_id: academy.id })
                .eq('id', user.id);

            return academy;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: academyKeys.all });
        },
    });

    // Update academy
    const updateAcademy = useMutation({
        mutationFn: async ({ id, ...input }: UpdateAcademyInput & { id: string }): Promise<Academy> => {
            const { data, error } = await supabase
                .from('academies')
                .update(input)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: academyKeys.all });
        },
    });

    // Switch current academy
    const switchAcademy = useMutation({
        mutationFn: async (academyId: string): Promise<void> => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // Verify user is a member
            const { data: membership } = await supabase
                .from('academy_members')
                .select('id')
                .eq('academy_id', academyId)
                .eq('user_id', user.id)
                .eq('is_active', true)
                .single();

            if (!membership) throw new Error('Not a member of this academy');

            // Update current academy
            const { error } = await supabase
                .from('profiles')
                .update({ current_academy_id: academyId })
                .eq('id', user.id);

            if (error) throw error;
        },
        onSuccess: () => {
            // Invalidate all queries to refresh data for new academy
            queryClient.invalidateQueries();
        },
    });

    return {
        createAcademy,
        updateAcademy,
        switchAcademy,
    };
}
