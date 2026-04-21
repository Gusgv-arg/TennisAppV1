import { Input } from '@/src/design/components/Input';
import { useTheme } from '@/src/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions
} from 'react-native';
import { Theme } from '../../../design/theme';
import { spacing } from '../../../design/tokens/spacing';
import { typography } from '../../../design/tokens/typography';
import type { PlayerBalance, UnifiedPaymentGroup } from '../../../types/payments';
import { useAutoBilling } from '../hooks/useAutoBilling';
import { usePlayerBalances } from '../hooks/usePayments';
import { usePaymentSettings } from '../hooks/usePaymentSettings';
import {
    useUnifiedPaymentGroupBalances,
    useUnifiedPaymentGroupMutations
} from '../hooks/useUnifiedPaymentGroups';
import { HelpIcon } from '@/src/design/components/HelpIcon';
import { HelpModal, HelpItem } from '@/src/components/HelpModal';
import PaymentHistoryModal from './PaymentHistoryModal';
import RegisterPaymentModal from './RegisterPaymentModal';

export default function PaymentsScreen() {
    const { theme } = useTheme();
    const { t, i18n } = useTranslation();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 768;
    const styles = React.useMemo(() => createStyles(theme, isDesktop), [theme, isDesktop]);
    const router = useRouter();
    const { search, playerId, unifiedGroupId } = useLocalSearchParams<{ search?: string; playerId?: string; unifiedGroupId?: string }>();
    const { data: balances, isLoading, refetch, isFetching } = usePlayerBalances();
    const { isSimplifiedMode } = usePaymentSettings();
    const { runAutoBilling } = useAutoBilling();

    // Hook para balances de grupos de pago unificado (declared before useFocusEffect which uses refetchGroups)
    const { data: unifiedGroupBalances, isLoading: isLoadingGroups, refetch: refetchGroups, isFetching: isFetchingGroups } = useUnifiedPaymentGroupBalances();

    // Track whether the focus-triggered refetch has completed at least once
    // Must be state (not ref) so that changes trigger a re-render to show/hide the loader
    const [initialLoadDone, setInitialLoadDone] = useState(false);

    useFocusEffect(
        useCallback(() => {
            // Reset on each focus so the loader shows while refetching
            setInitialLoadDone(false);

            const doRefetch = async () => {
                await runAutoBilling();
                await Promise.all([refetch(), refetchGroups()]);
                setInitialLoadDone(true);
            };
            doRefetch();
        }, [])
    );

    const [selectedPlayer, setSelectedPlayer] = useState<PlayerBalance | null>(null);
    const [selectedGroup, setSelectedGroup] = useState<UnifiedPaymentGroup | null>(null);
    const [paymentModalVisible, setPaymentModalVisible] = useState(false);
    const [historyModalVisible, setHistoryModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState<'all' | 'debtors' | 'upToDate'>('all');
    const [paymentMode, setPaymentMode] = useState<'default' | 'quick_pay'>('default');
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Help Modal state
    const [helpModalVisible, setHelpModalVisible] = useState(false);
    const [helpModalConfig, setHelpModalConfig] = useState<{ title: string; items: HelpItem[] }>({
        title: '',
        items: []
    });

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
                    const group = unifiedGroupBalances.find((g: UnifiedPaymentGroup) => g.id === unifiedGroupId);
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
        return new Intl.NumberFormat(i18n.language.startsWith('en') ? 'en-US' : 'es-AR', {
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

    const showPaymentsHelp = () => {
        setHelpModalConfig({
            title: t('payments.modals.history.help.title') || 'Guía de Acciones',
            items: [
                {
                    icon: 'receipt-outline',
                    title: t('payments.modals.history.help.items.history.title') || 'Detalle',
                    description: t('payments.modals.history.help.items.history.desc') || 'Historial completo de movimientos, clases y cobros de la cuenta.'
                },
                {
                    icon: 'options-outline',
                    title: t('payments.modals.history.help.items.adjustment.title') || 'Saldo ($ +-)',
                    description: t('payments.modals.history.help.items.adjustment.desc') || 'Registro de ajustes manuales rápidos (descuentos o cargos).'
                },
                {
                    icon: 'cash-outline',
                    title: t('payments.modals.history.help.items.total.title') || 'Pago ($ Total)',
                    description: t('payments.modals.history.help.items.total.desc') || 'Registro de cobro por la totalidad de la deuda pendiente.'
                }
            ]
        });
        setHelpModalVisible(true);
    };

    // 1. Primero agrupamos y filtramos solo por búsqueda (base para los contadores)
    const baseData = React.useMemo(() => {
        if (!balances) return [];
        if (isLoadingGroups) return [];

        const individualPlayers = balances.filter(b => !b.unified_payment_group_id);
        const data: any[] = [];

        if (unifiedGroupBalances) {
            unifiedGroupBalances.forEach((group: UnifiedPaymentGroup) => {
                const groupMembers = balances.filter(b => b.unified_payment_group_id === group.id);
                if (groupMembers.length > 0) {
                    data.push({
                        type: 'group',
                        id: group.id,
                        data: group,
                        members: groupMembers
                    });
                }
            });
        }

        individualPlayers.forEach(player => {
            data.push({
                type: 'individual',
                id: player.player_id,
                data: player
            });
        });

        // Filtrar SOLO por búsqueda para que las pestañas muestren el conteo correcto según la búsqueda
        return data.filter(item => {
            if (item.type === 'individual') {
                const player = item.data;
                return player.full_name.toLowerCase().includes(searchQuery.toLowerCase());
            } else {
                const group = item.data;
                const members = item.members;
                return group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    members.some((m: PlayerBalance) => m.full_name.toLowerCase().includes(searchQuery.toLowerCase()));
            }
        });
    }, [balances, unifiedGroupBalances, searchQuery, isLoadingGroups]);

    // 2. Luego filtramos por estado de pago y ordenamos (lo que se renderiza)
    const processedData = React.useMemo(() => {
        return baseData.filter(item => {
            const balance = item.type === 'group' ? (item.data.total_balance || 0) : item.data.balance;
            if (activeFilter === 'all') return true;
            if (activeFilter === 'debtors') return balance < 0;
            return balance >= 0;
        }).sort((a, b) => {
            const balanceA = a.type === 'group' ? a.data.total_balance || 0 : a.data.balance;
            const balanceB = b.type === 'group' ? b.data.total_balance || 0 : b.data.balance;
            return balanceA - balanceB;
        });
    }, [baseData, activeFilter]);

    // Grid Layout Calculation
    const numColumns = isDesktop ? 3 : 1;
    const gap = isDesktop ? spacing.sm : spacing.md;
    const horizontalPadding = spacing.md * 2; // Approximate available width calculation
    // Note: In a real app we might want to measure the container, but for this simple grid:
    // width includes padding.
    // Container padding is spacing.md (16) on both sides = 32
    // We want 3 columns with gap.
    // total width = screenWidth
    // list container width = screenWidth
    // actual content width = screenWidth - (spacing.md * 2)
    // item width = (content width - (gap * (numColumns - 1))) / numColumns

    const listPadding = isDesktop ? spacing.xxl : spacing.md;
    const totalGap = (numColumns - 1) * gap;
    const availableWidth = width - (listPadding * 2);
    const cardWidth = (availableWidth - totalGap) / numColumns;


    const renderSearchBar = () => (
        <Input
            placeholder={t('payments.searchPlaceholder')}
            value={searchQuery}
            onChangeText={setSearchQuery}
            leftIcon={<Ionicons name="search" size={20} color={theme.text.secondary} />}
            rightIcon={searchQuery.length > 0 ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={20} color={theme.text.secondary} />
                </TouchableOpacity>
            ) : undefined}
            containerStyle={{ marginBottom: 0 }}
        />
    );

    const renderFilters = () => {
        // Contar entidades desde la base de datos ya filtrada por búsqueda, no por la pestaña activa
        const totalEntities = baseData.length;
        const debtorEntities = baseData.filter(item => {
            const balance = item.type === 'group' ? (item.data.total_balance || 0) : item.data.balance;
            return balance < 0;
        }).length;

        const filters: { key: 'all' | 'debtors' | 'upToDate'; label: string; count?: number }[] = [
            { key: 'all', label: t('payments.filters.all'), count: totalEntities },
            { key: 'debtors', label: t('payments.filters.debtors'), count: debtorEntities },
            { key: 'upToDate', label: t('payments.filters.upToDate'), count: totalEntities - debtorEntities },
        ];

        return (
            <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={[styles.filtersContainer, { marginBottom: 0 }]}
            >
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
                            {filter.label}
                        </Text>
                        <View style={[
                            styles.filterCountBadge,
                            { backgroundColor: activeFilter === filter.key ? 'rgba(0,0,0,0.1)' : theme.background.subtle }
                        ]}>
                            <Text style={[
                                styles.filterCountText,
                                { color: activeFilter === filter.key ? theme.components.button.primary.text : theme.text.secondary }
                            ]}>
                                {filter.count || 0}
                            </Text>
                        </View>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        );
    };

    const renderGroupItem = (item: any) => {
        const group = item.data;
        const balance = group.total_balance || 0;
        const isDebtor = balance < 0;

        const allMemberNames = (group.members || []).map((m: any) => m.full_name).join(', ');
        const hasName = group.name && group.name.trim().length > 0;

        if (isDesktop) {
            return (
                <View style={{ width: cardWidth, maxWidth: cardWidth, marginBottom: gap }}>
                    <View style={[styles.playerCard, { height: numColumns > 1 ? '100%' : undefined, flexDirection: 'column', alignItems: 'stretch', paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, backgroundColor: theme.background.surface }]}>
                        {/* Row 1: Icon + Name (left) and Balance (right) */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
                                <View style={[styles.groupIconContainer, { backgroundColor: 'transparent' }]}>
                                    <Ionicons name="people" size={16} color={theme.text.primary} />
                                </View>
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                                        <Text style={[styles.groupName, { color: theme.text.primary, flexShrink: 1 }]} numberOfLines={1}>{hasName ? group.name : allMemberNames}</Text>
                                    </View>
                                    {hasName && allMemberNames.length > 0 && (
                                        <Text style={[styles.groupMembersText, { color: theme.text.secondary, marginTop: 2 }]} numberOfLines={1}>{allMemberNames}</Text>
                                    )}
                                </View>
                            </View>

                            <Text style={[
                                styles.groupBalanceAmount,
                                {
                                    color: isDebtor ? theme.status.error : theme.status.success,
                                    fontSize: typography.size.md,
                                    fontWeight: '700'
                                }
                            ]}>
                                {formatCurrency(balance)}
                            </Text>
                        </View>

                        {/* Row 2: Actions */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                             <TouchableOpacity
                                style={styles.actionButton}
                                onPress={(e) => {
                                    e.stopPropagation();
                                    handleGroupTap(group);
                                }}
                            >
                                <Ionicons name="receipt-outline" size={26} color={theme.text.secondary} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.paymentChip, styles.adjustmentChip, { paddingHorizontal: spacing.md }]}
                                onPress={(e) => {
                                    e.stopPropagation();
                                    handleAdjustGroupBalance(group);
                                }}
                            >
                                <Text style={styles.adjustmentChipText}>
                                    {t('payments.actions.adjustment')}
                                </Text>
                            </TouchableOpacity>

                            {isDebtor && (
                                <TouchableOpacity
                                    style={[styles.paymentChip, styles.primaryPaymentChip, { paddingHorizontal: spacing.md }]}
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        handleRegisterGroupPayment(group, 'quick_pay');
                                    }}
                                >
                                    <Text style={styles.primaryPaymentChipText}>
                                        {t('payments.actions.total')}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            );
        }

        return (
            <View style={{ width: cardWidth, maxWidth: cardWidth, marginBottom: gap }}>
                <View style={[styles.playerCard, { height: numColumns > 1 ? '100%' : undefined, flexDirection: 'column', alignItems: 'stretch', paddingVertical: spacing.sm, backgroundColor: theme.background.surface }]}>
                    {/* Row 1: Icon + Name (left) and Balance (right) */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, marginRight: spacing.xs }}>
                            <View style={[styles.groupIconContainer, { backgroundColor: 'transparent' }]}>
                                <Ionicons name="people" size={16} color={theme.text.primary} />
                            </View>
                            <View style={{ flex: 1, marginLeft: 8 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                                    <Text style={[styles.groupName, { color: theme.text.primary, flexShrink: 1 }]} numberOfLines={1}>{hasName ? group.name : allMemberNames}</Text>
                                </View>
                                {hasName && allMemberNames.length > 0 && (
                                    <Text style={[styles.groupMembersText, { color: theme.text.secondary, marginTop: 2 }]} numberOfLines={1}>{allMemberNames}</Text>
                                )}
                            </View>
                        </View>

                        <Text style={[
                            styles.groupBalanceAmount,
                            {
                                color: isDebtor ? theme.status.error : theme.status.success,
                                fontSize: typography.size.sm,
                                fontWeight: '700'
                            }
                        ]}>
                            {formatCurrency(balance)}
                        </Text>
                    </View>

                    {/* Row 2: Actions */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.lg, marginTop: spacing.md }}>
                         <TouchableOpacity
                            style={styles.actionButton}
                            onPress={(e) => {
                                e.stopPropagation();
                                handleGroupTap(group);
                            }}
                        >
                            <Ionicons name="receipt-outline" size={28} color={theme.text.secondary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.paymentChip, styles.adjustmentChip, { paddingHorizontal: spacing.md }]}
                            onPress={(e) => {
                                e.stopPropagation();
                                handleAdjustGroupBalance(group);
                            }}
                        >
                            <Text style={styles.adjustmentChipText}>
                                {t('payments.actions.adjustment')}
                            </Text>
                        </TouchableOpacity>

                        {isDebtor && (
                            <TouchableOpacity
                                style={[styles.paymentChip, styles.primaryPaymentChip, { paddingHorizontal: spacing.md }]}
                                onPress={(e) => {
                                    e.stopPropagation();
                                    handleRegisterGroupPayment(group, 'quick_pay');
                                }}
                            >
                                <Text style={styles.primaryPaymentChipText}>
                                    {t('payments.actions.total')}
                                </Text>
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

        if (isDesktop) {
            return (
                <View style={{ width: cardWidth, maxWidth: cardWidth, marginBottom: gap }}>
                    <TouchableOpacity
                        style={[styles.playerCard, { height: numColumns > 1 ? '100%' : undefined, flexDirection: 'column', alignItems: 'stretch', paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, backgroundColor: theme.background.surface }]}
                        onPress={() => handlePlayerTap(player)}
                        activeOpacity={0.7}
                    >
                        {/* Row 1: Icon + Name (left) and Balance (right) */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
                                <View style={[styles.groupIconContainer, { width: 32, height: 32, backgroundColor: 'transparent' }]}>
                                    <Ionicons name="person" size={16} color={theme.text.secondary} />
                                </View>
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <Text style={[styles.playerName, { color: theme.text.primary }]} numberOfLines={1}>{player.full_name}</Text>
                                </View>
                            </View>

                            <Text style={[
                                styles.groupBalanceAmount,
                                {
                                    color: isDebtor ? theme.status.error : theme.status.success,
                                    fontSize: typography.size.md,
                                    fontWeight: '700'
                                }
                            ]}>
                                {formatCurrency(player.balance)}
                            </Text>
                        </View>

                        {/* Row 2: Actions */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={(e) => {
                                    e.stopPropagation();
                                    handlePlayerTap(player);
                                }}
                            >
                                <Ionicons name="receipt-outline" size={26} color={theme.text.secondary} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.paymentChip, styles.adjustmentChip, { paddingHorizontal: spacing.md }]}
                                onPress={(e) => {
                                    e.stopPropagation();
                                    handleAdjustBalance(player);
                                }}
                            >
                                <Text style={styles.adjustmentChipText}>
                                    {t('payments.actions.adjustment')}
                                </Text>
                            </TouchableOpacity>

                            {isDebtor && (
                                <TouchableOpacity
                                    style={[styles.paymentChip, styles.primaryPaymentChip, { paddingHorizontal: spacing.md }]}
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        handleRegisterPayment(player, 'quick_pay');
                                    }}
                                >
                                    <Text style={styles.primaryPaymentChipText}>
                                        {t('payments.actions.total')}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <View style={{ width: cardWidth, maxWidth: cardWidth, marginBottom: gap }}>
                <TouchableOpacity
                    style={[styles.playerCard, { height: numColumns > 1 ? '100%' : undefined, flexDirection: 'column', alignItems: 'stretch', paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, backgroundColor: theme.background.surface }]}
                    onPress={() => handlePlayerTap(player)}
                    activeOpacity={0.7}
                >
                    {/* Row 1: Icon + Name (left) and Balance (right) */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, marginRight: spacing.xs }}>
                            <View style={[styles.groupIconContainer, { width: 28, height: 28, backgroundColor: 'transparent' }]}>
                                <Ionicons name="person" size={14} color={theme.text.secondary} />
                            </View>
                            <View style={{ flex: 1, marginLeft: 8 }}>
                                <Text style={[styles.playerName, { color: theme.text.primary }]} numberOfLines={1}>{player.full_name}</Text>
                            </View>
                        </View>

                        <Text style={[
                            styles.groupBalanceAmount,
                            {
                                color: isDebtor ? theme.status.error : theme.status.success,
                                fontSize: typography.size.sm,
                                fontWeight: '700'
                            }
                        ]}>
                            {formatCurrency(player.balance)}
                        </Text>
                    </View>

                    {/* Row 2: Actions */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.lg, marginTop: spacing.md }}>
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={(e) => {
                                e.stopPropagation();
                                handlePlayerTap(player);
                            }}
                        >
                            <Ionicons name="receipt-outline" size={28} color={theme.text.secondary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.paymentChip, styles.adjustmentChip, { paddingHorizontal: spacing.md }]}
                            onPress={(e) => {
                                e.stopPropagation();
                                handleAdjustBalance(player);
                            }}
                        >
                            <Text style={styles.adjustmentChipText}>
                                {t('payments.actions.adjustment')}
                            </Text>
                        </TouchableOpacity>

                        {isDebtor && (
                            <TouchableOpacity
                                style={[styles.paymentChip, styles.primaryPaymentChip, { paddingHorizontal: spacing.md }]}
                                onPress={(e) => {
                                    e.stopPropagation();
                                    handleRegisterPayment(player, 'quick_pay');
                                }}
                            >
                                <Text style={styles.primaryPaymentChipText}>
                                    {t('payments.actions.total')}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </TouchableOpacity>
            </View>
        );
    };



    // Show full-screen loader: during initial data load OR while focus-triggered refetch is in progress
    const isInitialLoading = isLoading || isLoadingGroups;
    const isFocusRefetching = !initialLoadDone && (isFetching || isFetchingGroups);

    if (isInitialLoading || isFocusRefetching) {
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
                columnWrapperStyle={numColumns > 1 ? { gap: gap } : undefined}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={async () => {
                        setIsRefreshing(true);
                        await Promise.all([refetch(), refetchGroups()]);
                        setIsRefreshing(false);
                    }} />
                }
                ListHeaderComponent={
                    <View style={{
                        flexDirection: 'column',
                        marginBottom: spacing.lg,
                        marginTop: 0,
                    }}>
                        {!isDesktop && (
                            <View style={{ alignItems: 'flex-end', marginBottom: spacing.md }}>
                                <HelpIcon size={20} onPress={showPaymentsHelp} />
                            </View>
                        )}
                        <View style={{
                            flexDirection: isDesktop ? 'row' : 'column',
                            alignItems: isDesktop ? 'center' : 'stretch',
                            justifyContent: 'flex-start'
                        }}>
                            <View style={{ width: isDesktop ? 340 : 'auto', marginRight: isDesktop ? spacing.lg : 0, marginBottom: isDesktop ? 0 : spacing.md }}>
                                {renderSearchBar()}
                            </View>
                            <View>
                                {renderFilters()}
                            </View>

                            {isDesktop && (
                                <View style={{ 
                                    position: 'absolute', 
                                    right: 0, 
                                    top: 6,
                                    justifyContent: 'center'
                                }}>
                                    <HelpIcon size={20} onPress={showPaymentsHelp} />
                                </View>
                            )}
                        </View>
                    </View>
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="wallet-outline" size={64} color={theme.text.tertiary} />
                        <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
                            {searchQuery || activeFilter !== 'all' 
                                ? t('payments.empty.noResults') 
                                : t('payments.empty.noPlayers')}
                        </Text>
                        <Text style={[styles.emptySubtext, { color: theme.text.tertiary }]}>
                            {searchQuery || activeFilter !== 'all'
                                ? t('payments.empty.noResultsDetail')
                                : t('payments.empty.noPlayersDetail')}
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
                    playerName={selectedGroup ? selectedGroup.name : selectedPlayer?.full_name || t('payments.modals.history.defaultPlayerName')}
                    currentBalance={selectedGroup ? (selectedGroup.total_balance || 0) : (selectedPlayer?.balance || 0)}
                />
            )}

            <HelpModal
                visible={helpModalVisible}
                onClose={() => setHelpModalVisible(false)}
                title={helpModalConfig.title}
                items={helpModalConfig.items}
            />

        </View>
    );
}

const createStyles = (theme: Theme, isDesktop: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background.default,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    syncingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        gap: 8,
        borderBottomWidth: 1,
        zIndex: 10,
    },
    syncingText: {
        fontSize: 12,
        fontWeight: '500',
    },
    listContent: {
        paddingHorizontal: isDesktop ? spacing.xxl : spacing.md,
        paddingVertical: spacing.md,
    },



    filtersContainer: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.lg,
    },
    filterPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 20,
        borderWidth: 1,
        marginRight: spacing.sm,
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
    filterCountBadge: {
        marginLeft: spacing.xs,
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    filterCountText: {
        fontSize: 10,
        fontWeight: '700',
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
        padding: spacing.sm,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'nowrap',
        gap: spacing.xs,
        borderWidth: 1,
        borderColor: theme.border.subtle,
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
        borderWidth: Platform.OS === 'web' ? 1.2 : 1.5,
        borderColor: theme.border.default,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    adjustmentChipText: {
        fontSize: typography.size.xs,
        fontWeight: '700',
        color: theme.text.secondary,
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
        backgroundColor: theme.background.subtle,
        paddingHorizontal: spacing.xs,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
    },
    unifiedBadgeTextSmall: {
        fontSize: 11,
        fontWeight: '700',
        color: theme.text.primary,
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
        backgroundColor: theme.background.subtle,
        borderWidth: Platform.OS === 'web' ? 1.2 : 1.5,
        borderColor: theme.border.default,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    secondaryPaymentChip: {
        backgroundColor: theme.background.surface,
        borderWidth: 1,
        borderColor: theme.border.subtle,
    },
    primaryPaymentChipText: {
        fontSize: typography.size.xs,
        fontWeight: '700',
        color: theme.text.secondary,
    },
    secondaryPaymentChipText: {
        fontSize: typography.size.xs,
        fontWeight: '600',
        color: theme.text.secondary,
    },
});
