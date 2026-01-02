import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Avatar } from '@/src/design/components/Avatar';
import { Button } from '@/src/design/components/Button';
import { Card } from '@/src/design/components/Card';
import { Input } from '@/src/design/components/Input';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { usePlayers } from '@/src/features/players/hooks/usePlayers';

export default function PlayersScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    const { data: players, isLoading, refetch } = usePlayers(searchQuery, showArchived);

    const renderPlayerItem = ({ item }: { item: any }) => (
        <TouchableOpacity
            onPress={() => router.push(`/players/${item.id}`)}
            activeOpacity={0.7}
        >
            <Card style={styles.playerCard} padding="md">
                <View style={styles.playerInfo}>
                    <Avatar name={item.full_name} source={item.avatar_url} size="md" />
                    <View style={styles.playerDetails}>
                        <Text style={styles.playerName}>{item.full_name}</Text>
                        <View style={styles.playerMeta}>
                            <Text style={styles.playerLevel}>{t(`level.${item.level || 'beginner'}`)}</Text>
                            {item.is_archived && (
                                <View style={styles.archivedBadge}>
                                    <Text style={styles.archivedBadgeText}>{t('archived')}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.neutral[400]} />
                </View>
            </Card>
        </TouchableOpacity>
    );

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

            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tab, !showArchived && styles.activeTab]}
                    onPress={() => setShowArchived(false)}
                >
                    <Text style={[styles.tabText, !showArchived && styles.activeTabText]}>{t('tabPlayers')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, showArchived && styles.activeTab]}
                    onPress={() => setShowArchived(true)}
                >
                    <Text style={[styles.tabText, showArchived && styles.activeTabText]}>{t('showArchived')}</Text>
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
        marginTop: 2,
    },
    playerLevel: {
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
