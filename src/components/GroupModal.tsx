import { supabase } from '@/src/services/supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions
} from 'react-native';

import { SelectorOption, SelectorSheet } from '@/src/components/SelectorSheet';
import StatusModal, { StatusType } from '@/src/components/StatusModal';
import { Avatar } from '@/src/design/components/Avatar';
import { Button } from '@/src/design/components/Button';
import { Input } from '@/src/design/components/Input';
import { Row } from '@/src/design/components/Row';
import { Section } from '@/src/design/components/Section';
import { Selector } from '@/src/design/components/Selector';
import { Theme } from '@/src/design/theme';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useClassGroup, useClassGroupMutations } from '@/src/features/calendar/hooks/useClassGroups';
import { usePricingPlans } from '@/src/features/payments/hooks/usePricingPlans';
import { useSubscriptions } from '@/src/features/payments/hooks/useSubscriptions';
import { usePlayers } from '@/src/features/players/hooks/usePlayers';
import { useGroupImageUpload } from '@/src/hooks/useGroupImageUpload';
import { useImagePicker } from '@/src/hooks/useImagePicker';
import { useTheme } from '@/src/hooks/useTheme';
import { useAuthStore } from '@/src/store/useAuthStore';
import { ClassGroup } from '@/src/types/classGroups';

interface GroupModalProps {
    visible: boolean;
    onClose: () => void;
    groupId: string | null;
    mode: 'view' | 'edit' | 'create';
}

export default function GroupModal({ visible, onClose, groupId, mode: initialMode }: GroupModalProps) {
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const { theme, isDark } = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const isDesktop = windowWidth >= 768;

    const [mode, setMode] = useState<'view' | 'edit' | 'create'>(initialMode);

    // Data Hooks
    const { data: group, isLoading: isLoadingGroup } = useClassGroup(groupId || '');
    const { data: players } = usePlayers();
    const { plans } = usePricingPlans();
    const { createGroup, updateGroup } = useClassGroupMutations();
    const { assignPlan } = useSubscriptions();

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        plan_id: null as string | null,
        members: [] as { player_id: string; plan_id: string | null; is_plan_exempt?: boolean }[],
    });
    const [avatarUri, setAvatarUri] = useState<string | null>(null);
    const [memberSearch, setMemberSearch] = useState('');

    // UI State
    const [showGroupPlanSelector, setShowGroupPlanSelector] = useState(false);
    const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
    const [statusModalVisible, setStatusModalVisible] = useState(false);
    const [statusModalConfig, setStatusModalConfig] = useState<{
        type: StatusType;
        title: string;
        message: string;
    }>({ type: 'success', title: '', message: '' });

    // Confirmation Modal for Future Sessions
    const [confirmModalVisible, setConfirmModalVisible] = useState(false);
    const [pendingSave, setPendingSave] = useState(false);
    const [futureSessionsCount, setFutureSessionsCount] = useState(0);

    // Image Upload
    const { pickImageFromCamera, pickImageFromGallery } = useImagePicker();
    const { uploadGroupImage, isUploading } = useGroupImageUpload();

    // Init Logic
    useEffect(() => {
        if (visible) {
            setMode(initialMode);
            if (initialMode === 'create') {
                resetForm();
            }
        }
    }, [visible, initialMode]);

    useEffect(() => {
        if (group && visible && (mode === 'edit' || mode === 'view')) {
            loadGroupData(group);
        }
    }, [group, visible, mode]);

    const resetForm = () => {
        setFormData({ name: '', description: '', plan_id: null, members: [] });
        setAvatarUri(null);
        setMemberSearch('');
    };

    const loadGroupData = (data: ClassGroup) => {
        setFormData({
            name: data.name,
            description: data.description || '',
            plan_id: data.plan_id || null,
            members: data.members?.map(m => ({
                player_id: m.player_id,
                plan_id: m.plan_id || null,
                is_plan_exempt: m.is_plan_exempt
            })) || [],
        });
        setAvatarUri(data.image_url || null);
    };

    // Member Search Logic
    const filteredMembers = useMemo(() => {
        if (memberSearch.length < 2 || !players) return [];
        const currentMemberIds = formData.members.map(m => m.player_id);
        return players
            .filter(p =>
                !currentMemberIds.includes(p.id) &&
                p.full_name.toLowerCase().includes(memberSearch.toLowerCase())
            )
            .slice(0, 5);
    }, [memberSearch, players, formData.members]);

    // Actions
    const handleAvatarPress = async () => {
        if (mode === 'view') return;
        Alert.alert(
            'Foto del grupo',
            'Elige una opción',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Tomar foto',
                    onPress: async () => {
                        const uri = await pickImageFromCamera();
                        if (uri) setAvatarUri(uri);
                    },
                },
                {
                    text: 'Elegir de galería',
                    onPress: async () => {
                        const uri = await pickImageFromGallery();
                        if (uri) setAvatarUri(uri);
                    },
                },
            ]
        );
    };

    const handleSave = async (force: boolean = false) => {
        if (!formData.name.trim()) {
            Alert.alert('Error', 'El nombre del grupo es requerido');
            return;
        }

        // --- Check for future sessions if editing and not already confirmed ---
        if (mode === 'edit' && groupId && !force) {
            try {
                const now = new Date().toISOString();
                const { count, error: countError } = await supabase
                    .from('sessions')
                    .select('*', { count: 'exact', head: true })
                    .eq('class_group_id', groupId)
                    .gte('scheduled_at', now)
                    .neq('status', 'cancelled')
                    .is('deleted_at', null);

                if (!countError && count && count > 0) {
                    setFutureSessionsCount(count);
                    setConfirmModalVisible(true);
                    return; // Stop here, wait for modal
                }
            } catch (err) {
                console.warn('[GroupModal] Error checking future sessions:', err);
                // We continue if check fails to not block user
            }
        }

        // Proceed with save logic
        try {
            const subscriptionPromises = formData.members.map(async (m) => {
                if (m.is_plan_exempt) return;
                const targetPlanId = m.plan_id || formData.plan_id;
                if (!targetPlanId) return;

                const player = players?.find(p => p.id === m.player_id);
                if (!player) return;

                const hasActiveSub = player.active_subscriptions?.some(
                    (s: any) => s.plan?.id === targetPlanId && s.status === 'active'
                );

                if (!hasActiveSub) {
                    await assignPlan({
                        playerId: m.player_id,
                        planId: targetPlanId,
                    });
                }
            });

            await Promise.all(subscriptionPromises);
        } catch (error) {
            console.error('[Auto-Sub] Error:', error);
        }

        try {
            const idToUse = groupId || `temp_${Date.now()}`;
            let image_url = mode === 'edit' && group ? group.image_url : undefined;

            if (avatarUri && !avatarUri.startsWith('http')) {
                const uploadedUrl = await uploadGroupImage(avatarUri, idToUse);
                if (uploadedUrl) image_url = uploadedUrl;
            }

            const { profile } = useAuthStore.getState();

            const membersPayload = formData.members.map(m => ({
                player_id: m.player_id,
                plan_id: m.plan_id,
                is_plan_exempt: m.is_plan_exempt
            }));

            if (mode === 'edit' && groupId) {
                await updateGroup.mutateAsync({
                    id: groupId,
                    input: { ...formData, members: membersPayload, image_url },
                });
            } else {
                await createGroup.mutateAsync({
                    ...formData,
                    members: membersPayload,
                    image_url,
                    academy_id: profile?.current_academy_id
                });
            }

            setStatusModalConfig({
                type: 'success',
                title: mode === 'edit' ? 'Grupo Actualizado' : 'Grupo Creado',
                message: mode === 'edit'
                    ? `Los cambios en el grupo "${formData.name}" se guardaron correctamente.`
                    : `El grupo "${formData.name}" ha sido creado exitosamente.`
            });
            setStatusModalVisible(true);
        } catch (error) {
            console.error(error);
            setStatusModalConfig({
                type: 'error',
                title: 'Error',
                message: 'No se pudo guardar el grupo. Inténtalo de nuevo.'
            });
            setStatusModalVisible(true);
        }
    };



    // Member Management
    const addMember = (pid: string) => {
        setFormData(prev => ({
            ...prev,
            members: [...prev.members, { player_id: pid, plan_id: null, is_plan_exempt: false }],
        }));
    };

    const removeMember = (pid: string) => {
        setFormData(prev => ({
            ...prev,
            members: prev.members.filter(m => m.player_id !== pid),
        }));
    };

    const updateMemberPlan = (pid: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            members: prev.members.map(m => {
                if (m.player_id !== pid) return m;

                if (value === '__default__') {
                    return { ...m, plan_id: null, is_plan_exempt: false };
                } else if (value === 'none_explicit') {
                    return { ...m, plan_id: null, is_plan_exempt: true };
                } else {
                    return { ...m, plan_id: value, is_plan_exempt: false };
                }
            }),
        }));
    };

    // Helper Display Logic
    const getMemberPlanLabel = (member: { plan_id: string | null; is_plan_exempt?: boolean }) => {
        if (member.is_plan_exempt) return 'Excluído del cobro';
        if (member.plan_id) return plans?.find(p => p.id === member.plan_id)?.name || 'Custom';
        return 'Plan del Grupo';
    };

    const selectedGroupPlanLabel = useMemo(() => {
        if (!formData.plan_id) return 'Sin Plan del Grupo';
        return plans?.find(p => p.id === formData.plan_id)?.name || 'Plan Desconocido';
    }, [formData.plan_id, plans]);

    const planOptions: SelectorOption[] = [
        { label: 'Sin Plan del Grupo', value: '', icon: 'remove-circle-outline' },
        ...(plans?.map(p => ({
            label: p.name,
            value: p.id,
            icon: 'pricetag-outline' as const
        })) || [])
    ];

    const getMemberPlanOptions = (): SelectorOption[] => {
        const defaultPlanName = plans?.find(p => p.id === formData.plan_id)?.name || 'Sin Plan';

        return [
            {
                label: 'Plan del Grupo',
                subLabel: `Hereda: ${defaultPlanName}`,
                value: '__default__',
                icon: 'people-outline',
                color: theme.components.button.primary.bg
            },
            {
                label: 'Excluir del cobro',
                subLabel: 'Este alumno no pagará por estas clases',
                value: 'none_explicit',
                icon: 'alert-circle-outline',
                color: theme.status.error,
                isDestructive: true
            },
            ...(plans?.map(p => ({
                label: p.name,
                value: p.id,
                icon: 'pricetag-outline' as const
            })) || [])
        ];
    };

    const closeModal = () => {
        onClose();
    };

    const handleStatusClose = () => {
        setStatusModalVisible(false);
        if (statusModalConfig.type === 'success') {
            onClose();
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            onRequestClose={closeModal}
        >
            <View style={[styles.modalOverlay, { backgroundColor: theme.background.backdrop }]}>
                <View style={[
                    styles.modalContainer,
                    { backgroundColor: theme.background.surface },
                    isDesktop && { width: 500, maxHeight: windowHeight * 0.9, borderRadius: 12, overflow: 'hidden' }
                ]}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        style={{ flex: 1 }}
                    >
                        {/* Header */}
                        <View style={[styles.modalHeader, { backgroundColor: theme.background.surface, borderBottomColor: theme.border.subtle }]}>
                            <View style={{ width: 44 }}>
                                {mode === 'view' && (
                                    <TouchableOpacity onPress={() => setMode('edit')} style={styles.headerBtn}>
                                        <Ionicons name="create-outline" size={24} color={theme.components.button.primary.bg} />
                                    </TouchableOpacity>
                                )}
                            </View>
                            <Text style={[styles.modalTitle, { color: theme.text.primary, textAlign: 'center', flex: 1 }]}>
                                {mode === 'create' ? 'Nuevo Grupo' : (mode === 'edit' ? 'Editar Grupo' : 'Detalles del Grupo')}
                            </Text>
                            <TouchableOpacity onPress={closeModal} style={styles.headerBtn}>
                                <Ionicons name="close" size={24} color={theme.text.primary} />
                            </TouchableOpacity>
                        </View>

                        {isLoadingGroup && groupId ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={theme.components.button.primary.bg} />
                            </View>
                        ) : (
                            <ScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                                <View style={[styles.formContainer, isDesktop && styles.desktopContainer]}>
                                    {/* Avatar */}
                                    <View style={styles.sectionCentered}>
                                        <TouchableOpacity onPress={handleAvatarPress} activeOpacity={mode === 'view' ? 1 : 0.8} disabled={mode === 'view'}>
                                            <Avatar
                                                source={avatarUri || undefined}
                                                name={formData.name || '?'}
                                                size="xl"
                                            />
                                            {mode !== 'view' && (
                                                <View style={styles.editBadge}>
                                                    <Ionicons name="camera" size={14} color="white" />
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    </View>



                                    {/* Name */}
                                    <Section title="Nombre">
                                        {mode === 'view' ? (
                                            <Text style={[{ color: theme.text.primary }, typography.variants.bodyLarge]}>{formData.name}</Text>
                                        ) : (
                                            <Input
                                                value={formData.name}
                                                onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                                                placeholder="Ej. Avanzados Martes"
                                            />
                                        )}
                                    </Section>

                                    {/* Plan */}
                                    <Section
                                        title="Plan del Grupo"
                                        icon="pricetag-outline"
                                        footer="Aplica a todos los miembros salvo excepciones."
                                    >
                                        {mode === 'view' ? (
                                            <Row>
                                                <Text style={[{ color: theme.text.primary }, typography.variants.bodyLarge]}>
                                                    {selectedGroupPlanLabel}
                                                </Text>
                                            </Row>
                                        ) : (
                                            <>
                                                <Selector
                                                    value={selectedGroupPlanLabel}
                                                    onPress={() => setShowGroupPlanSelector(true)}
                                                    leftIcon={
                                                        <Ionicons
                                                            name={formData.plan_id ? "pricetag" : "pricetag-outline"}
                                                            size={20}
                                                            color={formData.plan_id ? theme.components.button.primary.bg : theme.text.secondary}
                                                        />
                                                    }
                                                />
                                            </>
                                        )}
                                    </Section>



                                    <Section title={`Miembros (${formData.members.length})`}>

                                        <View style={styles.membersList}>
                                            {formData.members.map((member) => {
                                                const player = players?.find(p => p.id === member.player_id);
                                                if (!player) return null;
                                                const planLabel = getMemberPlanLabel(member);

                                                return (
                                                    <View key={member.player_id} style={[styles.memberRow, { backgroundColor: isDark ? theme.background.subtle : theme.background.input }]}>
                                                        <Avatar name={player.full_name} source={player.avatar_url} size="sm" />
                                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                                            <Text style={[styles.memberName, { color: theme.text.primary }]}>{player.full_name}</Text>
                                                            {mode === 'view' ? (
                                                                <Text style={[
                                                                    styles.memberPlanText,
                                                                    member.is_plan_exempt && { color: theme.status.error },
                                                                    member.plan_id && { color: theme.components.button.primary.bg }
                                                                ]}>
                                                                    {planLabel}
                                                                </Text>
                                                            ) : (
                                                                <Selector
                                                                    value={planLabel}
                                                                    onPress={() => setEditingMemberId(member.player_id)}
                                                                    size="sm"
                                                                    style={[styles.memberPlanBadge]}
                                                                    valueStyle={[
                                                                        member.is_plan_exempt && { color: theme.status.error },
                                                                        member.plan_id && { color: theme.components.button.primary.bg },
                                                                        typography.variants.labelSmall,
                                                                    ]}
                                                                    rightIcon={<Ionicons name="chevron-down" size={12} color={theme.text.secondary} />}
                                                                />
                                                            )}
                                                        </View>
                                                        {mode !== 'view' && (
                                                            <TouchableOpacity
                                                                onPress={() => removeMember(member.player_id)}
                                                                style={styles.removeMemberBtn}
                                                            >
                                                                <Ionicons name="close-circle" size={20} color={theme.text.secondary} />
                                                            </TouchableOpacity>
                                                        )}
                                                    </View>
                                                );
                                            })}
                                            {formData.members.length === 0 && (
                                                <Text style={[styles.emptyMembersText, { color: theme.text.secondary }]}>No hay miembros en este grupo</Text>
                                            )}
                                        </View>



                                        {mode !== 'view' && (
                                            <>
                                                <Input
                                                    value={memberSearch}
                                                    onChangeText={setMemberSearch}
                                                    placeholder="Agregar alumno..."
                                                    leftIcon={<Ionicons name="search" size={18} color={theme.text.secondary} />}
                                                />

                                                {memberSearch.length >= 1 && (
                                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionsScroll}>
                                                        {filteredMembers.map(player => (
                                                            <TouchableOpacity
                                                                key={player.id}
                                                                style={[styles.suggestionChip, { backgroundColor: theme.background.surface, borderColor: theme.border.default }]}
                                                                onPress={() => {
                                                                    addMember(player.id);
                                                                    setMemberSearch('');
                                                                }}
                                                            >
                                                                <Avatar name={player.full_name} size="xs" />
                                                                <Text style={[styles.suggestionText, { color: theme.text.primary }]}>{player.full_name}</Text>
                                                                <Ionicons name="add-circle" size={18} color={theme.status.info} style={{ marginLeft: 4 }} />
                                                            </TouchableOpacity>
                                                        ))}
                                                    </ScrollView>
                                                )}
                                            </>
                                        )}
                                    </Section>



                                    {/* Notes */}
                                    <Section title="Notas">
                                        {mode === 'view' ? (
                                            <Text style={[{ color: theme.text.primary }, typography.variants.bodyLarge]}>{formData.description || 'Sin notas.'}</Text>
                                        ) : (
                                            <Input
                                                inputStyle={{ minHeight: 100, textAlignVertical: 'top' }}
                                                value={formData.description}
                                                onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                                                placeholder="Información adicional..."
                                                multiline
                                            />
                                        )}
                                    </Section>

                                    {mode !== 'view' && (
                                        <View style={[styles.footerInner, { marginTop: spacing.md, paddingBottom: spacing.lg }]}>
                                            <View style={{ width: 'auto', minWidth: 200, alignSelf: 'center' }}>
                                                <Button
                                                    label={mode === 'edit' ? 'Guardar Cambios' : 'Crear Grupo'}
                                                    onPress={() => handleSave()}
                                                    loading={createGroup.isPending || updateGroup.isPending || isUploading}
                                                    variant="primary"
                                                />
                                            </View>
                                        </View>
                                    )}


                                </View>
                            </ScrollView>
                        )}
                    </KeyboardAvoidingView>
                </View >
            </View >

            {/* Selectors */}
            {
                mode !== 'view' && (
                    <>
                        <SelectorSheet
                            visible={showGroupPlanSelector}
                            title="Seleccionar Plan del Grupo"
                            options={planOptions}
                            onSelect={(val) => {
                                setFormData(prev => ({ ...prev, plan_id: val === '' ? null : val }));
                                setShowGroupPlanSelector(false);
                            }}
                            onClose={() => setShowGroupPlanSelector(false)}
                            selectedValue={formData.plan_id || ''}
                        />

                        <SelectorSheet
                            visible={!!editingMemberId}
                            title="Plan del Alumno"
                            options={getMemberPlanOptions()}
                            onSelect={(val) => {
                                if (editingMemberId) updateMemberPlan(editingMemberId, val);
                                setEditingMemberId(null);
                            }}
                            onClose={() => setEditingMemberId(null)}
                            selectedValue={
                                editingMemberId
                                    ? (formData.members.find(m => m.player_id === editingMemberId)?.is_plan_exempt
                                        ? 'none_explicit'
                                        : (formData.members.find(m => m.player_id === editingMemberId)?.plan_id || '__default__'))
                                    : null
                            }
                        />
                    </>
                )
            }

            <StatusModal
                visible={confirmModalVisible}
                type="warning"
                title="Clases Futuras Detectadas"
                message={
                    <Text style={{ textAlign: 'center', color: theme.text.secondary, lineHeight: 20, marginBottom: 10 }}>
                        Este grupo tiene <Text style={{ fontWeight: 'bold', color: theme.text.primary }}>{futureSessionsCount} {futureSessionsCount === 1 ? 'clase agendada' : 'clases agendadas'}</Text> a futuro.{"\n\n"}
                        Los cambios <Text style={{ fontWeight: 'bold', color: theme.text.primary }}>NO</Text> se aplicarán automáticamente a esas clases.{"\n\n"}
                        Para sincronizarlas, deberás usar <Text style={{ color: theme.components.button.primary.bg, fontWeight: '600' }}>"Edición Masiva"</Text> en el calendario luego de guardar.
                    </Text>
                }
                showCancel={true}
                cancelText="Cerrar"
                buttonText="Guardar"
                onClose={() => setConfirmModalVisible(false)}
                onConfirm={() => {
                    setConfirmModalVisible(false);
                    handleSave(true); // Call save again, forcing bypass of check
                }}
            />

            <StatusModal
                visible={statusModalVisible}
                type={statusModalConfig.type}
                title={statusModalConfig.title}
                message={statusModalConfig.message}
                onClose={handleStatusClose}
            />
        </Modal >
    );
}

const createStyles = (theme: Theme) => StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        width: '100%',
        height: '100%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
    },
    modalTitle: {
        ...typography.variants.h3,
    },
    headerBtn: {
        padding: spacing.sm,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        flex: 1,
    },
    formContainer: {
        padding: spacing.md,
    },
    desktopContainer: {
        maxWidth: 600,
        alignSelf: 'center',
        width: '100%',
    },
    sectionCentered: {
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    editBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: theme.status.success,
        borderRadius: 12,
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: theme.background.surface,
    },
    selectorButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderRadius: 12,
        paddingHorizontal: spacing.md,
        height: 48,
        borderWidth: 1,
    },
    viewText: {
        ...typography.variants.bodyLarge,
        color: theme.text.primary,
    },
    selectorText: {
        ...typography.variants.bodyLarge,
        fontWeight: '500', // keeping medium weight for selector
    },
    membersList: {
        marginBottom: spacing.sm,
    },
    memberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.xs,
        paddingRight: spacing.sm,
        borderRadius: 30, // Pill shape
        marginBottom: spacing.xs,
    },
    memberName: {
        ...typography.variants.label,
        color: theme.text.primary,
    },
    memberPlanBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    memberInitialText: {
        ...typography.variants.labelSmall,
        color: theme.text.inverse,
    },
    memberPlanText: {
        ...typography.variants.bodySmall,
        fontWeight: '500',
    },
    removeMemberBtn: {
        padding: 4,
    },
    emptyMembersText: {
        ...typography.variants.bodyMedium,
        fontStyle: 'italic',
        marginBottom: spacing.sm,
    },
    suggestionsScroll: {
        marginTop: spacing.sm,
        flexDirection: 'row',
    },
    suggestionChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        marginRight: spacing.sm,
        borderWidth: 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 1,
        elevation: 1,
    },
    emptyText: {
        ...typography.variants.bodyMedium,
        color: theme.text.tertiary,
        textAlign: 'center',
    },
    suggestionText: {
        ...typography.variants.label,
        marginLeft: 8,
    },
    footerInner: {
        marginTop: spacing.md,
    }
});
