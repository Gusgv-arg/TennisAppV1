import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import StatusModal from '@/src/components/StatusModal';
import { Avatar } from '@/src/design/components/Avatar';
import { Card } from '@/src/design/components/Card';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { usePlayerMutations } from '@/src/features/players/hooks/usePlayerMutations';
import { usePlayers } from '@/src/features/players/hooks/usePlayers';

export default function PlayersScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'active' | 'no_plan' | 'archived'>('active');
    const [searchQuery, setSearchQuery] = useState('');

    // Query 1: Fetch ALL active players for:
    // a) Client-side filtering (search)
    // b) "No Plan" badge count 
    // c) "Active" list
    const {
        data: allActivePlayers,
        isLoading: isLoadingActivePlayers,
        refetch: refetchActive
    } = usePlayers('', 'active');

    // Query 2: Fetch Archived players (server-side filtering is fine here)
    const {
        data: archivedPlayers,
        isLoading: isLoadingArchived,
        refetch: refetchArchived
    } = usePlayers(searchQuery, 'archived');

    // Derived state: No Plan Count
    const noPlanCount = useMemo(() => {
        return allActivePlayers?.filter(p => !p.has_plan).length || 0;
    }, [allActivePlayers]);

    // Derived state: Filtered List for Display
    const filteredData = useMemo(() => {
        if (activeTab === 'archived') {
            return archivedPlayers || [];
        }

        let data = allActivePlayers || [];

        // Client-side search for Active/NoPlan
        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            data = data.filter(p => p.full_name.toLowerCase().includes(lowerQuery));
        }

        // Tab specific filter
        if (activeTab === 'no_plan') {
            data = data.filter(p => !p.has_plan);
        }

        return data;
    }, [activeTab, searchQuery, allActivePlayers, archivedPlayers]);

    // Loading & Refetching
    const isLoading = activeTab === 'archived' ? isLoadingArchived : isLoadingActivePlayers;

    const handleRefetch = () => {
        refetchActive();
        refetchArchived();
    };

    const { archivePlayer, unarchivePlayer } = usePlayerMutations();
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [reactivateConfirmVisible, setReactivateConfirmVisible] = useState(false);
    const [playerToProcess, setPlayerToProcess] = useState<string | null>(null);

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

    // Render Item (Restored Inline)
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
                                <Text style={styles.playerName}>{item.full_name}</Text>
                                <View style={styles.playerMeta}>
                                    {item.active_subscription?.plan?.name ? (
                                        <View style={styles.planBadge}>
                                            <Ionicons name="pricetag-outline" size={12} color={colors.primary[600]} />
                                            <Text style={styles.planBadgeText}>
                                                {item.active_subscription.plan.name}
                                            </Text>
                                        </View>
                                    ) : (
                                        <View style={styles.roleBadge}>
                                            <Text style={styles.roleBadgeText}>
                                                {item.intended_role === 'coach' ? 'Entrenador' : 'Alumno'}
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
                            {activeTab === 'archived' ? (
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
                        placeholder={t('searchPlayers') || "Buscar alumnos..."}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholderTextColor={colors.neutral[400]}
                    />
                </View>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => router.push('/players/new')}
                >
                    <Ionicons name="add" size={24} color={colors.common.white} />
                    <Text style={styles.addButtonText}>{t('newPlayer') || "Nuevo Alumno"}</Text>
                </TouchableOpacity>
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
                    renderItem={renderPlayerItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={isLoading} onRefresh={handleRefetch} tintColor={colors.primary[500]} />
                    }
                    ListEmptyComponent={
                        !isLoading ? (
                            <View style={styles.emptyContainer}>
                                <Ionicons
                                    name={
                                        activeTab === 'archived' ? "archive-outline" :
                                            activeTab === 'no_plan' ? "alert-circle-outline" : "people-outline"
                                    }
                                    size={64}
                                    color={colors.neutral[300]}
                                />
                                <Text style={styles.emptyText}>
                                    {activeTab === 'archived' ? (t('noArchivedPlayersFound') || "No hay alumnos archivados") :
                                        activeTab === 'no_plan' ? "No hay alumnos sin plan" :
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
        flexDirection: 'row',
        paddingHorizontal: spacing.md,
        marginBottom: spacing.md,
        gap: spacing.sm,
    },
    tabsContent: {
        gap: spacing.sm,
        paddingRight: spacing.md,
    },
    tab: {
        flexDirection: 'row',
        paddingVertical: 8,
        paddingHorizontal: 16,
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
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 6,
        paddingHorizontal: 4,
    },
    badgeText: {
        color: colors.common.white,
        fontSize: 10,
        fontWeight: 'bold',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
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
    },
    planBadgeText: {
        fontSize: 11,
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
