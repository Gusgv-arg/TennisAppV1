import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import { Button } from '@/src/design/components/Button';
import { Card } from '@/src/design/components/Card';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useClassGroupMutations, useClassGroups } from '@/src/features/calendar/hooks/useClassGroups';
import { usePricingPlans } from '@/src/features/payments/hooks/usePricingPlans';
import { usePlayers } from '@/src/features/players/hooks/usePlayers';
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
        member_ids: [] as string[],
    });
    const [viewModalVisible, setViewModalVisible] = useState(false);
    const [viewingGroup, setViewingGroup] = useState<ClassGroup | null>(null);

    // Auto-open modal if create=true, edit=id, or view=id is passed
    useEffect(() => {
        if (params.create === 'true') {
            openCreateModal();
        } else if (params.edit && groups) {
            const groupToEdit = groups.find(g => g.id === params.edit);
            if (groupToEdit) {
                openEditModal(groupToEdit);
            }
        } else if (params.view && groups) {
            const groupToView = groups.find(g => g.id === params.view);
            if (groupToView) {
                setViewingGroup(groupToView);
                setViewModalVisible(true);
            }
        }
    }, [params.create, params.edit, params.view, groups]);

    const openCreateModal = () => {
        setEditingGroup(null);
        setFormData({ name: '', description: '', plan_id: null, member_ids: [] });
        setMemberSearch('');
        setModalVisible(true);
    };

    const openEditModal = (group: ClassGroup) => {
        setEditingGroup(group);
        setFormData({
            name: group.name,
            description: group.description || '',
            plan_id: group.plan_id || null,
            member_ids: group.members?.map(m => m.player_id) || [],
        });
        setMemberSearch('');
        setModalVisible(true);
    };

    // Close modal and navigate back if we came from params
    const closeModalAndGoBack = () => {
        setModalVisible(false);
        setViewModalVisible(false);
        if (params.view || params.edit || params.create) {
            if (router.canGoBack()) {
                router.back();
            } else {
                router.replace('/(tabs)/players');
            }
        }
    };

    const handleSave = async () => {
        if (!formData.name.trim()) {
            Alert.alert('Error', 'El nombre del grupo es requerido');
            return;
        }

        try {
            if (editingGroup) {
                await updateGroup.mutateAsync({
                    id: editingGroup.id,
                    input: formData,
                });
            } else {
                await createGroup.mutateAsync(formData);
            }
            closeModalAndGoBack();
        } catch (error) {
            Alert.alert('Error', 'No se pudo guardar el grupo');
        }
    };

    const handleDelete = (group: ClassGroup) => {
        Alert.alert(
            'Eliminar Grupo',
            `¿Estás seguro de eliminar "${group.name}"?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: () => deleteGroup.mutate(group.id),
                },
            ]
        );
    };

    const toggleMember = (playerId: string) => {
        setFormData(prev => ({
            ...prev,
            member_ids: prev.member_ids.includes(playerId)
                ? prev.member_ids.filter(id => id !== playerId)
                : [...prev.member_ids, playerId],
        }));
    };

    const renderGroupItem = ({ item }: { item: ClassGroup }) => (
        <TouchableOpacity onPress={() => openEditModal(item)}>
            <Card style={styles.groupCard} padding="md">
                <View style={styles.groupHeader}>
                    <View style={styles.groupIcon}>
                        <Ionicons name="people" size={24} color={colors.secondary[500]} />
                    </View>
                    <View style={styles.groupInfo}>
                        <Text style={styles.groupName}>{item.name}</Text>
                        <Text style={styles.groupMeta}>
                            {item.member_count} {item.member_count === 1 ? 'alumno' : 'alumnos'}
                            {item.plan && ` • ${item.plan.name}`}
                        </Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteButton}>
                        <Ionicons name="trash-outline" size={20} color={colors.error[500]} />
                    </TouchableOpacity>
                </View>
                {item.description && (
                    <Text style={styles.groupDescription}>{item.description}</Text>
                )}
            </Card>
        </TouchableOpacity>
    );

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary[500]} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: 'Grupos de Clases',
                    headerTitleAlign: 'center',
                }}
            />

            <FlatList
                data={groups}
                keyExtractor={(item) => item.id}
                renderItem={renderGroupItem}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="people-circle-outline" size={64} color={colors.neutral[300]} />
                        <Text style={styles.emptyTitle}>Sin grupos</Text>
                        <Text style={styles.emptyText}>
                            Crea grupos para organizar clases grupales recurrentes
                        </Text>
                    </View>
                }
            />

            {/* FAB */}
            <TouchableOpacity style={styles.fab} onPress={openCreateModal}>
                <Ionicons name="add" size={28} color={colors.common.white} />
            </TouchableOpacity>

            {/* Create/Edit Modal */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={closeModalAndGoBack}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>
                            {editingGroup ? 'Editar Grupo' : 'Nuevo Grupo'}
                        </Text>
                        <TouchableOpacity onPress={closeModalAndGoBack}>
                            <Ionicons name="close" size={28} color={colors.neutral[500]} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalContent}>
                        {/* Name */}
                        <Text style={styles.label}>Nombre del grupo *</Text>
                        <TextInput
                            style={styles.input}
                            value={formData.name}
                            onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                            placeholder="Ej: Avanzados Lunes"
                            placeholderTextColor={colors.neutral[400]}
                        />

                        {/* Description */}
                        <Text style={styles.label}>Descripción (opcional)</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={formData.description}
                            onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                            placeholder="Notas sobre el grupo..."
                            placeholderTextColor={colors.neutral[400]}
                            multiline
                            numberOfLines={3}
                        />

                        {/* Plan */}
                        <Text style={styles.label}>Plan de pago (opcional)</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.planSelector}>
                            <TouchableOpacity
                                style={[styles.planOption, !formData.plan_id && styles.planOptionSelected]}
                                onPress={() => setFormData(prev => ({ ...prev, plan_id: null }))}
                            >
                                <Text style={[styles.planOptionText, !formData.plan_id && styles.planOptionTextSelected]}>
                                    Sin plan
                                </Text>
                            </TouchableOpacity>
                            {plans?.map(plan => (
                                <TouchableOpacity
                                    key={plan.id}
                                    style={[styles.planOption, formData.plan_id === plan.id && styles.planOptionSelected]}
                                    onPress={() => setFormData(prev => ({ ...prev, plan_id: plan.id }))}
                                >
                                    <Text style={[styles.planOptionText, formData.plan_id === plan.id && styles.planOptionTextSelected]}>
                                        {plan.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {/* Members */}
                        <Text style={styles.label}>
                            Miembros ({formData.member_ids.length} seleccionados)
                        </Text>

                        {/* Show selected members first */}
                        {formData.member_ids.length > 0 && (
                            <View style={[styles.membersGrid, { marginBottom: spacing.sm }]}>
                                {players
                                    ?.filter(p => formData.member_ids.includes(p.id))
                                    .map(player => (
                                        <TouchableOpacity
                                            key={player.id}
                                            style={styles.selectedMemberChip}
                                            onPress={() => toggleMember(player.id)}
                                        >
                                            <Text style={styles.selectedMemberText}>
                                                {player.full_name}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                            </View>
                        )}

                        {/* Search input */}
                        <TextInput
                            style={[styles.input, { marginBottom: spacing.sm }]}
                            value={memberSearch}
                            onChangeText={setMemberSearch}
                            placeholder="Buscar alumno para agregar..."
                            placeholderTextColor={colors.neutral[400]}
                        />

                        {/* Search results - only show when searching */}
                        {memberSearch.length >= 2 && (
                            <View style={styles.membersGrid}>
                                {players
                                    ?.filter(p =>
                                        p.full_name.toLowerCase().includes(memberSearch.toLowerCase()) &&
                                        !formData.member_ids.includes(p.id) // Don't show already selected
                                    )
                                    .slice(0, 10) // Limit to 10 results
                                    .map(player => (
                                        <TouchableOpacity
                                            key={player.id}
                                            style={styles.memberChip}
                                            onPress={() => toggleMember(player.id)}
                                        >
                                            <Text style={styles.memberChipText}>
                                                {player.full_name}
                                            </Text>
                                            <Ionicons name="add" size={16} color={colors.secondary[500]} />
                                        </TouchableOpacity>
                                    ))}
                            </View>
                        )}

                        {memberSearch.length > 0 && memberSearch.length < 2 && (
                            <Text style={{ fontSize: 12, color: colors.neutral[400], fontStyle: 'italic' }}>
                                Escribí al menos 2 caracteres para buscar...
                            </Text>
                        )}

                        <Button
                            label={editingGroup ? 'Guardar Cambios' : 'Crear Grupo'}
                            onPress={handleSave}
                            loading={createGroup.isPending || updateGroup.isPending}
                            style={styles.saveButton}
                        />
                    </ScrollView>
                </View>
            </Modal>

            {/* View Modal (Read-only) */}
            <Modal
                visible={viewModalVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={closeModalAndGoBack}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>
                            {viewingGroup?.name}
                        </Text>
                        <TouchableOpacity onPress={closeModalAndGoBack}>
                            <Ionicons name="close" size={28} color={colors.neutral[500]} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalContent}>
                        {viewingGroup?.description && (
                            <>
                                <Text style={styles.label}>Descripción</Text>
                                <Text style={{ fontSize: 14, color: colors.neutral[700], marginBottom: spacing.md }}>
                                    {viewingGroup.description}
                                </Text>
                            </>
                        )}

                        {viewingGroup?.plan && (
                            <>
                                <Text style={styles.label}>Plan asignado</Text>
                                <View style={[styles.selectedMemberChip, { alignSelf: 'flex-start', marginBottom: spacing.md }]}>
                                    <Ionicons name="pricetag" size={14} color={colors.primary[600]} />
                                    <Text style={{ fontSize: 14, color: colors.primary[700], marginLeft: 4 }}>
                                        {viewingGroup.plan.name}
                                    </Text>
                                </View>
                            </>
                        )}

                        <Text style={styles.label}>
                            Miembros ({viewingGroup?.member_count || 0})
                        </Text>
                        <View style={styles.membersGrid}>
                            {viewingGroup?.members?.map(member => (
                                <View key={member.player_id} style={styles.selectedMemberChip}>
                                    <Text style={styles.selectedMemberText}>
                                        {member.player?.full_name}
                                    </Text>
                                </View>
                            ))}
                        </View>

                        {(!viewingGroup?.members || viewingGroup.members.length === 0) && (
                            <Text style={{ fontSize: 14, color: colors.neutral[400], fontStyle: 'italic' }}>
                                Este grupo no tiene miembros
                            </Text>
                        )}
                    </ScrollView>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.neutral[50],
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: spacing.md,
        paddingBottom: 100,
    },
    groupCard: {
        marginBottom: spacing.sm,
    },
    groupHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    groupIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
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
        fontWeight: '600',
        color: colors.neutral[900],
    },
    groupMeta: {
        fontSize: typography.size.sm,
        color: colors.neutral[500],
        marginTop: 2,
    },
    groupDescription: {
        fontSize: typography.size.sm,
        color: colors.neutral[600],
        marginTop: spacing.sm,
        paddingLeft: 64,
    },
    deleteButton: {
        padding: spacing.sm,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: spacing.xxl,
    },
    emptyTitle: {
        fontSize: typography.size.lg,
        fontWeight: '600',
        color: colors.neutral[700],
        marginTop: spacing.md,
    },
    emptyText: {
        fontSize: typography.size.sm,
        color: colors.neutral[500],
        textAlign: 'center',
        marginTop: spacing.xs,
        paddingHorizontal: spacing.xl,
    },
    fab: {
        position: 'absolute',
        bottom: spacing.xl,
        right: spacing.lg,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.secondary[500],
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: colors.common.white,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[200],
    },
    modalTitle: {
        fontSize: typography.size.xl,
        fontWeight: '700',
        color: colors.neutral[900],
    },
    modalContent: {
        flex: 1,
        padding: spacing.md,
    },
    label: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        color: colors.neutral[700],
        marginBottom: spacing.xs,
        marginTop: spacing.md,
    },
    input: {
        borderWidth: 1,
        borderColor: colors.neutral[300],
        borderRadius: 8,
        padding: spacing.md,
        fontSize: typography.size.md,
        color: colors.neutral[900],
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    planSelector: {
        marginBottom: spacing.sm,
    },
    planOption: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.neutral[300],
        marginRight: spacing.sm,
    },
    planOptionSelected: {
        backgroundColor: colors.primary[500],
        borderColor: colors.primary[500],
    },
    planOptionText: {
        fontSize: typography.size.sm,
        color: colors.neutral[600],
    },
    planOptionTextSelected: {
        color: colors.common.white,
        fontWeight: '600',
    },
    membersGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    memberChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.neutral[300],
        gap: spacing.xs,
    },
    memberChipSelected: {
        backgroundColor: colors.secondary[500],
        borderColor: colors.secondary[500],
    },
    memberChipText: {
        fontSize: typography.size.sm,
        color: colors.neutral[700],
    },
    memberChipTextSelected: {
        color: colors.common.white,
        fontWeight: '500',
    },
    saveButton: {
        marginTop: spacing.xl,
        marginBottom: spacing.xxl,
    },
    selectedMemberChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.neutral[300],
        backgroundColor: colors.neutral[100],
    },
    selectedMemberText: {
        fontSize: typography.size.sm,
        color: colors.neutral[700],
    },
});
