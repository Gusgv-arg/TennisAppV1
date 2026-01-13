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

            // Get current academy with name
            const { data: profile } = await supabase
                .from('profiles')
                .select('current_academy_id, full_name')
                .eq('id', user.id)
                .single();

            if (!profile?.current_academy_id) {
                throw new Error('No academy selected');
            }

            // Get academy name
            const { data: academy } = await supabase
                .from('academies')
                .select('name')
                .eq('id', profile.current_academy_id)
                .single();

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

            // Send invitation email with magic link via Edge Function
            const { error: fnError } = await supabase.functions.invoke('send-invitation', {
                body: {
                    ...data,
                    academy_name: academy?.name || 'la academia',
                    inviter_name: profile.full_name || 'El equipo',
                    use_magic_link: true,
                }
            });

            if (fnError) {
                console.error('Error sending invitation email:', fnError);
                // Don't throw - invitation was created, email failed
            }

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
            // Invalidate all academy-related queries to ensure role changes are reflected
            queryClient.invalidateQueries({ queryKey: academyKeys.all });
            // Also invalidate the current member query explicitly
            queryClient.invalidateQueries({ queryKey: [...academyKeys.current(), 'member'] });
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

            // Trigger email resend via Edge Function
            const { error: fnError } = await supabase.functions.invoke('send-invitation', {
                body: {
                    ...data,
                    type: 'resend'
                }
            });

            if (fnError) throw fnError;

            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invitations'] });
        },
    });

    // Restore archived member
    const restoreMember = useMutation({
        mutationFn: async (memberId: string): Promise<void> => {
            const { error } = await supabase
                .from('academy_members')
                .update({ is_active: true })
                .eq('id', memberId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: academyKeys.all });
        },
    });

    // Promote registered member to have app access
    const promoteMember = useMutation({
        mutationFn: async ({ memberId, email }: { memberId: string; email: string }): Promise<void> => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // Get member details
            const { data: member, error: memberError } = await supabase
                .from('academy_members')
                .select('academy_id, role, member_email')
                .eq('id', memberId)
                .single();

            if (memberError || !member) throw new Error('Miembro no encontrado');

            // Get academy and inviter info
            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', user.id)
                .single();

            const { data: academy } = await supabase
                .from('academies')
                .select('name')
                .eq('id', member.academy_id)
                .single();

            // Update member_email if it changed
            if (email !== member.member_email) {
                await supabase
                    .from('academy_members')
                    .update({ member_email: email })
                    .eq('id', memberId);
            }

            // Check if invitation already exists
            const { data: existing } = await supabase
                .from('academy_invitations')
                .select('id')
                .eq('academy_id', member.academy_id)
                .eq('email', email.toLowerCase())
                .is('accepted_at', null)
                .maybeSingle();

            if (existing) {
                throw new Error('Ya existe una invitación pendiente para este email');
            }

            // Create invitation WITH linked_member_id
            const { data: invitation, error: inviteError } = await supabase
                .from('academy_invitations')
                .insert({
                    academy_id: member.academy_id,
                    email: email.toLowerCase(),
                    role: member.role,
                    invited_by: user.id,
                    linked_member_id: memberId, // Link to existing member for history preservation
                })
                .select()
                .single();

            if (inviteError) throw inviteError;

            // Deactivate member (will be reactivated when invitation is accepted)
            const { error: updateError } = await supabase
                .from('academy_members')
                .update({
                    is_active: false,
                    member_email: email, // Update email if changed
                })
                .eq('id', memberId);

            if (updateError) throw updateError;

            // Send invitation email
            await supabase.functions.invoke('send-invitation', {
                body: {
                    ...invitation,
                    academy_name: academy?.name || 'la academia',
                    inviter_name: profile?.full_name || 'El equipo',
                    use_magic_link: true,
                }
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: academyKeys.all });
            queryClient.invalidateQueries({ queryKey: ['invitations'] });
        },
    });

    // Revoke app access from a member (keeps user_id for easy re-granting)
    const revokeAccess = useMutation({
        mutationFn: async (memberId: string): Promise<void> => {
            const { error } = await supabase
                .from('academy_members')
                .update({ has_app_access: false })
                .eq('id', memberId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: academyKeys.all });
        },
    });

    // Grant app access to a member who previously had it revoked
    const grantAccess = useMutation({
        mutationFn: async (memberId: string): Promise<void> => {
            const { error } = await supabase
                .from('academy_members')
                .update({ has_app_access: true })
                .eq('id', memberId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: academyKeys.all });
        },
    });

    return {
        inviteMember,
        updateMember,
        removeMember,
        restoreMember,
        promoteMember,
        revokeAccess,
        grantAccess,
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
