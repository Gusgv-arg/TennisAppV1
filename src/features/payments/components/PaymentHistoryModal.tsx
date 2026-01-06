import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { colors, spacing, typography } from '../../../design';
import type { Transaction } from '../../../types/payments';
import { usePlayerTransactions, useTransactionMutations } from '../hooks/usePayments';
import { usePaymentSettings } from '../hooks/usePaymentSettings';

interface PaymentHistoryModalProps {
    visible: boolean;
    onClose: () => void;
    onAddPayment?: () => void;
    playerId: string;
    playerName: string;
    currentBalance: number;
}

export default function PaymentHistoryModal({
    visible,
    onClose,
    onAddPayment,
    playerId,
    playerName,
    currentBalance,
}: PaymentHistoryModalProps) {
    const { data: transactions, isLoading, refetch } = usePlayerTransactions(playerId);
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
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 0,
        }).format(value);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('es-AR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    };

    const getTransactionIcon = (type: Transaction['type']) => {
        switch (type) {
            case 'payment':
                return { name: 'arrow-down-circle' as const, color: colors.success[500] };
            case 'charge':
                return { name: 'arrow-up-circle' as const, color: colors.error[500] };
            case 'adjustment':
                return { name: 'swap-horizontal' as const, color: colors.warning[500] };
            case 'refund':
                return { name: 'return-down-back' as const, color: colors.primary[500] };
            default:
                return { name: 'ellipse' as const, color: colors.neutral[500] };
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
            Alert.alert('Info', 'No se pueden ajustar los ajustes');
            return;
        }

        setTransactionToCorrect(transaction);
        setCorrectionAmount(transaction.amount.toString());
        setCorrectionModalVisible(true);
    };

    const handleSubmitCorrection = async () => {
        if (!transactionToCorrect) return;

        const correctAmount = parseFloat(correctionAmount.replace(/[^0-9.]/g, '') || '0');

        if (isNaN(correctAmount) || correctAmount < 0) {
            Alert.alert('Error', 'Ingresa un monto válido');
            return;
        }

        const difference = transactionToCorrect.amount - correctAmount;

        if (difference === 0) {
            Alert.alert('Info', 'El monto es el mismo, no se requiere ajuste');
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

            await createTransaction.mutateAsync({
                player_id: playerId,
                type: 'adjustment',
                amount: difference,
                description,
            });
            refetch();
            setCorrectionModalVisible(false);
            setTransactionToCorrect(null);
        } catch (error) {
            Alert.alert('Error', 'No se pudo crear el ajuste');
        } finally {
            setIsAdjusting(false);
        }
    };

    const renderTransaction = ({ item }: { item: Transaction }) => {
        const icon = getTransactionIcon(item.type);
        const isPositive = item.type === 'payment' || item.type === 'refund';
        const canReverse = item.type !== 'adjustment';

        return (
            <TouchableOpacity
                style={styles.transactionItem}
                onPress={() => canReverse && handleReverseTransaction(item)}
                activeOpacity={canReverse ? 0.7 : 1}
                disabled={isAdjusting}
            >
                <View style={styles.transactionLeft}>
                    <Ionicons name={icon.name} size={28} color={icon.color} />
                    <View style={styles.transactionInfo}>
                        <Text style={styles.transactionDescription}>
                            {item.description || (item.type === 'payment' ? 'Pago' : 'Cargo')}
                        </Text>
                        <Text style={styles.transactionMeta}>
                            {formatDate(item.transaction_date)}
                            {item.billing_month && ` • Periodo: ${item.billing_month}/${item.billing_year}`}
                            {item.payment_method && ` • ${getPaymentMethodLabel(item.payment_method)}`}
                            {item.reference && ` • Ref: ${item.reference}`}
                        </Text>
                    </View>
                </View>
                <View style={styles.transactionRight}>
                    <Text style={[
                        styles.transactionAmount,
                        { color: isPositive ? colors.success[500] : colors.error[500] }
                    ]}>
                        {isPositive ? '+' : '-'}{formatCurrency(item.amount)}
                    </Text>
                    {canReverse && (
                        <Ionicons name="create-outline" size={18} color={colors.neutral[400]} />
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.title}>{playerName}</Text>
                        <Text style={[
                            styles.balance,
                            { color: currentBalance < 0 ? colors.error[500] : colors.success[500] }
                        ]}>
                            {isSimplifiedMode
                                ? `Estado: ${currentBalance < 0 ? 'Con deuda' : 'Al día'}`
                                : `Balance: ${formatCurrency(currentBalance)}`
                            }
                        </Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={28} color={colors.neutral[600]} />
                    </TouchableOpacity>
                </View>

                {/* Content */}
                {isLoading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary[500]} />
                    </View>
                ) : transactions && transactions.length > 0 ? (
                    <FlatList
                        data={transactions}
                        keyExtractor={(item) => item.id}
                        renderItem={renderTransaction}
                        contentContainerStyle={styles.listContent}
                        ItemSeparatorComponent={() => <View style={styles.separator} />}
                    />
                ) : (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="receipt-outline" size={64} color={colors.neutral[300]} />
                        <Text style={styles.emptyText}>Sin movimientos</Text>
                        <Text style={styles.emptySubtext}>
                            Los pagos y cargos aparecerán aquí
                        </Text>
                    </View>
                )}

                {/* FAB Add Payment */}
                {onAddPayment && (
                    <TouchableOpacity
                        style={styles.fab}
                        onPress={onAddPayment}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="add" size={28} color={colors.common.white} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Correction Modal */}
            <Modal
                visible={correctionModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setCorrectionModalVisible(false)}
            >
                <View style={styles.correctionOverlay}>
                    <View style={styles.correctionModal}>
                        <Text style={styles.correctionTitle}>Corregir monto</Text>
                        {transactionToCorrect && (
                            <Text style={styles.correctionSubtitle}>
                                Monto original: {formatCurrency(transactionToCorrect.amount)}
                            </Text>
                        )}
                        <Text style={styles.correctionLabel}>¿Cuál es el monto correcto?</Text>
                        <View style={styles.correctionInputContainer}>
                            <Text style={styles.correctionCurrency}>$</Text>
                            <TextInput
                                style={[styles.correctionInput, { outlineStyle: 'none' } as any]}
                                value={correctionAmount}
                                onChangeText={setCorrectionAmount}
                                keyboardType="numeric"
                                autoFocus
                            />
                        </View>
                        <Text style={styles.correctionHint}>
                            Ingresa 0 para anular completamente
                        </Text>
                        <View style={styles.correctionButtons}>
                            <TouchableOpacity
                                style={styles.correctionCancelButton}
                                onPress={() => {
                                    setCorrectionModalVisible(false);
                                    setTransactionToCorrect(null);
                                }}
                            >
                                <Text style={styles.correctionCancelText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.correctionSubmitButton, isAdjusting && { opacity: 0.6 }]}
                                onPress={handleSubmitCorrection}
                                disabled={isAdjusting}
                            >
                                <Text style={styles.correctionSubmitText}>
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.neutral[50],
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        backgroundColor: colors.common.white,
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[200],
    },
    title: {
        fontSize: typography.size.xl,
        fontWeight: '700',
        color: colors.neutral[900],
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
        backgroundColor: colors.common.white,
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
        color: colors.neutral[900],
    },
    transactionMeta: {
        fontSize: typography.size.xs,
        color: colors.neutral[500],
        marginTop: 2,
    },
    transactionAmount: {
        fontSize: typography.size.md,
        fontWeight: '700',
        marginRight: spacing.xs,
    },
    transactionRight: {
        flexDirection: 'row',
        alignItems: 'center',
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
        color: colors.neutral[700],
        marginTop: spacing.md,
    },
    emptySubtext: {
        fontSize: typography.size.sm,
        color: colors.neutral[500],
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
        backgroundColor: colors.primary[500],
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 8,
    },
    correctionOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    correctionModal: {
        backgroundColor: colors.common.white,
        borderRadius: 16,
        padding: spacing.lg,
        width: '100%',
        maxWidth: 400,
    },
    correctionTitle: {
        fontSize: typography.size.xl,
        fontWeight: '700',
        color: colors.neutral[900],
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    correctionSubtitle: {
        fontSize: typography.size.sm,
        color: colors.neutral[500],
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    correctionLabel: {
        fontSize: typography.size.md,
        color: colors.neutral[700],
        marginBottom: spacing.sm,
    },
    correctionInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.neutral[300],
        borderRadius: 12,
        paddingHorizontal: spacing.md,
        marginBottom: spacing.sm,
    },
    correctionCurrency: {
        fontSize: typography.size.xl,
        fontWeight: '700',
        color: colors.primary[500],
    },
    correctionInput: {
        flex: 1,
        fontSize: typography.size.xl,
        fontWeight: '700',
        color: colors.neutral[900],
        paddingVertical: spacing.md,
        marginLeft: spacing.sm,
    },
    correctionHint: {
        fontSize: typography.size.xs,
        color: colors.neutral[400],
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
        backgroundColor: colors.neutral[100],
        alignItems: 'center',
    },
    correctionCancelText: {
        fontSize: typography.size.md,
        fontWeight: '600',
        color: colors.neutral[600],
    },
    correctionSubmitButton: {
        flex: 1,
        paddingVertical: spacing.md,
        borderRadius: 12,
        backgroundColor: colors.primary[500],
        alignItems: 'center',
    },
    correctionSubmitText: {
        fontSize: typography.size.md,
        fontWeight: '600',
        color: colors.common.white,
    },
});
