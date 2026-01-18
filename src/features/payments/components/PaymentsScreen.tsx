import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { colors, spacing, typography } from '../../../design';
import type { PlayerBalance, UnifiedPaymentGroup } from '../../../types/payments';
import { useAutoBilling } from '../hooks/useAutoBilling';
import { usePaymentStats, usePlayerBalances } from '../hooks/usePayments';
import { usePaymentSettings } from '../hooks/usePaymentSettings';
import { useUnifiedPaymentGroupBalances } from '../hooks/useUnifiedPaymentGroups';
import PaymentHistoryModal from './PaymentHistoryModal';
import RegisterPaymentModal from './RegisterPaymentModal';

export default function PaymentsScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const { search, playerId } = useLocalSearchParams<{ search?: string; playerId?: string }>();
    const { data: balances, isLoading, refetch, isRefetching } = usePlayerBalances();
    const { data: stats } = usePaymentStats();
    const { isSimplifiedMode } = usePaymentSettings();
    const { runAutoBilling } = useAutoBilling();

    React.useEffect(() => {
        runAutoBilling();
    }, []);

    const [selectedPlayer, setSelectedPlayer] = useState<PlayerBalance | null>(null);
    const [selectedGroup, setSelectedGroup] = useState<UnifiedPaymentGroup | null>(null);
    const [paymentModalVisible, setPaymentModalVisible] = useState(false);
    const [historyModalVisible, setHistoryModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState<'all' | 'debtors' | 'upToDate'>('all');

    // Hook para balances de grupos de pago unificado
    const { data: unifiedGroupBalances, isLoading: isLoadingGroups } = useUnifiedPaymentGroupBalances();

    // Sincronizar búsqueda desde params
    React.useEffect(() => {
        if (search) {
            setSearchQuery(search);
        }
    }, [search]);

    // Abrir detalle automáticamente si viene un playerId
    React.useEffect(() => {
        if (playerId && balances) {
            const player = balances.find(b => b.player_id === playerId);
            if (player) {
                setSelectedPlayer(player);
                setHistoryModalVisible(true);
            }
        }
    }, [playerId, balances]);

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
        setHistoryModalVisible(true);
    };

    const handleRegisterPayment = (player: PlayerBalance) => {
        setSelectedPlayer(player);
        setSelectedGroup(null);
        setPaymentModalVisible(true);
    };

    const handleRegisterGroupPayment = (group: UnifiedPaymentGroup) => {
        // Para registrar un pago a un grupo, necesitamos un player_id de referencia
        // Usamos el primer miembro del grupo si existe
        if (group.members && group.members.length > 0) {
            const firstMember = balances?.find(b => b.player_id === group.members![0].id);
            if (firstMember) {
                setSelectedPlayer(firstMember);
                setSelectedGroup(group);
                setPaymentModalVisible(true);
            }
        }
    };

    // Procesar y agrupar datos
    const processedData = React.useMemo(() => {
        if (!balances) return [];

        const individualPlayers = balances.filter(b => !b.unified_payment_group_id);
        const groupedPlayerIds = new Set(balances.filter(b => b.unified_payment_group_id).map(b => b.player_id));

        const data: any[] = [];

        // Agregar grupos primero
        if (unifiedGroupBalances) {
            unifiedGroupBalances.forEach(group => {
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
    }, [balances, unifiedGroupBalances, searchQuery, activeFilter]);

    const renderSummary = () => (
        <View style={styles.summaryContainer}>
            <View style={styles.summaryCard}>
                <Ionicons name="trending-up" size={24} color={colors.success[500]} />
                <Text style={styles.summaryValue}>
                    {isSimplifiedMode ? (stats?.totalPlayers || 0) - (stats?.debtorsCount || 0) : formatCurrency(stats?.totalCollected || 0)}
                </Text>
                <Text style={styles.summaryLabel}>{isSimplifiedMode ? 'Al día' : 'Cobrado (mes)'}</Text>
            </View>
            <View style={styles.summaryCard}>
                <Ionicons name="alert-circle" size={24} color={colors.error[500]} />
                <Text style={[styles.summaryValue, { color: colors.error[500] }]}>
                    {isSimplifiedMode ? (stats?.debtorsCount || 0) : formatCurrency(stats?.totalPending || 0)}
                </Text>
                <Text style={styles.summaryLabel}>{isSimplifiedMode ? 'Deben' : 'Pendiente'}</Text>
            </View>
            <View style={styles.summaryCard}>
                <Ionicons name="people" size={24} color={colors.warning[500]} />
                <Text style={styles.summaryValue}>
                    {stats?.debtorsCount || 0}/{stats?.totalPlayers || 0}
                </Text>
                <Text style={styles.summaryLabel}>Deben</Text>
            </View>
        </View>
    );


    const renderSearchBar = () => (
        <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.neutral[400]} style={styles.searchIcon} />
            <TextInput
                style={[styles.searchInput, { outlineStyle: 'none' } as any]}
                placeholder="Buscar alumno..."
                placeholderTextColor={colors.neutral[400]}
                value={searchQuery}
                onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                    <Ionicons name="close-circle" size={20} color={colors.neutral[400]} />
                </TouchableOpacity>
            )}
        </View>
    );

    const renderFilters = () => {
        const filters: { key: 'all' | 'debtors' | 'upToDate'; label: string; count?: number }[] = [
            { key: 'all', label: 'Todos', count: balances?.length },
            { key: 'debtors', label: 'Con deuda', count: stats?.debtorsCount },
            { key: 'upToDate', label: 'Al día', count: (balances?.length || 0) - (stats?.debtorsCount || 0) },
        ];

        return (
            <View style={styles.filtersContainer}>
                {filters.map((filter) => (
                    <TouchableOpacity
                        key={filter.key}
                        style={[
                            styles.filterPill,
                            activeFilter === filter.key && styles.filterPillActive,
                        ]}
                        onPress={() => setActiveFilter(filter.key)}
                    >
                        <Text style={[
                            styles.filterPillText,
                            activeFilter === filter.key && styles.filterPillTextActive,
                        ]}>
                            {filter.label} ({filter.count || 0})
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    // Renderizar bloque de grupo de pago unificado integrado
    const renderGroupItem = (item: any) => {
        const group = item.data;
        const members = item.members;
        const balance = group.total_balance || 0;
        const isDebtor = balance < 0;

        return (
            <View style={styles.groupBlock}>
                <View style={styles.groupHeader}>
                    <View style={styles.groupTitleContainer}>
                        <View style={styles.groupIconContainer}>
                            <Ionicons name="people" size={20} color={colors.primary[600]} />
                        </View>
                        <View>
                            <Text style={styles.groupName}>{group.name}</Text>
                            <View style={styles.unifiedBadgeSmall}>
                                <Text style={styles.unifiedBadgeTextSmall}>PAGO UNIFICADO</Text>
                            </View>
                        </View>
                    </View>
                    <View style={styles.groupBalanceContainer}>
                        <Text style={[
                            styles.groupBalanceAmount,
                            { color: isDebtor ? colors.error[500] : colors.success[500] }
                        ]}>
                            {formatCurrency(balance)}
                        </Text>
                        <TouchableOpacity
                            style={styles.groupActionButton}
                            onPress={() => handleRegisterGroupPayment(group)}
                        >
                            <Ionicons name="add-circle" size={32} color={colors.primary[500]} />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.groupMembersList}>
                    {members.map((member: PlayerBalance, index: number) => {
                        const mDebtor = member.balance < 0;
                        return (
                            <TouchableOpacity
                                key={member.player_id}
                                style={[
                                    styles.groupMemberItem,
                                    index === members.length - 1 && { borderBottomWidth: 0 }
                                ]}
                                onPress={() => handlePlayerTap(member)}
                            >
                                <View style={styles.groupMemberInfo}>
                                    <View style={[
                                        styles.statusDotSmall,
                                        { backgroundColor: mDebtor ? colors.error[500] : colors.success[500] }
                                    ]} />
                                    <Text style={styles.groupMemberName}>{member.full_name}</Text>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                                    <Text style={[
                                        styles.groupMemberBalance,
                                        { color: mDebtor ? colors.error[500] : colors.success[500] }
                                    ]}>
                                        {formatCurrency(member.balance)}
                                    </Text>
                                    <Ionicons name="chevron-forward" size={14} color={colors.neutral[300]} />
                                </View>
                            </TouchableOpacity>
                        );
                    })}
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
            <TouchableOpacity
                style={styles.playerCard}
                onPress={() => handlePlayerTap(player)}
                activeOpacity={0.7}
            >
                <View style={styles.playerInfo}>
                    <View style={[
                        styles.statusDot,
                        { backgroundColor: isDebtor ? colors.error[500] : colors.success[500] }
                    ]} />
                    <View style={styles.playerDetails}>
                        <Text style={styles.playerName}>{player.full_name}</Text>
                        {player.last_payment_date && (
                            <Text style={styles.lastPayment}>
                                Último pago: {new Date(player.last_payment_date).toLocaleDateString('es-AR')}
                            </Text>
                        )}
                    </View>
                </View>
                <View style={styles.balanceContainer}>
                    <Text style={[
                        styles.balanceAmount,
                        { color: isDebtor ? colors.error[500] : colors.success[500] }
                    ]}>
                        {formatCurrency(player.balance)}
                    </Text>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handlePlayerTap(player)}
                    >
                        <Ionicons name="receipt-outline" size={24} color={colors.neutral[500]} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleRegisterPayment(player)}
                    >
                        <Ionicons name="add-circle" size={28} color={colors.primary[500]} />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    const renderSectionHeader = (title: string, count: number, color: string) => (
        <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
            <View style={[styles.countBadge, { backgroundColor: color }]}>
                <Text style={styles.countText}>{count}</Text>
            </View>
        </View>
    );

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary[500]} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <FlatList
                data={processedData}
                keyExtractor={(item) => item.id}
                renderItem={renderPlayerItem}
                refreshControl={
                    <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
                }
                ListHeaderComponent={
                    <>
                        {renderSummary()}
                        {renderSearchBar()}
                        {renderFilters()}
                        {activeFilter === 'all' && processedData.some(i => i.type === 'individual' && i.data.balance < 0) && (
                            renderSectionHeader('Pendientes de Pago', processedData.filter(i => i.type === 'individual' && i.data.balance < 0).length, colors.error[500])
                        )}
                    </>
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="wallet-outline" size={64} color={colors.neutral[300]} />
                        <Text style={styles.emptyText}>
                            {searchQuery || activeFilter !== 'all' ? 'No hay resultados' : 'No hay alumnos registrados'}
                        </Text>
                        <Text style={styles.emptySubtext}>
                            {searchQuery || activeFilter !== 'all'
                                ? 'Prueba con otro filtro o búsqueda'
                                : 'Agrega alumnos para comenzar a registrar pagos'}
                        </Text>
                    </View>
                }
                contentContainerStyle={styles.listContent}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
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
                    currentBalance={selectedPlayer.balance}
                    unifiedPaymentGroupId={selectedPlayer.unified_payment_group_id}
                    initialIsUnified={!!selectedGroup}
                />
            )}

            {selectedPlayer && (
                <PaymentHistoryModal
                    visible={historyModalVisible}
                    onClose={() => {
                        setHistoryModalVisible(false);
                        setSelectedPlayer(null);
                    }}
                    onAddPayment={() => {
                        setHistoryModalVisible(false);
                        setPaymentModalVisible(true);
                    }}
                    playerId={selectedPlayer.player_id}
                    playerName={selectedPlayer.full_name}
                    currentBalance={selectedPlayer.balance}
                />
            )}

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.neutral[50],
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
        backgroundColor: colors.common.white,
        borderRadius: 12,
        paddingHorizontal: spacing.md,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: colors.neutral[200],
    },
    searchIcon: {
        marginRight: spacing.sm,
    },
    searchInput: {
        flex: 1,
        paddingVertical: spacing.sm,
        fontSize: typography.size.md,
        color: colors.neutral[900],
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
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.md,
        borderRadius: 20,
        backgroundColor: colors.common.white,
        borderWidth: 1,
        borderColor: colors.neutral[200],
    },
    filterPillActive: {
        backgroundColor: colors.primary[500],
        borderColor: colors.primary[500],
    },
    filterPillText: {
        fontSize: typography.size.sm,
        color: colors.neutral[600],
    },
    filterPillTextActive: {
        color: colors.common.white,
        fontWeight: '600',
    },
    summaryCard: {
        flex: 1,
        backgroundColor: colors.common.white,
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
        color: colors.neutral[900],
        marginTop: spacing.xs,
    },
    summaryLabel: {
        fontSize: typography.size.xs,
        color: colors.neutral[500],
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
        color: colors.common.white,
    },
    playerCard: {
        backgroundColor: colors.common.white,
        padding: spacing.md,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    playerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
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
        color: colors.neutral[900],
    },
    lastPayment: {
        fontSize: typography.size.xs,
        color: colors.neutral[500],
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
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: spacing.xl * 2,
    },
    emptyText: {
        fontSize: typography.size.lg,
        fontWeight: '600',
        color: colors.neutral[700],
        marginTop: spacing.md,
    },
    emptySubtext: {
        fontSize: typography.size.sm,
        color: colors.neutral[500],
        marginTop: spacing.xs,
        textAlign: 'center',
    },
    emptyStateText: {
        fontSize: typography.size.sm,
        color: colors.neutral[500],
        textAlign: 'center',
    },
    subheader: {
        fontSize: typography.size.md,
        color: colors.neutral[500],
        marginBottom: spacing.md,
        paddingHorizontal: spacing.md,
    },
    // Estilos para bloques de grupo
    groupBlock: {
        backgroundColor: colors.common.white,
        borderRadius: 16,
        marginBottom: spacing.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.neutral[200],
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    groupHeader: {
        padding: spacing.md,
        backgroundColor: colors.neutral[50],
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[100],
    },
    groupTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        flex: 1,
    },
    groupIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.primary[50],
        alignItems: 'center',
        justifyContent: 'center',
    },
    groupName: {
        fontSize: typography.size.md,
        fontWeight: '700',
        color: colors.neutral[900],
    },
    unifiedBadgeSmall: {
        backgroundColor: colors.primary[100],
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
        marginTop: 2,
    },
    unifiedBadgeTextSmall: {
        fontSize: 8,
        fontWeight: '800',
        color: colors.primary[700],
        letterSpacing: 0.5,
    },
    groupBalanceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    groupBalanceAmount: {
        fontSize: typography.size.lg,
        fontWeight: '800',
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
        borderBottomColor: colors.neutral[50],
    },
    groupMemberInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        flex: 1,
    },
    groupMemberName: {
        fontSize: typography.size.sm,
        color: colors.neutral[700],
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
});
