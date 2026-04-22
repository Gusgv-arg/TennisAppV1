import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View
} from 'react-native';
import { Theme } from '../../../design/theme';
import { spacing } from '../../../design/tokens/spacing';
import { typography } from '../../../design/tokens/typography';
import type { Transaction } from '../../../types/payments';
import { showError, showInfo, showSuccess } from '../../../utils/toast';
import { usePlayerTransactions, useTransactionMutations } from '../hooks/usePayments';
import { usePaymentSettings } from '../hooks/usePaymentSettings';

interface PaymentHistoryModalProps {
    visible: boolean;
    onClose: () => void;
    onAddPayment?: () => void;
    playerId?: string;
    unifiedGroupId?: string;
    playerName: string;
    currentBalance: number;
}

export default function PaymentHistoryModal({
    visible,
    onClose,
    onAddPayment,
    playerId,
    unifiedGroupId,
    playerName,
    currentBalance,
}: PaymentHistoryModalProps) {
    const { width, height } = useWindowDimensions();
    const isLargeScreen = width > 768; // Breakpoint for tablets/desktop
    const { t } = useTranslation();
    const { data: transactions, isLoading, refetch } = usePlayerTransactions(playerId, unifiedGroupId);
    const { theme, isDark } = useTheme();
    const styles = React.useMemo(() => createStyles(theme, isLargeScreen), [theme, isLargeScreen]);
    const { createTransaction } = useTransactionMutations();
    const [isAdjusting, setIsAdjusting] = useState(false);
    const [correctionModalVisible, setCorrectionModalVisible] = useState(false);
    const [transactionToCorrect, setTransactionToCorrect] = useState<Transaction | null>(null);
    const [correctionAmount, setCorrectionAmount] = useState('');

    const { isSimplifiedMode } = usePaymentSettings();

    const formatCurrency = (value: number) => {
        if (isSimplifiedMode) {
            return value > 0 ? '✓' : value < 0 ? '✗' : '-';
        }
        return new Intl.NumberFormat(t('i18n.locale') === 'en' ? 'en-US' : 'es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 0,
        }).format(value);
    };

    const formatDate = (dateStr: string) => {
        // Fix for YYYY-MM-DD strings being treated as UTC midnight (shifting to prev day in Western hemisphere)
        const safeDateStr = dateStr.length === 10 ? `${dateStr}T12:00:00` : dateStr;
        return new Date(safeDateStr).toLocaleDateString(t('i18n.locale') === 'en' ? 'en-US' : 'es-AR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    };

    const getTransactionIcon = (type: Transaction['type']) => {
        switch (type) {
            case 'payment':
                return { name: 'arrow-down-circle' as const, color: theme.status.success };
            case 'charge':
                return { name: 'arrow-up-circle' as const, color: theme.status.error };
            case 'adjustment':
                return { name: 'swap-horizontal' as const, color: theme.status.warning };
            case 'refund':
                return { name: 'return-down-back' as const, color: theme.components.button.primary.bg };
            default:
                return { name: 'ellipse' as const, color: theme.text.secondary };
        }
    };

    const getPaymentMethodLabel = (method?: string | null) => {
        switch (method) {
            case 'cash': return t('payments.methods.cash');
            case 'transfer': return t('payments.methods.transfer');
            case 'mercadopago': return t('payments.methods.mercadopago');
            case 'card': return t('payments.methods.card');
            default: return method || '';
        }
    };

    const handleReverseTransaction = (transaction: Transaction) => {
        // No permitir ajustar ajustes
        if (transaction.type === 'adjustment') {
            showInfo('Info', t('payments.modals.history.correction.noAdjustAdjustment'));
            return;
        }

        setTransactionToCorrect(transaction);
        setCorrectionAmount(transaction.amount.toString());
        setCorrectionModalVisible(true);
    };

    const handleSubmitCorrection = async () => {
        if (!transactionToCorrect) return;

        const correctAmount = isSimplifiedMode ? 0 : parseFloat(correctionAmount.replace(/[^0-9.]/g, '') || '0');

        if (!isSimplifiedMode && (isNaN(correctAmount) || correctAmount < 0)) {
            showError('Error', t('payments.modals.registerPayment.notifications.invalidAmount'));
            return;
        }

        const difference = transactionToCorrect.amount - correctAmount;

        if (difference === 0) {
            showInfo('Info', t('payments.modals.history.correction.sameAmount'));
            setCorrectionModalVisible(false);
            return;
        }

        setIsAdjusting(true);
        try {
            const actionLabel = transactionToCorrect.type === 'payment' ? t('payments.types.payment') : t('payments.types.charge');
            // Get the base description and clean it to avoid duplicating " - por [email]"
            const baseOriginalDesc = transactionToCorrect.description || actionLabel;
            const cleanedOriginalDesc = baseOriginalDesc.replace(/[\s\-–—]+por\s+.*$/i, '').trim();

            let description = '';
            if (correctAmount === 0) {
                // If it's a void action, use the cleaned original description
                description = `${t('payments.modals.history.correction.voidAction')}: ${cleanedOriginalDesc}`;
            } else {
                description = t('payments.modals.history.correction.correctionAction', {
                    from: formatCurrency(transactionToCorrect.amount),
                    to: formatCurrency(correctAmount)
                });
            }

            // LÓGICA DE SIGNOS:
            // Para Pago: diferencia > 0 (pagó de más) => Ajuste + => Resta balance. Correcto.
            // Para Cargo: diferencia > 0 (cobró de más) => Ajuste + => Resta balance (Más deuda). INCORRECTO.
            // Para Cargo: debemos restar la diferencia al "lado de la deuda" (Ajustes), por lo que pasamos -diferencia.
            const adjustmentAmount = transactionToCorrect.type === 'charge' ? -difference : difference;

            await createTransaction.mutateAsync({
                player_id: transactionToCorrect.player_id, // Use transaction's player_id
                academy_id: transactionToCorrect.academy_id, // Keep same academy
                type: 'adjustment',
                amount: adjustmentAmount,
                description,
            });
            refetch();
            setCorrectionModalVisible(false);
            setTransactionToCorrect(null);
            showSuccess(t('payments.modals.history.correction.successTitle'), t('payments.modals.history.correction.successDetail'));
        } catch (error) {
            showError('Error', t('payments.modals.history.correction.error'));
        } finally {
            setIsAdjusting(false);
        }
    };

    // Calcular los saldos acumulados para cada transacción
    const transactionsWithBalance = React.useMemo(() => {
        if (!transactions || transactions.length === 0) return [];

        // Empezar con el saldo actual e ir hacia atrás
        let runningBalance = currentBalance;
        const result = [];

        // Recorrer transacciones de la más reciente a la más antigua
        for (let i = 0; i < transactions.length; i++) {
            const transaction = transactions[i];
            const isPositive = transaction.type === 'payment' || transaction.type === 'refund';

            // El saldo después de esta transacción es el runningBalance actual
            result.push({
                ...transaction,
                balanceAfter: runningBalance
            });

            // Restar esta transacción para obtener el saldo previo
            if (isPositive) {
                runningBalance -= transaction.amount;
            } else {
                runningBalance += transaction.amount;
            }
        }

        return result;
    }, [transactions, currentBalance]);

    const renderTransaction = ({ item }: { item: Transaction & { balanceAfter: number } }) => {
        const icon = getTransactionIcon(item.type);
        const isPositive = item.type === 'payment' || item.type === 'refund';
        const canReverse = item.type !== 'adjustment';

        // Mobile: 2-column / 5-row info-stack layout
        if (!isLargeScreen) {
            return (
                <View style={[styles.transactionItemMobile, { backgroundColor: theme.background.surface, borderRadius: 12 }]}>
                    {/* Col 1: Icon */}
                    <View style={styles.colIcon}>
                        <Ionicons name={icon.name} size={24} color={icon.color} />
                    </View>

                    {/* Col 2: Info Stack */}
                    <View style={styles.colInfo}>
                        {/* Row 1: Money Info (Mov. Left / Saldo Right) */}
                        <View style={[styles.rowMoney, { justifyContent: 'space-between', width: '100%' }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={styles.moneyLabel}>{t('payments.modals.history.movement')}: </Text>
                                <Text style={[styles.moneyValueBold, { color: isPositive ? theme.status.success : theme.status.error }]}>
                                    {isPositive ? '+' : '-'}{formatCurrency(item.amount)}
                                </Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={styles.moneyLabel}>{t('payments.modals.history.balance')}: </Text>
                                <Text style={[
                                    styles.moneyValue,
                                    { color: item.balanceAfter < 0 ? theme.status.error : theme.status.success }
                                ]}>
                                    {formatCurrency(item.balanceAfter)}
                                </Text>
                            </View>
                        </View>

                        {/* Row 2: Event/Origin */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 1 }}>
                            <Text style={styles.rowEvent} numberOfLines={2}>
                                {unifiedGroupId && !isPositive && item.player?.full_name && (
                                    <Text style={styles.rowPlayerPrefix}>
                                        {item.player.full_name}:{' '}
                                    </Text>
                                )}
                                <Text style={{ color: theme.text.primary }}>
                                    {(() => {
                                        const baseDesc = item.description || (item.type === 'payment' ? t('payments.modals.registerPayment.notifications.paymentDefault') : t('payments.modals.registerPayment.notifications.adjustmentDefault'));
                                        const planName = item.subscription?.plan?.name;
                                        
                                        let cleanedDesc = baseDesc;
                                        // Remove "Clase " if present
                                        cleanedDesc = cleanedDesc.replace(/Clase\s*/i, '');
                                        
                                        // If it's a monthly fee label, replace with date/time
                                        if (cleanedDesc.toLowerCase().startsWith('cuota mensual')) {
                                            const d = new Date(item.created_at);
                                            const dateStr = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear().toString().slice(-2)}`;
                                            const timeStr = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
                                            cleanedDesc = `${dateStr} ${timeStr} hs.`;
                                        }

                                        // Shorten year 2026 -> 26
                                        cleanedDesc = cleanedDesc.replace(/\/20(\d{2})/g, '/$1');
                                        
                                        // Remove " - por [email]" using a resilient split & regex combo
                                        // The user mentioned "-" and "por" might be separate, so we handle both.
                                        if (cleanedDesc.toLowerCase().includes(' - por ')) {
                                            cleanedDesc = cleanedDesc.split(/ - por /i)[0];
                                        } else {
                                            cleanedDesc = cleanedDesc.replace(/[\s\-–—]+por\s+.*$/i, '');
                                        }
                                        
                                        // Cleanup any trailing colons or spaces after removal
                                        cleanedDesc = cleanedDesc.trim().replace(/:$/, '').trim();
                                        
                                        if (planName && cleanedDesc.toLowerCase().includes(`- plan: ${planName.toLowerCase()}`)) {
                                            // More robust replacement for " - Plan: [Name]" at the end of description
                                            return cleanedDesc.replace(new RegExp(`\\s*-\\s*plan:\\s*${planName}.*`, 'i'), '');
                                        }
                                        return cleanedDesc;
                                    })()}
                                </Text>
                                {'  '}
                                {item.subscription?.plan?.name && (
                                    <>
                                        <Text style={[styles.rowPlanBadge, { transform: [{ translateY: Platform.OS === 'android' ? 3 : 1 }] }]}>
                                            <Ionicons name="pricetag" size={9} color={theme.components.button.primary.text} />
                                            <Text style={[styles.rowPlanText, { color: theme.components.button.primary.text, includeFontPadding: false }]}> {item.subscription.plan.name}</Text>
                                        </Text>
                                        <Text>{' '}</Text>
                                    </>
                                )}
                            </Text>
                        </View>

                        {/* Row 3: Meta (Unified) */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap', marginTop: 2 }}>
                            <Text style={[styles.rowMeta, { color: theme.text.secondary, marginBottom: 0, includeFontPadding: false, textAlignVertical: 'center' }]} numberOfLines={1}>
                                {(() => {
                                    const d = new Date(item.created_at);
                                    const dateStr = `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear().toString().slice(-2)}`;
                                    return `${dateStr}: ${item.created_by_profile?.email || '-'}`;
                                })()}
                            </Text>
                        </View>
                    </View>
                </View>
            );
        }

        // Desktop: original horizontal layout
        return (
            <View style={[styles.transactionItem, { backgroundColor: theme.background.surface }]}>
                <View style={styles.transactionLeft}>
                    <Ionicons name={icon.name} size={28} color={icon.color} />
                    <View style={styles.transactionInfo}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={[styles.transactionDescription, { color: theme.text.primary }]} numberOfLines={2}>
                                {unifiedGroupId && !isPositive && (item as any).player?.full_name && (
                                    <Text style={{ fontWeight: '700', color: theme.text.primary, fontSize: typography.size.sm }}>
                                        {(item as any).player.full_name}:{' '}
                                    </Text>
                                )}
                                {(() => {
                                    const baseDesc = item.description || (item.type === 'payment' ? t('payments.modals.registerPayment.notifications.paymentDefault') : t('payments.modals.registerPayment.notifications.adjustmentDefault'));
                                    const planName = item.subscription?.plan?.name;
                                    
                                    let cleanedDesc = baseDesc;
                                    // Remove "Clase " if present
                                    cleanedDesc = cleanedDesc.replace(/Clase\s*/i, '');
                                    
                                    // If it's a monthly fee label, replace with date/time
                                    if (cleanedDesc.toLowerCase().startsWith('cuota mensual')) {
                                        const d = new Date(item.created_at);
                                        const dateStr = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear().toString().slice(-2)}`;
                                        const timeStr = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
                                        cleanedDesc = `${dateStr} ${timeStr} hs.`;
                                    }

                                    // Shorten year 2026 -> 26
                                    cleanedDesc = cleanedDesc.replace(/\/20(\d{2})/g, '/$1');
                                    
                                    // Remove " - por [email]" using a resilient split & regex combo
                                    if (cleanedDesc.toLowerCase().includes(' - por ')) {
                                        cleanedDesc = cleanedDesc.split(/ - por /i)[0];
                                    } else {
                                        cleanedDesc = cleanedDesc.replace(/[\s\-–—]+por\s+.*$/i, '');
                                    }
                                    
                                    // Cleanup any trailing colons or spaces after removal
                                    cleanedDesc = cleanedDesc.trim().replace(/:$/, '').trim();
                                    
                                    if (planName && cleanedDesc.toLowerCase().includes(`- plan: ${planName.toLowerCase()}`)) {
                                        // More robust replacement for " - Plan: [Name]" at the end of description
                                        return cleanedDesc.replace(new RegExp(`\\s*-\\s*plan:\\s*${planName}.*`, 'i'), '');
                                    }
                                    return cleanedDesc;
                                })()}
                                {'  '}
                                {item.subscription?.plan?.name && (
                                    <>
                                        <Text style={[styles.rowPlanBadge, { transform: [{ translateY: Platform.OS === 'android' ? 3 : 1 }] }]}>
                                            <Ionicons name="pricetag" size={9} color={theme.components.button.primary.text} />
                                            <Text style={[styles.rowPlanText, { color: theme.components.button.primary.text, includeFontPadding: false }]}> {item.subscription.plan.name}</Text>
                                        </Text>
                                        <Text>{' '}</Text>
                                    </>
                                )}
                            </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginTop: 4 }}>
                            <Text style={[styles.transactionMeta, { color: theme.text.secondary, marginBottom: 0, includeFontPadding: false, textAlignVertical: 'center' }]}>
                                {(() => {
                                    const d = new Date(item.created_at);
                                    const dateStr = `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear().toString().slice(-2)}`;
                                    const emailPart = item.created_by_profile?.email || '-';
                                    const methodPart = item.payment_method ? ` • ${getPaymentMethodLabel(item.payment_method)}` : '';
                                    return `${dateStr}: ${emailPart}${methodPart}`;
                                })()}
                            </Text>
                        </View>
                    </View>
                </View>
                <View style={styles.transactionRight}>
                    <View style={styles.amountColumn}>
                        <Text style={[styles.columnLabel, { color: theme.text.tertiary }]}>{t('payments.modals.history.movement')}</Text>
                        <Text style={[
                            styles.transactionAmount,
                            { color: isPositive ? theme.status.success : theme.status.error }
                        ]}>
                            {isPositive ? '+' : '-'}{formatCurrency(item.amount)}
                        </Text>
                    </View>
                    <View style={styles.balanceColumn}>
                        <Text style={[styles.columnLabel, { color: theme.text.tertiary }]}>{t('payments.modals.history.balance')}</Text>
                        <Text style={[
                            styles.balanceAmount,
                            { color: item.balanceAfter < 0 ? theme.status.error : theme.status.success }
                        ]}>
                            {formatCurrency(item.balanceAfter)}
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={[
                isLargeScreen ? styles.modalOverlayDesktop : styles.modalOverlay,
                { backgroundColor: theme.background.backdrop }
            ]}>
                <View style={[
                    !isLargeScreen && styles.container,
                    isLargeScreen && styles.modalContentDesktop,
                    {
                        backgroundColor: theme.background.default,
                    }
                ]}>
                    {/* Header */}
                    <View style={[styles.header, { backgroundColor: theme.background.surface, borderBottomColor: theme.border.subtle }]}>
                        <View>
                            <Text style={[styles.title, { color: theme.text.primary }]}>{playerName}</Text>
                            <Text style={[
                                styles.balance,
                                { color: currentBalance < 0 ? theme.status.error : theme.status.success }
                            ]}>
                                {isSimplifiedMode
                                    ? `${t('players.status.label', { status: currentBalance < 0 ? t('players.status.debt') : t('players.status.upToDate') })}`
                                    : `${t('payments.modals.registerPayment.balance.current', { amount: formatCurrency(currentBalance) })}`
                                }
                            </Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={28} color={theme.text.secondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Content */}
                    {isLoading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={theme.components.button.primary.bg} />
                        </View>
                    ) : transactionsWithBalance && transactionsWithBalance.length > 0 ? (
                        <FlatList
                            data={transactionsWithBalance}
                            keyExtractor={(item) => item.id}
                            renderItem={renderTransaction}
                            contentContainerStyle={styles.listContent}
                            ItemSeparatorComponent={() => <View style={styles.separator} />}
                        />
                    ) : (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="receipt-outline" size={64} color={theme.text.disabled || theme.text.tertiary} />
                            <Text style={[styles.emptyText, { color: theme.text.secondary }]}>{t('payments.modals.history.empty')}</Text>
                            <Text style={[styles.emptySubtext, { color: theme.text.tertiary }]}>
                                {t('payments.modals.history.emptyDetail')}
                            </Text>
                        </View>
                    )}


                </View>
            </View>

            {/* Correction Modal */}
            <Modal
                visible={correctionModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setCorrectionModalVisible(false)}
            >
                <View style={[styles.correctionOverlay, { backgroundColor: theme.background.backdrop }]}>
                    <View style={[styles.correctionModal, { backgroundColor: theme.background.surface, shadowColor: '#000' }]}>
                        <Text style={[styles.correctionTitle, { color: theme.text.primary }]}>
                            {isSimplifiedMode ? t('payments.modals.history.correction.voidTitle') : t('payments.modals.history.correction.correctTitle')}
                        </Text>
                        {transactionToCorrect && !isSimplifiedMode && (
                            <Text style={[styles.correctionSubtitle, { color: theme.text.secondary }]}>
                                {t('payments.modals.history.correction.originalAmount', { amount: formatCurrency(transactionToCorrect.amount) })}
                            </Text>
                        )}
                        {!isSimplifiedMode ? (
                            <>
                                <Text style={[styles.correctionLabel, { color: theme.text.primary }]}>{t('payments.modals.history.correction.question')}</Text>
                                <View style={[styles.correctionInputContainer, { borderColor: theme.border.default }]}>
                                    <Text style={[styles.correctionCurrency, { color: theme.components.button.primary.bg }]}>$</Text>
                                    <TextInput
                                        style={[styles.correctionInput, { outlineStyle: 'none', color: theme.text.primary } as any]}
                                        value={correctionAmount}
                                        onChangeText={setCorrectionAmount}
                                        keyboardType="numeric"
                                        autoFocus
                                    />
                                </View>
                                <Text style={[styles.correctionHint, { color: theme.text.tertiary }]}>
                                    {t('payments.modals.history.correction.voidHint')}
                                </Text>
                            </>
                        ) : (
                            <Text style={[styles.correctionLabel, { color: theme.text.primary }]}>
                                {t('payments.modals.history.correction.confirmVoid', { type: transactionToCorrect?.type === 'payment' ? t('payments.types.payment') : t('payments.types.charge') })}
                            </Text>
                        )}
                        <View style={styles.correctionButtons}>
                            <TouchableOpacity
                                style={[styles.correctionCancelButton, { backgroundColor: theme.background.subtle }]}
                                onPress={() => {
                                    setCorrectionModalVisible(false);
                                    setTransactionToCorrect(null);
                                }}
                            >
                                <Text style={[styles.correctionCancelText, { color: theme.text.primary }]}>{t('common.cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.correctionSubmitButton, { backgroundColor: theme.components.button.primary.bg }, isAdjusting && { opacity: 0.6 }]}
                                onPress={handleSubmitCorrection}
                                disabled={isAdjusting}
                            >
                                <Text style={[styles.correctionSubmitText, { color: theme.components.button.primary.text }]}>
                                    {isAdjusting ? t('common.saving') : t('common.correct')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </Modal>
    );
}

const createStyles = (theme: Theme, isLargeScreen: boolean) => StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        width: '100%',
        height: '100%',
    },
    modalOverlayDesktop: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100%',
    },
    container: {
        flex: 1,
        borderColor: theme.border.subtle,
    },
    modalContentDesktop: {
        width: '100%',
        maxWidth: 600,
        height: '80%',
        maxHeight: 700,
        borderRadius: 16,
        borderWidth: 1,
        overflow: 'hidden',
        flexGrow: 0,
        flexBasis: 'auto',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: isLargeScreen ? spacing.lg : spacing.sm,
        paddingVertical: spacing.md,
        paddingTop: !isLargeScreen && Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + spacing.sm : spacing.md,
        borderBottomWidth: 1,
    },
    title: {
        fontSize: typography.size.xl,
        fontWeight: '700',
        color: theme.text.primary,
    },
    balance: {
        fontSize: typography.size.md,
        fontWeight: '600',
        marginTop: spacing.xs,
    },
    closeButton: {
        padding: spacing.xs,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
    },
    transactionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.md,
        borderRadius: 12,
    },
    transactionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    transactionInfo: {
        marginLeft: spacing.sm,
        flex: 1,
    },
    transactionDescription: {
        fontSize: typography.size.md,
        fontWeight: '500',
        color: theme.text.primary,
        lineHeight: 22,
    },
    transactionMeta: {
        fontSize: typography.size.xs,
        color: theme.text.secondary,
        marginTop: 2,
    },
    transactionAmount: {
        fontSize: typography.size.md,
        fontWeight: '700',
        marginRight: spacing.xs,
    },
    transactionRight: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: spacing.md,
    },
    amountColumn: {
        alignItems: 'flex-end',
        minWidth: 90,
    },
    balanceColumn: {
        alignItems: 'flex-end',
        minWidth: 90,
    },
    columnLabel: {
        fontSize: typography.size.xs,
        color: theme.text.tertiary,
        fontWeight: '500',
        marginBottom: 2,
    },
    balanceAmount: {
        fontSize: typography.size.md,
        fontWeight: '700',
    },
    transactionRecorder: {
        fontSize: typography.size.xs,
        marginTop: 2,
    },
    separator: {
        height: spacing.md,
    },
    // Mobile 3-Column / 4-Row layout styles
    transactionItemMobile: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.sm,
    },
    colIcon: {
        width: 32,
        alignItems: 'center',
    },
    colInfo: {
        flex: 1,
        paddingHorizontal: spacing.sm,
    },
    colAmount: {
        width: 0, // No longer used in 2-column mobile layout
    },
    // Money Row
    rowMoney: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 4,
    },
    moneyLabel: {
        fontSize: typography.size.sm,
        fontWeight: '700',
        color: theme.text.primary,
        textTransform: 'none',
    },
    moneyValue: {
        fontSize: typography.size.sm,
        fontWeight: '600',
    },
    moneyValueBold: {
        fontSize: typography.size.sm,
        fontWeight: '700',
    },
    // Row 2: Event
    rowEvent: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        color: theme.text.primary,
        marginBottom: 1,
        lineHeight: 20,
    },
    rowPlayerPrefix: {
        fontWeight: '700',
        color: theme.text.primary,
    },
    rowPlanBadge: {
        backgroundColor: theme.components.button.primary.bg,
        paddingHorizontal: spacing.xs,
        paddingVertical: 1,
        borderRadius: 4,
        overflow: 'hidden',
    },
    rowPlanText: {
        fontSize: typography.size.xs,
        fontWeight: '700',
        color: 'white',
        textTransform: 'capitalize',
    },
    // Row 3: Meta
    rowMeta: {
        fontSize: typography.size.xs,
        marginBottom: 1,
    },
    // Row 4: Recorder
    rowRecorder: {
        fontSize: typography.size.xs,
        color: theme.text.primary,
    },
    // Right Col
    movementAmount: {
        fontSize: typography.size.md,
        fontWeight: '700',
    },
    balanceAfter: {
        fontSize: typography.size.xs,
        fontWeight: '500',
        marginTop: 1,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
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
    fab: {
        position: 'absolute',
        bottom: spacing.xl,
        right: spacing.lg,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: theme.components.button.primary.bg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    correctionOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    correctionModal: {
        backgroundColor: theme.background.surface,
        borderRadius: 16,
        padding: spacing.lg,
        width: '100%',
        maxWidth: 400,
    },
    correctionTitle: {
        fontSize: typography.size.xl,
        fontWeight: '700',
        color: theme.text.primary,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    correctionSubtitle: {
        fontSize: typography.size.sm,
        color: theme.text.secondary,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    correctionLabel: {
        fontSize: typography.size.md,
        color: theme.text.primary,
        marginBottom: spacing.sm,
    },
    correctionInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.border.default,
        borderRadius: 12,
        paddingHorizontal: spacing.md,
        marginBottom: spacing.sm,
        backgroundColor: theme.background.input,
    },
    correctionCurrency: {
        fontSize: typography.size.xl,
        fontWeight: '700',
        color: theme.components.button.primary.bg,
    },
    correctionInput: {
        flex: 1,
        fontSize: typography.size.xl,
        fontWeight: '700',
        color: theme.text.primary,
        paddingVertical: spacing.md,
        marginLeft: spacing.sm,
    },
    correctionHint: {
        fontSize: typography.size.xs,
        color: theme.text.tertiary,
        marginBottom: spacing.lg,
    },
    correctionButtons: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    correctionCancelButton: {
        flex: 1,
        paddingVertical: spacing.md,
        borderRadius: 12,
        backgroundColor: theme.background.subtle,
        alignItems: 'center',
    },
    correctionCancelText: {
        fontSize: typography.size.md,
        fontWeight: '600',
        color: theme.text.primary,
    },
    correctionSubmitButton: {
        flex: 1,
        paddingVertical: spacing.md,
        borderRadius: 12,
        backgroundColor: theme.components.button.primary.bg,
        alignItems: 'center',
    },
    correctionSubmitText: {
        fontSize: typography.size.md,
        fontWeight: '600',
        color: 'white',
    },
});
