import { useTheme } from '@/src/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    useWindowDimensions
} from 'react-native';
import { Theme } from '../../../design/theme';
import { spacing } from '../../../design/tokens/spacing';
import { typography } from '../../../design/tokens/typography';
import type { PlayerBalance, UnifiedPaymentGroup } from '../../../types/payments';
import { useAutoBilling } from '../hooks/useAutoBilling';
import { usePaymentStats, usePlayerBalances } from '../hooks/usePayments';
import { usePaymentSettings } from '../hooks/usePaymentSettings';
import { useUnifiedPaymentGroupBalances } from '../hooks/useUnifiedPaymentGroups';
import PaymentHistoryModal from './PaymentHistoryModal';
import RegisterPaymentModal from './RegisterPaymentModal';

export default function PaymentsScreen() {
    const { theme } = useTheme();
    const styles = React.useMemo(() => createStyles(theme), [theme]);
    const { t } = useTranslation();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 768;
    const router = useRouter();
    const { search, playerId, unifiedGroupId } = useLocalSearchParams<{ search?: string; playerId?: string; unifiedGroupId?: string }>();
    const { data: balances, isLoading, refetch, isRefetching } = usePlayerBalances();
    const { data: stats } = usePaymentStats();
    const { isSimplifiedMode } = usePaymentSettings();
    const { runAutoBilling } = useAutoBilling();

    useFocusEffect(
        useCallback(() => {
            runAutoBilling();
            refetch();
        }, [])
    );

    const [selectedPlayer, setSelectedPlayer] = useState<PlayerBalance | null>(null);
    const [selectedGroup, setSelectedGroup] = useState<UnifiedPaymentGroup | null>(null);
    const [paymentModalVisible, setPaymentModalVisible] = useState(false);
    const [historyModalVisible, setHistoryModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState<'all' | 'debtors' | 'upToDate'>('all');
    const [paymentMode, setPaymentMode] = useState<'default' | 'quick_pay'>('default');

    // Hook para balances de grupos de pago unificado
    const { data: unifiedGroupBalances, isLoading: isLoadingGroups } = useUnifiedPaymentGroupBalances();

    // Sincronizar búsqueda desde params
    React.useEffect(() => {
        if (search) {
            setSearchQuery(search);
        }
    }, [search]);

    // Abrir detalle automáticamente si viene un playerId O unifiedGroupId
    React.useEffect(() => {
        if (playerId && balances) {
            const player = balances.find(b => b.player_id === playerId);
            if (player) {
                setSelectedPlayer(player);
                // Si viene también unifiedGroupId, significa que queremos ver el historial del grupo
                if (unifiedGroupId && unifiedGroupBalances) {
                    const group = unifiedGroupBalances.find(g => g.id === unifiedGroupId);
                    if (group) {
                        setSelectedGroup(group);
                    }
                }
                setHistoryModalVisible(true);
            }
        }
    }, [playerId, unifiedGroupId, balances, unifiedGroupBalances]);

    const formatCurrency = (value: number) => {
        if (isSimplifiedMode) {
            return value > 0 ? '✓' : value < 0 ? '✗' : '-';
        }
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 0,
        }).format(value);
    };

    const handlePlayerTap = (player: PlayerBalance) => {
        setSelectedPlayer(player);
        setSelectedGroup(null);
        setHistoryModalVisible(true);
    };

    const handleGroupTap = (group: UnifiedPaymentGroup) => {
        setSelectedGroup(group);
        setSelectedPlayer(null);
        setHistoryModalVisible(true);
    };

    const handleRegisterPayment = (player: PlayerBalance, mode: 'default' | 'quick_pay') => {
        setSelectedPlayer(player);
        setPaymentMode(mode);
        setPaymentModalVisible(true);
    };

    const handleAdjustBalance = (player: PlayerBalance) => {
        setSelectedPlayer(player);
        setSelectedGroup(null);
        setPaymentMode('default');
        setPaymentModalVisible(true);
    };

    const handleAdjustGroupBalance = (group: UnifiedPaymentGroup) => {
        if (group.members && group.members.length > 0) {
            const firstMember = balances?.find(b => b.player_id === group.members?.[0]?.id);
            if (firstMember) {
                setSelectedPlayer(firstMember);
                setSelectedGroup(group);
                setPaymentMode('default');
                setPaymentModalVisible(true);
            }
        }
    };

    const handleRegisterGroupPayment = (group: UnifiedPaymentGroup, mode: 'default' | 'quick_pay' = 'default') => {
        // Para registrar un pago a un grupo, necesitamos un player_id de referencia
        // Usamos el primer miembro del grupo si existe
        if (group.members && group.members.length > 0) {
            const firstMember = balances?.find(b => b.player_id === group.members?.[0]?.id);
            if (firstMember) {
                setSelectedPlayer(firstMember);
                setSelectedGroup(group);
                setPaymentMode(mode);
                setPaymentModalVisible(true);
            }
        }
    };

    // Procesar y agrupar datos
    const processedData = React.useMemo(() => {
        // No procesar hasta que ambos hooks estén listos
        if (!balances) return [];
        if (isLoadingGroups) return [];

        // Filtrar: Si tiene unified_payment_group_id, ES parte de un grupo. No mostrar como individual.
        const individualPlayers = balances.filter(b => !b.unified_payment_group_id);

        const data: any[] = [];

        // Agregar grupos primero
        if (unifiedGroupBalances) {
            unifiedGroupBalances.forEach(group => {
                // Buscar miembros directamente por unified_payment_group_id en balances
                const groupMembers = balances.filter(b => b.unified_payment_group_id === group.id);

                data.push({
                    type: 'group',
                    id: group.id,
                    data: group,
                    members: groupMembers
                });
            });
        }

        // Agregar alumnos individuales
        individualPlayers.forEach(player => {
            data.push({
                type: 'individual',
                id: player.player_id,
                data: player
            });
        });

        // Filtrar según búsqueda y filtros
        return data.filter(item => {
            if (item.type === 'individual') {
                const player = item.data;
                const matchesSearch = player.full_name.toLowerCase().includes(searchQuery.toLowerCase());
                const matchesFilter = activeFilter === 'all' ? true :
                    activeFilter === 'debtors' ? player.balance < 0 :
                        player.balance >= 0;
                return matchesSearch && matchesFilter;
            } else {
                const group = item.data;
                const members = item.members;
                const matchesSearch = group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    members.some((m: PlayerBalance) => m.full_name.toLowerCase().includes(searchQuery.toLowerCase()));

                const balance = group.total_balance || 0;
                const matchesFilter = activeFilter === 'all' ? true :
                    activeFilter === 'debtors' ? balance < 0 :
                        balance >= 0;
                return matchesSearch && matchesFilter;
            }
        }).sort((a, b) => {
            // Ordenar: Morosos primero
            const balanceA = a.type === 'group' ? a.data.total_balance || 0 : a.data.balance;
            const balanceB = b.type === 'group' ? b.data.total_balance || 0 : b.data.balance;
            return balanceA - balanceB;
        });

    }, [balances, unifiedGroupBalances, searchQuery, activeFilter, isLoadingGroups]);

    // Grid Layout Calculation
    const numColumns = isDesktop ? 3 : 1;
    const gap = spacing.md;
    const horizontalPadding = spacing.md * 2; // Approximate available width calculation
    // Note: In a real app we might want to measure the container, but for this simple grid:
    // width includes padding.
    // Container padding is spacing.md (16) on both sides = 32
    // We want 3 columns with gap.
    // total width = screenWidth
    // list container width = screenWidth
    // actual content width = screenWidth - (spacing.md * 2)
    // item width = (content width - (gap * (numColumns - 1))) / numColumns

    const listPadding = spacing.md;
    const totalGap = (numColumns - 1) * gap;
    const availableWidth = width - (listPadding * 2);
    const cardWidth = (availableWidth - totalGap) / numColumns;


    const renderSummary = () => (
        <View style={styles.summaryContainer}>
            <View style={[styles.summaryCard, { backgroundColor: theme.background.surface }]}>
                <Ionicons name="trending-up" size={24} color={theme.status.success} />
                <Text style={[styles.summaryValue, { color: theme.text.primary }]}>
                    {isSimplifiedMode ? (stats?.totalPlayers || 0) - (stats?.debtorsCount || 0) : formatCurrency(stats?.totalCollected || 0)}
                </Text>
                <Text style={[styles.summaryLabel, { color: theme.text.secondary }]}>{isSimplifiedMode ? 'Al día' : 'Cobrado (mes)'}</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: theme.background.surface }]}>
                <Ionicons name="alert-circle" size={24} color={theme.status.error} />
                <Text style={[styles.summaryValue, { color: theme.status.error }]}>
                    {isSimplifiedMode ? (stats?.debtorsCount || 0) : formatCurrency(stats?.totalPending || 0)}
                </Text>
                <Text style={[styles.summaryLabel, { color: theme.text.secondary }]}>{isSimplifiedMode ? 'Deben' : 'Pendiente'}</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: theme.background.surface }]}>
                <Ionicons name="people" size={24} color={theme.status.warning} />
                <Text style={[styles.summaryValue, { color: theme.text.primary }]}>
                    {stats?.debtorsCount || 0}/{stats?.totalPlayers || 0}
                </Text>
                <Text style={[styles.summaryLabel, { color: theme.text.secondary }]}>Deben</Text>
            </View>
        </View>
    );


    const renderSearchBar = () => (
        <View style={[styles.searchContainer, { marginBottom: 0, backgroundColor: theme.background.surface, borderColor: theme.border.subtle }]}>
            <Ionicons name="search" size={20} color={theme.text.secondary} style={styles.searchIcon} />
            <TextInput
                style={[styles.searchInput, { outlineStyle: 'none', color: theme.text.primary } as any]}
                placeholder="Buscar alumno..."
                placeholderTextColor={theme.text.tertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                    <Ionicons name="close-circle" size={20} color={theme.text.secondary} />
                </TouchableOpacity>
            )}
        </View>
    );

    const renderFilters = () => {
        // Contar entidades visibles (individuales + grupos)
        const totalEntities = processedData.length;
        const debtorEntities = processedData.filter(item => {
            const balance = item.type === 'group' ? (item.data.total_balance || 0) : item.data.balance;
            return balance < 0;
        }).length;

        const filters: { key: 'all' | 'debtors' | 'upToDate'; label: string; count?: number }[] = [
            { key: 'all', label: 'Todos', count: totalEntities },
            { key: 'debtors', label: 'Con deuda', count: debtorEntities },
            { key: 'upToDate', label: 'Al día', count: totalEntities - debtorEntities },
        ];

        return (
            <View style={[styles.filtersContainer, { marginBottom: 0 }]}>
                {filters.map((filter) => (
                    <TouchableOpacity
                        key={filter.key}
                        style={[
                            styles.filterPill,
                            { backgroundColor: theme.background.surface, borderColor: theme.border.subtle },
                            activeFilter === filter.key && [styles.filterPillActive, { backgroundColor: theme.components.button.primary.bg, borderColor: theme.components.button.primary.bg }],
                        ]}
                        onPress={() => setActiveFilter(filter.key)}
                    >
                        <Text style={[
                            styles.filterPillText,
                            { color: theme.text.secondary },
                            activeFilter === filter.key && [styles.filterPillTextActive, { color: theme.components.button.primary.text }],
                        ]}>
                            {filter.label} ({filter.count || 0})
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    const renderGroupItem = (item: any) => {
        const group = item.data;
        const members = item.members;
        const balance = group.total_balance || 0;
        const isDebtor = balance < 0;

        const allMemberNames = (group.members || []).map((m: any) => m.full_name).join(', ');
        const hasName = group.name && group.name.trim().length > 0;

        return (
            <View style={{ width: cardWidth, marginBottom: gap }}>
                <View style={[styles.playerCard, { height: '100%', flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, backgroundColor: theme.background.surface }]}>
                    {/* Left: Icon + Name */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, marginRight: 4 }}>
                        <View style={[styles.groupIconContainer, { backgroundColor: theme.background.subtle }]}>
                            <Ionicons name="people" size={16} color={theme.components.button.primary.bg} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 6 }}>
                            <Text style={[styles.groupName, { color: theme.text.primary }]} numberOfLines={1}>{hasName ? group.name : allMemberNames}</Text>
                            {hasName && allMemberNames.length > 0 && (
                                <Text style={[styles.groupMembersText, { color: theme.text.secondary }]} numberOfLines={1}>{allMemberNames}</Text>
                            )}
                            <View style={[styles.unifiedBadgeSmall, { backgroundColor: theme.components.badge.primary }]}>
                                <Text style={[styles.unifiedBadgeTextSmall, { color: theme.components.button.primary.bg }]}>PAGO UNIFICADO</Text>
                            </View>
                        </View>
                    </View>

                    {/* Right: Balance + Actions */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={[
                            styles.groupBalanceAmount,
                            {
                                color: isDebtor ? theme.status.error : theme.status.success,
                                marginRight: spacing.sm,
                                fontSize: isDesktop ? typography.size.md : typography.size.sm
                            }
                        ]}>
                            {formatCurrency(balance)}
                        </Text>

                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={(e) => {
                                e.stopPropagation();
                                handleGroupTap(group);
                            }}
                        >
                            <Ionicons name="receipt-outline" size={20} color={theme.text.secondary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.paymentChip, styles.adjustmentChip, { paddingHorizontal: isDesktop ? spacing.md : spacing.sm, backgroundColor: theme.background.subtle, borderColor: theme.border.subtle }]}
                            onPress={(e) => {
                                e.stopPropagation();
                                handleAdjustGroupBalance(group);
                            }}
                        >
                            <Text style={[styles.secondaryPaymentChipText, { color: theme.text.secondary }]}>Ajuste</Text>
                        </TouchableOpacity>

                        {isDebtor && (
                            <TouchableOpacity
                                style={[styles.paymentChip, styles.primaryPaymentChip, { paddingHorizontal: isDesktop ? spacing.md : spacing.sm, backgroundColor: theme.components.button.primary.bg }]}
                                onPress={(e) => {
                                    e.stopPropagation();
                                    handleRegisterGroupPayment(group, 'quick_pay');
                                }}
                            >
                                <Text style={[styles.primaryPaymentChipText, { fontSize: 13, marginRight: 2, color: theme.components.button.primary.text }]}>$</Text>
                                <Text style={[styles.primaryPaymentChipText, { color: theme.components.button.primary.text }]}>Total</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        );
    };

    const renderPlayerItem = ({ item }: { item: any }) => {
        if (item.type === 'group') {
            return renderGroupItem(item);
        }

        const player = item.data;
        const isDebtor = player.balance < 0;

        return (
            <View style={{ width: cardWidth, marginBottom: gap }}>
                <TouchableOpacity
                    style={[styles.playerCard, { height: '100%', flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, backgroundColor: theme.background.surface }]}
                    onPress={() => handlePlayerTap(player)}
                    activeOpacity={0.7}
                >
                    {/* Left: Icon + Name */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, marginRight: 4 }}>
                        <View style={[styles.groupIconContainer, { width: 28, height: 28, backgroundColor: theme.background.subtle }]}>
                            <Ionicons name="person" size={14} color={theme.components.button.primary.bg} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 6 }}>
                            <Text style={[styles.playerName, { color: theme.text.primary }]} numberOfLines={1}>{player.full_name}</Text>

                        </View>
                    </View>

                    {/* Right: Balance + Actions */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={[
                            styles.groupBalanceAmount,
                            {
                                color: isDebtor ? theme.status.error : theme.status.success,
                                marginRight: spacing.sm,
                                fontSize: isDesktop ? typography.size.md : typography.size.sm
                            }
                        ]}>
                            {formatCurrency(player.balance)}
                        </Text>

                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={(e) => {
                                e.stopPropagation();
                                handlePlayerTap(player);
                            }}
                        >
                            <Ionicons name="receipt-outline" size={20} color={theme.text.secondary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.paymentChip, styles.adjustmentChip, { paddingHorizontal: isDesktop ? spacing.md : spacing.sm, backgroundColor: theme.background.subtle, borderColor: theme.border.subtle }]}
                            onPress={(e) => {
                                e.stopPropagation();
                                handleAdjustBalance(player);
                            }}
                        >
                            <Text style={[styles.secondaryPaymentChipText, { color: theme.text.secondary }]}>Ajuste</Text>
                        </TouchableOpacity>

                        {isDebtor && (
                            <TouchableOpacity
                                style={[styles.paymentChip, styles.primaryPaymentChip, { paddingHorizontal: isDesktop ? spacing.md : spacing.sm, backgroundColor: theme.components.button.primary.bg }]}
                                onPress={(e) => {
                                    e.stopPropagation();
                                    handleRegisterPayment(player, 'quick_pay');
                                }}
                            >
                                <Text style={[styles.primaryPaymentChipText, { fontSize: 13, marginRight: 2, color: theme.components.button.primary.text }]}>$</Text>
                                <Text style={[styles.primaryPaymentChipText, { color: theme.components.button.primary.text }]}>Total</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </TouchableOpacity>
            </View>
        );
    };



    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.components.button.primary.bg} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.background.default }]}>
            <FlatList
                key={numColumns} // Force re-render on column change
                data={processedData}
                keyExtractor={(item) => `${item.type}-${item.id}`}
                renderItem={renderPlayerItem}
                numColumns={numColumns}
                showsVerticalScrollIndicator={false}
                columnWrapperStyle={numColumns > 1 ? { gap: spacing.md } : undefined}
                refreshControl={
                    <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
                }
                ListHeaderComponent={
                    <>
                        {renderSummary()}
                        <View style={{
                            flexDirection: isDesktop ? 'row' : 'column',
                            marginBottom: spacing.lg,
                            marginTop: spacing.xl * 2,
                            alignItems: isDesktop ? 'center' : 'stretch',
                            justifyContent: 'flex-start' // Left align always
                        }}>
                            <View style={{ width: isDesktop ? 340 : 'auto', marginRight: isDesktop ? spacing.lg : 0, marginBottom: isDesktop ? 0 : spacing.md }}>
                                {renderSearchBar()}
                            </View>
                            <View>
                                {renderFilters()}
                            </View>
                        </View>
                    </>
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="wallet-outline" size={64} color={theme.text.tertiary} />
                        <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
                            {searchQuery || activeFilter !== 'all' ? 'No hay resultados' : 'No hay alumnos registrados'}
                        </Text>
                        <Text style={[styles.emptySubtext, { color: theme.text.tertiary }]}>
                            {searchQuery || activeFilter !== 'all'
                                ? 'Prueba con otro filtro o búsqueda'
                                : 'Agrega alumnos para comenzar a registrar pagos'}
                        </Text>
                    </View>
                }
                contentContainerStyle={[styles.listContent, { paddingBottom: 80 }]}
            // Removed ItemSeparatorComponent as we use gap/margin now
            // ItemSeparatorComponent={() => <View style={styles.separator} />} 
            />

            {selectedPlayer && (
                <RegisterPaymentModal
                    visible={paymentModalVisible}
                    onClose={() => {
                        setPaymentModalVisible(false);
                        setSelectedPlayer(null);
                        setSelectedGroup(null);
                    }}
                    playerId={selectedPlayer.player_id}
                    playerName={selectedPlayer.full_name}
                    currentBalance={selectedGroup ? (selectedGroup.total_balance || 0) : selectedPlayer.balance}
                    unifiedPaymentGroupId={selectedGroup?.id} // Si es grupo, pasamos el ID
                    initialIsUnified={!!selectedGroup} // Flag para indicar que viene dede grupo
                    mode={paymentMode}
                />
            )}

            {/* Unified Modal Master will handle all types: payment/adjustment */}

            {(selectedPlayer || selectedGroup) && (
                <PaymentHistoryModal
                    visible={historyModalVisible}
                    onClose={() => {
                        setHistoryModalVisible(false);
                        setSelectedPlayer(null);
                        setSelectedGroup(null);
                        // Clear URL params AND local state to prevent persistent filtering
                        if (playerId || search || unifiedGroupId) {
                            router.replace('/payments');
                            setSearchQuery(''); // Clear local search state
                        }
                    }}
                    onAddPayment={() => {
                        setHistoryModalVisible(false);
                        if (selectedGroup) {
                        } else {
                            setPaymentModalVisible(true);
                        }
                    }}
                    playerId={selectedPlayer?.player_id}
                    unifiedGroupId={selectedGroup?.id}
                    playerName={selectedGroup ? selectedGroup.name : selectedPlayer?.full_name || 'Jugador'}
                    currentBalance={selectedGroup ? (selectedGroup.total_balance || 0) : (selectedPlayer?.balance || 0)}
                />
            )}

        </View>
    );
}

const createStyles = (theme: Theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background.default,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: spacing.md,
    },
    summaryContainer: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },

    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.background.input,
        borderRadius: 12,
        paddingHorizontal: spacing.md,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: theme.border.subtle,
    },
    searchIcon: {
        marginRight: spacing.sm,
    },
    searchInput: {
        flex: 1,
        paddingVertical: spacing.sm,
        fontSize: typography.size.md,
        color: theme.text.primary,
    },
    clearButton: {
        padding: spacing.xs,
    },
    filtersContainer: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.lg,
    },
    filterPill: {
        paddingVertical: spacing.sm, // Match input padding (was xs)
        paddingHorizontal: spacing.md,
        borderRadius: 20,
        backgroundColor: theme.background.surface,
        borderWidth: 1,
        borderColor: theme.border.subtle,
    },
    filterPillActive: {
        backgroundColor: theme.components.button.primary.bg,
        borderColor: theme.components.button.primary.bg,
    },
    filterPillText: {
        fontSize: typography.size.sm,
        color: theme.text.secondary,
    },
    filterPillTextActive: {
        color: theme.components.button.primary.text,
        fontWeight: '600',
    },
    summaryCard: {
        flex: 1,
        backgroundColor: theme.background.surface,
        padding: spacing.md,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    summaryValue: {
        fontSize: typography.size.lg,
        fontWeight: '700',
        color: theme.text.primary,
        marginTop: spacing.xs,
    },
    summaryLabel: {
        fontSize: typography.size.xs,
        color: theme.text.secondary,
        marginTop: 2,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
        marginTop: spacing.sm,
    },
    sectionTitle: {
        fontSize: typography.size.md,
        fontWeight: '600',
    },
    countBadge: {
        marginLeft: spacing.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: 12,
    },
    countText: {
        fontSize: typography.size.xs,
        fontWeight: '600',
        color: 'white',
    },
    playerCard: {
        backgroundColor: theme.background.surface,
        padding: spacing.sm, // Reduced from md (16 -> 12)
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'nowrap', // Force same line for desktop
        gap: spacing.xs,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    playerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flexGrow: 1, // Allow growing
        minWidth: '100%', // Force full width for Name/Balance row on mobile wrap
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: spacing.sm,
    },
    playerDetails: {
        flex: 1,
    },
    playerName: {
        fontSize: typography.size.md,
        fontWeight: '600',
        color: theme.text.primary,
    },
    lastPayment: {
        fontSize: typography.size.xs,
        color: theme.text.secondary,
        marginTop: 2,
    },
    balanceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    balanceAmount: {
        fontSize: typography.size.md,
        fontWeight: '700',
    },
    actionButton: {
        padding: spacing.xs,
    },
    separator: {
        height: spacing.sm,
    },
    adjustmentChip: {
        backgroundColor: theme.background.subtle,
        borderColor: theme.border.subtle,
        paddingHorizontal: spacing.md,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: spacing.xl * 2,
    },
    emptyText: {
        fontSize: typography.size.lg,
        fontWeight: '600',
        color: theme.text.primary,
        marginTop: spacing.md,
    },
    emptySubtext: {
        fontSize: typography.size.sm,
        color: theme.text.secondary,
        marginTop: spacing.xs,
        textAlign: 'center',
    },
    emptyStateText: {
        fontSize: typography.size.sm,
        color: theme.text.secondary,
        textAlign: 'center',
    },
    subheader: {
        fontSize: typography.size.md,
        color: theme.text.secondary,
        marginBottom: spacing.md,
        paddingHorizontal: spacing.md,
    },
    // Estilos para bloques de grupo
    groupBlock: {
        backgroundColor: theme.background.surface,
        borderRadius: 12,
        // Eliminamos bordes y sombras para unificar con playerCard
        /*
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: theme.border.subtle,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
        */
    },
    groupHeader: {
        padding: spacing.md,
        // backgroundColor: colors.neutral[50], // Unificar fondo blanco
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        // borderBottomWidth: 1, // Remover borde
        // borderBottomColor: colors.neutral[100],
    },
    groupTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        flex: 1,
    },
    groupIconContainer: {
        width: 28, // Reduced from 36
        height: 28,
        borderRadius: 14,
        backgroundColor: theme.background.subtle,
        alignItems: 'center',
        justifyContent: 'center',
    },
    groupName: {
        fontSize: typography.size.md,
        fontWeight: '600', // 700 -> 600
        color: theme.text.primary,
    },
    groupMembersText: {
        fontSize: typography.size.xs,
        color: theme.text.secondary,
        marginTop: 1,
    },
    unifiedBadgeSmall: {
        backgroundColor: theme.components.badge.primary,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
        marginTop: 2,
    },
    unifiedBadgeTextSmall: {
        fontSize: 8,
        fontWeight: '800',
        color: theme.components.button.primary.bg,
        letterSpacing: 0.5,
    },
    groupBalanceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm, // md -> sm (match player balanceContainer gap?) Player uses gap: spacing.sm
    },
    groupBalanceAmount: {
        fontSize: typography.size.md, // lg -> md
        fontWeight: '700', // 800 -> 700
    },
    groupActionButton: {
        padding: spacing.xs,
    },
    groupMembersList: {
        paddingHorizontal: spacing.md,
    },
    groupMemberItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: theme.background.subtle,
    },
    groupMemberInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        flex: 1,
    },
    groupMemberName: {
        fontSize: typography.size.sm,
        color: theme.text.primary,
        fontWeight: '500',
    },
    groupMemberBalance: {
        fontSize: typography.size.sm,
        fontWeight: '600',
    },
    statusDotSmall: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    groupMembersChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    memberChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: theme.background.subtle,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 12,
    },
    memberChipName: {
        fontSize: typography.size.xs,
        color: theme.text.secondary,
        fontWeight: '500',
    },
    actionButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    paymentChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.sm,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 4,
    },
    primaryPaymentChip: {
        backgroundColor: theme.components.button.primary.bg,
    },
    secondaryPaymentChip: {
        backgroundColor: theme.background.surface,
        borderWidth: 1,
        borderColor: theme.border.subtle,
    },
    primaryPaymentChipText: {
        fontSize: typography.size.xs,
        fontWeight: '600',
        color: 'white',
    },
    secondaryPaymentChipText: {
        fontSize: typography.size.xs,
        fontWeight: '600',
        color: theme.text.secondary,
    },
});
