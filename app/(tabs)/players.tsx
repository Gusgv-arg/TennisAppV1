import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
import { usePlayerMutations } from '@/src/features/players/hooks/usePlayerMutations';
import { usePlayers } from '@/src/features/players/hooks/usePlayers';

type RoleFilter = 'all' | 'player' | 'collaborator' | 'coach';

export default function PlayersScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
    const { data: allPlayers, isLoading, refetch } = usePlayers(searchQuery, showArchived);

    // Filter players by intended_role
    const players = allPlayers?.filter(player => {
        if (roleFilter === 'all') return true;
        return (player.intended_role || 'player') === roleFilter;
    });

    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [reactivateConfirmVisible, setReactivateConfirmVisible] = useState(false);
    const [playerToProcess, setPlayerToProcess] = useState<string | null>(null);

    const { archivePlayer, unarchivePlayer } = usePlayerMutations();

    const handleDeletePress = (id: string) => {
        setPlayerToProcess(id);
        setDeleteConfirmVisible(true);
    };

    const handleReactivatePress = (id: string) => {
        setPlayerToProcess(id);
        setReactivateConfirmVisible(true);
    };

    const handleConfirmDelete = async () => {
        if (playerToProcess) {
            await archivePlayer.mutateAsync(playerToProcess);
            setPlayerToProcess(null);
        }
        setDeleteConfirmVisible(false);
    };

    const handleConfirmReactivate = async () => {
        if (playerToProcess) {
            await unarchivePlayer.mutateAsync(playerToProcess);
            setPlayerToProcess(null);
        }
        setReactivateConfirmVisible(false);
    };

    const getRoleBadge = (intendedRole: string | undefined) => {
        const role = intendedRole || 'player';
        const roleColors: Record<string, { bg: string; text: string }> = {
            coach: { bg: colors.secondary[100], text: colors.secondary[700] },
            collaborator: { bg: colors.primary[100], text: colors.primary[700] },
            player: { bg: colors.neutral[100], text: colors.neutral[600] },
        };
        return roleColors[role] || roleColors.player;
    };

    const renderPlayerItem = ({ item }: { item: any }) => {
        const roleStyle = getRoleBadge(item.intended_role);

        return (
            <Card style={styles.playerCard} padding="md">
                <View style={styles.playerInfo}>
                    <TouchableOpacity
                        onPress={() => router.push(`/players/${item.id}`)}
                        activeOpacity={0.7}
                        style={styles.playerMainInfo}
                    >
                        <View style={styles.playerInfoContent}>
                            <Avatar name={item.full_name} source={item.avatar_url} size="md" />
                            <View style={styles.playerDetails}>
                                <Text style={styles.playerName}>{item.full_name}</Text>
                                <View style={styles.playerMeta}>
                                    <View style={[styles.roleBadge, { backgroundColor: roleStyle.bg }]}>
                                        <Text style={[styles.roleBadgeText, { color: roleStyle.text }]}>
                                            {t(`roles.${item.intended_role || 'player'}`)}
                                        </Text>
                                    </View>
                                    {item.is_archived && (
                                        <View style={styles.archivedBadge}>
                                            <Text style={styles.archivedBadgeText}>{t('archived')}</Text>
                                        </View>
                                    )}
                                    {item.active_subscription?.plan?.name && (
                                        <View style={styles.planBadge}>
                                            <Ionicons name="pricetag-outline" size={10} color={colors.primary[600]} />
                                            <Text style={styles.planBadgeText}>
                                                {item.active_subscription.plan.name}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>
                    </TouchableOpacity>

                    <View style={styles.actionButtons}>
                        <View style={styles.iconRow}>
                            <TouchableOpacity
                                style={styles.actionIconBtn}
                                activeOpacity={0.5}
                                onPress={() => router.push(`/players/${item.id}`)}
                            >
                                <Ionicons name="eye-outline" size={20} color={colors.neutral[300]} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.actionIconBtn}
                                activeOpacity={0.5}
                                onPress={() => router.push(`/players/edit?id=${item.id}`)}
                            >
                                <Ionicons name="create-outline" size={20} color={colors.warning[500]} />
                            </TouchableOpacity>
                            {item.is_archived ? (
                                <TouchableOpacity
                                    style={styles.actionIconBtn}
                                    activeOpacity={0.5}
                                    onPress={() => handleReactivatePress(item.id)}
                                >
                                    <Ionicons name="refresh-outline" size={20} color={colors.primary[500]} />
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    style={styles.actionIconBtn}
                                    activeOpacity={0.5}
                                    onPress={() => handleDeletePress(item.id)}
                                >
                                    <Ionicons name="trash-outline" size={20} color={colors.error[500]} />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            </Card>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Input
                    placeholder={t('searchPlayers')}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    leftIcon={<Ionicons name="search" size={20} color={colors.neutral[400]} />}
                    containerStyle={styles.searchInput}
                />
                <Button
                    label={t('addPlayer')}
                    onPress={() => router.push('/players/new')}
                    size="sm"
                    style={styles.addButton}
                    leftIcon={<Ionicons name="add" size={18} color={colors.common.white} style={{ marginRight: spacing.xs }} />}
                />
            </View>

            {/* Role Filter Tabs */}
            <View style={styles.filterTabs}>
                <TouchableOpacity
                    style={[styles.filterTab, roleFilter === 'all' && styles.activeFilterTab]}
                    onPress={() => setRoleFilter('all')}
                >
                    <Text style={[styles.filterTabText, roleFilter === 'all' && styles.activeFilterTabText]}>
                        Todos
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.filterTab, roleFilter === 'coach' && styles.activeFilterTab]}
                    onPress={() => setRoleFilter('coach')}
                >
                    <Text style={[styles.filterTabText, roleFilter === 'coach' && styles.activeFilterTabText]}>
                        {t('roles.coach')}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.filterTab, roleFilter === 'collaborator' && styles.activeFilterTab]}
                    onPress={() => setRoleFilter('collaborator')}
                >
                    <Text style={[styles.filterTabText, roleFilter === 'collaborator' && styles.activeFilterTabText]}>
                        {t('roles.collaborator')}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.filterTab, roleFilter === 'player' && styles.activeFilterTab]}
                    onPress={() => setRoleFilter('player')}
                >
                    <Text style={[styles.filterTabText, roleFilter === 'player' && styles.activeFilterTabText]}>
                        {t('roles.player')}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Archived Toggle */}
            <View style={styles.archivedToggle}>
                <TouchableOpacity
                    style={styles.archivedCheckbox}
                    onPress={() => setShowArchived(!showArchived)}
                >
                    <Ionicons
                        name={showArchived ? "checkbox" : "square-outline"}
                        size={20}
                        color={showArchived ? colors.primary[500] : colors.neutral[400]}
                    />
                    <Text style={styles.archivedToggleText}>{t('showArchived')}</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={players}
                renderItem={renderPlayerItem}
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
                            <Text style={styles.emptyText}>{t('noPlayersFound')}</Text>
                        </View>
                    ) : null
                }
            />

            <StatusModal
                visible={deleteConfirmVisible}
                type="warning"
                title={t('delete')}
                message={t('deleteConfirm')}
                buttonText={t('delete')}
                showCancel
                onClose={() => setDeleteConfirmVisible(false)}
                onConfirm={handleConfirmDelete}
            />

            <StatusModal
                visible={reactivateConfirmVisible}
                type="warning"
                title={t('reactivate')}
                message={t('reactivateConfirm')}
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
    filterTabs: {
        flexDirection: 'row',
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        gap: spacing.sm,
        backgroundColor: colors.common.white,
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[200],
        paddingBottom: spacing.sm,
    },
    filterTab: {
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.md,
        borderRadius: 20,
        backgroundColor: colors.neutral[100],
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
    archivedToggle: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.common.white,
    },
    archivedCheckbox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    archivedToggleText: {
        fontSize: typography.size.sm,
        color: colors.neutral[600],
    },
    listContent: {
        padding: spacing.md,
        paddingBottom: spacing.xxl,
    },
    playerCard: {
        marginBottom: spacing.sm,
    },
    playerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    playerMainInfo: {
        flex: 1,
    },
    playerInfoContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    playerDetails: {
        flex: 1,
        marginLeft: spacing.md,
    },
    playerName: {
        fontSize: typography.size.md,
        fontWeight: '700',
        color: colors.neutral[900],
    },
    playerMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: 4,
    },
    roleBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: 12,
    },
    roleBadgeText: {
        fontSize: typography.size.xs,
        fontWeight: '600',
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
    planBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary[50],
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: 12,
        gap: 4,
    },
    planBadgeText: {
        fontSize: typography.size.xs,
        fontWeight: '600',
        color: colors.primary[700],
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
});
