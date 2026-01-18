import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Button } from '@/src/design/components/Button';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import type { UnifiedPaymentGroup } from '@/src/types/payments';
import { useUnifiedPaymentGroupMutations, useUnifiedPaymentGroups } from '../hooks/useUnifiedPaymentGroups';

interface UnifiedPaymentModalProps {
    visible: boolean;
    onClose: () => void;
    playerId: string;
    playerName: string;
}

type ModalMode = 'select' | 'create';

/**
 * Modal para vincular un alumno a un grupo de pago unificado
 * Permite seleccionar un grupo existente o crear uno nuevo
 */
export default function UnifiedPaymentModal({
    visible,
    onClose,
    playerId,
    playerName
}: UnifiedPaymentModalProps) {
    const [mode, setMode] = useState<ModalMode>('select');
    const [searchQuery, setSearchQuery] = useState('');
    const [newGroupName, setNewGroupName] = useState('');
    const [contactName, setContactName] = useState('');

    const { data: groups, isLoading: isLoadingGroups } = useUnifiedPaymentGroups();
    const { createGroup, addMemberToGroup } = useUnifiedPaymentGroupMutations();

    const filteredGroups = groups?.filter(g =>
        g.name.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    const handleSelectGroup = async (group: UnifiedPaymentGroup) => {
        try {
            await addMemberToGroup.mutateAsync({ playerId, groupId: group.id });
            handleClose();
        } catch (error) {
            console.error('Error adding to group:', error);
        }
    };

    const handleCreateGroup = async () => {
        if (!newGroupName.trim()) return;

        try {
            const newGroup = await createGroup.mutateAsync({
                name: newGroupName.trim(),
                contact_name: contactName.trim() || undefined,
            });

            // Agregar el alumno al grupo recién creado
            await addMemberToGroup.mutateAsync({ playerId, groupId: newGroup.id });
            handleClose();
        } catch (error) {
            console.error('Error creating group:', error);
        }
    };

    const handleClose = () => {
        setMode('select');
        setSearchQuery('');
        setNewGroupName('');
        setContactName('');
        onClose();
    };

    const isCreating = createGroup.isPending || addMemberToGroup.isPending;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={handleClose}
        >
            <Pressable style={styles.overlay} onPress={handleClose}>
                <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>
                            {mode === 'select' ? 'Vincular a Pago Unificado' : 'Crear Nuevo Grupo'}
                        </Text>
                        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={colors.neutral[500]} />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.subtitle}>
                        Alumno: <Text style={styles.playerName}>{playerName}</Text>
                    </Text>

                    {mode === 'select' ? (
                        <>
                            {/* Search */}
                            <View style={styles.searchContainer}>
                                <Ionicons name="search" size={18} color={colors.neutral[400]} />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Buscar grupo..."
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    placeholderTextColor={colors.neutral[400]}
                                />
                            </View>

                            {/* Groups List */}
                            <ScrollView style={styles.groupsList}>
                                {isLoadingGroups ? (
                                    <ActivityIndicator size="small" color={colors.primary[500]} />
                                ) : filteredGroups.length > 0 ? (
                                    filteredGroups.map((group) => (
                                        <TouchableOpacity
                                            key={group.id}
                                            style={styles.groupItem}
                                            onPress={() => handleSelectGroup(group)}
                                            disabled={addMemberToGroup.isPending}
                                        >
                                            <View style={styles.groupItemContent}>
                                                <Ionicons name="people" size={20} color={colors.primary[500]} />
                                                <View style={styles.groupItemText}>
                                                    <Text style={styles.groupItemName}>{group.name}</Text>
                                                    {group.contact_name && (
                                                        <Text style={styles.groupItemContact}>
                                                            Responsable: {group.contact_name}
                                                        </Text>
                                                    )}
                                                </View>
                                            </View>
                                            <Ionicons name="chevron-forward" size={20} color={colors.neutral[400]} />
                                        </TouchableOpacity>
                                    ))
                                ) : (
                                    <View style={styles.emptyList}>
                                        <Text style={styles.emptyText}>
                                            {searchQuery ? 'No se encontraron grupos' : 'No hay grupos creados'}
                                        </Text>
                                    </View>
                                )}
                            </ScrollView>

                            {/* Create New Button */}
                            <TouchableOpacity
                                style={styles.createNewButton}
                                onPress={() => setMode('create')}
                            >
                                <Ionicons name="add-circle-outline" size={20} color={colors.primary[500]} />
                                <Text style={styles.createNewText}>Crear nuevo grupo</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            {/* Create Form */}
                            <View style={styles.form}>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Nombre del grupo *</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Ej: Familia Pérez"
                                        value={newGroupName}
                                        onChangeText={setNewGroupName}
                                        placeholderTextColor={colors.neutral[400]}
                                    />
                                </View>

                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Responsable de pago</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Ej: Juan Pérez (padre)"
                                        value={contactName}
                                        onChangeText={setContactName}
                                        placeholderTextColor={colors.neutral[400]}
                                    />
                                </View>
                            </View>

                            {/* Actions */}
                            <View style={styles.actions}>
                                <Button
                                    label="Cancelar"
                                    variant="outline"
                                    onPress={() => setMode('select')}
                                    disabled={isCreating}
                                    style={{ flex: 1 }}
                                />
                                <Button
                                    label="Crear y Vincular"
                                    variant="primary"
                                    onPress={handleCreateGroup}
                                    loading={isCreating}
                                    disabled={!newGroupName.trim()}
                                    style={{ flex: 1 }}
                                />
                            </View>
                        </>
                    )}
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    content: {
        backgroundColor: colors.common.white,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '80%',
        paddingBottom: spacing.xl,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[200],
    },
    title: {
        fontSize: typography.size.lg,
        fontWeight: '700',
        color: colors.neutral[900],
    },
    closeButton: {
        padding: spacing.xs,
    },
    subtitle: {
        fontSize: typography.size.sm,
        color: colors.neutral[600],
        paddingHorizontal: spacing.md,
        paddingTop: spacing.sm,
    },
    playerName: {
        fontWeight: '600',
        color: colors.neutral[800],
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.neutral[100],
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
        paddingHorizontal: spacing.md,
        borderRadius: 10,
    },
    searchInput: {
        flex: 1,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        fontSize: typography.size.sm,
        color: colors.neutral[900],
    },
    groupsList: {
        maxHeight: 300,
        paddingHorizontal: spacing.md,
        marginTop: spacing.sm,
    },
    groupItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[100],
    },
    groupItemContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        flex: 1,
    },
    groupItemText: {
        flex: 1,
    },
    groupItemName: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        color: colors.neutral[800],
    },
    groupItemContact: {
        fontSize: typography.size.xs,
        color: colors.neutral[500],
        marginTop: 2,
    },
    emptyList: {
        padding: spacing.xl,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: typography.size.sm,
        color: colors.neutral[500],
    },
    createNewButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.md,
        marginHorizontal: spacing.md,
        marginTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.neutral[200],
    },
    createNewText: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        color: colors.primary[500],
    },
    form: {
        padding: spacing.md,
        gap: spacing.md,
    },
    inputGroup: {
        gap: spacing.xs,
    },
    label: {
        fontSize: typography.size.xs,
        fontWeight: '600',
        color: colors.neutral[600],
    },
    input: {
        borderWidth: 1,
        borderColor: colors.neutral[300],
        borderRadius: 8,
        padding: spacing.sm,
        fontSize: typography.size.sm,
        color: colors.neutral[900],
    },
    actions: {
        flexDirection: 'row',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        marginTop: spacing.md,
    },
});
