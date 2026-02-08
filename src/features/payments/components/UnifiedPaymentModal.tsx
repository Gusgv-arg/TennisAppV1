import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';

import { Button } from '@/src/design/components/Button';
import { Theme } from '@/src/design/theme';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useTheme } from '@/src/hooks/useTheme';
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
    const { theme } = useTheme();
    const styles = React.useMemo(() => createStyles(theme), [theme]);
    const [mode, setMode] = useState<ModalMode>('select');
    const [searchQuery, setSearchQuery] = useState('');
    const [newGroupName, setNewGroupName] = useState('');
    const [contactName, setContactName] = useState('');

    const { width: windowWidth } = useWindowDimensions();
    const isDesktop = windowWidth >= 768;

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
            animationType={isDesktop ? "fade" : "slide"}
            onRequestClose={handleClose}
        >
            <Pressable
                style={[styles.overlay, isDesktop && styles.overlayDesktop]}
                onPress={handleClose}
            >
                <Pressable
                    style={[
                        styles.content,
                        isDesktop && styles.contentDesktop
                    ]}
                    onPress={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <View style={[styles.header, { borderBottomColor: theme.border.subtle }]}>
                        <Text style={[styles.title, { color: theme.text.primary }]}>
                            {mode === 'select' ? 'Vincular a Pago Unificado' : 'Crear Nuevo Grupo'}
                        </Text>
                        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={theme.text.secondary} />
                        </TouchableOpacity>
                    </View>

                    <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
                        Alumno: <Text style={[styles.playerName, { color: theme.text.primary }]}>{playerName}</Text>
                    </Text>

                    {mode === 'select' ? (
                        <>
                            {/* Search */}
                            <View style={[styles.searchContainer, { backgroundColor: theme.background.surface }]}>
                                <Ionicons name="search" size={18} color={theme.text.secondary} />
                                <TextInput
                                    style={[styles.searchInput, { color: theme.text.primary }]}
                                    placeholder="Buscar grupo..."
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    placeholderTextColor={theme.text.tertiary || theme.text.secondary}
                                />
                            </View>

                            {/* Groups List */}
                            <ScrollView style={styles.groupsList}>
                                {isLoadingGroups ? (
                                    <ActivityIndicator size="small" color={theme.components.button.primary.bg} />
                                ) : filteredGroups.length > 0 ? (
                                    filteredGroups.map((group) => (
                                        <TouchableOpacity
                                            key={group.id}
                                            style={[styles.groupItem, { borderBottomColor: theme.border.subtle }]}
                                            onPress={() => handleSelectGroup(group)}
                                            disabled={addMemberToGroup.isPending}
                                        >
                                            <View style={styles.groupItemContent}>
                                                <Ionicons name="people" size={20} color={theme.components.button.primary.bg} />
                                                <View style={styles.groupItemText}>
                                                    <Text style={[styles.groupItemName, { color: theme.text.primary }]}>{group.name}</Text>
                                                    {group.contact_name && (
                                                        <Text style={[styles.groupItemContact, { color: theme.text.secondary }]}>
                                                            Responsable: {group.contact_name}
                                                        </Text>
                                                    )}
                                                </View>
                                            </View>
                                            <Ionicons name="chevron-forward" size={20} color={theme.text.secondary} />
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
                                style={[styles.createNewButton, { borderTopColor: theme.border.subtle }]}
                                onPress={() => setMode('create')}
                            >
                                <Ionicons name="add-circle-outline" size={20} color={theme.components.button.primary.bg} />
                                <Text style={[styles.createNewText, { color: theme.components.button.primary.bg }]}>Crear nuevo grupo</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            {/* Create Form */}
                            <View style={styles.form}>
                                <View style={styles.inputGroup}>
                                    <Text style={[styles.label, { color: theme.text.secondary }]}>Nombre del grupo *</Text>
                                    <TextInput
                                        style={[styles.input, { borderColor: theme.border.default, color: theme.text.primary }]}
                                        placeholder="Ej: Familia Pérez"
                                        value={newGroupName}
                                        onChangeText={setNewGroupName}
                                        placeholderTextColor={theme.text.tertiary || theme.text.secondary}
                                    />
                                </View>

                                <View style={styles.inputGroup}>
                                    <Text style={[styles.label, { color: theme.text.secondary }]}>Responsable de pago</Text>
                                    <TextInput
                                        style={[styles.input, { borderColor: theme.border.default, color: theme.text.primary }]}
                                        placeholder="Ej: Juan Pérez (padre)"
                                        value={contactName}
                                        onChangeText={setContactName}
                                        placeholderTextColor={theme.text.tertiary || theme.text.secondary}
                                    />
                                </View>
                            </View>

                            {/* Actions */}
                            <View style={[styles.actions, { marginBottom: 20, justifyContent: 'center' }]}>
                                <View style={{ width: '100%', maxWidth: 200 }}>
                                    <Button
                                        label="Crear y Vincular"
                                        variant="primary"
                                        onPress={handleCreateGroup}
                                        loading={isCreating}
                                        disabled={!newGroupName.trim()}
                                        style={{ width: '100%' }}
                                    />
                                </View>
                            </View>
                        </>
                    )}
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const createStyles = (theme: Theme) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    overlayDesktop: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        backgroundColor: theme.background.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '80%',
        paddingBottom: spacing.xl,
        width: '100%',
    },
    contentDesktop: {
        width: 450,
        borderRadius: 12,
        maxHeight: '70%',
        paddingBottom: 0,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
        borderBottomWidth: 1,
    },
    title: {
        fontSize: typography.size.lg,
        fontWeight: '700',
    },
    closeButton: {
        padding: spacing.xs,
    },
    subtitle: {
        fontSize: typography.size.sm,
        paddingHorizontal: spacing.md,
        paddingTop: spacing.sm,
    },
    playerName: {
        fontWeight: '600',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
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
    },
    groupItemContact: {
        fontSize: typography.size.xs,
        marginTop: 2,
    },
    emptyList: {
        padding: spacing.xl,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: typography.size.sm,
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
    },
    createNewText: {
        fontSize: typography.size.sm,
        fontWeight: '600',
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
    },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        padding: spacing.sm,
        fontSize: typography.size.sm,
    },
    actions: {
        flexDirection: 'row',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        marginTop: spacing.md,
    },
});
