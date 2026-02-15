import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';

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
import { useUserAcademies } from '@/src/features/academy/hooks/useAcademy';
import { useClassGroupMutations, useClassGroups } from '@/src/features/calendar/hooks/useClassGroups';
import { usePlayerMutations } from '@/src/features/players/hooks/usePlayerMutations';
import { usePlayers } from '@/src/features/players/hooks/usePlayers';
import { useTheme } from '@/src/hooks/useTheme';
import { useViewStore } from '@/src/store/useViewStore';
import { ClassGroup } from '@/src/types/classGroups';

export default function PlayersScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const { theme } = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const [activeTab, setActiveTab] = useState<'active' | 'groups' | 'no_plan' | 'archived'>('active');
    const [searchQuery, setSearchQuery] = useState('');
    const { viewPlayerId } = useLocalSearchParams<{ viewPlayerId: string }>();
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
        // Switch to the appropriate tab so the user sees the new player
        if (hasPlan) {
            setActiveTab('active');
        } else {
            setActiveTab('no_plan');
        }
    };

    const handlePlayerUpdated = () => {
        handleRefetch();
    };

    // Query 1: Fetch ALL active players for:
    // a) Client-side filtering (search)
    // b) "No Plan" badge count 
    // c) "Active" list
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
    const noPlanCount = useMemo(() => {
        const playersNoPlan = allActivePlayers?.filter(p => !p.has_plan).length || 0;
        return playersNoPlan;
    }, [allActivePlayers]);

    const activeCount = useMemo(() => {
        return allActivePlayers?.filter(p => p.has_plan).length || 0;
    }, [allActivePlayers]);

    const archivedCount = (archivedPlayers?.length || 0) + (archivedGroups?.length || 0);

    // Derived state: Filtered List for Display
    const filteredData = useMemo(() => {
        let players = (activeTab === 'archived' ? archivedPlayers : allActivePlayers) || [];
        let groups: ClassGroup[] = [];

        // Determine which groups to include
        if (activeTab === 'groups') {
            groups = (activeGroups || []).filter(g => g.plan_id || !g.plan_id); // Show all groups
        } else if (activeTab === 'no_plan') {
            groups = []; // Don't show groups in no_plan
        } else if (activeTab === 'archived') {
            groups = archivedGroups || [];
        }

        // Apply Tab specific filter for players
        if (activeTab === 'no_plan') {
            players = players.filter(p => !p.has_plan);
        } else if (activeTab === 'active') {
            players = players.filter(p => p.has_plan);
        } else if (activeTab === 'groups') {
            players = []; // Only groups in groups tab
        }

        // Combine for tabs that support mixed content
        let combinedData: any[] = [];
        if (activeTab === 'active') {
            combinedData = players;
        } else if (activeTab === 'groups') {
            combinedData = groups;
        } else {
            // Mixed tabs: no_plan, archived
            combinedData = [...groups, ...players];
        }

        // Client-side search
        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            combinedData = combinedData.filter(item => {
                const name = item.full_name || item.name || '';
                return name.toLowerCase().includes(lowerQuery);
            });
        }

        // Sort safely (create copy first)
        return [...combinedData].sort((a, b) => {
            const nameA = a.full_name || a.name || '';
            const nameB = b.full_name || b.name || '';
            return nameA.localeCompare(nameB);
        });

    }, [activeTab, searchQuery, allActivePlayers, archivedPlayers, activeGroups, archivedGroups]);

    // Loading & Refetching
    const isLoading = activeTab === 'archived' ? (isLoadingArchived || isLoadingArchivedGroups) :
        activeTab === 'groups' ? isLoadingGroups :
            activeTab === 'no_plan' ? (isLoadingActivePlayers || isLoadingGroups) :
                isLoadingActivePlayers;

    const handleRefetch = () => {
        refetchActive();
        refetchArchived();
        refetchGroups();
        refetchArchivedGroups();
    };

    const { archivePlayer, unarchivePlayer, deletePlayer } = usePlayerMutations();
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [reactivateConfirmVisible, setReactivateConfirmVisible] = useState(false);
    const [playerToProcess, setPlayerToProcess] = useState<string | null>(null);

    // Group handlers
    const [groupToArchive, setGroupToArchive] = useState<ClassGroup | null>(null);
    const [groupToRestore, setGroupToRestore] = useState<ClassGroup | null>(null);
    const [archiveGroupConfirmVisible, setArchiveGroupConfirmVisible] = useState(false);
    const [restoreGroupConfirmVisible, setRestoreGroupConfirmVisible] = useState(false);

    // Permanent delete state
    const [permanentDeletePlayerVisible, setPermanentDeletePlayerVisible] = useState(false);
    const [playerToDelete, setPlayerToDelete] = useState<string | null>(null);
    const [permanentDeleteGroupVisible, setPermanentDeleteGroupVisible] = useState(false);
    const [groupToDelete, setGroupToDelete] = useState<ClassGroup | null>(null);

    // Handlers
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
            try {
                await archivePlayer.mutateAsync(playerToProcess);
                showSuccess(t('success'), "Alumno archivado correctamente");
                handleRefetch(); // Force UI update
            } catch (error: any) {
                showError(t('error'), error.message || t('errorOccurred'));
            }
            setPlayerToProcess(null);
        }
        setDeleteConfirmVisible(false);
    };

    const handleConfirmReactivate = async () => {
        if (playerToProcess) {
            try {
                await unarchivePlayer.mutateAsync(playerToProcess);
                showSuccess(t('success'), "Alumno reactivado correctamente");
                handleRefetch(); // Force UI update
            } catch (error: any) {
                showError(t('error'), error.message || t('errorOccurred'));
            }
            setPlayerToProcess(null);
        }
        setReactivateConfirmVisible(false);
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
                showSuccess(t('success') || "Éxito", "Grupo archivado correctamente");
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
                showSuccess(t('success') || "Éxito", "Grupo restaurado correctamente");
                handleRefetch();
            } catch (error: any) {
                showError(t('error') || "Error", error.message || t('errorOccurred'));
            }
            setGroupToRestore(null);
        }
        setRestoreGroupConfirmVisible(false);
    };

    // Permanent delete handlers
    const handlePermanentDeletePlayerPress = (id: string) => {
        setPlayerToDelete(id);
        setPermanentDeletePlayerVisible(true);
    };

    const handleConfirmPermanentDeletePlayer = async () => {
        if (playerToDelete) {
            try {
                await deletePlayer.mutateAsync(playerToDelete);
                showSuccess(t('success'), "Alumno eliminado correctamente");
                handleRefetch();
            } catch (error: any) {
                showError(t('error'), error.message || t('errorOccurred'));
            }
            setPlayerToDelete(null);
        }
        setPermanentDeletePlayerVisible(false);
    };

    const handlePermanentDeleteGroupPress = (group: ClassGroup) => {
        setGroupToDelete(group);
        setPermanentDeleteGroupVisible(true);
    };

    const handleConfirmPermanentDeleteGroup = async () => {
        if (groupToDelete) {
            try {
                await deleteGroup.mutateAsync(groupToDelete.id);
                showSuccess(t('success') || "Éxito", "Grupo eliminado correctamente");
                handleRefetch();
            } catch (error: any) {
                showError(t('error') || "Error", error.message || t('errorOccurred'));
            }
            setGroupToDelete(null);
        }
        setPermanentDeleteGroupVisible(false);
    };

    // Responsive Grid
    const { width } = useWindowDimensions();
    const isDesktop = width >= 768; // Tablet/Desktop breakpoint
    const numColumns = isDesktop ? 3 : 1;
    const gap = spacing.md;
    const horizontalPadding = spacing.md * 2; // Left and right padding of the container
    const totalGap = (numColumns - 1) * gap;
    const cardWidth = (width - horizontalPadding - totalGap) / numColumns;

    // Render Group Item
    const renderGroupItem = ({ item }: { item: ClassGroup }) => {
        // Calculate effective plans
        const effectivePlans = new Set(item.members?.map(m => {
            if (m.is_plan_exempt) return 'IS_EXEMPT';
            return m.plan_id || item.plan_id || 'NO_PLAN';
        }));
        const hasMixedPlans = effectivePlans.size > 1;

        const memberNames = item.members
            ?.map(m => allActivePlayers?.find(p => p.id === m.player_id)?.full_name)
            .filter(Boolean)
            .join(', ');

        return (
            <View style={{ width: cardWidth, marginBottom: gap }}>
                <Card style={[styles.playerCard, { height: '100%', backgroundColor: theme.background.surface }]} padding="md">
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

                                    {/* Plan Row */}
                                    {item.plan ? (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                            <Ionicons name="pricetag-outline" size={12} color={theme.components.button.primary.bg} style={{ marginRight: 4 }} />
                                            <Text style={{ fontSize: 12, color: theme.components.button.primary.bg, fontWeight: '500' }}>
                                                {item.plan.name}
                                            </Text>
                                        </View>
                                    ) : (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                            <Ionicons name="alert-circle-outline" size={12} color={theme.status.warning} style={{ marginRight: 4 }} />
                                            <Text style={{ fontSize: 12, color: theme.status.warning, fontWeight: '500' }}>
                                                Sin plan asignado
                                            </Text>
                                        </View>
                                    )}

                                    {/* Members Row */}
                                    {hasMixedPlans ? (
                                        <View style={{ marginTop: 2 }}>
                                            {item.members?.map(m => {
                                                const player = allActivePlayers?.find(p => p.id === m.player_id);
                                                if (!player) return null;

                                                let planLabel = 'Plan del Grupo';
                                                let labelColor = theme.text.secondary;

                                                if (m.is_plan_exempt) {
                                                    planLabel = 'Excluído del cobro';
                                                    labelColor = theme.status.error;
                                                } else if (m.plan_id) {
                                                    planLabel = m.plan?.name || 'Custom';
                                                    labelColor = theme.components.button.primary.bg;
                                                }

                                                return (
                                                    <View key={m.player_id} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                                        {/* Player Icon */}
                                                        <Ionicons name="person-outline" size={12} color={theme.text.secondary} style={{ marginRight: 4 }} />
                                                        <Text style={{ fontSize: 12, color: theme.text.primary, fontWeight: '500', marginRight: 8 }}>
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
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                            <Ionicons name="people-outline" size={12} color={theme.text.secondary} style={{ marginRight: 4 }} />
                                            <Text style={{ fontSize: 12, color: theme.text.secondary }}>
                                                {item.member_count} {item.member_count === 1 ? 'alumno' : 'alumnos'}
                                                {item.members?.length ? ` • ${memberNames}` : ''}
                                            </Text>
                                        </View>
                                    )}

                                    {/* Notes Row */}
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

    // Render Item (Unified)
    const renderMixedItem = ({ item }: { item: any }) => {
        // Distinguish between Player and Group
        if ('full_name' in item) {
            return renderPlayerItem({ item });
        } else {
            return renderGroupItem({ item: item as ClassGroup });
        }
    };

    const renderPlayerItem = ({ item }: { item: any }) => {
        return (
            <View style={{ width: cardWidth, marginBottom: gap }}>
                <Card style={[styles.playerCard, { height: '100%', backgroundColor: theme.background.surface }]} padding="md">
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

                                    {/* Mostrar TODOS los planes activos - cada uno en su renglón */}
                                    {item.active_subscriptions?.length > 0 ? (
                                        item.active_subscriptions.map((sub: any, idx: number) => {
                                            // Fallback: only show details if it is a note.
                                            // We temporarily disabled price check because 'price' column might not exist or be accessible, confusing the list.
                                            const details = sub.notes;
                                            return (
                                                <View key={sub.id || idx} style={styles.planItemContainer}>
                                                    <View style={styles.planRow}>
                                                        <Ionicons name="pricetag-outline" size={12} color={theme.components.button.primary.bg} />
                                                        <Text style={[styles.planRowText, { color: theme.components.button.primary.bg }]} numberOfLines={1}>
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
                                                    {item.intended_role === 'coach' ? 'Entrenador' : 'Alumno'}
                                                </Text>
                                            </View>
                                        </View>
                                    )}
                                    {/* Badge de Pago Unificado - renglón separado */}
                                    {item.unified_payment_group_id && (
                                        <View style={[styles.unifiedPaymentRow, { backgroundColor: theme.components.badge.primary }]}>
                                            <Ionicons name="wallet-outline" size={12} color={theme.components.button.primary.bg} />
                                            <Text style={[styles.unifiedPaymentRowText, { color: theme.components.button.primary.bg }]}>Pago Unificado</Text>
                                        </View>
                                    )}
                                    {/* Groups the player belongs to */}
                                    {activeGroups && activeGroups.filter(g =>
                                        g.members?.some(m => m.player_id === item.id)
                                    ).length > 0 && (
                                            <View style={styles.groupsContainer}>
                                                {activeGroups.filter(g =>
                                                    g.members?.some(m => m.player_id === item.id)
                                                ).map(group => (
                                                    <View key={group.id} style={[styles.groupBadge, { backgroundColor: theme.components.badge.secondary }]}>
                                                        <Ionicons name="people" size={12} color={theme.status.info} />
                                                        <Text style={[styles.groupBadgeText, { color: theme.status.info }]} numberOfLines={1}>
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
                                                Notas: {item.notes}
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
                    headerShown: true, // Inherits from _layout
                }}
            />

            {/* Search and Add */}
            <View style={[styles.searchAndAddContainer, { width: isDesktop ? '50%' : '100%' }]}>
                <View style={[styles.searchContainer, { flex: 1, backgroundColor: theme.background.input, borderColor: theme.border.default }]}>
                    <Ionicons name="search" size={20} color={theme.text.secondary} style={styles.searchIcon} />
                    <TextInput
                        style={[styles.searchInput, { color: theme.text.primary }]}
                        placeholder={activeTab === 'groups' ? "Buscar grupos..." : (t('searchPlayers') || "Buscar alumnos...")}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholderTextColor={theme.text.tertiary}
                    />
                </View>
                <PermissionGate permission="players.create">
                    <TouchableOpacity
                        style={[
                            styles.addButton,
                            { backgroundColor: theme.status.success },
                            activeTab === 'groups' && { backgroundColor: theme.status.info }
                        ]}
                        onPress={() => activeTab === 'groups' ? handleCreateGroup() : handleCreatePlayer()}
                    >
                        <Ionicons name="add" size={24} color={theme.components.button.primary.text} />
                        <Text style={[styles.addButtonText, { color: theme.components.button.primary.text }]}>Nuevo</Text>
                    </TouchableOpacity>
                </PermissionGate>
            </View>

            {/* Tabs */}
            <View style={styles.tabsContainer}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.tabsContent}
                >
                    <TouchableOpacity
                        style={[
                            styles.tab,
                            { backgroundColor: theme.background.subtle, borderColor: theme.border.subtle },
                            activeTab === 'active' && [styles.activeTab, { backgroundColor: theme.status.success, borderColor: theme.status.success }]
                        ]}
                        onPress={() => setActiveTab('active')}
                    >
                        <Ionicons
                            name="people"
                            size={16}
                            color={activeTab === 'active' ? theme.components.button.primary.text : theme.status.success}
                            style={{ marginRight: 6 }}
                        />
                        <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>
                            Activos
                        </Text>
                        {activeCount > 0 && (
                            <View style={[styles.badge, { backgroundColor: theme.status.success }]}>
                                <Text style={[styles.badgeText, { color: theme.components.button.primary.text }]}>
                                    {activeCount}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.tab,
                            { backgroundColor: theme.background.subtle, borderColor: theme.border.subtle },
                            activeTab === 'groups' && [styles.groupsTab, { backgroundColor: theme.status.info, borderColor: theme.status.info }]
                        ]}
                        onPress={() => setActiveTab('groups')}
                    >
                        <Ionicons
                            name="people-circle"
                            size={16}
                            color={activeTab === 'groups' ? theme.components.button.primary.text : theme.status.info}
                            style={{ marginRight: 6 }}
                        />

                        <Text style={[styles.tabText, activeTab === 'groups' && styles.activeTabText]}>
                            Grupos
                        </Text>
                        {groupsCount > 0 && (
                            <View style={[styles.badge, { backgroundColor: theme.status.info }]}>
                                <Text style={[styles.badgeText, { color: theme.components.button.primary.text }]}>{groupsCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.tab,
                            { backgroundColor: theme.background.subtle, borderColor: theme.border.subtle },
                            activeTab === 'no_plan' && [styles.noPlanTab, { backgroundColor: theme.status.error, borderColor: theme.status.error }]
                        ]}
                        onPress={() => setActiveTab('no_plan')}
                    >
                        <Ionicons
                            name="alert-circle"
                            size={16}
                            color={activeTab === 'no_plan' ? theme.components.button.primary.text : theme.status.error}
                            style={{ marginRight: 6 }}
                        />
                        <Text style={[styles.tabText, activeTab === 'no_plan' && styles.activeTabText]}>
                            Sin Plan
                        </Text>
                        {noPlanCount > 0 && (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{noPlanCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.tab,
                            { backgroundColor: theme.background.subtle, borderColor: theme.border.subtle },
                            activeTab === 'archived' && [styles.archivedTab, { backgroundColor: theme.text.tertiary, borderColor: theme.text.tertiary }]
                        ]}
                        onPress={() => setActiveTab('archived')}
                    >
                        <Ionicons
                            name="archive"
                            size={16}
                            color={activeTab === 'archived' ? theme.components.button.primary.text : theme.text.tertiary}
                            style={{ marginRight: 6 }}
                        />
                        <Text style={[styles.tabText, activeTab === 'archived' && styles.activeTabText]}>
                            Archivados
                        </Text>
                        {archivedCount > 0 && (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{archivedCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </ScrollView>
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
                    contentContainerStyle={{
                        paddingHorizontal: spacing.md,
                        flexGrow: 1,
                        paddingBottom: 80
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
                                            activeTab === 'no_plan' ? "alert-circle-outline" :
                                                activeTab === 'groups' ? "people-circle-outline" : "people-outline"
                                    }
                                    size={64}
                                    color={theme.text.disabled || theme.text.tertiary}
                                />
                                <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
                                    {activeTab === 'archived' ? (t('noArchivedPlayersFound') || "No hay elementos archivados") :
                                        activeTab === 'no_plan' ? "No hay elementos sin plan" :
                                            activeTab === 'groups' ? "No hay grupos creados" :
                                                (t('noPlayersFound') || "No se encontraron alumnos")}
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
                type="warning"
                title="Archivar Alumno"
                message="¿Estás seguro de archivar este alumno? Dejará de aparecer en la lista de activos."
                buttonText="Archivar"
                showCancel
                onClose={() => setDeleteConfirmVisible(false)}
                onConfirm={handleConfirmDelete}
            />

            <StatusModal
                visible={reactivateConfirmVisible}
                type="warning"
                title="Reactivar Alumno"
                message="¿Estás seguro de reactivar este alumno? Volverá a aparecer en la lista de activos."
                buttonText="Reactivar"
                showCancel
                onClose={() => setReactivateConfirmVisible(false)}
                onConfirm={handleConfirmReactivate}
            />

            <StatusModal
                visible={archiveGroupConfirmVisible}
                type="warning"
                title="Archivar Grupo"
                message={`¿Estás seguro de archivar el grupo "${groupToArchive?.name}"? Dejará de aparecer en la lista activa.`}
                buttonText="Archivar"
                showCancel
                onClose={() => setArchiveGroupConfirmVisible(false)}
                onConfirm={handleConfirmArchiveGroup}
            />

            <StatusModal
                visible={restoreGroupConfirmVisible}
                type="warning"
                title="Restaurar Grupo"
                message={`¿Estás seguro de restaurar el grupo "${groupToRestore?.name}"? Volverá a la lista de grupos activos.`}
                buttonText="Restaurar"
                showCancel
                onClose={() => setRestoreGroupConfirmVisible(false)}
                onConfirm={handleConfirmRestoreGroup}
            />

            {/* Permanent Delete Modals */}
            <StatusModal
                visible={permanentDeletePlayerVisible}
                type="error"
                title="Eliminar Definitivamente"
                message="¿Estás seguro de eliminar definitivamente este alumno? Desaparecerá de la vista pero el historial de sesiones y pagos se mantendrá."
                buttonText="Eliminar"
                showCancel
                onClose={() => setPermanentDeletePlayerVisible(false)}
                onConfirm={handleConfirmPermanentDeletePlayer}
            />

            <StatusModal
                visible={permanentDeleteGroupVisible}
                type="error"
                title="Eliminar Definitivamente"
                message={`¿Estás seguro de eliminar definitivamente el grupo "${groupToDelete?.name}"? Desaparecerá de la vista pero el historial de sesiones se mantendrá. Los miembros del grupo NO serán afectados.`}
                buttonText="Eliminar"
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
        marginTop: spacing.sm,
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
        backgroundColor: theme.text.secondary,
        borderColor: theme.text.secondary,
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
        fontWeight: '500',
        color: theme.components.button.primary.bg,
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
