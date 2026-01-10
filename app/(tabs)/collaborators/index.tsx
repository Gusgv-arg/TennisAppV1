import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import StatusModal from '@/src/components/StatusModal';
import { Avatar } from '@/src/design/components/Avatar';
import { Button } from '@/src/design/components/Button';
import { Card } from '@/src/design/components/Card';
import { Input } from '@/src/design/components/Input';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useCollaboratorMutations } from '@/src/features/collaborators/hooks/useCollaboratorMutations';
import { useCollaborators } from '@/src/features/collaborators/hooks/useCollaborators';

export default function CollaboratorsScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    const { data: collaborators, isLoading, refetch } = useCollaborators(searchQuery, showArchived);
    const { data: archivedCollaborators } = useCollaborators('', true); // Get archived count

    const archivedCount = archivedCollaborators?.length || 0;

    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [reactivateConfirmVisible, setReactivateConfirmVisible] = useState(false);
    const [itemToProcess, setItemToProcess] = useState<string | null>(null);

    const { toggleCollaboratorActive, deleteCollaborator } = useCollaboratorMutations();

    const handleDeletePress = (id: string) => {
        setItemToProcess(id);
        setDeleteConfirmVisible(true);
    };

    const handleReactivatePress = (id: string) => {
        setItemToProcess(id);
        setReactivateConfirmVisible(true);
    };

    const handleConfirmDelete = async () => {
        if (itemToProcess) {
            await toggleCollaboratorActive.mutateAsync({ id: itemToProcess, is_active: false });
            setItemToProcess(null);
        }
        setDeleteConfirmVisible(false);
    };

    const handleConfirmReactivate = async () => {
        if (itemToProcess) {
            await toggleCollaboratorActive.mutateAsync({ id: itemToProcess, is_active: true });
            setItemToProcess(null);
        }
        setReactivateConfirmVisible(false);
    };

    const getRoleInfo = (intendedRole: string | undefined) => {
        const role = intendedRole || 'collaborator';
        const roles: Record<string, { bg: string; text: string; icon: keyof typeof Ionicons.glyphMap; label: string }> = {
            coach: { bg: colors.secondary[100], text: colors.secondary[700], icon: 'school-outline', label: 'Coach' },
            collaborator: { bg: colors.primary[100], text: colors.primary[700], icon: 'school-outline', label: 'Colaborador' },
        };
        return roles[role] || roles.collaborator;
    };

    const renderItem = ({ item }: { item: any }) => {
        const roleInfo = getRoleInfo(item.intended_role);

        return (
            <Card style={styles.itemCard} padding="md">
                <TouchableOpacity
                    onPress={() => router.push(`/collaborators/${item.id}` as any)}
                    activeOpacity={0.7}
                    style={styles.itemContent}
                >
                    <Avatar name={item.full_name} source={item.avatar_url} size="lg" />
                    <View style={styles.itemDetails}>
                        <Text style={styles.itemName}>{item.full_name}</Text>
                        <View style={styles.itemMeta}>
                            <View style={[styles.roleBadge, { backgroundColor: roleInfo.bg }]}>
                                <Ionicons name={roleInfo.icon} size={12} color={roleInfo.text} />
                                <Text style={[styles.roleBadgeText, { color: roleInfo.text }]}>
                                    {roleInfo.label}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.actionButtons}>
                        {!showArchived ? (
                            <>
                                <TouchableOpacity
                                    style={styles.actionIconBtn}
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        router.push(`/collaborators/${item.id}` as any);
                                    }}
                                >
                                    <Ionicons name="eye-outline" size={22} color={colors.primary[500]} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.actionIconBtn}
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        router.push(`/collaborators/edit?id=${item.id}` as any);
                                    }}
                                >
                                    <Ionicons name="create-outline" size={22} color={colors.primary[500]} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.actionIconBtn}
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        handleDeletePress(item.id);
                                    }}
                                >
                                    <Ionicons name="trash-outline" size={22} color={colors.error[500]} />
                                </TouchableOpacity>
                            </>
                        ) : (
                            <TouchableOpacity
                                style={styles.actionIconBtn}
                                onPress={(e) => {
                                    e.stopPropagation();
                                    handleReactivatePress(item.id);
                                }}
                            >
                                <Ionicons name="refresh-outline" size={22} color={colors.success[500]} />
                            </TouchableOpacity>
                        )}
                    </View>
                </TouchableOpacity>
            </Card>
        );
    };

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    headerTitle: () => (
                        <View style={styles.headerTitleContainer}>
                            <Ionicons name="school" size={24} color={colors.primary[500]} style={{ marginRight: spacing.sm }} />
                            <Text style={styles.headerTitleText}>Colaboradores</Text>
                        </View>
                    ),
                    headerTitleAlign: 'left',
                    headerLeft: () => null,
                    headerShown: true,
                }}
            />

            {/* Description Section */}
            <View style={styles.descriptionSection}>
                <Text style={styles.descriptionText}>
                    Gestiona los coaches y colaboradores de tu academia
                </Text>
            </View>

            {/* Search and Add */}
            <View style={styles.header}>
                <View style={styles.searchBar}>
                    <Input
                        placeholder="Buscar colaborador..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        leftIcon={<Ionicons name="search" size={20} color={colors.neutral[400]} />}
                        style={styles.searchInput}
                        containerStyle={{ marginBottom: 0 }}
                        size="sm"
                    />
                </View>
                <Button
                    label="Nuevo"
                    leftIcon={<Ionicons name="add" size={20} color={colors.common.white} />}
                    onPress={() => router.push('/collaborators/new' as any)}
                    style={styles.addButton}
                    size="sm"
                    shadow
                />
            </View>

            {/* Filters */}
            <View style={styles.filterContainer}>
                <TouchableOpacity
                    style={[styles.filterTab, !showArchived && styles.activeFilterTab]}
                    onPress={() => setShowArchived(false)}
                >
                    <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={!showArchived ? colors.common.white : colors.neutral[400]}
                    />
                    <Text style={[styles.filterTabText, !showArchived && styles.activeFilterTabText]}>
                        Activos
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.filterTab, showArchived && styles.activeFilterTab]}
                    onPress={() => setShowArchived(true)}
                >
                    <Ionicons
                        name="archive"
                        size={16}
                        color={showArchived ? colors.common.white : colors.neutral[400]}
                    />
                    <Text style={[styles.filterTabText, showArchived && styles.activeFilterTabText]}>
                        Archivados
                    </Text>
                    {archivedCount > 0 && (
                        <View style={styles.countBadge}>
                            <Text style={styles.countBadgeText}>{archivedCount}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {/* List */}
            <FlatList
                data={collaborators}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary[500]} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <View style={styles.emptyIcon}>
                            <Ionicons name="people-outline" size={48} color={colors.neutral[300]} />
                        </View>
                        <Text style={styles.emptyText}>
                            {showArchived ? 'No hay colaboradores archivados' : 'No hay colaboradores'}
                        </Text>
                        <Text style={styles.emptySubtext}>
                            {showArchived
                                ? 'Los colaboradores archivados aparecerán aquí'
                                : 'Agrega coaches o colaboradores para tu academia'
                            }
                        </Text>
                        {!showArchived && (
                            <Button
                                label="Agregar Colaborador"
                                onPress={() => router.push('/collaborators/new' as any)}
                                style={styles.emptyButton}
                                variant="outline"
                                size="sm"
                            />
                        )}
                    </View>
                }
            />

            <StatusModal
                visible={deleteConfirmVisible}
                type="warning"
                title="Archivar colaborador"
                message="¿Estás seguro de que deseas archivar este colaborador?"
                onClose={() => setDeleteConfirmVisible(false)}
                onConfirm={handleConfirmDelete}
                showCancel
            />

            <StatusModal
                visible={reactivateConfirmVisible}
                type="success"
                title="Reactivar colaborador"
                message="¿Deseas reactivar este colaborador?"
                onClose={() => setReactivateConfirmVisible(false)}
                onConfirm={handleConfirmReactivate}
                showCancel
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.neutral[50],
    },
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitleText: {
        fontSize: typography.size.lg,
        fontWeight: '700',
        color: colors.neutral[900],
    },
    descriptionSection: {
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
        backgroundColor: colors.common.white,
    },
    descriptionText: {
        fontSize: typography.size.sm,
        color: colors.neutral[500],
    },
    header: {
        flexDirection: 'row',
        padding: spacing.md,
        paddingBottom: spacing.sm,
        gap: spacing.sm,
        alignItems: 'center',
    },
    searchBar: {
        flex: 1,
    },
    searchInput: {
        backgroundColor: colors.common.white,
    },
    addButton: {
        paddingHorizontal: spacing.md,
        backgroundColor: colors.primary[500],
    },
    filterContainer: {
        flexDirection: 'row',
        paddingHorizontal: spacing.md,
        marginBottom: spacing.sm,
        gap: spacing.md,
    },
    filterTab: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        backgroundColor: colors.neutral[200],
    },
    activeFilterTab: {
        backgroundColor: colors.primary[500],
    },
    filterTabText: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        color: colors.neutral[600],
    },
    activeFilterTabText: {
        color: colors.common.white,
    },
    listContent: {
        padding: spacing.md,
        paddingTop: spacing.xs,
    },
    itemCard: {
        marginBottom: spacing.sm,
    },
    itemContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    itemDetails: {
        flex: 1,
        marginLeft: spacing.md,
    },
    itemName: {
        fontSize: typography.size.md,
        fontWeight: '600',
        color: colors.neutral[900],
        marginBottom: spacing.xs,
    },
    itemMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        flexWrap: 'wrap',
    },
    roleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 12,
    },
    roleBadgeText: {
        fontSize: typography.size.xs,
        fontWeight: '600',
    },
    actionButtons: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionIconBtn: {
        padding: spacing.sm,
        marginLeft: spacing.xs,
    },
    emptyContainer: {
        marginTop: spacing.xxl,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
    },
    emptyIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.neutral[100],
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    emptyText: {
        fontSize: typography.size.md,
        color: colors.neutral[600],
        fontWeight: '600',
        marginBottom: spacing.xs,
    },
    emptySubtext: {
        fontSize: typography.size.sm,
        color: colors.neutral[400],
        textAlign: 'center',
        marginBottom: spacing.lg,
    },
    emptyButton: {
        minWidth: 180,
    },
    countBadge: {
        backgroundColor: colors.primary[500],
        borderRadius: 10,
        paddingHorizontal: 4,
        height: 14,
        minWidth: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: spacing.xs,
    },
    countBadgeText: {
        color: colors.common.white,
        fontSize: 9,
        fontWeight: '800',
        lineHeight: 12,
    },
});
