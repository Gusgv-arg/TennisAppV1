import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/src/services/supabaseClient';
import { AcademyInvitation, AcademyMember, InviteMemberInput, UpdateMemberInput } from '@/src/types/academy';
import { academyKeys } from './useAcademy';

/**
 * Mutations for managing academy members
 */
export function useMemberMutations() {
    const queryClient = useQueryClient();

    // Invite a new member by email
    const inviteMember = useMutation({
        mutationFn: async (input: InviteMemberInput): Promise<AcademyInvitation> => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // Get current academy
            const { data: profile } = await supabase
                .from('profiles')
                .select('current_academy_id')
                .eq('id', user.id)
                .single();

            if (!profile?.current_academy_id) {
                throw new Error('No academy selected');
            }

            // Check if invitation already exists for this email
            const { data: existing } = await supabase
                .from('academy_invitations')
                .select('id')
                .eq('academy_id', profile.current_academy_id)
                .eq('email', input.email.toLowerCase())
                .is('accepted_at', null)
                .maybeSingle();

            if (existing) {
                throw new Error('Ya existe una invitación pendiente para este email');
            }

            // Check if user is already a member
            const { data: existingMember } = await supabase
                .from('academy_members')
                .select(`
                    id,
                    user:profiles!academy_members_user_id_fkey(email)
                `)
                .eq('academy_id', profile.current_academy_id)
                .eq('is_active', true);

            const isMember = existingMember?.some(
                (m: any) => m.user?.email?.toLowerCase() === input.email.toLowerCase()
            );

            if (isMember) {
                throw new Error('Este usuario ya es miembro de la academia');
            }

            // Create invitation
            const { data, error } = await supabase
                .from('academy_invitations')
                .insert({
                    academy_id: profile.current_academy_id,
                    email: input.email.toLowerCase(),
                    role: input.role,
                    invited_by: user.id,
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invitations'] });
        },
    });

    // Update member role or permissions
    const updateMember = useMutation({
        mutationFn: async ({ memberId, ...input }: UpdateMemberInput & { memberId: string }): Promise<AcademyMember> => {
            const { data, error } = await supabase
                .from('academy_members')
                .update(input)
                .eq('id', memberId)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: academyKeys.all });
        },
    });

    // Remove member from academy
    const removeMember = useMutation({
        mutationFn: async (memberId: string): Promise<void> => {
            // First check if this is the owner
            const { data: member } = await supabase
                .from('academy_members')
                .select('role')
                .eq('id', memberId)
                .single();

            if (member?.role === 'owner') {
                throw new Error('No se puede eliminar al dueño de la academia');
            }

            const { error } = await supabase
                .from('academy_members')
                .update({ is_active: false })
                .eq('id', memberId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: academyKeys.all });
        },
    });

    // Cancel pending invitation
    const cancelInvitation = useMutation({
        mutationFn: async (invitationId: string): Promise<void> => {
            const { error } = await supabase
                .from('academy_invitations')
                .delete()
                .eq('id', invitationId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invitations'] });
        },
    });

    // Resend invitation (creates new token, extends expiry)
    const resendInvitation = useMutation({
        mutationFn: async (invitationId: string): Promise<AcademyInvitation> => {
            const { data, error } = await supabase
                .from('academy_invitations')
                .update({
                    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                })
                .eq('id', invitationId)
                .select()
                .single();

            if (error) throw error;

            // TODO: Trigger email resend via Edge Function

            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invitations'] });
        },
    });

    return {
        inviteMember,
        updateMember,
        removeMember,
        cancelInvitation,
        resendInvitation,
    };
}

/**
 * Hook to get pending invitations for current academy
 */
export function usePendingInvitations() {
    const queryClient = useQueryClient();

    return {
        queryKey: ['invitations', 'pending'] as const,
        queryFn: async (): Promise<AcademyInvitation[]> => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return [];

            const { data: profile } = await supabase
                .from('profiles')
                .select('current_academy_id')
                .eq('id', user.id)
                .single();

            if (!profile?.current_academy_id) return [];

            const { data, error } = await supabase
                .from('academy_invitations')
                .select('*')
                .eq('academy_id', profile.current_academy_id)
                .is('accepted_at', null)
                .gt('expires_at', new Date().toISOString())
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
        },
    };
}
