import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { useAuthStore } from '../../../store/useAuthStore';
import { useViewStore } from '../../../store/useViewStore';
import type {
    CreateUnifiedPaymentGroupInput,
    UnifiedPaymentGroup,
    UpdateUnifiedPaymentGroupInput
} from '../../../types/payments';
import { showError, showSuccess } from '../../../utils/toast';

/**
 * Hook para obtener todos los grupos de pago unificado de la academia
 */
export function useUnifiedPaymentGroups() {
    const { profile } = useAuthStore();
    const { isGlobalView } = useViewStore();
    const academyId = profile?.current_academy_id;

    return useQuery({
        queryKey: ['unifiedPaymentGroups', isGlobalView ? 'global' : academyId],
        queryFn: async () => {
            let query = supabase
                .from('unified_payment_groups')
                .select('*')
                .eq('is_active', true)
                .order('name', { ascending: true });

            if (!isGlobalView && academyId) {
                query = query.eq('academy_id', academyId);
            }
            // En vista global, RLS filtra por membresía de academias

            const { data, error } = await query;
            if (error) throw error;
            return data as UnifiedPaymentGroup[];
        },
        enabled: isGlobalView || !!academyId,
    });
}

/**
 * Hook para obtener un grupo de pago unificado por ID con sus miembros
 */
export function useUnifiedPaymentGroup(groupId: string | undefined) {
    const { profile } = useAuthStore();
    const academyId = profile?.current_academy_id;

    return useQuery({
        queryKey: ['unifiedPaymentGroup', groupId],
        queryFn: async () => {
            if (!groupId || !academyId) return null;

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
        enabled: !!groupId && !!academyId,
    });
}

/**
 * Hook para obtener balances de grupos de pago unificado
 */
export function useUnifiedPaymentGroupBalances() {
    const { profile } = useAuthStore();
    const { isGlobalView } = useViewStore();
    const academyId = profile?.current_academy_id;

    return useQuery({
        queryKey: ['unifiedPaymentGroupBalances', isGlobalView ? 'global' : academyId],
        queryFn: async () => {
            let query = supabase
                .from('unified_payment_group_balances')
                .select('*')
                .eq('is_active', true);

            if (!isGlobalView && academyId) {
                query = query.eq('academy_id', academyId);
            }
            // En vista global, RLS filtra por membresía de academias

            const { data, error } = await query;
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
        enabled: isGlobalView || !!academyId,
    });
}

/**
 * Hook para mutaciones de grupos de pago unificado
 */
export function useUnifiedPaymentGroupMutations() {
    const queryClient = useQueryClient();
    const { session, profile } = useAuthStore();
    const academyId = profile?.current_academy_id;

    const createGroup = useMutation({
        mutationFn: async (input: CreateUnifiedPaymentGroupInput) => {
            if (!academyId || !session?.user?.id) {
                throw new Error('Academia o usuario no disponible');
            }

            const { data, error } = await supabase
                .from('unified_payment_groups')
                .insert({
                    ...input,
                    academy_id: academyId,
                    created_by: session.user.id,
                })
                .select()
                .single();

            if (error) throw error;
            return data as UnifiedPaymentGroup;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['unifiedPaymentGroups'] });
            showSuccess('Grupo creado', 'El grupo de pago unificado ha sido creado correctamente.');
        },
        onError: (error: any) => {
            console.error('[useUnifiedPaymentGroupMutations] Create error:', error);
            showError('Error', 'No se pudo crear el grupo de pago.');
        }
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
            showSuccess('Grupo actualizado', 'Los datos del grupo han sido actualizados.');
        },
        onError: (error: any) => {
            console.error('[useUnifiedPaymentGroupMutations] Update error:', error);
            showError('Error', 'No se pudieron actualizar los datos del grupo.');
        }
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
            showSuccess('Grupo eliminado', 'El grupo ha sido eliminado.');
        },
        onError: (error: any) => {
            showError('Error', 'No se pudo eliminar el grupo.');
        }
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
            showSuccess('Alumno vinculado', 'El alumno ha sido añadido al grupo de pago.');
        },
        onError: (error: any) => {
            console.error('[useUnifiedPaymentGroupMutations] Add member error:', error);
            showError('Error', 'No se pudo vincular al alumno al grupo.');
        }
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
            showSuccess('Alumno desvinculado', 'El alumno ha sido removido del grupo de pago.');
        },
        onError: (error: any) => {
            showError('Error', 'No se pudo desvincular al alumno.');
        }
    });

    return {
        createGroup,
        updateGroup,
        deleteGroup,
        addMemberToGroup,
        removeMemberFromGroup,
    };
}
