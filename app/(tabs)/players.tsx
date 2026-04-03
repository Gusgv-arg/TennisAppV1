import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Player } from '@/src/types/player';

import { showError, showSuccess } from '@/src/utils/toast';

import GroupModal from '@/src/components/GroupModal';
import { PermissionGate } from '@/src/components/PermissionGate';
import PlayerModal from '@/src/components/PlayerModal';
import StatusModal from '@/src/components/StatusModal';
import { Avatar } from '@/src/design/components/Avatar';
import { Card } from '@/src/design/components/Card';
import { Theme } from '@/src/design/theme';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { colors } from '@/src/design/tokens/colors';
import { useUserAcademies } from '@/src/features/academy/hooks/useAcademy';
import { useClassGroupMutations, useClassGroups } from '@/src/features/calendar/hooks/useClassGroups';
import { useSessionMutations } from '@/src/features/calendar/hooks/useSessions';
import { usePlayerMutations } from '@/src/features/players/hooks/usePlayerMutations';
import { usePlayers } from '@/src/features/players/hooks/usePlayers';
import { PlayerSafetyResult, usePlayerSafetyCheck } from '@/src/features/players/hooks/usePlayerSafetyCheck';
import { useTheme } from '@/src/hooks/useTheme';
import { useViewStore } from '@/src/store/useViewStore';
import { ClassGroup } from '@/src/types/classGroups';

export default function PlayersScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const { theme } = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const [activeTab, setActiveTab] = useState<'players' | 'groups' | 'no_plan' | 'archived'>('players');
    const [searchQuery, setSearchQuery] = useState('');
    const [groupSearchQuery, setGroupSearchQuery] = useState('');
    const { viewPlayerId } = useLocalSearchParams<{ viewPlayerId: string }>();
    const insets = useSafeAreaInsets();
    const { isGlobalView } = useViewStore();
    const { data: academiesData } = useUserAcademies();
    const allAcademies = academiesData ? [...(academiesData.active || []), ...(academiesData.archived || [])] : [];

    // Player Modal State
    const [playerModalVisible, setPlayerModalVisible] = useState(false);
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
    const [playerModalMode, setPlayerModalMode] = useState<'view' | 'edit' | 'create'>('view');

    // Group Modal State
    const [groupModalVisible, setGroupModalVisible] = useState(false);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [groupModalMode, setGroupModalMode] = useState<'view' | 'edit' | 'create'>('view');

    useEffect(() => {
        if (viewPlayerId) {
            handleViewPlayer(viewPlayerId);
        }
    }, [viewPlayerId]);

    const handleViewPlayer = (id: string) => {
        setSelectedPlayerId(id);
        setPlayerModalMode('view');
        setPlayerModalVisible(true);
    };

    const handleEditPlayer = (id: string) => {
        setSelectedPlayerId(id);
        setPlayerModalMode('edit');
        setPlayerModalVisible(true);
    };

    const handleCreatePlayer = () => {
        setSelectedPlayerId(null);
        setPlayerModalMode('create');
        setPlayerModalVisible(true);
    };

    const handlePlayerCreated = (player: any, hasPlan: boolean) => {
        handleRefetch();
        setActiveTab('players');
    };

    const handlePlayerUpdated = () => {
        handleRefetch();
    };

    const {
        data: allActivePlayers,
        isLoading: isLoadingActivePlayers,
        refetch: refetchActive
    } = usePlayers('', 'active');

    const {
        data: archivedPlayers,
        isLoading: isLoadingArchived,
        refetch: refetchArchived
    } = usePlayers('', 'archived');

    // Class Groups
    const { data: activeGroups, isLoading: isLoadingGroups, refetch: refetchGroups } = useClassGroups('active');
    const { data: archivedGroups, isLoading: isLoadingArchivedGroups, refetch: refetchArchivedGroups } = useClassGroups('archived');

    const { deleteGroup, archiveGroup, unarchiveGroup } = useClassGroupMutations();

    // Counts
    const groupsCount = activeGroups?.length || 0;
    const activeCount = useMemo(() => {
        return allActivePlayers?.filter((p: any) => p.has_plan).length || 0;
    }, [allActivePlayers]);

    const archivedCount = (archivedPlayers?.length || 0) + (archivedGroups?.length || 0);
    const noPlanCount = useMemo(() => {
        return allActivePlayers?.filter((p: any) => !p.has_plan).length || 0;
    }, [allActivePlayers]);

    // Derived state: Filtered List for Display
    const filteredData = useMemo(() => {
        let players = (activeTab === 'archived' ? archivedPlayers : allActivePlayers) || [];
        let groups: ClassGroup[] = [];

        if (activeTab === 'groups') {
            groups = (activeGroups || []).filter(g => g.plan_id || !g.plan_id);
        } else if (activeTab === 'archived') {
            groups = archivedGroups || [];
        }

        if (activeTab === 'players') {
            players = players.filter((p: any) => p.has_plan);
        } else if (activeTab === 'no_plan') {
            players = players.filter((p: any) => !p.has_plan);
        } else if (activeTab === 'groups') {
            players = [];
        }

        let combinedData: any[] = [];
        if (activeTab === 'players') {
            combinedData = players;
        } else if (activeTab === 'groups') {
            combinedData = groups;
        } else {
            combinedData = [...groups, ...players];
        }

        const query = activeTab === 'groups' ? groupSearchQuery : searchQuery;
        if (query) {
            const lowerQuery = query.toLowerCase();
            combinedData = combinedData.filter(item => {
                const name = item.full_name || item.name || '';
                return name.toLowerCase().includes(lowerQuery);
            });
        }

        return [...combinedData].sort((a, b) => {
            const nameA = a.full_name || a.name || '';
            const nameB = b.full_name || b.name || '';
            return nameA.localeCompare(nameB);
        });

    }, [activeTab, searchQuery, groupSearchQuery, allActivePlayers, archivedPlayers, activeGroups, archivedGroups]);

    const isLoading = activeTab === 'archived' ? (isLoadingArchived || isLoadingArchivedGroups) :
        activeTab === 'groups' ? isLoadingGroups :
            activeTab === 'no_plan' ? isLoadingActivePlayers :
                isLoadingActivePlayers;

    const handleRefetch = () => {
        refetchActive();
        refetchArchived();
        refetchGroups();
        refetchArchivedGroups();
    };

    const { archivePlayer, unarchivePlayer, deletePlayer } = usePlayerMutations();
    const { removePlayersFromSessionsBulk } = useSessionMutations();
    const checkPlayerSafety = usePlayerSafetyCheck();

    const [safetyResult, setSafetyResult] = useState<PlayerSafetyResult | null>(null);
    const [isCheckingPlayer, setIsCheckingPlayer] = useState(false);
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [reactivateConfirmVisible, setReactivateConfirmVisible] = useState(false);
    const [playerToProcess, setPlayerToProcess] = useState<string | null>(null);

    const [groupToArchive, setGroupToArchive] = useState<ClassGroup | null>(null);
    const [groupToRestore, setGroupToRestore] = useState<ClassGroup | null>(null);
    const [archiveGroupConfirmVisible, setArchiveGroupConfirmVisible] = useState(false);
    const [restoreGroupConfirmVisible, setRestoreGroupConfirmVisible] = useState(false);

    const [permanentDeletePlayerVisible, setPermanentDeletePlayerVisible] = useState(false);
    const [playerToDelete, setPlayerToDelete] = useState<string | null>(null);
    const [permanentDeleteGroupVisible, setPermanentDeleteGroupVisible] = useState(false);
    const [groupToDelete, setGroupToDelete] = useState<ClassGroup | null>(null);

    const handleDeletePress = async (id: string) => {
        setPlayerToProcess(id);
        setIsCheckingPlayer(true);
        try {
            const result = await checkPlayerSafety.mutateAsync(id);
            setSafetyResult(result);
            setDeleteConfirmVisible(true);
        } catch (error: any) {
            showError(t('error'), error.message || t('errorOccurred'));
            setPlayerToProcess(null);
        } finally {
            setIsCheckingPlayer(false);
        }
    };

    const handleReactivatePress = (id: string) => {
        setPlayerToProcess(id);
        setReactivateConfirmVisible(true);
    };

    const handleConfirmDelete = async (removeFromSessions: boolean = false) => {
        if (playerToProcess) {
            try {
                if (removeFromSessions && safetyResult?.futureSessionCount && safetyResult.futureSessionCount > 0) {
                    await removePlayersFromSessionsBulk.mutateAsync({
                        sessionIds: safetyResult.futureSessionIds,
                        playerIds: [playerToProcess]
                    });
                }

                await archivePlayer.mutateAsync(playerToProcess);
                showSuccess(t('success'), t('players.notifications.archivedSuccess'));
                handleRefetch();
            } catch (error: any) {
                showError(t('error'), error.message || t('errorOccurred'));
            }
            setPlayerToProcess(null);
            setSafetyResult(null);
        }
        setDeleteConfirmVisible(false);
    };

    const handleConfirmReactivate = async () => {
        if (playerToProcess) {
            try {
                await unarchivePlayer.mutateAsync(playerToProcess);
                showSuccess(t('success'), t('players.notifications.reactivatedSuccess'));
                handleRefetch();
            } catch (error: any) {
                showError(t('error'), error.message || t('errorOccurred'));
            }
            setPlayerToProcess(null);
        }
        setReactivateConfirmVisible(false);
    };

    const handleCloseDeleteConfirm = () => {
        setDeleteConfirmVisible(false);
        setPlayerToProcess(null);
        setSafetyResult(null);
    };

    const handleEditGroup = (group: ClassGroup) => {
        setSelectedGroupId(group.id);
        setGroupModalMode('edit');
        setGroupModalVisible(true);
    };

    const handleCreateGroup = () => {
        setSelectedGroupId(null);
        setGroupModalMode('create');
        setGroupModalVisible(true);
    };

    const handleArchiveGroupPress = (group: ClassGroup) => {
        setGroupToArchive(group);
        setArchiveGroupConfirmVisible(true);
    };

    const handleRestoreGroupPress = (group: ClassGroup) => {
        setGroupToRestore(group);
        setRestoreGroupConfirmVisible(true);
    };

    const handleConfirmArchiveGroup = async () => {
        if (groupToArchive) {
            try {
                await archiveGroup.mutateAsync(groupToArchive.id);
                showSuccess(t('success'), t('players.notifications.groupArchivedSuccess'));
                handleRefetch();
            } catch (error: any) {
                showError(t('error') || "Error", error.message || t('errorOccurred'));
            }
            setGroupToArchive(null);
        }
        setArchiveGroupConfirmVisible(false);
    };

    const handleConfirmRestoreGroup = async () => {
        if (groupToRestore) {
            try {
                await unarchiveGroup.mutateAsync(groupToRestore.id);
                showSuccess(t('success'), t('players.notifications.groupRestoredSuccess'));
                handleRefetch();
            } catch (error: any) {
                showError(t('error') || "Error", error.message || t('errorOccurred'));
            }
            setGroupToRestore(null);
        }
        setRestoreGroupConfirmVisible(false);
    };

    const handlePermanentDeletePlayerPress = async (id: string) => {
        setPlayerToDelete(id);
        setIsCheckingPlayer(true);
        try {
            const result = await checkPlayerSafety.mutateAsync(id);
            setSafetyResult(result);
            setPermanentDeletePlayerVisible(true);
        } catch (error: any) {
            showError(t('error'), error.message || t('errorOccurred'));
            setPlayerToDelete(null);
        } finally {
            setIsCheckingPlayer(false);
        }
    };

    const handleConfirmPermanentDeletePlayer = async (removeFromSessions: boolean = false) => {
        if (playerToDelete) {
            try {
                if (removeFromSessions && safetyResult?.futureSessionCount && safetyResult.futureSessionCount > 0) {
                    await removePlayersFromSessionsBulk.mutateAsync({
                        sessionIds: safetyResult.futureSessionIds,
                        playerIds: [playerToDelete]
                    });
                }

                await deletePlayer.mutateAsync(playerToDelete);
                showSuccess(t('success'), t('players.notifications.deletedPermanentSuccess'));
                handleRefetch();
            } catch (error: any) {
                showError(t('error'), error.message || t('errorOccurred'));
            }
            setPlayerToDelete(null);
            setSafetyResult(null);
        }
        setPermanentDeletePlayerVisible(false);
    };

    const handleClosePermanentDeleteConfirm = () => {
        setPermanentDeletePlayerVisible(false);
        setPlayerToDelete(null);
        setSafetyResult(null);
    };

    const handlePermanentDeleteGroupPress = (group: ClassGroup) => {
        setGroupToDelete(group);
        setPermanentDeleteGroupVisible(true);
    };

    const handleConfirmPermanentDeleteGroup = async () => {
        if (groupToDelete) {
            try {
                await deleteGroup.mutateAsync(groupToDelete.id);
                showSuccess(t('success'), t('players.notifications.groupDeletedSuccess') || 'Grupo eliminado correctamente');
                handleRefetch();
            } catch (error: any) {
                showError(t('error') || "Error", error.message || t('errorOccurred'));
            }
            setGroupToDelete(null);
        }
        setPermanentDeleteGroupVisible(false);
    };

    const { width } = useWindowDimensions();
    const isDesktop = width >= 768;
    const numColumns = isDesktop ? 3 : 1;
    const gap = spacing.md;
    const horizontalPadding = spacing.md * 2;
    const totalGap = (numColumns - 1) * gap;
    const cardWidth = (width - horizontalPadding - totalGap) / numColumns;

    const renderGroupItem = ({ item }: { item: ClassGroup }) => {
        const effectivePlans = new Set(item.members?.map(m => {
            if (m.is_plan_exempt) return 'IS_EXEMPT';
            return m.plan_id || item.plan_id || 'NO_PLAN';
        }));
        const hasMixedPlans = effectivePlans.size > 1;

        const memberNames = item.members
            ?.map(m => allActivePlayers?.find((p: any) => p.id === m.player_id)?.full_name)
            .filter(Boolean)
            .join(', ');

        return (
            <View style={{ width: cardWidth, maxWidth: cardWidth, marginBottom: gap }}>
                <Card style={[styles.playerCard, { height: numColumns > 1 ? '100%': undefined, backgroundColor: theme.background.surface }]} padding="md">
                    <View style={styles.playerInfo}>
                        <View style={styles.playerMainInfo}>
                            <View style={styles.playerInfoContent}>
                                <View style={[styles.groupIconContainer, item.image_url ? { backgroundColor: 'transparent' } : null]}>
                                    {item.image_url ? (
                                        <Avatar
                                            source={item.image_url}
                                            name={item.name}
                                            size="md"
                                        />
                                    ) : (
                                        <Ionicons name="people" size={24} color={theme.status.info} />
                                    )}
                                </View>
                                <View style={{ flex: 1, marginLeft: spacing.md }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <Text style={styles.playerName}>{item.name}</Text>
                                        <View style={styles.actionButtons}>
                                            <View style={styles.iconRow}>
                                                <TouchableOpacity
                                                    style={styles.actionIconBtn}
                                                    activeOpacity={0.5}
                                                    onPress={() => handleEditGroup(item)}
                                                >
                                                    <Ionicons name="create-outline" size={20} color={theme.status.warning} />
                                                </TouchableOpacity>

                                                {activeTab === 'archived' ? (
                                                    <>
                                                        <TouchableOpacity
                                                            style={styles.actionIconBtn}
                                                            activeOpacity={0.5}
                                                            onPress={() => handleRestoreGroupPress(item)}
                                                        >
                                                            <Ionicons name="refresh-outline" size={20} color={theme.components.button.primary.bg} />
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            style={styles.actionIconBtn}
                                                            activeOpacity={0.5}
                                                            onPress={() => handlePermanentDeleteGroupPress(item)}
                                                        >
                                                            <Ionicons name="trash" size={20} color={theme.status.error} />
                                                        </TouchableOpacity>
                                                    </>
                                                ) : (
                                                    <TouchableOpacity
                                                        style={styles.actionIconBtn}
                                                        activeOpacity={0.5}
                                                        onPress={() => handleArchiveGroupPress(item)}
                                                    >
                                                        <Ionicons name="trash-outline" size={20} color={theme.status.error} />
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        </View>
                                    </View>

                                    {item.plan ? (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                            <Ionicons name="pricetag-outline" size={12} color={theme.mode === 'dark' ? colors.primary[400] : colors.primary[600]} style={{ marginRight: 4 }} />
                                            <Text style={{ fontSize: 12, color: theme.mode === 'dark' ? colors.primary[400] : colors.primary[600], fontWeight: '500' }}>
                                                {item.plan.name}
                                            </Text>
                                        </View>
                                    ) : (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                            <Ionicons name="alert-circle-outline" size={12} color={theme.status.warning} style={{ marginRight: 4 }} />
                                            <Text style={{ fontSize: 12, color: theme.status.warning, fontWeight: '500' }}>
                                                {t('players.modals.group.labels.noGroupPlan')}
                                            </Text>
                                        </View>
                                    )}

                                    {hasMixedPlans ? (
                                        <View style={{ marginTop: 2 }}>
                                            {item.members?.map((m: any) => {
                                                const player = allActivePlayers?.find((p: any) => p.id === m.player_id);
                                                if (!player) return null;

                                                let planLabel = t('players.modals.group.labels.groupPlan');
                                                let labelColor = theme.text.secondary;

                                                if (m.is_plan_exempt) {
                                                    planLabel = t('players.modals.group.labels.excludedFromPayment');
                                                    labelColor = theme.status.error;
                                                } else if (m.plan_id) {
                                                    planLabel = m.plan?.name || 'Custom';
                                                    labelColor = theme.mode === 'dark' ? colors.primary[400] : colors.primary[600];
                                                }

                                                return (
                                                    <View key={m.player_id} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                                        <Ionicons name="person-outline" size={12} color={theme.text.secondary} style={{ marginRight: 4 }} />
                                                        <Text style={{ fontSize: 12, color: theme.text.primary, fontWeight: '500', marginRight: 8 }}>
                                                            {player.full_name}
                                                        </Text>

                                                        <Ionicons name={m.is_plan_exempt ? "alert-circle-outline" : "pricetag-outline"} size={12} color={labelColor} style={{ marginRight: 4 }} />
                                                        <Text style={{ fontSize: 11, color: labelColor }}>
                                                            {planLabel}
                                                        </Text>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    ) : (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                            <Ionicons name="people-outline" size={12} color={theme.text.secondary} style={{ marginRight: 4 }} />
                                            <Text style={{ fontSize: 12, color: theme.text.secondary }}>
                                                {item.member_count} {t('players.labels.member', { count: item.member_count })}
                                                {item.members?.length ? ` • ${memberNames}` : ''}
                                            </Text>
                                        </View>
                                    )}

                                    {item.description && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                            <Ionicons name="document-text-outline" size={12} color={theme.text.tertiary} style={{ marginRight: 4 }} />
                                            <Text style={{ fontSize: 12, color: theme.text.secondary }} numberOfLines={1}>
                                                {item.description}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>
                    </View>
                </Card>
            </View>
        );
    };

    const renderMixedItem = ({ item }: { item: any }) => {
        if ('full_name' in item) {
            return renderPlayerItem({ item });
        } else {
            return renderGroupItem({ item: item as ClassGroup });
        }
    };

    const renderPlayerItem = ({ item }: { item: any }) => {
        return (
            <View style={{ width: cardWidth, maxWidth: cardWidth, marginBottom: gap }}>
                <Card style={[styles.playerCard, { height: numColumns > 1 ? '100%' : undefined, backgroundColor: theme.background.surface }]} padding="sm">
                    <View style={styles.playerInfo}>
                        <TouchableOpacity
                            onPress={() => handleViewPlayer(item.id)}
                            activeOpacity={0.7}
                            style={styles.playerMainInfo}
                        >
                            <View style={styles.playerInfoContent}>
                                <Avatar name={item.full_name} source={item.avatar_url} size="md" />
                                <View style={styles.playerDetails}>
                                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                        <Text style={styles.playerName}>{item.full_name}</Text>
                                        <View style={styles.actionButtons}>
                                            <View style={styles.iconRow}>
                                                {isGlobalView && item.academy_id && (
                                                    <View style={{
                                                        backgroundColor: theme.background.subtle,
                                                        paddingHorizontal: 6,
                                                        paddingVertical: 2,
                                                        borderRadius: 4,
                                                        marginRight: 4,
                                                        justifyContent: 'center',
                                                        height: 24,
                                                        alignSelf: 'center'
                                                    }}>
                                                        <Text style={{
                                                            fontSize: 10,
                                                            color: theme.text.secondary,
                                                            fontWeight: '500'
                                                        }}>
                                                            {allAcademies.find(a => a.id === item.academy_id)?.name || 'Academia'}
                                                        </Text>
                                                    </View>
                                                )}
                                                <TouchableOpacity
                                                    style={styles.actionIconBtn}
                                                    activeOpacity={0.5}
                                                    onPress={() => handleViewPlayer(item.id)}
                                                >
                                                    <Ionicons name="eye-outline" size={20} color={theme.text.secondary} />
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={styles.actionIconBtn}
                                                    activeOpacity={0.5}
                                                    onPress={() => handleEditPlayer(item.id)}
                                                >
                                                    <Ionicons name="create-outline" size={20} color={theme.status.warning} />
                                                </TouchableOpacity>
                                                {activeTab === 'archived' ? (
                                                    <>
                                                        <TouchableOpacity
                                                            style={styles.actionIconBtn}
                                                            activeOpacity={0.5}
                                                            onPress={() => handleReactivatePress(item.id)}
                                                        >
                                                            <Ionicons name="refresh-outline" size={20} color={theme.components.button.primary.bg} />
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            style={styles.actionIconBtn}
                                                            activeOpacity={0.5}
                                                            onPress={() => handlePermanentDeletePlayerPress(item.id)}
                                                        >
                                                            <Ionicons name="trash" size={20} color={theme.status.error} />
                                                        </TouchableOpacity>
                                                    </>
                                                ) : (
                                                    <TouchableOpacity
                                                        style={styles.actionIconBtn}
                                                        activeOpacity={0.5}
                                                        onPress={() => handleDeletePress(item.id)}
                                                    >
                                                        <Ionicons name="trash-outline" size={20} color={theme.status.error} />
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        </View>
                                    </View>

                                    {item.active_subscriptions?.length > 0 ? (
                                        item.active_subscriptions.map((sub: any, idx: number) => {
                                            const details = sub.notes;
                                            return (
                                                <View key={sub.id || idx} style={styles.planItemContainer}>
                                                    <View style={styles.planRow}>
                                                        <Ionicons name="pricetag-outline" size={12} color={theme.mode === 'dark' ? colors.primary[400] : colors.primary[600]} />
                                                        <Text style={[styles.planRowText, { color: theme.mode === 'dark' ? colors.primary[400] : colors.primary[600] }]} numberOfLines={1}>
                                                            {sub.plan?.name || 'Plan'}
                                                        </Text>
                                                    </View>
                                                    {details && (
                                                        <Text style={[styles.planDetailsText, { color: theme.status.success }]} numberOfLines={1}>
                                                            {details}
                                                        </Text>
                                                    )}
                                                </View>
                                            );
                                        })
                                    ) : (
                                        <View style={styles.planRow}>
                                            <View style={[styles.roleBadge, { backgroundColor: theme.background.subtle }]}>
                                                <Text style={[styles.roleBadgeText, { color: theme.text.secondary }]}>
                                                    {item.intended_role === 'coach' ? t('players.labels.coach') : t('players.labels.student')}
                                                </Text>
                                            </View>
                                        </View>
                                    )}
                                    {item.unified_payment_group_id && (
                                        <View style={[styles.unifiedPaymentRow, { backgroundColor: theme.components.badge.primary }]}>
                                            <Ionicons name="wallet-outline" size={12} color={theme.text.primary} />
                                            <Text style={[styles.unifiedPaymentRowText, { color: theme.text.primary }]}>{t('players.labels.unifiedPayment')}</Text>
                                        </View>
                                    )}
                                    {activeGroups && activeGroups.filter((g: any) =>
                                        g.members?.some((m: any) => m.player_id === item.id)
                                    ).length > 0 && (
                                            <View style={styles.groupsContainer}>
                                                {activeGroups.filter((g: any) =>
                                                    g.members?.some((m: any) => m.player_id === item.id)
                                                ).map((group: any) => (
                                                    <View key={group.id} style={[styles.groupBadge, { backgroundColor: theme.status.infoBackground }]}>
                                                        <Ionicons name="people" size={12} color={theme.status.infoText} />
                                                        <Text style={[styles.groupBadgeText, { color: theme.status.infoText }]} numberOfLines={1}>
                                                            {group.name}
                                                        </Text>
                                                    </View>
                                                ))}
                                            </View>
                                        )}
                                    {item.notes ? (
                                        <View style={styles.notesContainer}>
                                            <Ionicons name="document-text-outline" size={12} color={theme.text.secondary} />
                                            <Text style={[styles.notesText, { color: theme.text.secondary }]} numberOfLines={1} ellipsizeMode="tail">
                                                {t('players.labels.notes')}: {item.notes}
                                            </Text>
                                        </View>
                                    ) : null}
                                </View>
                            </View>
                        </TouchableOpacity>
                    </View>
                </Card>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background.default }]}>
            <Stack.Screen
                options={{
                    headerShown: true,
                }}
            />
            <View style={[styles.searchAndAddContainer, { width: isDesktop ? '50%' : '100%' }]}>
                <View style={[styles.searchContainer, { flex: 1, backgroundColor: theme.background.input, borderColor: theme.border.default }]}>
                    <TextInput
                        style={[styles.searchInput, { color: theme.text.primary }]}
                        placeholder={activeTab === 'groups' ? t('players.searchGroupsPlaceholder') : t('players.searchPlaceholder')}
                        value={activeTab === 'groups' ? groupSearchQuery : searchQuery}
                        onChangeText={activeTab === 'groups' ? setGroupSearchQuery : setSearchQuery}
                        placeholderTextColor={theme.text.tertiary}
                    />
                </View>
                <PermissionGate permission="players.create">
                    <TouchableOpacity
                        style={[
                            styles.addButton,
                            { backgroundColor: theme.components.button.primary.bg },
                            activeTab === 'groups' && { backgroundColor: theme.status.info }
                        ]}
                        onPress={() => activeTab === 'groups' ? handleCreateGroup() : handleCreatePlayer()}
                    >
                        <Text style={[styles.addButtonText, { color: theme.components.button.primary.text }]}>{activeTab === 'groups' ? t('players.addGroup') : t('players.addPlayer')}</Text>
                    </TouchableOpacity>
                </PermissionGate>
            </View>

            <View style={[styles.tabsContainer, Platform.OS !== 'web' && { paddingHorizontal: 0 }]}>
                {Platform.OS === 'web' ? (
                    <View style={styles.tabsContent}>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'players' && styles.activeTab]}
                            onPress={() => setActiveTab('players')}
                        >
                            <Text style={[styles.tabText, { color: theme.text.secondary }, activeTab === 'players' && styles.activeTabText]}>
                                {t('players.tabs.active')}
                            </Text>
                            <View style={[styles.badge, { backgroundColor: theme.status.success }, activeTab === 'players' && { backgroundColor: 'white' }]}>
                                <Text style={[styles.badgeText, { color: activeTab === 'players' ? (theme.mode === 'dark' ? colors.success[700] : colors.success[700]) : theme.background.default }]}>{activeCount}</Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'no_plan' && [styles.activeTab, styles.noPlanTab]]}
                            onPress={() => setActiveTab('no_plan')}
                        >
                            <Text style={[styles.tabText, { color: theme.text.secondary }, activeTab === 'no_plan' && styles.activeTabText]}>
                                {t('players.tabs.noPlan')}
                            </Text>
                            <View style={[styles.badge, { backgroundColor: theme.status.warning }, activeTab === 'no_plan' && { backgroundColor: 'white' }]}>
                                <Text style={[styles.badgeText, { color: activeTab === 'no_plan' ? (theme.mode === 'dark' ? colors.warning[700] : colors.warning[700]) : theme.background.default }]}>{noPlanCount}</Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'groups' && [styles.activeTab, styles.groupsTab]]}
                            onPress={() => setActiveTab('groups')}
                        >
                            <Text style={[styles.tabText, { color: theme.text.secondary }, activeTab === 'groups' && styles.activeTabText]}>
                                {t('players.tabs.groups')}
                            </Text>
                            <View style={[styles.badge, { backgroundColor: theme.status.info }, activeTab === 'groups' && { backgroundColor: 'white' }]}>
                                <Text style={[styles.badgeText, { color: activeTab === 'groups' ? (theme.mode === 'dark' ? colors.secondary[700] : colors.secondary[700]) : theme.background.default }]}>{groupsCount}</Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'archived' && [styles.activeTab, styles.archivedTab]]}
                            onPress={() => setActiveTab('archived')}
                        >
                            <Text style={[styles.tabText, { color: theme.text.secondary }, activeTab === 'archived' && styles.activeTabText]}>
                                {t('players.tabs.archived')}
                            </Text>
                            <View style={[styles.badge, { backgroundColor: theme.text.tertiary }, activeTab === 'archived' && { backgroundColor: 'white' }]}>
                                <Text style={[styles.badgeText, { color: activeTab === 'archived' ? (theme.mode === 'dark' ? colors.neutral[700] : colors.neutral[700]) : theme.background.default }]}>{archivedCount}</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={[styles.tabsContent, { paddingHorizontal: spacing.md }]}
                    >
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'players' && styles.activeTab]}
                            onPress={() => setActiveTab('players')}
                        >
                            <Text style={[styles.tabText, { color: theme.text.secondary }, activeTab === 'players' && styles.activeTabText]}>
                                {t('players.tabs.active')}
                            </Text>
                            <View style={[styles.badge, { backgroundColor: theme.status.success }, activeTab === 'players' && { backgroundColor: 'white' }]}>
                                <Text style={[styles.badgeText, { color: activeTab === 'players' ? (theme.mode === 'dark' ? colors.success[700] : colors.success[700]) : theme.background.default }]}>{activeCount}</Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'no_plan' && [styles.activeTab, styles.noPlanTab]]}
                            onPress={() => setActiveTab('no_plan')}
                        >
                            <Text style={[styles.tabText, { color: theme.text.secondary }, activeTab === 'no_plan' && styles.activeTabText]}>
                                {t('players.tabs.noPlan')}
                            </Text>
                            <View style={[styles.badge, { backgroundColor: theme.status.warning }, activeTab === 'no_plan' && { backgroundColor: 'white' }]}>
                                <Text style={[styles.badgeText, { color: activeTab === 'no_plan' ? (theme.mode === 'dark' ? colors.warning[700] : colors.warning[700]) : theme.background.default }]}>{noPlanCount}</Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'groups' && [styles.activeTab, styles.groupsTab]]}
                            onPress={() => setActiveTab('groups')}
                        >
                            <Text style={[styles.tabText, { color: theme.text.secondary }, activeTab === 'groups' && styles.activeTabText]}>
                                {t('players.tabs.groups')}
                            </Text>
                            <View style={[styles.badge, { backgroundColor: theme.status.info }, activeTab === 'groups' && { backgroundColor: 'white' }]}>
                                <Text style={[styles.badgeText, { color: activeTab === 'groups' ? (theme.mode === 'dark' ? colors.secondary[700] : colors.secondary[700]) : theme.background.default }]}>{groupsCount}</Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'archived' && [styles.activeTab, styles.archivedTab]]}
                            onPress={() => setActiveTab('archived')}
                        >
                            <Text style={[styles.tabText, { color: theme.text.secondary }, activeTab === 'archived' && styles.activeTabText]}>
                                {t('players.tabs.archived')}
                            </Text>
                            <View style={[styles.badge, { backgroundColor: theme.text.tertiary }, activeTab === 'archived' && { backgroundColor: 'white' }]}>
                                <Text style={[styles.badgeText, { color: activeTab === 'archived' ? (theme.mode === 'dark' ? colors.neutral[700] : colors.neutral[700]) : theme.background.default }]}>{archivedCount}</Text>
                            </View>
                        </TouchableOpacity>
                    </ScrollView>
                )}
            </View>

            {/* List */}
            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.components.button.primary.bg} />
                </View>
            ) : (
                <FlatList
                    key={numColumns}
                    data={filteredData}
                    keyExtractor={(item) => item.id}
                    renderItem={renderMixedItem}
                    style={{ flex: 1 }}
                    contentContainerStyle={{
                        paddingHorizontal: spacing.md,
                        flexGrow: 1,
                        paddingBottom: Math.max(insets.bottom, spacing.xl) + 80
                    }}
                    columnWrapperStyle={numColumns > 1 ? { gap: spacing.md } : undefined}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={isLoading} onRefresh={handleRefetch} tintColor={theme.components.button.primary.bg} />
                    }
                    ListEmptyComponent={
                        !isLoading ? (
                            <View style={styles.emptyContainer}>
                                <Ionicons
                                    name={
                                        activeTab === 'archived' ? "archive-outline" :
                                            activeTab === 'groups' ? "people-circle-outline" : "people-outline"
                                    }
                                    size={64}
                                    color={theme.text.disabled || theme.text.tertiary}
                                />
                                <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
                                    {activeTab === 'archived' ? t('players.emptyState.noArchived') :
                                        activeTab === 'groups' ? t('players.emptyState.noGroups') :
                                            t('players.emptyState.noPlayers')}
                                </Text>
                            </View>
                        ) : null
                    }
                    numColumns={numColumns}
                />
            )}

            {/* Modals */}
            <StatusModal
                visible={deleteConfirmVisible}
                onClose={handleCloseDeleteConfirm}
                title={t('players.modals.archivePlayer.title')}
                message={
                    safetyResult?.futureSessionCount ?
                        `${t('auth.error').toUpperCase()}!\n\n${t('dashboard.slides.calendar.agenda')}: ${safetyResult.futureSessionCount}${safetyResult.hasDebt ? `\n\n${t('payments.owes')}: $${Math.abs(safetyResult.balance).toLocaleString('es-AR')}` : ''}`
                        : safetyResult?.hasDebt ?
                            `${t('auth.error').toUpperCase()}!\n\n${t('payments.owes')}: $${Math.abs(safetyResult.balance).toLocaleString('es-AR')}\n\n${t('players.modals.group.labels.excludeDescription')}`
                            :
                            t('players.modals.archivePlayer.confirm')
                }
                type="warning"
                buttons={
                    safetyResult?.futureSessionCount ? [
                        {
                            text: t('players.modals.archivePlayer.keepClasses'),
                            onPress: () => handleConfirmDelete(false),
                            style: 'primary' as const
                        },
                        {
                            text: t('players.modals.archivePlayer.cancelClasses'),
                            onPress: () => handleConfirmDelete(true),
                            style: 'danger' as const
                        }
                    ] : undefined
                }
                buttonText={!safetyResult?.futureSessionCount ? t('archive') : undefined}
                showCancel={false}
                onConfirm={!safetyResult?.futureSessionCount ? () => handleConfirmDelete(false) : undefined}
            />

            <StatusModal
                visible={reactivateConfirmVisible}
                type="warning"
                title={t('players.modals.reactivatePlayer.title')}
                message={t('players.modals.reactivatePlayer.confirm')}
                buttonText={t('reactivate')}
                showCancel
                onClose={() => setReactivateConfirmVisible(false)}
                onConfirm={handleConfirmReactivate}
            />

            <StatusModal
                visible={archiveGroupConfirmVisible}
                type="warning"
                title={t('players.modals.archiveGroup.title')}
                message={t('players.modals.archiveGroup.confirm', { name: groupToArchive?.name })}
                buttonText={t('archive')}
                showCancel
                onClose={() => setArchiveGroupConfirmVisible(false)}
                onConfirm={handleConfirmArchiveGroup}
            />

            <StatusModal
                visible={restoreGroupConfirmVisible}
                type="warning"
                title={t('players.modals.restoreGroup.title')}
                message={t('players.modals.restoreGroup.confirm', { name: groupToRestore?.name })}
                buttonText={t('reactivate')}
                showCancel
                onClose={() => setRestoreGroupConfirmVisible(false)}
                onConfirm={handleConfirmRestoreGroup}
            />

            {/* Permanent Delete Modals */}
            <StatusModal
                visible={permanentDeletePlayerVisible}
                onClose={handleClosePermanentDeleteConfirm}
                title={safetyResult?.hasDebt ? t('players.modals.deletePlayer.cannotDelete') : t('players.modals.deletePlayer.titleDefinitive')}
                message={
                    safetyResult?.hasDebt ?
                        `${t('auth.error').toUpperCase()}!\n\n${t('payments.owes')}: $${Math.abs(safetyResult.balance).toLocaleString('es-AR')}\n\n${t('players.modals.group.labels.excludeDescription')}`
                        : safetyResult?.futureSessionCount ?
                            `${t('auth.error').toUpperCase()}!\n\n${t('dashboard.slides.calendar.agenda')}: ${safetyResult.futureSessionCount}`
                            :
                            t('deleteConfirm')
                }
                type={safetyResult?.hasDebt ? 'error' : 'danger'}
                buttons={
                    safetyResult?.hasDebt ? undefined : safetyResult?.futureSessionCount ? [
                        {
                            text: t('players.modals.archivePlayer.keepClasses'),
                            onPress: () => handleConfirmPermanentDeletePlayer(false),
                            style: 'primary' as const
                        },
                        {
                            text: t('players.modals.archivePlayer.cancelClasses'),
                            onPress: () => handleConfirmPermanentDeletePlayer(true),
                            style: 'danger' as const
                        }
                    ] : undefined
                }
                buttonText={!safetyResult?.hasDebt && !safetyResult?.futureSessionCount ? t('delete') : undefined}
                showCancel={false}
                onConfirm={!safetyResult?.hasDebt && !safetyResult?.futureSessionCount ? () => handleConfirmPermanentDeletePlayer(false) : undefined}
            />

            <StatusModal
                visible={permanentDeleteGroupVisible}
                type="error"
                title={t('players.modals.deletePlayer.titleDefinitive')}
                message={t('players.modals.archiveGroup.confirm', { name: groupToDelete?.name })}
                buttonText={t('delete')}
                showCancel
                onClose={() => setPermanentDeleteGroupVisible(false)}
                onConfirm={handleConfirmPermanentDeleteGroup}
            />

            <PlayerModal
                visible={playerModalVisible}
                onClose={() => setPlayerModalVisible(false)}
                playerId={selectedPlayerId}
                mode={playerModalMode}
                onPlayerCreated={handlePlayerCreated}
                onPlayerUpdated={handlePlayerUpdated}
            />

            <GroupModal
                visible={groupModalVisible}
                onClose={() => setGroupModalVisible(false)}
                groupId={selectedGroupId}
                mode={groupModalMode}
            />

            {/* Loading Overlay Global (for safety checks) */}
            {isCheckingPlayer && (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }]}>
                    <ActivityIndicator size="large" color={theme.components.button.primary.bg} />
                    <Text style={{ color: 'white', marginTop: spacing.md, fontWeight: '600' }}>{t('system.starting')}</Text>
                </View>
            )}
        </View>
    );
}

const createStyles = (theme: Theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background.default,
    },
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.sm,
        paddingTop: spacing.xl,
        backgroundColor: theme.background.surface,
    },
    searchAndAddContainer: {
        flexDirection: 'row',
        paddingHorizontal: spacing.md,
        marginBottom: spacing.md,
        marginTop: spacing.lg,
        gap: spacing.sm,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.background.surface,
        borderRadius: 12,
        paddingHorizontal: spacing.md,
        height: 48,
        borderWidth: 1,
        borderColor: theme.border.subtle,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    searchIcon: {
        marginRight: spacing.sm,
    },
    searchInput: {
        flex: 1,
        height: '100%',
        fontSize: typography.size.md,
        color: theme.text.primary,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.components.button.primary.bg,
        paddingHorizontal: spacing.md,
        borderRadius: 12,
        height: 48,
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    addButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: typography.size.sm,
        marginLeft: spacing.xs,
    },
    tabsContainer: {
        paddingHorizontal: spacing.md,
        marginBottom: spacing.md,
    },
    tabsContent: {
        flexDirection: 'row',
        gap: spacing.xs,
    },
    tab: {
        flexDirection: 'row',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
        backgroundColor: theme.background.subtle,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.border.subtle,
    },
    activeTab: {
        backgroundColor: theme.status.success,
        borderColor: theme.status.success,
    },
    noPlanTab: {
        backgroundColor: theme.status.warning,
        borderColor: theme.status.warning,
    },
    archivedTab: {
        backgroundColor: theme.text.tertiary,
        borderColor: theme.text.tertiary,
    },
    groupsTab: {
        backgroundColor: theme.status.info,
        borderColor: theme.status.info,
    },
    activeTabText: {
        color: 'white',
        fontWeight: '600',
    },
    tabText: {
        fontSize: typography.size.sm,
        color: theme.text.secondary,
        fontWeight: '500',
    },
    badge: {
        backgroundColor: theme.status.error,
        borderRadius: 9,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 6,
        paddingHorizontal: 4,
    },
    badgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: '800',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    planItemContainer: {
        marginBottom: 2,
    },
    planDetailsText: {
        fontSize: 11,
        color: theme.status.success,
        marginLeft: 16,
        marginTop: 0,
        fontWeight: '500',
    },
    listContent: {
        paddingHorizontal: spacing.md,
        paddingBottom: 80,
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
        color: theme.text.primary,
    },
    playerMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: 4,
    },
    notesContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        gap: 4,
    },
    notesText: {
        fontSize: typography.size.xs,
        color: theme.text.secondary,
        flex: 1,
        fontStyle: 'italic',
    },
    roleBadge: {
        paddingHorizontal: spacing.xs,
        paddingVertical: 2,
        borderRadius: 4,
        backgroundColor: theme.background.subtle,
    },
    roleBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: theme.text.secondary,
    },
    planBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.background.subtle,
        paddingHorizontal: spacing.xs,
        paddingVertical: 2,
        borderRadius: 4,
        gap: 4,
        flexShrink: 1,
    },
    planBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: theme.components.button.primary.bg,
        flexShrink: 1,
    },
    groupsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        marginTop: 4,
    },
    groupBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.background.subtle,
        paddingHorizontal: spacing.xs,
        paddingVertical: 2,
        borderRadius: 4,
        gap: 4,
    },
    groupBadgeText: {
        fontSize: 11,
        fontWeight: '500',
        color: theme.status.info,
    },
    unifiedPaymentBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.background.subtle,
        paddingHorizontal: spacing.xs,
        paddingVertical: 2,
        borderRadius: 4,
        gap: 4,
        marginLeft: 4,
    },
    unifiedPaymentBadgeText: {
        fontSize: 11,
        fontWeight: '500',
        color: theme.components.button.primary.bg,
    },
    planRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    planRowText: {
        fontSize: 12,
        fontWeight: '500',
        color: theme.components.button.primary.bg,
    },
    unifiedPaymentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
        backgroundColor: theme.background.subtle,
        paddingHorizontal: spacing.xs,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
    },
    unifiedPaymentRowText: {
        fontSize: 11,
        fontWeight: '700',
        color: theme.text.primary,
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
        color: theme.text.secondary,
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
    groupIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: theme.background.subtle,
        justifyContent: 'center',
        alignItems: 'center',
    },
    fab: {
        position: 'absolute',
        bottom: 100,
        right: spacing.lg,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: theme.components.button.primary.bg,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
});
