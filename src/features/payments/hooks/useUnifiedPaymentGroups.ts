import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';
import type {
    CreateUnifiedPaymentGroupInput,
    UnifiedPaymentGroup,
    UpdateUnifiedPaymentGroupInput
} from '../../../types/payments';
import { useCurrentAcademy } from '../../academy/hooks/useAcademy';

/**
 * Hook para obtener todos los grupos de pago unificado de la academia
 */
export function useUnifiedPaymentGroups() {
    const { data: currentAcademy } = useCurrentAcademy();

    return useQuery({
        queryKey: ['unifiedPaymentGroups', currentAcademy?.id],
        queryFn: async () => {
            if (!currentAcademy?.id) return [];

            const { data, error } = await supabase
                .from('unified_payment_groups')
                .select('*')
                .eq('academy_id', currentAcademy.id)
                .eq('is_active', true)
                .order('name', { ascending: true });

            if (error) throw error;
            return data as UnifiedPaymentGroup[];
        },
        enabled: !!currentAcademy?.id,
    });
}

/**
 * Hook para obtener un grupo de pago unificado por ID con sus miembros
 */
export function useUnifiedPaymentGroup(groupId: string | undefined) {
    const { data: currentAcademy } = useCurrentAcademy();

    return useQuery({
        queryKey: ['unifiedPaymentGroup', groupId],
        queryFn: async () => {
            if (!groupId || !currentAcademy?.id) return null;

            // Obtener el grupo
            const { data: group, error: groupError } = await supabase
                .from('unified_payment_groups')
                .select('*')
                .eq('id', groupId)
                .single();

            if (groupError) throw groupError;

            // Obtener los miembros
            const { data: members, error: membersError } = await supabase
                .from('players')
                .select('id, full_name')
                .eq('unified_payment_group_id', groupId)
                .eq('is_archived', false)
                .eq('is_deleted', false)
                .order('full_name', { ascending: true });

            if (membersError) throw membersError;

            return {
                ...group,
                members: members || [],
                member_count: members?.length || 0,
            } as UnifiedPaymentGroup;
        },
        enabled: !!groupId && !!currentAcademy?.id,
    });
}

/**
 * Hook para obtener balances de grupos de pago unificado
 */
export function useUnifiedPaymentGroupBalances() {
    const { data: currentAcademy } = useCurrentAcademy();

    return useQuery({
        queryKey: ['unifiedPaymentGroupBalances', currentAcademy?.id],
        queryFn: async () => {
            if (!currentAcademy?.id) return [];

            const { data, error } = await supabase
                .from('unified_payment_group_balances')
                .select('*')
                .eq('academy_id', currentAcademy.id)
                .eq('is_active', true);

            if (error) throw error;

            // Normalizar los datos de la vista SQL para que coincidan con la interfaz
            return (data || []).map((row: any) => {
                // La vista SQL usa 'group_id', pero el frontend necesita 'id'
                // También el array 'members' puede venir como JSON string o array
                let parsedMembers = row.members;
                if (typeof parsedMembers === 'string') {
                    try {
                        parsedMembers = JSON.parse(parsedMembers);
                    } catch {
                        parsedMembers = [];
                    }
                }
                // Asegurar que members sea un array
                if (!Array.isArray(parsedMembers)) {
                    parsedMembers = [];
                }

                return {
                    ...row,
                    id: row.group_id || row.id,
                    members: parsedMembers,
                } as UnifiedPaymentGroup;
            });
        },
        enabled: !!currentAcademy?.id,
    });
}

/**
 * Hook para mutaciones de grupos de pago unificado
 */
export function useUnifiedPaymentGroupMutations() {
    const queryClient = useQueryClient();
    const { data: currentAcademy } = useCurrentAcademy();
    const { session } = useAuthStore();

    const createGroup = useMutation({
        mutationFn: async (input: CreateUnifiedPaymentGroupInput) => {
            if (!currentAcademy?.id || !session?.user?.id) {
                throw new Error('Academia o usuario no disponible');
            }

            const { data, error } = await supabase
                .from('unified_payment_groups')
                .insert({
                    ...input,
                    academy_id: currentAcademy.id,
                    created_by: session.user.id,
                })
                .select()
                .single();

            if (error) throw error;
            return data as UnifiedPaymentGroup;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['unifiedPaymentGroups'] });
        },
    });

    const updateGroup = useMutation({
        mutationFn: async ({ id, input }: { id: string; input: UpdateUnifiedPaymentGroupInput }) => {
            const { data, error } = await supabase
                .from('unified_payment_groups')
                .update(input)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data as UnifiedPaymentGroup;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['unifiedPaymentGroups'] });
            queryClient.invalidateQueries({ queryKey: ['unifiedPaymentGroup', data.id] });
        },
    });

    const deleteGroup = useMutation({
        mutationFn: async (id: string) => {
            // Soft delete: marcar como inactivo
            const { error } = await supabase
                .from('unified_payment_groups')
                .update({ is_active: false })
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['unifiedPaymentGroups'] });
        },
    });

    const addMemberToGroup = useMutation({
        mutationFn: async ({ playerId, groupId }: { playerId: string; groupId: string }) => {
            const { error } = await supabase
                .from('players')
                .update({ unified_payment_group_id: groupId })
                .eq('id', playerId);

            if (error) throw error;
        },
        onSuccess: (_, { groupId, playerId }) => {
            queryClient.invalidateQueries({ queryKey: ['unifiedPaymentGroups'] });
            queryClient.invalidateQueries({ queryKey: ['unifiedPaymentGroup', groupId] });
            queryClient.invalidateQueries({ queryKey: ['player', playerId] });
            queryClient.invalidateQueries({ queryKey: ['players'] });
        },
    });

    const removeMemberFromGroup = useMutation({
        mutationFn: async (playerId: string) => {
            const { error } = await supabase
                .from('players')
                .update({ unified_payment_group_id: null })
                .eq('id', playerId);

            if (error) throw error;
        },
        onSuccess: (_, playerId) => {
            queryClient.invalidateQueries({ queryKey: ['unifiedPaymentGroups'] });
            queryClient.invalidateQueries({ queryKey: ['unifiedPaymentGroup'] });
            queryClient.invalidateQueries({ queryKey: ['player', playerId] });
            queryClient.invalidateQueries({ queryKey: ['players'] });
        },
    });

    return {
        createGroup,
        updateGroup,
        deleteGroup,
        addMemberToGroup,
        removeMemberFromGroup,
    };
}
