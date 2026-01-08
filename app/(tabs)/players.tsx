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
    const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
    const [searchQuery, setSearchQuery] = useState('');
    const { data: allPlayers, isLoading, refetch } = usePlayers(searchQuery, activeTab === 'archived');

    // Filter players is now handled by the hook's showArchived param mostly, 
    // but if the hook returns all, we might need to filter. 
    // Assuming usePlayers handles 'showArchived' correctly by fetching the right data.
    // If we look at previous code: `usePlayers(searchQuery, showArchived)`
    // So `activeTab === 'archived'` passed to usePlayers should work.

    // We strictly show only players, no roles needed as user requested.
    // However, the previous logic filtered by 'intended_role'. 
    // If the API returns mixed users, we should force filter for players.
    const players = allPlayers?.filter(p => (p.intended_role === 'player' || !p.intended_role));

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
                                    {/* Always show Alumni label or Plan */}
                                    {item.active_subscription?.plan?.name ? (
                                        <View style={styles.planBadge}>
                                            <Ionicons name="pricetag-outline" size={12} color={colors.primary[600]} />
                                            <Text style={styles.planBadgeText}>
                                                {item.active_subscription.plan.name}
                                            </Text>
                                        </View>
                                    ) : (
                                        <View style={styles.roleBadge}>
                                            <Text style={styles.roleBadgeText}>Alumno</Text>
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
            <Text style={styles.subheader}>Gestioná tus alumnos</Text>

            <View style={styles.searchContainer}>
                <Input
                    placeholder={t('searchPlayers')}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    leftIcon={<Ionicons name="search" size={20} color={colors.neutral[400]} />}
                    containerStyle={styles.searchInput}
                />
                <Button
                    label={t('newPlayer')} // Assuming 'Nuevo' or similar
                    onPress={() => router.push('/players/new')}
                    size="md"
                    style={styles.addButton}
                    leftIcon={<Ionicons name="add" size={20} color={colors.common.white} />}
                />
            </View>

            {/* Status Tabs */}
            <View style={styles.tabsContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'active' && styles.activeTab]}
                    onPress={() => setActiveTab('active')}
                >
                    <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={activeTab === 'active' ? colors.common.white : colors.success[500]}
                        style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>
                        Activos
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tab, activeTab === 'archived' && styles.activeTab]}
                    onPress={() => setActiveTab('archived')}
                >
                    <Ionicons
                        name="archive"
                        size={16}
                        color={activeTab === 'archived' ? colors.common.white : colors.neutral[500]}
                        style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.tabText, activeTab === 'archived' && styles.activeTabText]}>
                        Archivados
                    </Text>
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
                                name={activeTab === 'archived' ? "archive-outline" : "people-outline"}
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
        backgroundColor: colors.neutral[50], // Check consistent bg color
    },
    // Search & Add Button Container
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.md,
        gap: spacing.sm,
    },
    searchInput: {
        flex: 1,
        marginBottom: 0,
        backgroundColor: colors.common.white, // Usually inputs have white bg
    },
    addButton: {
        height: 48, // Match input height roughly
        paddingHorizontal: spacing.md,
        backgroundColor: colors.success[500], // Match the green button in reference
    },
    // Tabs Container (Activos / Archivados)
    tabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: spacing.md,
        marginBottom: spacing.md,
        gap: spacing.sm,
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        backgroundColor: colors.neutral[200],
    },
    activeTab: {
        backgroundColor: colors.success[500], // Green for Activos
    },
    tabText: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        color: colors.neutral[600],
    },
    activeTabText: {
        color: colors.common.white,
    },
    subheader: {
        fontSize: typography.size.md,
        color: colors.neutral[500],
        marginBottom: spacing.md,
        paddingHorizontal: spacing.md,
    },
    listContent: {
        padding: spacing.md,
        paddingTop: 0,
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
        backgroundColor: colors.primary[50], // Keep branding for paid plans
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
