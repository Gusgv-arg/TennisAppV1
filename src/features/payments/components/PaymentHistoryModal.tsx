import { useTheme } from '@/src/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
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
    const { data: transactions, isLoading, refetch } = usePlayerTransactions(playerId, unifiedGroupId);
    const { theme, isDark } = useTheme();
    const styles = React.useMemo(() => createStyles(theme), [theme]);
    const { createTransaction } = useTransactionMutations();
    const [isAdjusting, setIsAdjusting] = useState(false);
    const [correctionModalVisible, setCorrectionModalVisible] = useState(false);
    const [transactionToCorrect, setTransactionToCorrect] = useState<Transaction | null>(null);
    const [correctionAmount, setCorrectionAmount] = useState('');

    const { width, height } = useWindowDimensions();
    const isLargeScreen = width > 768; // Breakpoint for tablets/desktop

    const { isSimplifiedMode } = usePaymentSettings();

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

    const formatDate = (dateStr: string) => {
        // Fix for YYYY-MM-DD strings being treated as UTC midnight (shifting to prev day in Western hemisphere)
        const safeDateStr = dateStr.length === 10 ? `${dateStr}T12:00:00` : dateStr;
        return new Date(safeDateStr).toLocaleDateString('es-AR', {
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
            case 'cash': return 'Efectivo';
            case 'transfer': return 'Transferencia';
            case 'mercadopago': return 'Mercado Pago';
            case 'card': return 'Tarjeta';
            default: return method || '';
        }
    };

    const handleReverseTransaction = (transaction: Transaction) => {
        // No permitir ajustar ajustes
        if (transaction.type === 'adjustment') {
            showInfo('Info', 'No se pueden ajustar los ajustes');
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
            showError('Error', 'Ingresa un monto válido');
            return;
        }

        const difference = transactionToCorrect.amount - correctAmount;

        if (difference === 0) {
            showInfo('Info', 'El monto es el mismo, no se requiere ajuste');
            setCorrectionModalVisible(false);
            return;
        }

        setIsAdjusting(true);
        try {
            const actionLabel = transactionToCorrect.type === 'payment' ? 'pago' : 'cargo';
            let description = '';
            if (correctAmount === 0) {
                description = `Anulación: ${transactionToCorrect.description || actionLabel}`;
            } else {
                description = `Corrección de ${formatCurrency(transactionToCorrect.amount)} a ${formatCurrency(correctAmount)}`;
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
            showSuccess('Ajuste creado', 'La transacción ha sido corregida correctamente.');
        } catch (error) {
            showError('Error', 'No se pudo crear el ajuste');
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

        return (
            <View style={[styles.transactionItem, { backgroundColor: theme.background.surface }]}>
                <View style={styles.transactionLeft}>
                    <Ionicons name={icon.name} size={28} color={icon.color} />
                    <View style={styles.transactionInfo}>
                        <Text style={styles.transactionDescription}>
                            {/* Mostrar nombre solo para cargos/deudas, no para pagos */}
                            {unifiedGroupId && !isPositive && (item as any).player?.full_name && (
                                <Text style={{ fontWeight: '700', color: theme.components.button.primary.bg }}>
                                    {(item as any).player.full_name}:{' '}
                                </Text>
                            )}
                            <Text style={[styles.transactionDescription, { color: theme.text.primary }]}>
                                {item.description || (item.type === 'payment' ? 'Pago' : 'Cargo')}
                            </Text>
                        </Text>
                        <Text style={[styles.transactionMeta, { color: theme.text.secondary }]}>
                            {formatDate(item.transaction_date)}
                            {item.billing_month && ` • Periodo: ${item.billing_month}/${item.billing_year}`}
                            {item.payment_method && ` • ${getPaymentMethodLabel(item.payment_method)}`}
                        </Text>
                    </View>
                </View>
                <View style={styles.transactionRight}>
                    {/* Columna de Movimiento */}
                    <View style={styles.amountColumn}>
                        <Text style={[styles.columnLabel, { color: theme.text.tertiary }]}>Movimiento</Text>
                        <Text style={[
                            styles.transactionAmount,
                            { color: isPositive ? theme.status.success : theme.status.error }
                        ]}>
                            {isPositive ? '+' : '-'}{formatCurrency(item.amount)}
                        </Text>
                    </View>
                    {/* Columna de Saldo */}
                    <View style={styles.balanceColumn}>
                        <Text style={[styles.columnLabel, { color: theme.text.tertiary }]}>Saldo</Text>
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
                styles.modalOverlay,
                isLargeScreen && styles.modalOverlayDesktop,
                { backgroundColor: theme.background.backdrop }
            ]}>
                <View style={[
                    styles.container,
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
                                    ? `Estado: ${currentBalance < 0 ? 'Con deuda' : 'Al día'}`
                                    : `Balance: ${formatCurrency(currentBalance)}`
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
                            <Text style={[styles.emptyText, { color: theme.text.secondary }]}>Sin movimientos</Text>
                            <Text style={[styles.emptySubtext, { color: theme.text.tertiary }]}>
                                Los pagos y cargos aparecerán aquí
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
                            {isSimplifiedMode ? 'Anular movimiento' : 'Corregir monto'}
                        </Text>
                        {transactionToCorrect && !isSimplifiedMode && (
                            <Text style={[styles.correctionSubtitle, { color: theme.text.secondary }]}>
                                Monto original: {formatCurrency(transactionToCorrect.amount)}
                            </Text>
                        )}
                        {!isSimplifiedMode ? (
                            <>
                                <Text style={[styles.correctionLabel, { color: theme.text.primary }]}>¿Cuál es el monto correcto?</Text>
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
                                    Ingresa 0 para anular completamente
                                </Text>
                            </>
                        ) : (
                            <Text style={[styles.correctionLabel, { color: theme.text.primary }]}>
                                ¿Deseas anular este {transactionToCorrect?.type === 'payment' ? 'pago' : 'cargo'}?
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
                                <Text style={[styles.correctionCancelText, { color: theme.text.primary }]}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.correctionSubmitButton, { backgroundColor: theme.components.button.primary.bg }, isAdjusting && { opacity: 0.6 }]}
                                onPress={handleSubmitCorrection}
                                disabled={isAdjusting}
                            >
                                <Text style={[styles.correctionSubmitText, { color: theme.components.button.primary.text }]}>
                                    {isAdjusting ? 'Guardando...' : 'Corregir'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </Modal>
    );
}

const createStyles = (theme: Theme) => StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        width: '100%',
        height: '100%',
    },
    modalOverlayDesktop: {
        justifyContent: 'center',
        alignItems: 'center',
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
        overflow: 'hidden',
        flexGrow: 0,
        flexBasis: 'auto',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
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
        padding: spacing.md,
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
    separator: {
        height: spacing.sm,
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
