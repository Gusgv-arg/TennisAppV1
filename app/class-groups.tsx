import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

import { SelectorOption, SelectorSheet } from '@/src/components/SelectorSheet';
import StatusModal from '@/src/components/StatusModal';
import { Avatar } from '@/src/design/components/Avatar';
import { Button } from '@/src/design/components/Button';
import { Card } from '@/src/design/components/Card';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useClassGroupMutations, useClassGroups } from '@/src/features/calendar/hooks/useClassGroups';
import { usePricingPlans } from '@/src/features/payments/hooks/usePricingPlans';
import { useSubscriptions } from '@/src/features/payments/hooks/useSubscriptions';
import { usePlayers } from '@/src/features/players/hooks/usePlayers';
import { useGroupImageUpload } from '@/src/hooks/useGroupImageUpload';
import { useImagePicker } from '@/src/hooks/useImagePicker';
import { useAuthStore } from '@/src/store/useAuthStore';
import { ClassGroup } from '@/src/types/classGroups';

export default function ClassGroupsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ create?: string; edit?: string; view?: string }>();
    const { data: groups, isLoading } = useClassGroups();
    const { data: players } = usePlayers();
    const { plans } = usePricingPlans();
    const { createGroup, updateGroup, deleteGroup } = useClassGroupMutations();

    const [modalVisible, setModalVisible] = useState(false);
    const [editingGroup, setEditingGroup] = useState<ClassGroup | null>(null);
    const [memberSearch, setMemberSearch] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        plan_id: null as string | null,
        members: [] as { player_id: string; plan_id: string | null; is_plan_exempt?: boolean }[],
    });
    const [avatarUri, setAvatarUri] = useState<string | null>(null);

    // Selector State
    const [showGroupPlanSelector, setShowGroupPlanSelector] = useState(false);
    const [editingMemberId, setEditingMemberId] = useState<string | null>(null); // If set, showing selector for this member

    const { pickImageFromCamera, pickImageFromGallery } = useImagePicker();
    const { uploadGroupImage, isUploading } = useGroupImageUpload();

    // Optimized member search
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

    // ... (UseEffects for params handling same as before)
    useEffect(() => {
        if (params.create === 'true') {
            openCreateModal();
        } else if (params.edit && groups) {
            const groupToEdit = groups.find(g => g.id === params.edit);
            if (groupToEdit) {
                openEditModal(groupToEdit);
            }
        }
    }, [params.create, params.edit, groups]);

    const openCreateModal = () => {
        setEditingGroup(null);
        setFormData({ name: '', description: '', plan_id: null, members: [] });
        setAvatarUri(null);
        setMemberSearch('');
        setModalVisible(true);
    };

    const openEditModal = (group: ClassGroup) => {
        setEditingGroup(group);
        setFormData({
            name: group.name,
            description: group.description || '',
            plan_id: group.plan_id || null,
            members: group.members?.map(m => ({
                player_id: m.player_id,
                plan_id: m.plan_id || null, // Keep actual plan_id
                is_plan_exempt: m.is_plan_exempt // preserve exempt flag
            })) || [],
        });
        setAvatarUri(group.image_url || null);
        setMemberSearch('');
        setModalVisible(true);
    };

    const closeModalAndGoBack = () => {
        setModalVisible(false);
        if (params.edit || params.create) {
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)/players');
        }
    };

    const handleAvatarPress = async () => {
        // ... (Same avatar logic)
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

    const [statusModalVisible, setStatusModalVisible] = useState(false);
    const [statusModalConfig, setStatusModalConfig] = useState<{
        type: 'success' | 'error' | 'warning';
        title: string;
        message: string;
    }>({ type: 'success', title: '', message: '' });

    const { assignPlan } = useSubscriptions();

    const handleStatusModalClose = () => {
        setStatusModalVisible(false);
        if (statusModalConfig.type === 'success') {
            closeModalAndGoBack();
        }
    };

    const handleSave = async () => {
        if (!formData.name.trim()) {
            Alert.alert('Error', 'El nombre del grupo es requerido');
            return;
        }

        // Auto-create subscriptions for members who don't have the assigned plan
        try {
            const subscriptionPromises = formData.members.map(async (m) => {
                // Skip if exempt or no plan assigned
                if (m.is_plan_exempt) return;

                const targetPlanId = m.plan_id || formData.plan_id;
                if (!targetPlanId) return;

                const player = players?.find(p => p.id === m.player_id);
                if (!player) return;

                // Check if player ALREADY has this specific plan active
                // (Strict check, same as in Class Creation)
                const hasActiveSub = player.active_subscriptions?.some(
                    (s: any) => s.plan?.id === targetPlanId && s.status === 'active'
                );

                if (!hasActiveSub) {
                    console.log(`[Auto-Sub] Creating subscription to ${targetPlanId} for player ${player.full_name}`);
                    await assignPlan({
                        playerId: m.player_id,
                        planId: targetPlanId,
                    });
                }
            });

            // Wait for all auto-subscriptions to complete before saving group
            // This ensures data consistency
            await Promise.all(subscriptionPromises);

        } catch (error) {
            console.error('[Auto-Sub] Error creating automatic subscriptions:', error);
            // We continue with group creation even if this fails, 
            // but arguably we could show a warning. For now, proceeding is smoother.
        }

        try {
            const tempId = editingGroup?.id || `temp_${Date.now()}`;
            let image_url = editingGroup?.image_url;

            if (avatarUri && !avatarUri.startsWith('http')) {
                const uploadedUrl = await uploadGroupImage(avatarUri, tempId);
                if (uploadedUrl) image_url = uploadedUrl;
            } else if (!avatarUri) {
                image_url = undefined;
            }

            const { profile } = useAuthStore.getState();

            // Prepare members payload: map UI logic back to data structure
            // In UI, we might use "none_explicit" as a value for logic
            // But formData already keeps track of is_plan_exempt if we manage it correctly

            const membersPayload = formData.members.map(m => ({
                player_id: m.player_id,
                plan_id: m.plan_id,
                is_plan_exempt: m.is_plan_exempt
            }));

            if (editingGroup) {
                await updateGroup.mutateAsync({
                    id: editingGroup.id,
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
                title: editingGroup ? 'Grupo Actualizado' : 'Grupo Creado',
                message: editingGroup
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
    const addMember = (playerId: string) => {
        setFormData(prev => ({
            ...prev,
            members: [...prev.members, { player_id: playerId, plan_id: null, is_plan_exempt: false }],
        }));
    };

    const removeMember = (playerId: string) => {
        setFormData(prev => ({
            ...prev,
            members: prev.members.filter(m => m.player_id !== playerId),
        }));
    };

    const updateMemberPlan = (playerId: string, value: string) => {
        // Value can be:
        // "__default__" -> plan_id: null, is_plan_exempt: false
        // "none_explicit" -> plan_id: null, is_plan_exempt: true
        // UUID -> plan_id: UUID, is_plan_exempt: false

        setFormData(prev => ({
            ...prev,
            members: prev.members.map(m => {
                if (m.player_id !== playerId) return m;

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

    // Prepare Selector Options
    const planOptions: SelectorOption[] = [
        { label: 'Sin Plan del Grupo', value: '', icon: 'remove-circle-outline' },
        ...(plans?.map(p => ({
            label: p.name,
            value: p.id,
            // subLabel: `${p.price ? '$' + p.price : ''}`, // Price might not be available
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
                color: colors.primary[600]
            },
            {
                label: 'Excluir del cobro',
                subLabel: 'Este alumno no pagará por estas clases',
                value: 'none_explicit',
                icon: 'alert-circle-outline',
                color: colors.error[600],
                isDestructive: true
            },
            ...(plans?.map(p => ({
                label: p.name,
                value: p.id,
                icon: 'pricetag-outline' as const
            })) || [])
        ];
    };

    const renderGroupItem = ({ item }: { item: ClassGroup }) => {
        // Calculate effective plans for all members to determine if they are consistent or mixed
        const effectivePlans = new Set(item.members?.map(m => {
            if (m.is_plan_exempt) return 'IS_EXEMPT';
            // If member has explicit plan, use it. Else use group default. If both null, 'NO_PLAN'.
            return m.plan_id || item.plan_id || 'NO_PLAN';
        }));

        // If there is more than 1 distinct plan type in the group, we show the detailed list
        const hasMixedPlans = effectivePlans.size > 1;

        const memberNames = item.members
            ?.map(m => players?.find(p => p.id === m.player_id)?.full_name)
            .filter(Boolean)
            .join(', ');

        return (
            <TouchableOpacity onPress={() => openEditModal(item)} activeOpacity={0.7}>
                <Card style={styles.groupCard} padding="md">
                    <View style={styles.groupHeader}>
                        <View style={[styles.groupIcon, item.image_url ? { backgroundColor: 'transparent' } : null]}>
                            {item.image_url ? (
                                <Avatar source={item.image_url} name={item.name} size="md" />
                            ) : (
                                <Ionicons name="people" size={24} color={colors.secondary[500]} />
                            )}
                        </View>
                        <View style={styles.groupInfo}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={styles.groupName}>{item.name}</Text>
                                <Ionicons name="chevron-forward" size={16} color={colors.neutral[300]} />
                            </View>
                            <Text style={styles.groupMeta} numberOfLines={1}>
                                {item.member_count} {item.member_count === 1 ? 'alumno' : 'alumnos'}
                                {item.plan ? ` • ${item.plan.name}` : ''}
                            </Text>

                            {/* Conditional Member Display */}
                            {hasMixedPlans ? (
                                <View style={{ marginTop: 2 }}>
                                    {item.members?.map(m => {
                                        const player = players?.find(p => p.id === m.player_id);
                                        if (!player) return null;

                                        let planLabel = 'Plan del Grupo';
                                        let labelColor = colors.neutral[500];

                                        if (m.is_plan_exempt) {
                                            planLabel = 'Excluído del cobro';
                                            labelColor = colors.error[600];
                                        } else if (m.plan_id) {
                                            planLabel = plans?.find(p => p.id === m.plan_id)?.name || 'Custom';
                                            labelColor = colors.primary[600];
                                        }

                                        return (
                                            <View key={m.player_id} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                                {/* Player Icon */}
                                                <Ionicons name="person-outline" size={12} color={colors.neutral[600]} style={{ marginRight: 4 }} />
                                                <Text style={[styles.groupMemberDetailedText, { marginRight: 8, marginTop: 0 }]}>
                                                    {player.full_name}
                                                </Text>

                                                {/* Plan Icon */}
                                                <Ionicons name={m.is_plan_exempt ? "alert-circle-outline" : "pricetag-outline"} size={12} color={labelColor} style={{ marginRight: 4 }} />
                                                <Text style={{ fontSize: 11, color: labelColor }}>
                                                    {planLabel}
                                                </Text>
                                            </View>
                                        );
                                    })}
                                </View>
                            ) : (
                                memberNames ? (
                                    <Text style={styles.groupMembersText} numberOfLines={1}>
                                        {memberNames}
                                    </Text>
                                ) : null
                            )}
                        </View>
                    </View>
                </Card>
            </TouchableOpacity>
        );
    };

    // Helper to get selected plan label for group
    const selectedGroupPlanLabel = useMemo(() => {
        if (!formData.plan_id) return 'Sin Plan del Grupo';
        return plans?.find(p => p.id === formData.plan_id)?.name || 'Plan Desconocido';
    }, [formData.plan_id, plans]);

    // Helper to get selected plan label for member
    const getMemberPlanLabel = (member: { plan_id: string | null; is_plan_exempt?: boolean }) => {
        if (member.is_plan_exempt) return 'Excluído del cobro';
        if (member.plan_id) return plans?.find(p => p.id === member.plan_id)?.name || 'Custom';
        return 'Plan del Grupo';
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: 'Grupos' }} />

            {/* Main List */}
            <FlatList
                data={groups}
                renderItem={renderGroupItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    !isLoading ? (
                        <View style={styles.emptyContainer}>
                            <View style={styles.emptyIconCircle}>
                                <Ionicons name="people-outline" size={32} color={colors.neutral[400]} />
                            </View>
                            <Text style={styles.emptyTitle}>No hay grupos</Text>
                            <Text style={styles.emptyText}>Crea grupos para agendar clases rápidamente.</Text>
                        </View>
                    ) : null
                }
            />

            {/* FAB */}
            <TouchableOpacity style={styles.fab} onPress={openCreateModal} activeOpacity={0.8}>
                <Ionicons name="add" size={28} color="white" />
            </TouchableOpacity>

            {/* Create/Edit Modal */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                presentationStyle="pageSheet" // Nice iOS feel
                onRequestClose={closeModalAndGoBack}
            >
                <SafeAreaView style={{ flex: 1, backgroundColor: colors.common.white }}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        style={{ flex: 1 }}
                    >
                        <View style={styles.modalHeader}>
                            <View style={{ width: 44 }} />
                            <Text style={styles.modalTitle}>
                                {editingGroup ? 'Editar Grupo' : 'Nuevo Grupo'}
                            </Text>
                            <TouchableOpacity onPress={closeModalAndGoBack} style={styles.closeBtn}>
                                <Ionicons name="close" size={24} color={colors.neutral[900]} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

                            <View style={styles.formContainer}>
                                {/* Photo & Name Section */}
                                <View style={styles.sectionCentered}>
                                    <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.8}>
                                        <Avatar
                                            source={avatarUri || undefined}
                                            name={formData.name || '?'}
                                            size="xl" // Bigger for edit
                                        />
                                        <View style={styles.editBadge}>
                                            <Ionicons name="camera" size={14} color="white" />
                                        </View>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>NOMBRE</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={formData.name}
                                        onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                                        placeholder="Ej. Avanzados Martes"
                                        placeholderTextColor={colors.neutral[400]}
                                    />
                                </View>

                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>PLAN DEL GRUPO</Text>
                                    <TouchableOpacity
                                        style={styles.selectorButton}
                                        onPress={() => setShowGroupPlanSelector(true)}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Ionicons
                                                name={formData.plan_id ? "pricetag" : "pricetag-outline"}
                                                size={20}
                                                color={formData.plan_id ? colors.primary[500] : colors.neutral[500]}
                                                style={{ marginRight: 8 }}
                                            />
                                            <Text style={[styles.selectorText, !formData.plan_id && { color: colors.neutral[500] }]}>
                                                {selectedGroupPlanLabel}
                                            </Text>
                                        </View>
                                        <Ionicons name="chevron-down" size={16} color={colors.neutral[400]} />
                                    </TouchableOpacity>
                                    <Text style={styles.helperText}>
                                        Aplica a todos los miembros salvo excepciones.
                                    </Text>
                                </View>

                                <View style={styles.separator} />

                                {/* Members Section */}
                                <View style={styles.formGroup}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <Text style={styles.label}>MIEMBROS ({formData.members.length})</Text>
                                    </View>

                                    {/* Current Members List */}
                                    <View style={styles.membersList}>
                                        {formData.members.map((member) => {
                                            const player = players?.find(p => p.id === member.player_id);
                                            if (!player) return null;
                                            const planLabel = getMemberPlanLabel(member);

                                            return (
                                                <View key={member.player_id} style={styles.memberRow}>
                                                    <Avatar name={player.full_name} source={player.avatar_url} size="sm" />
                                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                                        <Text style={styles.memberName}>{player.full_name}</Text>
                                                        <TouchableOpacity
                                                            onPress={() => setEditingMemberId(member.player_id)}
                                                            style={styles.memberPlanBadge}
                                                        >
                                                            <Text style={[
                                                                styles.memberPlanText,
                                                                member.is_plan_exempt && { color: colors.error[600] },
                                                                member.plan_id && { color: colors.primary[700] }
                                                            ]}>
                                                                {planLabel}
                                                            </Text>
                                                            <Ionicons name="chevron-down" size={12} color={colors.neutral[400]} style={{ marginLeft: 2 }} />
                                                        </TouchableOpacity>
                                                    </View>
                                                    <TouchableOpacity
                                                        onPress={() => removeMember(member.player_id)}
                                                        style={styles.removeMemberBtn}
                                                    >
                                                        <Ionicons name="close-circle" size={20} color={colors.neutral[300]} />
                                                    </TouchableOpacity>
                                                </View>
                                            );
                                        })}
                                    </View>

                                    {/* Search Add Input */}
                                    <View style={styles.searchContainer}>
                                        <Ionicons name="search" size={18} color={colors.neutral[400]} style={{ marginRight: 8 }} />
                                        <TextInput
                                            style={styles.searchInput}
                                            value={memberSearch}
                                            onChangeText={setMemberSearch}
                                            placeholder="Agregar alumno..."
                                            placeholderTextColor={colors.neutral[400]}
                                        />
                                    </View>

                                    {/* Quick Add Suggestions */}
                                    {memberSearch.length >= 1 && (
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionsScroll}>
                                            {filteredMembers.map(player => (
                                                <TouchableOpacity
                                                    key={player.id}
                                                    style={styles.suggestionChip}
                                                    onPress={() => {
                                                        addMember(player.id);
                                                        setMemberSearch('');
                                                    }}
                                                >
                                                    <Avatar name={player.full_name} size="xs" />
                                                    <Text style={styles.suggestionText}>{player.full_name}</Text>
                                                    <Ionicons name="add-circle" size={18} color={colors.secondary[500]} style={{ marginLeft: 4 }} />
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    )}
                                </View>

                                <View style={styles.separator} />

                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>NOTAS</Text>
                                    <TextInput
                                        style={[styles.input, styles.textArea]}
                                        value={formData.description}
                                        onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                                        placeholder="Información adicional..."
                                        placeholderTextColor={colors.neutral[400]}
                                        multiline
                                    />
                                </View>

                                {/* Button moved inside ScrollView for natural scrolling */}
                                <View style={[styles.footerInner, { marginTop: 24, paddingBottom: 24 }]}>
                                    <Button
                                        label={editingGroup ? 'Guardar Cambios' : 'Crear Grupo'}
                                        onPress={handleSave}
                                        loading={createGroup.isPending || updateGroup.isPending || isUploading}
                                        variant="primary"
                                    />
                                </View>
                            </View>

                        </ScrollView>
                    </KeyboardAvoidingView>
                </SafeAreaView>
            </Modal>

            {/* Selectors */}
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

            <StatusModal
                visible={statusModalVisible}
                type={statusModalConfig.type}
                title={statusModalConfig.title}
                message={statusModalConfig.message}
                onClose={handleStatusModalClose}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.neutral[50], // Slightly gray background for list
    },
    listContent: {
        padding: spacing.md,
        paddingBottom: 100,
    },
    groupCard: {
        marginBottom: spacing.md,
        borderRadius: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    groupHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    groupIcon: {
        width: 56,
        height: 56,
        borderRadius: 16,
        backgroundColor: colors.secondary[50],
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    groupInfo: {
        flex: 1,
    },
    groupName: {
        fontSize: typography.size.md,
        fontWeight: '700',
        color: colors.neutral[900],
        marginBottom: 2,
    },
    groupMeta: {
        fontSize: typography.size.sm,
        color: colors.neutral[500],
    },
    groupMembersText: {
        fontSize: typography.size.xs,
        color: colors.neutral[400],
        marginTop: 2,
    },
    groupMemberDetailedText: {
        fontSize: typography.size.xs, // slightly larger or same
        color: colors.neutral[800],
        marginTop: 2,
    },
    fab: {
        position: 'absolute',
        bottom: spacing.xl,
        right: spacing.lg,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: colors.secondary[500],
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: colors.secondary[500],
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },

    // Empty State
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: spacing.xxxl,
    },
    emptyIconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.neutral[100],
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    emptyTitle: {
        fontSize: typography.size.lg,
        fontWeight: '700',
        color: colors.neutral[800],
    },
    emptyText: {
        fontSize: typography.size.sm,
        color: colors.neutral[500],
        marginTop: 4,
    },

    // Modal Styles
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[100],
        backgroundColor: colors.common.white,
    },
    modalTitle: {
        fontSize: typography.size.md,
        fontWeight: '700',
        color: colors.neutral[900],
    },
    closeBtn: {
        padding: spacing.sm,
    },
    closeBtnText: {
        fontSize: typography.size.md,
        color: colors.neutral[500],
    },
    saveBtnTop: {
        padding: spacing.sm,
    },
    saveBtnText: {
        fontSize: typography.size.md,
        fontWeight: '600',
        color: colors.primary[600],
    },
    modalContent: {
        flex: 1,
        backgroundColor: colors.common.white,
    },

    // Form Styles
    sectionCentered: {
        alignItems: 'center',
        paddingVertical: spacing.lg,
    },
    editBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: colors.primary[500],
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: colors.common.white,
    },
    formGroup: {
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.lg,
    },
    label: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.neutral[500],
        marginBottom: spacing.xs,
        letterSpacing: 0.5,
    },
    input: {
        fontSize: 16,
        color: colors.neutral[900],
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[200],
        paddingVertical: spacing.sm,
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    helperText: {
        fontSize: 12,
        color: colors.neutral[400],
        marginTop: 4,
    },

    // Custom Selector
    selectorButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[200],
    },
    selectorText: {
        fontSize: 16,
        color: colors.neutral[900],
    },

    separator: {
        height: 8,
        backgroundColor: colors.neutral[50],
        marginVertical: spacing.md,
    },

    // Footer
    footer: {
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.neutral[100],
        backgroundColor: colors.common.white,
    },

    // Members Section
    membersList: {
        marginTop: spacing.sm,
    },
    memberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[50],
    },
    memberName: {
        fontSize: 15,
        fontWeight: '500',
        color: colors.neutral[900],
    },
    memberPlanBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    memberPlanText: {
        fontSize: 12,
        color: colors.neutral[500],
        marginRight: 2,
    },
    removeMemberBtn: {
        padding: spacing.sm,
    },

    // Search & Suggestions
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.neutral[50],
        borderRadius: 8,
        paddingHorizontal: spacing.md,
        height: 40,
        marginTop: spacing.md,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: colors.neutral[900],
        height: '100%',
    },
    suggestionsScroll: {
        marginTop: spacing.sm,
        paddingBottom: spacing.sm,
    },
    suggestionChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.common.white,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 20,
        marginRight: 8,
        borderWidth: 1,
        borderColor: colors.neutral[200],
    },
    suggestionText: {
        fontSize: 13,
        color: colors.neutral[700],
        marginLeft: 6,
    },
    // Layout Constraints
    formContainer: {
        width: '100%',
        maxWidth: 600,
        alignSelf: 'center',
    },
    footerInner: {
        width: '100%',
        maxWidth: 400,
        alignSelf: 'center',
    },
});
