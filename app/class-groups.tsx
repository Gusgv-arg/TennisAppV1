import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActionSheetIOS,
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

import StatusModal from '@/src/components/StatusModal';
import { Avatar } from '@/src/design/components/Avatar';
import { Button } from '@/src/design/components/Button';
import { Card } from '@/src/design/components/Card';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useClassGroupMutations, useClassGroups } from '@/src/features/calendar/hooks/useClassGroups';
import { usePricingPlans } from '@/src/features/payments/hooks/usePricingPlans';
import { usePlayers } from '@/src/features/players/hooks/usePlayers';
import { useGroupImageUpload } from '@/src/hooks/useGroupImageUpload';
import { useImagePicker } from '@/src/hooks/useImagePicker';
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
    const [avatarUri, setAvatarUri] = useState<string | null>(null);

    const { pickImageFromCamera, pickImageFromGallery } = useImagePicker();
    const { uploadGroupImage, isUploading } = useGroupImageUpload();

    const [viewModalVisible, setViewModalVisible] = useState(false);
    const [viewingGroup, setViewingGroup] = useState<ClassGroup | null>(null);

    // Optimized member search
    const filteredMembers = React.useMemo(() => {
        if (memberSearch.length < 2 || !players) return [];
        return players
            .filter(p =>
                !formData.member_ids.includes(p.id) &&
                p.full_name.toLowerCase().includes(memberSearch.toLowerCase())
            )
            .slice(0, 5);
    }, [memberSearch, players, formData.member_ids]);

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
            member_ids: group.members?.map(m => m.player_id) || [],
        });
        setAvatarUri(group.image_url || null);
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

    const handleAvatarPress = async () => {
        if (Platform.OS === 'web') {
            const uri = await pickImageFromGallery();
            if (uri) setAvatarUri(uri);
            return;
        }

        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: ['Cancelar', 'Tomar foto', 'Elegir de galería'],
                    cancelButtonIndex: 0,
                },
                async (buttonIndex) => {
                    if (buttonIndex === 1) {
                        const uri = await pickImageFromCamera();
                        if (uri) setAvatarUri(uri);
                    } else if (buttonIndex === 2) {
                        const uri = await pickImageFromGallery();
                        if (uri) setAvatarUri(uri);
                    }
                }
            );
        } else {
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
        }
    };

    const [statusModalVisible, setStatusModalVisible] = useState(false);
    const [statusModalConfig, setStatusModalConfig] = useState<{
        type: 'success' | 'error' | 'warning';
        title: string;
        message: string;
        onCloseAction?: () => void;
    }>({
        type: 'success',
        title: '',
        message: ''
    });

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

        try {
            // Generar ID temporal si es nuevo, o usar el existente
            const tempId = editingGroup?.id || `temp_${Date.now()}`;

            // Subir imagen si es nueva (no empieza con http)
            let image_url = editingGroup?.image_url;
            if (avatarUri && !avatarUri.startsWith('http')) {
                const uploadedUrl = await uploadGroupImage(avatarUri, tempId);
                if (uploadedUrl) {
                    image_url = uploadedUrl;
                } else {
                    // If upload fails, we warn but might still want to save the group? 
                    // Or block? The original code returned. Let's block for safety or ask user.
                    // For now, let's just show error.
                    setStatusModalConfig({
                        type: 'error',
                        title: 'Error de imagen',
                        message: 'No se pudo subir la imagen. Intenta de nuevo.'
                    });
                    setStatusModalVisible(true);
                    return;
                }
            } else if (!avatarUri) {
                image_url = undefined;
            }

            if (editingGroup) {
                await updateGroup.mutateAsync({
                    id: editingGroup.id,
                    input: { ...formData, image_url },
                });
            } else {
                await createGroup.mutateAsync({ ...formData, image_url });
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

    const renderGroupItem = ({ item }: { item: ClassGroup }) => {
        // Get member names
        const memberNames = item.members
            ?.map(m => players?.find(p => p.id === m.player_id)?.full_name)
            .filter(Boolean)
            .join(', ');

        return (
            <TouchableOpacity onPress={() => openEditModal(item)}>
                <Card style={styles.groupCard} padding="md">
                    <View style={styles.groupHeader}>
                        <View style={[styles.groupIcon, item.image_url ? { backgroundColor: 'transparent' } : null]}>
                            {item.image_url ? (
                                <Avatar
                                    source={item.image_url || undefined}
                                    name={item.name}
                                    size="md"
                                />
                            ) : (
                                <Ionicons name="people" size={24} color={colors.secondary[500]} />
                            )}
                        </View>
                        <View style={styles.groupInfo}>
                            <Text style={styles.groupName}>{item.name}</Text>
                            <Text style={styles.groupMeta}>
                                {item.member_count} {item.member_count === 1 ? 'alumno' : 'alumnos'}
                                {memberNames ? ` • ${memberNames}` : ''}
                            </Text>
                        </View>
                    </View>
                    {item.description && (
                        <Text style={styles.groupDescription}>{item.description}</Text>
                    )}
                </Card>
            </TouchableOpacity>
        );
    };

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <Stack.Screen options={{ title: 'Grupos' }} />
                <ActivityIndicator size="large" color={colors.primary[500]} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: 'Grupos' }} />
            <FlatList
                data={groups}
                renderItem={renderGroupItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyTitle}>No hay grupos</Text>
                        <Text style={styles.emptyText}>Crea tu primer grupo para comenzar.</Text>
                    </View>
                }
            />

            <TouchableOpacity style={styles.fab} onPress={openCreateModal}>
                <Ionicons name="add" size={24} color="white" />
            </TouchableOpacity>

            {/* Create/Edit Modal */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                onRequestClose={closeModalAndGoBack}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>
                            {editingGroup ? 'Editar Grupo' : 'Nuevo Grupo'}
                        </Text>
                        <TouchableOpacity onPress={closeModalAndGoBack} style={{ borderWidth: 0 }}>
                            <Ionicons name="close" size={24} color={colors.neutral[500]} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                        <View style={styles.avatarContainer}>
                            <Avatar
                                source={avatarUri || undefined}
                                name={formData.name || '?'}
                                size="lg"
                                editable
                                onPress={handleAvatarPress}
                            />
                            <Text style={styles.avatarHint}>Tocá para cambiar la foto</Text>
                        </View>

                        <Text style={styles.label}>Nombre del Grupo</Text>
                        <TextInput
                            style={styles.input}
                            value={formData.name}
                            onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                            placeholder="Ej. Grupo Lunes 18hs"
                            placeholderTextColor={colors.neutral[400]}
                        />





                        <Text style={styles.label}>Plan de Pago</Text>
                        <View style={styles.input}>
                            <Picker
                                selectedValue={formData.plan_id || ""}
                                onValueChange={(itemValue) => setFormData(prev => ({
                                    ...prev,
                                    plan_id: itemValue === "" ? null : itemValue
                                }))}
                                style={{ marginVertical: -8 }}
                            >
                                <Picker.Item label="Sin Plan" value="" color={colors.neutral[500]} />
                                {plans?.map(plan => (
                                    <Picker.Item key={plan.id} label={plan.name} value={plan.id} color={colors.neutral[900]} />
                                ))}
                            </Picker>
                        </View>

                        <Text style={styles.label}>Miembros</Text>
                        <View style={{ marginBottom: 16 }}>
                            <TextInput
                                style={styles.input}
                                value={memberSearch}
                                onChangeText={setMemberSearch}
                                placeholder="Buscar alumno..."
                                placeholderTextColor={colors.neutral[400]}
                            />
                        </View>

                        <View style={styles.membersGrid}>
                            {formData.member_ids.map(id => {
                                const player = players?.find(p => p.id === id);
                                if (!player) return null;
                                return (
                                    <TouchableOpacity
                                        key={id}
                                        style={styles.selectedMemberChip}
                                        onPress={() => toggleMember(id)}
                                    >
                                        <Text style={styles.selectedMemberText}>{player.full_name}</Text>
                                        <Ionicons name="close-circle" size={16} color={colors.neutral[500]} />
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {memberSearch.length >= 2 && (
                            <View style={[styles.membersGrid, { marginTop: 8 }]}>
                                {filteredMembers.map(player => (
                                    <TouchableOpacity
                                        key={player.id}
                                        style={styles.memberChip}
                                        onPress={() => {
                                            toggleMember(player.id);
                                            setMemberSearch('');
                                        }}
                                    >
                                        <Text style={styles.memberChipText}>{player.full_name}</Text>
                                        <Ionicons name="add" size={16} color={colors.secondary[500]} />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        <Text style={styles.label}>Descripción</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={formData.description}
                            onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                            placeholder="Notas opcionales..."
                            placeholderTextColor={colors.neutral[400]}
                            numberOfLines={3}
                        />

                        <View style={{ flex: 1 }} />


                        <Button
                            label={editingGroup ? 'Guardar Cambios' : 'Crear Grupo'}
                            onPress={handleSave}
                            loading={createGroup.isPending || updateGroup.isPending || isUploading}
                            style={styles.saveButton}
                        />
                    </ScrollView>
                </View>
            </Modal>

            {/* Success/Error Modal */}
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
    avatarContainer: {
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    avatarHint: {
        marginTop: spacing.xs,
        fontSize: typography.size.xs,
        color: colors.neutral[400],
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
