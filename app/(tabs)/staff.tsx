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
import { useStaffMembers } from '@/src/features/staff/hooks/useStaff';
import { useStaffMutations } from '@/src/features/staff/hooks/useStaffMutations';
import { StaffMember } from '@/src/types/staff';

export default function StaffScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    const { data: collaborators, isLoading, refetch } = useStaffMembers(searchQuery, showArchived);

    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [reactivateConfirmVisible, setReactivateConfirmVisible] = useState(false);
    const [staffToProcess, setStaffToProcess] = useState<string | null>(null);

    const { deleteStaffMember, toggleStaffActive } = useStaffMutations();

    const handleDeletePress = (id: string) => {
        setStaffToProcess(id);
        setDeleteConfirmVisible(true);
    };

    const handleReactivatePress = (id: string) => {
        setStaffToProcess(id);
        setReactivateConfirmVisible(true);
    };

    const handleConfirmDelete = async () => {
        if (staffToProcess) {
            await toggleStaffActive.mutateAsync({ id: staffToProcess, is_active: false });
            setStaffToProcess(null);
        }
        setDeleteConfirmVisible(false);
    };

    const handleConfirmReactivate = async () => {
        if (staffToProcess) {
            await toggleStaffActive.mutateAsync({ id: staffToProcess, is_active: true });
            setStaffToProcess(null);
        }
        setReactivateConfirmVisible(false);
    };

    const renderCollaboratorItem = ({ item }: { item: StaffMember }) => (
        <Card style={styles.card} padding="md">
            <View style={styles.staffInfo}>
                <TouchableOpacity
                    onPress={() => router.push(`/staff/${item.id}` as any)}
                    activeOpacity={0.7}
                    style={styles.mainInfo}
                >
                    <View style={styles.infoContent}>
                        <Avatar name={item.full_name} size="md" />
                        <View style={styles.details}>
                            <Text style={styles.name}>{item.full_name}</Text>
                            <View style={styles.meta}>
                                <Text style={styles.metaText}>{item.email || t('collaborators')}</Text>
                                {!item.is_active && (
                                    <View style={styles.archivedBadge}>
                                        <Text style={styles.archivedBadgeText}>{t('archived')}</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>
                </TouchableOpacity>

                <View style={styles.actionButtons}>
                    <View style={styles.iconRow}>
                        <View
                            // @ts-ignore - title attribute for web hover tooltip
                            title={t('viewDetails')}
                        >
                            <TouchableOpacity
                                style={styles.actionIconBtn}
                                activeOpacity={0.5}
                                onPress={() => router.push(`/staff/${item.id}` as any)}
                                accessibilityLabel={t('viewDetails')}
                            >
                                <Ionicons name="eye-outline" size={20} color={colors.neutral[300]} />
                            </TouchableOpacity>
                        </View>
                        <View
                            // @ts-ignore - title attribute for web hover tooltip
                            title={t('editCollaborator')}
                        >
                            <TouchableOpacity
                                style={styles.actionIconBtn}
                                activeOpacity={0.5}
                                onPress={() => router.push(`/staff/edit?id=${item.id}` as any)}
                                accessibilityLabel={t('editCollaborator')}
                            >
                                <Ionicons name="create-outline" size={20} color={colors.warning[500]} />
                            </TouchableOpacity>
                        </View>
                        {!item.is_active ? (
                            <View
                                // @ts-ignore - title attribute for web hover tooltip
                                title={t('reactivate')}
                            >
                                <TouchableOpacity
                                    style={styles.actionIconBtn}
                                    activeOpacity={0.5}
                                    onPress={() => handleReactivatePress(item.id)}
                                    accessibilityLabel={t('reactivate')}
                                >
                                    <Ionicons name="refresh-outline" size={20} color={colors.primary[500]} />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View
                                // @ts-ignore - title attribute for web hover tooltip
                                title={t('archive')}
                            >
                                <TouchableOpacity
                                    style={styles.actionIconBtn}
                                    activeOpacity={0.5}
                                    onPress={() => handleDeletePress(item.id)}
                                    accessibilityLabel={t('archive')}
                                >
                                    <Ionicons name="trash-outline" size={20} color={colors.error[500]} />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </View>
        </Card>
    );

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: t('collaborators'), headerTitleAlign: 'center' }} />

            <View style={styles.header}>
                <Input
                    placeholder={t('searchCollaborators')}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    leftIcon={<Ionicons name="search" size={20} color={colors.neutral[400]} />}
                    containerStyle={styles.searchInput}
                />
                <Button
                    label={t('addCollaborator')}
                    onPress={() => router.push('/staff/new')}
                    size="sm"
                    style={styles.addButton}
                    leftIcon={<Ionicons name="add" size={18} color={colors.common.white} style={{ marginRight: spacing.xs }} />}
                />
            </View>

            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tab, !showArchived && styles.activeTab]}
                    onPress={() => setShowArchived(false)}
                >
                    <Text style={[styles.tabText, !showArchived && styles.activeTabText]}>{t('activeCollaborators')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, showArchived && styles.activeTab]}
                    onPress={() => setShowArchived(true)}
                >
                    <Text style={[styles.tabText, showArchived && styles.activeTabText]}>{t('archivedCollaborators')}</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={collaborators}
                renderItem={renderCollaboratorItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary[500]} />
                }
                ListEmptyComponent={
                    !isLoading ? (
                        <View style={styles.emptyContainer}>
                            <Ionicons
                                name={showArchived ? "archive-outline" : "people-outline"}
                                size={64}
                                color={colors.neutral[300]}
                            />
                            <Text style={styles.emptyText}>{t('noCollaborators')}</Text>
                        </View>
                    ) : null
                }
            />

            <StatusModal
                visible={deleteConfirmVisible}
                type="warning"
                title={t('archive')}
                message={t('archiveCollaboratorConfirm')}
                buttonText={t('archive')}
                showCancel
                onClose={() => setDeleteConfirmVisible(false)}
                onConfirm={handleConfirmDelete}
            />

            <StatusModal
                visible={reactivateConfirmVisible}
                type="warning"
                title={t('reactivate')}
                message={t('reactivateCollaboratorConfirm')}
                buttonText={t('confirm')}
                showCancel
                onClose={() => setReactivateConfirmVisible(false)}
                onConfirm={handleConfirmReactivate}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.neutral[50],
    },
    header: {
        padding: spacing.md,
        backgroundColor: colors.common.white,
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[200],
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    searchInput: {
        flex: 1,
        marginBottom: 0,
    },
    addButton: {
        height: 48,
        paddingHorizontal: spacing.md,
    },
    tabs: {
        flexDirection: 'row',
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        gap: spacing.md,
    },
    tab: {
        paddingVertical: spacing.xs,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    activeTab: {
        borderBottomColor: colors.primary[500],
    },
    tabText: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        color: colors.neutral[500],
    },
    activeTabText: {
        color: colors.primary[500],
    },
    listContent: {
        padding: spacing.md,
        paddingBottom: spacing.xxl,
    },
    card: {
        marginBottom: spacing.sm,
    },
    staffInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    mainInfo: {
        flex: 1,
    },
    infoContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    details: {
        flex: 1,
        marginLeft: spacing.md,
    },
    name: {
        fontSize: typography.size.md,
        fontWeight: '700',
        color: colors.neutral[900],
    },
    meta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: 2,
    },
    metaText: {
        fontSize: typography.size.sm,
        color: colors.neutral[500],
    },
    archivedBadge: {
        backgroundColor: colors.neutral[100],
        paddingHorizontal: spacing.xs,
        paddingVertical: 2,
        borderRadius: 4,
    },
    archivedBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: colors.neutral[500],
        textTransform: 'uppercase',
    },
    actionButtons: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        marginLeft: spacing.sm,
    },
    iconRow: {
        flexDirection: 'row',
        gap: spacing.xs,
    },
    actionIconBtn: {
        padding: spacing.xs,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: spacing.xxl,
    },
    emptyText: {
        marginTop: spacing.md,
        fontSize: typography.size.md,
        color: colors.neutral[500],
        fontWeight: '500',
    },
});
