import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { PermissionGate } from '@/src/components/PermissionGate';
import StatusModal from '@/src/components/StatusModal';
import { Avatar } from '@/src/design/components/Avatar';
import { Card } from '@/src/design/components/Card';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useUserAcademies } from '@/src/features/academy/hooks/useAcademy';
import { useClassGroupMutations, useClassGroups } from '@/src/features/calendar/hooks/useClassGroups';
import { usePlayerMutations } from '@/src/features/players/hooks/usePlayerMutations';
import { usePlayers } from '@/src/features/players/hooks/usePlayers';
import { useViewStore } from '@/src/store/useViewStore';
import { ClassGroup } from '@/src/types/classGroups';

export default function PlayersScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'active' | 'groups' | 'no_plan' | 'archived'>('active');
    const [searchQuery, setSearchQuery] = useState('');
    const { isGlobalView } = useViewStore();
    const { data: academiesData } = useUserAcademies();
    const allAcademies = academiesData ? [...(academiesData.active || []), ...(academiesData.archived || [])] : [];

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
        const groupsNoPlan = activeGroups?.filter(g => !g.plan_id).length || 0;
        return playersNoPlan + groupsNoPlan;
    }, [allActivePlayers, activeGroups]);

    const archivedCount = (archivedPlayers?.length || 0) + (archivedGroups?.length || 0);

    // Derived state: Filtered List for Display
    const filteredData = useMemo(() => {
        let players = (activeTab === 'archived' ? archivedPlayers : allActivePlayers) || [];
        let groups: ClassGroup[] = [];

        // Determine which groups to include
        if (activeTab === 'groups') {
            groups = (activeGroups || []).filter(g => g.plan_id);
        } else if (activeTab === 'no_plan') {
            groups = (activeGroups || []).filter(g => !g.plan_id);
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

    const handleEditGroup = (group: ClassGroup) => {
        router.push(`/class-groups?edit=${group.id}` as any);
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
            await archiveGroup.mutateAsync(groupToArchive.id);
            setGroupToArchive(null);
        }
        setArchiveGroupConfirmVisible(false);
    };

    const handleConfirmRestoreGroup = async () => {
        if (groupToRestore) {
            await unarchiveGroup.mutateAsync(groupToRestore.id);
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
            await deletePlayer.mutateAsync(playerToDelete);
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
            await deleteGroup.mutateAsync(groupToDelete.id);
            setGroupToDelete(null);
        }
        setPermanentDeleteGroupVisible(false);
    };

    // Render Group Item
    const renderGroupItem = ({ item }: { item: ClassGroup }) => (
        <Card style={styles.playerCard} padding="md">
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
                                <Ionicons name="people" size={24} color={colors.secondary[500]} />
                            )}
                        </View>
                        <View style={{ flex: 1, marginLeft: spacing.md }}>
                            <Text style={styles.playerName}>{item.name}</Text>

                            {/* Plan Row */}
                            {item.plan ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                    <Ionicons name="pricetag-outline" size={12} color={colors.primary[600]} style={{ marginRight: 4 }} />
                                    <Text style={{ fontSize: 12, color: colors.primary[700], fontWeight: '500' }}>
                                        {item.plan.name}
                                    </Text>
                                </View>
                            ) : (
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                    <Ionicons name="alert-circle-outline" size={12} color={colors.warning[600]} style={{ marginRight: 4 }} />
                                    <Text style={{ fontSize: 12, color: colors.warning[700], fontWeight: '500' }}>
                                        Sin plan asignado
                                    </Text>
                                </View>
                            )}

                            {/* Members Row */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                <Ionicons name="people-outline" size={12} color={colors.neutral[500]} style={{ marginRight: 4 }} />
                                <Text style={{ fontSize: 12, color: colors.neutral[500] }}>
                                    {item.member_count} {item.member_count === 1 ? 'alumno' : 'alumnos'}
                                    {item.members?.length ? ` • ${item.members.map(m => allActivePlayers?.find(p => p.id === m.player_id)?.full_name).filter(Boolean).join(', ')}` : ''}
                                </Text>
                            </View>

                            {/* Notes Row */}
                            {item.description && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                    <Ionicons name="document-text-outline" size={12} color={colors.neutral[400]} style={{ marginRight: 4 }} />
                                    <Text style={{ fontSize: 12, color: colors.neutral[500] }} numberOfLines={1}>
                                        {item.description}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
                <View style={styles.actionButtons}>
                    <View style={styles.iconRow}>
                        <TouchableOpacity
                            style={styles.actionIconBtn}
                            activeOpacity={0.5}
                            onPress={() => handleEditGroup(item)}
                        >
                            <Ionicons name="create-outline" size={20} color={colors.warning[500]} />
                        </TouchableOpacity>

                        {activeTab === 'archived' ? (
                            <>
                                <TouchableOpacity
                                    style={styles.actionIconBtn}
                                    activeOpacity={0.5}
                                    onPress={() => handleRestoreGroupPress(item)}
                                >
                                    <Ionicons name="refresh-outline" size={20} color={colors.primary[500]} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.actionIconBtn}
                                    activeOpacity={0.5}
                                    onPress={() => handlePermanentDeleteGroupPress(item)}
                                >
                                    <Ionicons name="trash" size={20} color={colors.error[600]} />
                                </TouchableOpacity>
                            </>
                        ) : (
                            <TouchableOpacity
                                style={styles.actionIconBtn}
                                activeOpacity={0.5}
                                onPress={() => handleArchiveGroupPress(item)}
                            >
                                <Ionicons name="trash-outline" size={20} color={colors.error[500]} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        </Card>
    );

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
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Text style={styles.playerName}>{item.full_name}</Text>
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
                                                    <Ionicons name="pricetag-outline" size={12} color={colors.primary[600]} />
                                                    <Text style={styles.planRowText} numberOfLines={1}>
                                                        {sub.plan?.name || 'Plan'}
                                                    </Text>
                                                </View>
                                                {details && (
                                                    <Text style={styles.planDetailsText} numberOfLines={1}>
                                                        {details}
                                                    </Text>
                                                )}
                                            </View>
                                        );
                                    })
                                ) : (
                                    <View style={styles.planRow}>
                                        <Text style={styles.roleBadgeText}>
                                            {item.intended_role === 'coach' ? 'Entrenador' : 'Alumno'}
                                        </Text>
                                    </View>
                                )}
                                {/* Badge de Pago Unificado - renglón separado */}
                                {item.unified_payment_group_id && (
                                    <View style={styles.unifiedPaymentRow}>
                                        <Ionicons name="wallet-outline" size={12} color={colors.primary[600]} />
                                        <Text style={styles.unifiedPaymentRowText}>Pago Unificado</Text>
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
                                                <View key={group.id} style={styles.groupBadge}>
                                                    <Ionicons name="people" size={12} color={colors.secondary[600]} />
                                                    <Text style={styles.groupBadgeText} numberOfLines={1}>
                                                        {group.name}
                                                    </Text>
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                {item.notes ? (
                                    <View style={styles.notesContainer}>
                                        <Ionicons name="document-text-outline" size={12} color={colors.neutral[500]} />
                                        <Text style={styles.notesText} numberOfLines={1} ellipsizeMode="tail">
                                            Notas: {item.notes}
                                        </Text>
                                    </View>
                                ) : null}
                            </View>
                        </View>
                    </TouchableOpacity>

                    <View style={styles.actionButtons}>
                        <View style={styles.iconRow}>
                            {isGlobalView && item.academy_id && (
                                <View style={{
                                    backgroundColor: colors.neutral[100],
                                    paddingHorizontal: 6,
                                    paddingVertical: 2,
                                    borderRadius: 4,
                                    marginRight: 4,
                                    justifyContent: 'center',
                                    height: 24, // Match icon button height roughly or center it
                                    alignSelf: 'center'
                                }}>
                                    <Text style={{
                                        fontSize: 10,
                                        color: colors.neutral[500],
                                        fontWeight: '500'
                                    }}>
                                        {allAcademies.find(a => a.id === item.academy_id)?.name || 'Academia'}
                                    </Text>
                                </View>
                            )}
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
                            {activeTab === 'archived' ? (
                                <>
                                    <TouchableOpacity
                                        style={styles.actionIconBtn}
                                        activeOpacity={0.5}
                                        onPress={() => handleReactivatePress(item.id)}
                                    >
                                        <Ionicons name="refresh-outline" size={20} color={colors.primary[500]} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.actionIconBtn}
                                        activeOpacity={0.5}
                                        onPress={() => handlePermanentDeletePlayerPress(item.id)}
                                    >
                                        <Ionicons name="trash" size={20} color={colors.error[600]} />
                                    </TouchableOpacity>
                                </>
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
            <Stack.Screen
                options={{
                    headerShown: true, // Inherits from _layout
                }}
            />

            {/* Search and Add */}
            <View style={styles.searchAndAddContainer}>
                <View style={[styles.searchContainer, { flex: 1 }]}>
                    <Ionicons name="search" size={20} color={colors.neutral[400]} style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder={activeTab === 'groups' ? "Buscar grupos..." : (t('searchPlayers') || "Buscar alumnos...")}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholderTextColor={colors.neutral[400]}
                    />
                </View>
                <PermissionGate permission="players.create">
                    <TouchableOpacity
                        style={[styles.addButton, activeTab === 'groups' && { backgroundColor: colors.secondary[500] }]}
                        onPress={() => activeTab === 'groups' ? router.push('/class-groups?create=true' as any) : router.push('/players/new')}
                    >
                        <Ionicons name="add" size={24} color={colors.common.white} />
                        <Text style={styles.addButtonText}>Nuevo</Text>
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
                        style={[styles.tab, activeTab === 'active' && styles.activeTab]}
                        onPress={() => setActiveTab('active')}
                    >
                        <Ionicons
                            name="people"
                            size={16}
                            color={activeTab === 'active' ? colors.common.white : colors.success[500]}
                            style={{ marginRight: 6 }}
                        />
                        <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>
                            Activos
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'groups' && styles.groupsTab]}
                        onPress={() => setActiveTab('groups')}
                    >
                        <Ionicons
                            name="people-circle"
                            size={16}
                            color={activeTab === 'groups' ? colors.common.white : colors.secondary[500]}
                            style={{ marginRight: 6 }}
                        />
                        <Text style={[styles.tabText, activeTab === 'groups' && styles.activeTabText]}>
                            Grupos
                        </Text>
                        {groupsCount > 0 && (
                            <View style={[styles.badge, { backgroundColor: colors.secondary[500] }]}>
                                <Text style={styles.badgeText}>{groupsCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'no_plan' && styles.noPlanTab]}
                        onPress={() => setActiveTab('no_plan')}
                    >
                        <Ionicons
                            name="alert-circle"
                            size={16}
                            color={activeTab === 'no_plan' ? colors.common.white : colors.neutral[500]}
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
                        style={[styles.tab, activeTab === 'archived' && styles.archivedTab]}
                        onPress={() => setActiveTab('archived')}
                    >
                        <Ionicons
                            name="archive"
                            size={16}
                            color={activeTab === 'archived' ? colors.common.white : colors.neutral[400]}
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
                    <ActivityIndicator size="large" color={colors.primary[500]} />
                </View>
            ) : (
                <FlatList
                    data={filteredData}
                    keyExtractor={(item) => item.id}
                    renderItem={renderMixedItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={isLoading} onRefresh={handleRefetch} tintColor={colors.primary[500]} />
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
                                    color={colors.neutral[300]}
                                />
                                <Text style={styles.emptyText}>
                                    {activeTab === 'archived' ? (t('noArchivedPlayersFound') || "No hay elementos archivados") :
                                        activeTab === 'no_plan' ? "No hay elementos sin plan" :
                                            activeTab === 'groups' ? "No hay grupos creados" :
                                                (t('noPlayersFound') || "No se encontraron alumnos")}
                                </Text>
                            </View>
                        ) : null
                    }
                />
            )}

            {/* Modals */}
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
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.neutral[50],
    },
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.sm,
        paddingTop: spacing.xl,
        backgroundColor: colors.common.white,
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
        backgroundColor: colors.common.white,
        borderRadius: 12,
        paddingHorizontal: spacing.md,
        height: 48,
        borderWidth: 1,
        borderColor: colors.neutral[200],
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
        color: colors.neutral[900],
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.success[500],
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
        color: colors.common.white,
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
        backgroundColor: colors.neutral[100],
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.neutral[200],
    },
    activeTab: {
        backgroundColor: colors.success[500],
        borderColor: colors.success[500],
    },
    noPlanTab: {
        backgroundColor: colors.neutral[600],
        borderColor: colors.neutral[600],
    },
    archivedTab: {
        backgroundColor: colors.neutral[400],
        borderColor: colors.neutral[400],
    },
    groupsTab: {
        backgroundColor: colors.secondary[500],
        borderColor: colors.secondary[500],
    },
    activeTabText: {
        color: colors.common.white,
        fontWeight: '600',
    },
    tabText: {
        fontSize: typography.size.sm,
        color: colors.neutral[600],
        fontWeight: '500',
    },
    badge: {
        backgroundColor: colors.error[500],
        borderRadius: 10,
        minWidth: 14,
        height: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 6,
        paddingHorizontal: 4,
    },
    badgeText: {
        color: colors.common.white,
        fontSize: 9,
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
        color: colors.success[600],
        marginLeft: 16, // Align with text start (12px icon + 4px gap)
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
        color: colors.neutral[900],
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
        color: colors.neutral[500],
        flex: 1,
        fontStyle: 'italic',
    },
    roleBadge: {
        paddingHorizontal: spacing.xs,
        paddingVertical: 2,
        borderRadius: 4,
        backgroundColor: colors.neutral[100],
    },
    roleBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: colors.neutral[600],
    },
    planBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary[50],
        paddingHorizontal: spacing.xs,
        paddingVertical: 2,
        borderRadius: 4,
        gap: 4,
        flexShrink: 1,
    },
    planBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: colors.primary[700],
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
        backgroundColor: colors.secondary[50],
        paddingHorizontal: spacing.xs,
        paddingVertical: 2,
        borderRadius: 4,
        gap: 4,
    },
    groupBadgeText: {
        fontSize: 11,
        fontWeight: '500',
        color: colors.secondary[700],
    },
    unifiedPaymentBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary[50],
        paddingHorizontal: spacing.xs,
        paddingVertical: 2,
        borderRadius: 4,
        gap: 4,
        marginLeft: 4,
    },
    unifiedPaymentBadgeText: {
        fontSize: 11,
        fontWeight: '500',
        color: colors.primary[700],
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
        color: colors.primary[600],
    },
    unifiedPaymentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
        backgroundColor: colors.primary[50],
        paddingHorizontal: spacing.xs,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
    },
    unifiedPaymentRowText: {
        fontSize: 11,
        fontWeight: '500',
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
    groupIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: colors.secondary[50],
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
        backgroundColor: colors.secondary[500],
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
});
