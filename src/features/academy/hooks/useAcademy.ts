import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/src/services/supabaseClient';
import { useAuthStore } from '@/src/store/useAuthStore';
import { Academy, AcademyMember, CreateAcademyInput, RegisterMemberInput, UpdateAcademyInput } from '@/src/types/academy';

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
        queryFn: async (): Promise<{ active: Academy[]; archived: Academy[] }> => {
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

            // Extract academies from the join
            const allAcademies = (data || [])
                .map((m: any) => m.academy as Academy)
                .filter((a): a is Academy => a !== null);

            // Separate active and archived
            const active = allAcademies.filter(a => !a.is_archived);
            const archived = allAcademies.filter(a => a.is_archived);

            return { active, archived };
        },
    });
}

/**
 * Get the current active academy
 */
export function useCurrentAcademy() {
    const { profile } = useAuthStore();

    return useQuery({
        queryKey: academyKeys.current(),
        queryFn: async (): Promise<Academy | null> => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;

            // Use profile from store specific ID if available, otherwise fetch
            const currentAcademyId = profile?.current_academy_id;

            if (!currentAcademyId) {
                // Fallback to fetching profile if store is somehow empty but user is logged in
                const { data: fetchedProfile } = await supabase
                    .from('profiles')
                    .select('current_academy_id')
                    .eq('id', user.id)
                    .single();

                if (!fetchedProfile?.current_academy_id) return null;

                const { data, error } = await supabase
                    .from('academies')
                    .select('*')
                    .eq('id', fetchedProfile.current_academy_id)
                    .single();

                if (error) throw error;
                return data;
            }

            // Then get the academy details
            const { data, error } = await supabase
                .from('academies')
                .select('*')
                .eq('id', currentAcademyId)
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
    const { profile } = useAuthStore();

    return useQuery({
        queryKey: [...academyKeys.current(), 'member'],
        queryFn: async (): Promise<AcademyMember | null> => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;

            const currentAcademyId = profile?.current_academy_id;
            if (!currentAcademyId) return null;

            // Get membership
            const { data, error } = await supabase
                .from('academy_members')
                .select('*')
                .eq('user_id', user.id)
                .eq('academy_id', currentAcademyId)
                .eq('is_active', true)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            return data;
        },
        enabled: !!profile?.current_academy_id,
    });
}

/**
 * Get all members of the current academy
 */
export function useAcademyMembers(academyId?: string) {
    const { profile } = useAuthStore();
    const targetAcademyId = academyId || profile?.current_academy_id;

    return useQuery({
        queryKey: academyKeys.members(targetAcademyId || 'missing'),
        queryFn: async (): Promise<AcademyMember[]> => {
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

            // Get user profiles for members with user_id (not registered-only)
            const userIds = members
                .filter(m => m.user_id !== null)
                .map(m => m.user_id);

            let profiles: any[] = [];
            if (userIds.length > 0) {
                const { data } = await supabase
                    .from('profiles')
                    .select('id, email, full_name, avatar_url')
                    .in('id', userIds);
                profiles = data || [];
            }

            // Merge profiles into members
            return members.map(member => ({
                ...member,
                has_app_access: member.has_app_access ?? true,
                user: member.user_id ? profiles.find(p => p.id === member.user_id) || null : null
            })) as AcademyMember[];
        },
        enabled: !!targetAcademyId,
    });
}

/**
 * Get all archived (inactive) members of the current academy
 */
export function useArchivedAcademyMembers(academyId?: string) {
    const { profile } = useAuthStore();
    const targetAcademyId = academyId || profile?.current_academy_id;

    return useQuery({
        queryKey: [...academyKeys.members(targetAcademyId || 'missing'), 'archived'],
        queryFn: async (): Promise<AcademyMember[]> => {
            if (!targetAcademyId) return [];

            // Get archived members (is_active = false)
            const { data: members, error } = await supabase
                .from('academy_members')
                .select('*')
                .eq('academy_id', targetAcademyId)
                .eq('is_active', false)
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (!members) return [];

            // Get member IDs that have pending linked invitations (these are promotions in progress)
            const memberIds = members.map(m => m.id);
            let pendingPromotionIds: string[] = [];

            if (memberIds.length > 0) {
                const { data: pendingInvitations } = await supabase
                    .from('academy_invitations')
                    .select('linked_member_id')
                    .in('linked_member_id', memberIds)
                    .is('accepted_at', null);

                pendingPromotionIds = (pendingInvitations || []).map(inv => inv.linked_member_id).filter(Boolean);
            }

            // Filter out members with pending promotions - they should appear in Invitations, not Archived
            const archivedMembers = members.filter(m => !pendingPromotionIds.includes(m.id));

            // Get user profiles for members with user_id
            const userIds = archivedMembers
                .filter(m => m.user_id !== null)
                .map(m => m.user_id);

            let profiles: any[] = [];
            if (userIds.length > 0) {
                const { data } = await supabase
                    .from('profiles')
                    .select('id, email, full_name, avatar_url')
                    .in('id', userIds);
                profiles = data || [];
            }

            // Merge profiles into members
            return archivedMembers.map(member => ({
                ...member,
                has_app_access: member.has_app_access ?? true,
                user: member.user_id ? profiles.find(p => p.id === member.user_id) || null : null
            })) as AcademyMember[];
        },
        enabled: !!targetAcademyId,
    });
}

/**
 * Get all members from ALL academies the user belongs to (for Global View)
 */
export function useGlobalAcademyMembers() {
    const { user } = useAuthStore();

    return useQuery({
        queryKey: ['academy_members', 'global', user?.id],
        queryFn: async (): Promise<AcademyMember[]> => {
            if (!user?.id) return [];

            // 1. Get all academies the user is a member of (active only)
            const { data: myMemberships } = await supabase
                .from('academy_members')
                .select('academy_id')
                .eq('user_id', user.id)
                .eq('is_active', true);

            const academyIds = myMemberships?.map(m => m.academy_id) || [];

            if (academyIds.length === 0) return [];

            // 2. Fetch all members for these academies
            const { data: members, error } = await supabase
                .from('academy_members')
                .select('*')
                .in('academy_id', academyIds)
                .eq('is_active', true)
                .order('role', { ascending: true });

            if (error) throw error;
            if (!members) return [];

            // 3. Get user profiles for members with user_id
            const userIds = members
                .filter(m => m.user_id !== null)
                .map(m => m.user_id);

            let profiles: any[] = [];
            if (userIds.length > 0) {
                const { data } = await supabase
                    .from('profiles')
                    .select('id, email, full_name, avatar_url')
                    .in('id', userIds);
                profiles = data || [];
            }

            // 4. Merge profiles into members
            return members.map(member => ({
                ...member,
                has_app_access: member.has_app_access ?? true,
                user: member.user_id ? profiles.find(p => p.id === member.user_id) || null : null
            })) as AcademyMember[];
        },
        enabled: !!user?.id,
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

            // Perform creation transaction via RPC
            const { data, error } = await supabase
                .rpc('create_academy_with_owner', {
                    p_name: input.name,
                    p_slug: slug,
                    p_logo_url: input.logo_url || null
                });

            if (error) throw error;

            console.log('Academy created via RPC:', data);

            // The RPC returns jsonb, we cast it to Academy
            // Ideally we should validate/transform if needed, but the shape matches
            return data as unknown as Academy;
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
        onSuccess: (_, academyId) => {
            // 1. Optimistically update the store so the app reflects the change immediately
            const { profile, setProfile } = useAuthStore.getState();
            if (profile) {
                setProfile({ ...profile, current_academy_id: academyId });
            }

            // 2. Invalidate ONLY the current academy query to force a refetch with the new ID
            // We avoid invalidateQueries() (global) because it causes a massive app-wide refetch
            queryClient.invalidateQueries({ queryKey: academyKeys.current() });

            // Note: Other queries (plans, locations) should automatically update because 
            // they should be observing the currentAcademyId from the store or useCurrentAcademy hook.
        },
    });

    // Register a member without app access
    const registerMember = useMutation({
        mutationFn: async (input: RegisterMemberInput): Promise<AcademyMember> => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // Get current academy
            const { data: profile } = await supabase
                .from('profiles')
                .select('current_academy_id')
                .eq('id', user.id)
                .single();

            if (!profile?.current_academy_id) throw new Error('No academy selected');

            // Create member record without user_id
            const { data, error } = await supabase
                .from('academy_members')
                .insert({
                    academy_id: profile.current_academy_id,
                    user_id: null,
                    role: input.role,
                    member_name: input.member_name,
                    member_email: input.member_email || null,
                    has_app_access: false,
                    invited_by: user.id,
                    invited_at: new Date().toISOString(),
                    accepted_at: new Date().toISOString(), // Already "accepted" since no invitation
                    is_active: true,
                })
                .select()
                .single();

            if (error) throw error;
            return data as AcademyMember;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: academyKeys.all });
        },
    });

    // Archive academy (soft delete)
    const archiveAcademy = useMutation({
        mutationFn: async (academyId: string): Promise<void> => {
            const { error } = await supabase
                .from('academies')
                .update({ is_archived: true })
                .eq('id', academyId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: academyKeys.all });
        },
    });

    // Unarchive academy
    const unarchiveAcademy = useMutation({
        mutationFn: async (academyId: string): Promise<void> => {
            const { error } = await supabase
                .from('academies')
                .update({ is_archived: false })
                .eq('id', academyId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: academyKeys.all });
        },
    });

    // Transfer ownership to another member
    const transferOwnership = useMutation({
        mutationFn: async ({ academyId, newOwnerId }: { academyId: string; newOwnerId: string }): Promise<void> => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const { error } = await supabase.rpc('transfer_academy_ownership', {
                p_academy_id: academyId,
                p_new_owner_id: newOwnerId,
                p_current_owner_id: user.id,
            });

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: academyKeys.all });
        },
    });

    return {
        createAcademy,
        updateAcademy,
        switchAcademy,
        registerMember,
        archiveAcademy,
        unarchiveAcademy,
        transferOwnership,
    };
}
