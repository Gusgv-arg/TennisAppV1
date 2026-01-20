import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Button, colors, spacing, typography } from '../../../design';
import type { PaymentMethod } from '../../../types/payments';
import { useTransactionMutations } from '../hooks/usePayments';
import { usePaymentSettings } from '../hooks/usePaymentSettings';
import { useUnifiedPaymentGroup } from '../hooks/useUnifiedPaymentGroups';

interface RegisterPaymentModalProps {
    visible: boolean;
    onClose: () => void;
    playerId: string;
    playerName: string;
    currentBalance?: number;
    unifiedPaymentGroupId?: string | null; // Grupo de pago unificado del alumno
    initialIsUnified?: boolean;
    mode?: 'default' | 'quick_pay';
}

const paymentMethods: { method: PaymentMethod; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { method: 'cash', label: 'Efectivo', icon: 'cash-outline' },
    { method: 'transfer', label: 'Transferencia', icon: 'swap-horizontal-outline' },
    { method: 'mercadopago', label: 'Mercado Pago', icon: 'phone-portrait-outline' },
    { method: 'card', label: 'Tarjeta', icon: 'card-outline' },
    { method: 'other', label: 'Otro', icon: 'ellipsis-horizontal-outline' },
];

export default function RegisterPaymentModal({
    visible,
    onClose,
    playerId,
    playerName,
    currentBalance = 0,
    unifiedPaymentGroupId,
    initialIsUnified = false,
    mode = 'default',
}: RegisterPaymentModalProps) {
    const { t } = useTranslation();
    const { createTransaction } = useTransactionMutations();
    const { isSimplifiedMode } = usePaymentSettings();

    // Fetch unified payment group info if exists
    const { data: unifiedGroup } = useUnifiedPaymentGroup(unifiedPaymentGroupId || undefined);

    // Initialize amount based on mode
    const [amount, setAmount] = useState(() => {
        if (mode === 'quick_pay' && currentBalance < 0) {
            return Math.abs(currentBalance).toString();
        }
        return '';
    });
    const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('cash');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Si pertenece a un grupo, SIEMPRE es pago unificado (sin opción individual)
    const isUnifiedPayment = !!unifiedPaymentGroupId;

    // Validar si el monto es un número válido
    const isValidAmount = () => {
        if (isSimplifiedMode) return true;
        const numAmount = parseFloat(amount.replace(/[^0-9.]/g, ''));
        return !isNaN(numAmount) && numAmount > 0;
    };

    const handleSubmit = async () => {
        const numAmount = isSimplifiedMode ? 1 : parseFloat(amount.replace(/[^0-9.]/g, ''));

        if (!isSimplifiedMode && (!numAmount || numAmount <= 0)) {
            Alert.alert('Error', 'Ingresa un monto válido');
            return;
        }

        setIsSubmitting(true);
        try {
            await createTransaction.mutateAsync({
                player_id: playerId,
                unified_payment_group_id: isUnifiedPayment && unifiedPaymentGroupId ? unifiedPaymentGroupId : undefined,
                type: 'payment',
                amount: numAmount,
                payment_method: selectedMethod,
                description: description.trim() || (isUnifiedPayment && unifiedGroup
                    ? `Pago unificado - ${unifiedGroup.name}`
                    : `Pago de ${playerName}`),
            });

            handleClose();
        } catch (error) {
            Alert.alert('Error', 'No se pudo registrar el pago');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setAmount('');
        setSelectedMethod('cash');
        setDescription('');
        onClose();
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 0,
        }).format(value);
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={handleClose}
        >
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Registrar Pago</Text>
                    <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                        <Ionicons name="close" size={28} color={colors.neutral[600]} />
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                    {/* Player Info */}
                    <View style={styles.playerInfo}>
                        <Text style={styles.playerName}>{playerName}</Text>
                        <Text style={[
                            styles.playerBalance,
                            { color: currentBalance < 0 ? colors.error[500] : colors.success[500] }
                        ]}>
                            {isSimplifiedMode
                                ? `Estado: ${currentBalance < 0 ? 'Con deuda' : 'Al día'}`
                                : `Balance: ${formatCurrency(currentBalance)}`
                            }
                        </Text>
                    </View>

                    {/* Unified Payment Info - Mostrar grupo si pertenece a uno */}
                    {unifiedGroup && (
                        <View style={styles.unifiedPaymentSection}>
                            <View style={[styles.unifiedPaymentToggle, styles.unifiedPaymentToggleActive]}>
                                <View style={styles.unifiedPaymentHeader}>
                                    <Ionicons name="people" size={24} color={colors.primary[500]} />
                                    <View style={{ flex: 1, marginLeft: spacing.sm }}>
                                        <Text style={styles.unifiedPaymentTitle}>Pago Unificado</Text>
                                        <Text style={styles.unifiedPaymentGroupName}>{unifiedGroup.name}</Text>
                                    </View>
                                    <View style={styles.unifiedBadge}>
                                        <Text style={styles.unifiedBadgeText}>CUENTA ÚNICA</Text>
                                    </View>
                                </View>
                            </View>

                            {unifiedGroup.members && unifiedGroup.members.length > 0 && (
                                <View style={styles.unifiedMembersList}>
                                    <Text style={styles.unifiedMembersLabel}>
                                        Miembros ({unifiedGroup.members.length}):
                                    </Text>
                                    <View style={styles.unifiedMembersChips}>
                                        {unifiedGroup.members.map((member) => (
                                            <View key={member.id} style={[
                                                styles.unifiedMemberChip,
                                                member.id === playerId && styles.unifiedMemberChipCurrent
                                            ]}>
                                                <Ionicons
                                                    name="person"
                                                    size={12}
                                                    color={member.id === playerId ? colors.primary[600] : colors.neutral[500]}
                                                />
                                                <Text style={[
                                                    styles.unifiedMemberName,
                                                    member.id === playerId && styles.unifiedMemberNameCurrent
                                                ]}>
                                                    {member.full_name}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}
                        </View>
                    )}

                    {!isSimplifiedMode && (
                        <>
                            {/* Amount Input */}
                            <Text style={styles.label}>Monto</Text>
                            {mode === 'quick_pay' ? (
                                <View style={styles.readOnlyAmountContainer}>
                                    <Text style={styles.readOnlyLabel}>Total a Pagar</Text>
                                    <Text style={styles.readOnlyAmount}>
                                        {formatCurrency(Math.abs(currentBalance))}
                                    </Text>
                                </View>
                            ) : (
                                <View style={styles.amountContainer}>
                                    <Text style={styles.currencySymbol}>$</Text>
                                    <TextInput
                                        style={[styles.amountInput, { outlineStyle: 'none' } as any]}
                                        value={amount}
                                        onChangeText={setAmount}
                                        keyboardType="numeric"
                                        placeholder="0"
                                        placeholderTextColor={colors.neutral[400]}
                                        autoFocus={mode === 'default'}
                                    />
                                </View>
                            )}

                            {/* Quick Amount Button - Only show in default mode */}
                            {mode === 'default' && currentBalance < 0 && (
                                <TouchableOpacity
                                    style={styles.quickButton}
                                    onPress={() => setAmount(Math.abs(currentBalance).toString())}
                                >
                                    <Text style={styles.quickButtonText}>
                                        Pagar deuda completa ({formatCurrency(Math.abs(currentBalance))})
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </>
                    )}

                    {/* Payment Method */}
                    <Text style={styles.label}>Método de Pago</Text>
                    <View style={styles.methodsContainer}>
                        {paymentMethods.map((item) => (
                            <TouchableOpacity
                                key={item.method}
                                style={[
                                    styles.methodButton,
                                    selectedMethod === item.method && styles.methodButtonSelected,
                                ]}
                                onPress={() => setSelectedMethod(item.method)}
                            >
                                <Ionicons
                                    name={item.icon}
                                    size={20}
                                    color={selectedMethod === item.method ? colors.primary[500] : colors.neutral[500]}
                                />
                                <Text style={[
                                    styles.methodLabel,
                                    selectedMethod === item.method && styles.methodLabelSelected,
                                ]}>
                                    {item.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Description */}
                    <Text style={styles.label}>Descripción (opcional)</Text>
                    <TextInput
                        style={styles.textInput}
                        value={description}
                        onChangeText={setDescription}
                        placeholder="Ej: Cuota enero, Paquete 8 clases..."
                        placeholderTextColor={colors.neutral[400]}
                    />

                    {/* Submit Button */}
                    <Button
                        label={isSubmitting ? 'Registrando...' : 'Registrar Pago'}
                        onPress={handleSubmit}
                        disabled={isSubmitting || !isValidAmount()}
                        style={styles.submitButton}
                    />
                </ScrollView>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.common.white,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[200],
    },
    title: {
        fontSize: typography.size.xl,
        fontWeight: '700',
        color: colors.neutral[900],
    },
    closeButton: {
        padding: spacing.xs,
    },
    content: {
        flex: 1,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
    },
    playerInfo: {
        backgroundColor: colors.neutral[50],
        padding: spacing.md,
        borderRadius: 12,
        marginBottom: spacing.lg,
    },
    playerName: {
        fontSize: typography.size.lg,
        fontWeight: '600',
        color: colors.neutral[900],
    },
    playerBalance: {
        fontSize: typography.size.md,
        marginTop: spacing.xs,
    },
    label: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        color: colors.neutral[700],
        marginBottom: spacing.xs,
    },
    amountContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.neutral[300],
        borderRadius: 12,
        paddingHorizontal: spacing.md,
        marginBottom: spacing.md,
        backgroundColor: colors.common.white,
    },
    currencySymbol: {
        fontSize: typography.size.xxl,
        fontWeight: '700',
        color: colors.primary[500],
    },
    amountInput: {
        flex: 1,
        fontSize: typography.size.xxl,
        fontWeight: '700',
        color: colors.neutral[900],
        paddingVertical: spacing.md,
        marginLeft: spacing.sm,
    },
    quickButton: {
        backgroundColor: colors.primary[50],
        padding: spacing.sm,
        borderRadius: 8,
        marginBottom: spacing.lg,
    },
    quickButtonText: {
        color: colors.primary[600],
        fontSize: typography.size.sm,
        fontWeight: '500',
        textAlign: 'center',
    },
    methodsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginBottom: spacing.lg,
    },
    methodButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.neutral[300],
        gap: spacing.xs,
    },
    methodButtonSelected: {
        borderColor: colors.primary[500],
        backgroundColor: colors.primary[50],
    },
    methodLabel: {
        fontSize: typography.size.sm,
        color: colors.neutral[600],
    },
    methodLabelSelected: {
        color: colors.primary[600],
        fontWeight: '500',
    },
    textInput: {
        borderWidth: 1,
        borderColor: colors.neutral[300],
        borderRadius: 8,
        padding: spacing.md,
        fontSize: typography.size.md,
        color: colors.neutral[900],
        marginBottom: spacing.md,
    },
    // Unified Payment Section Styles
    unifiedPaymentSection: {
        marginBottom: spacing.lg,
    },
    unifiedPaymentToggle: {
        borderWidth: 1,
        borderColor: colors.neutral[300],
        borderRadius: 12,
        padding: spacing.md,
        backgroundColor: colors.neutral[50],
    },
    unifiedPaymentToggleActive: {
        borderColor: colors.primary[500],
        backgroundColor: colors.primary[50],
    },
    unifiedPaymentHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    unifiedPaymentTitle: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        color: colors.neutral[800],
    },
    unifiedPaymentGroupName: {
        fontSize: typography.size.xs,
        color: colors.primary[600],
        marginTop: 2,
    },
    unifiedMembersList: {
        marginTop: spacing.sm,
        backgroundColor: colors.common.white,
        borderRadius: 8,
        padding: spacing.sm,
        borderWidth: 1,
        borderColor: colors.neutral[200],
    },
    unifiedMembersLabel: {
        fontSize: typography.size.xs,
        color: colors.neutral[500],
        marginBottom: spacing.xs,
    },
    unifiedMembersChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
    },
    unifiedMemberChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: colors.neutral[100],
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 12,
    },
    unifiedMemberChipCurrent: {
        backgroundColor: colors.primary[100],
        borderWidth: 1,
        borderColor: colors.primary[300],
    },
    unifiedMemberName: {
        fontSize: typography.size.xs,
        color: colors.neutral[600],
    },
    unifiedMemberNameCurrent: {
        fontWeight: '600',
        color: colors.primary[700],
    },
    submitButton: {
        marginTop: spacing.md,
        marginBottom: spacing.xl,
    },
    unifiedBadge: {
        backgroundColor: colors.primary[500],
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 4,
    },
    unifiedBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: colors.common.white,
        letterSpacing: 0.5,
    },
    readOnlyAmountContainer: {
        backgroundColor: colors.primary[50], // Light green background
        borderRadius: 12,
        padding: spacing.lg,
        alignItems: 'center',
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.primary[200],
    },
    readOnlyLabel: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        color: colors.primary[700],
        marginBottom: spacing.xs,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    readOnlyAmount: {
        fontSize: 32,
        fontWeight: '800',
        color: colors.primary[700],
    },
});
