import { Ionicons } from '@expo/vector-icons';
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
import type { PlayerBalance } from '../../../types/payments';
import { useAutoBilling } from '../hooks/useAutoBilling';
import { usePaymentStats, usePlayerBalances } from '../hooks/usePayments';
import { usePaymentSettings } from '../hooks/usePaymentSettings';
import PaymentHistoryModal from './PaymentHistoryModal';
import PricingPlansModal from './PricingPlansModal';
import RegisterPaymentModal from './RegisterPaymentModal';

export default function PaymentsScreen() {
    const { t } = useTranslation();
    const { data: balances, isLoading, refetch, isRefetching } = usePlayerBalances();
    const { data: stats } = usePaymentStats();
    const { isSimplifiedMode } = usePaymentSettings();
    const { runAutoBilling } = useAutoBilling();

    React.useEffect(() => {
        runAutoBilling();
    }, []);

    const [selectedPlayer, setSelectedPlayer] = useState<PlayerBalance | null>(null);
    const [paymentModalVisible, setPaymentModalVisible] = useState(false);
    const [historyModalVisible, setHistoryModalVisible] = useState(false);
    const [plansModalVisible, setPlansModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState<'all' | 'debtors' | 'upToDate'>('all');

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
        setPaymentModalVisible(true);
    };

    // Filtrar por búsqueda y filtro activo
    const filteredBalances = balances?.filter(b => {
        const matchesSearch = b.full_name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter =
            activeFilter === 'all' ? true :
                activeFilter === 'debtors' ? b.balance < 0 :
                    b.balance >= 0;
        return matchesSearch && matchesFilter;
    }) || [];

    const debtors = filteredBalances.filter(b => b.balance < 0);
    const upToDate = filteredBalances.filter(b => b.balance >= 0);

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

    const renderQuickActions = () => (
        <View style={styles.quickActions}>
            <TouchableOpacity
                style={styles.actionButton}
                onPress={() => setPlansModalVisible(true)}
            >
                <View style={[styles.actionIcon, { backgroundColor: colors.primary[50] }]}>
                    <Ionicons name="pricetags" size={20} color={colors.primary[500]} />
                </View>
                <Text style={styles.actionText}>Planes</Text>
            </TouchableOpacity>

            {/* Future action: General History */}
            <TouchableOpacity
                style={[styles.actionButton, { opacity: 0.5 }]}
                disabled
            >
                <View style={[styles.actionIcon, { backgroundColor: colors.secondary[50] }]}>
                    <Ionicons name="list" size={20} color={colors.secondary[500]} />
                </View>
                <Text style={styles.actionText}>Historial</Text>
            </TouchableOpacity>
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

    const renderPlayerItem = ({ item }: { item: PlayerBalance }) => {
        const isDebtor = item.balance < 0;

        return (
            <TouchableOpacity
                style={styles.playerCard}
                onPress={() => handlePlayerTap(item)}
                activeOpacity={0.7}
            >
                <View style={styles.playerInfo}>
                    <View style={[
                        styles.statusDot,
                        { backgroundColor: isDebtor ? colors.error[500] : colors.success[500] }
                    ]} />
                    <View style={styles.playerDetails}>
                        <Text style={styles.playerName}>{item.full_name}</Text>
                        {item.last_payment_date && (
                            <Text style={styles.lastPayment}>
                                Último pago: {new Date(item.last_payment_date).toLocaleDateString('es-AR')}
                            </Text>
                        )}
                    </View>
                </View>
                <View style={styles.balanceContainer}>
                    <Text style={[
                        styles.balanceAmount,
                        { color: isDebtor ? colors.error[500] : colors.success[500] }
                    ]}>
                        {formatCurrency(item.balance)}
                    </Text>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handlePlayerTap(item)}
                    >
                        <Ionicons name="receipt-outline" size={24} color={colors.neutral[500]} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleRegisterPayment(item)}
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
                data={[...debtors, ...upToDate]}
                keyExtractor={(item) => item.player_id}
                renderItem={renderPlayerItem}
                refreshControl={
                    <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
                }
                ListHeaderComponent={
                    <>
                        {renderSummary()}
                        <View style={styles.quickActions}>
                            <TouchableOpacity
                                style={styles.quickActionButton}
                                onPress={() => setPlansModalVisible(true)}
                            >
                                <View style={[styles.actionIcon, { backgroundColor: colors.primary[50] }]}>
                                    <Ionicons name="pricetags" size={20} color={colors.primary[500]} />
                                </View>
                                <Text style={styles.actionText}>Planes</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.quickActionButton, { opacity: 0.5 }]}
                                disabled
                            >
                                <View style={[styles.actionIcon, { backgroundColor: colors.secondary[50] }]}>
                                    <Ionicons name="list" size={20} color={colors.secondary[500]} />
                                </View>
                                <Text style={styles.actionText}>Historial</Text>
                            </TouchableOpacity>
                        </View>
                        {renderSearchBar()}
                        {renderFilters()}
                        {activeFilter === 'all' && debtors.length > 0 && renderSectionHeader('Pendientes de Pago', debtors.length, colors.error[500])}
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
                    }}
                    playerId={selectedPlayer.player_id}
                    playerName={selectedPlayer.full_name}
                    currentBalance={selectedPlayer.balance}
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

            <PricingPlansModal
                visible={plansModalVisible}
                onClose={() => setPlansModalVisible(false)}
            />
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
    quickActions: {
        flexDirection: 'row',
        gap: spacing.md,
        marginBottom: spacing.lg,
    },
    quickActionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.common.white,
        padding: spacing.sm,
        paddingRight: spacing.md,
        borderRadius: 12,
        gap: spacing.sm,
        borderWidth: 1,
        borderColor: colors.neutral[100],
    },
    actionIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionText: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        color: colors.neutral[700],
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
});
