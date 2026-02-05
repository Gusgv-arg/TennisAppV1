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
    useWindowDimensions,
    View
} from 'react-native';
import { Button, colors, spacing, typography } from '../../../design';
import { useAuthStore } from '../../../store/useAuthStore';
import type { PaymentMethod } from '../../../types/payments';
import { useTransactionMutations } from '../hooks/usePayments';
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
    const { profile } = useAuthStore();
    const { width } = useWindowDimensions();
    const isLargeScreen = width > 768;

    // Fetch unified payment group info if exists
    const { data: unifiedGroup } = useUnifiedPaymentGroup(unifiedPaymentGroupId || undefined);

    // Unified Movement Type: Income (A favor) or Expense (En contra)
    const [movementType, setMovementType] = useState<'income' | 'expense'>(() => {
        // If they have debt and hit a payment button, default to income
        if (currentBalance < 0 || mode === 'quick_pay') return 'income';
        // Otherwise default to income but allow toggle
        return 'income';
    });

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
        const numAmount = parseFloat(amount.replace(/[^0-9.]/g, ''));
        return !isNaN(numAmount) && numAmount > 0;
    };

    const handleSubmit = async () => {
        const numAmount = parseFloat(amount.replace(/[^0-9.]/g, ''));

        if (!numAmount || numAmount <= 0) {
            Alert.alert('Error', 'Ingresa un monto válido');
            return;
        }

        setIsSubmitting(true);
        try {
            // LÓGICA DE SIGNOS/TIPOS:
            // Ingreso (A favor): type='payment', amount=positivo => Balance sube
            // Cargo (En contra): type='adjustment', amount=positivo => Balance baja (según view player_balances)
            const type = movementType === 'income' ? 'payment' : 'adjustment';

            await createTransaction.mutateAsync({
                player_id: playerId,
                unified_payment_group_id: isUnifiedPayment && unifiedPaymentGroupId ? unifiedPaymentGroupId : undefined,
                academy_id: profile?.current_academy_id,
                type: type,
                amount: numAmount,
                payment_method: movementType === 'income' ? selectedMethod : undefined,
                description: description.trim() || (isUnifiedPayment && unifiedGroup
                    ? `${movementType === 'income' ? 'Pago' : 'Cargo'} unificado - ${unifiedGroup.name}`
                    : `${movementType === 'income' ? 'Pago' : 'Cargo'} de ${playerName}`),
            });

            handleClose();
        } catch (error) {
            Alert.alert('Error', `No se pudo registrar el ${movementType === 'income' ? 'pago' : 'movimiento'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setAmount('');
        setSelectedMethod('cash');
        setDescription('');
        setMovementType('income');
        onClose();
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 0,
        }).format(value);
    };

    const isExpense = movementType === 'expense';
    const mainColor = isExpense ? colors.error[500] : colors.success[500];
    const lightColor = isExpense ? colors.error[50] : colors.success[50];
    const darkColor = isExpense ? colors.error[700] : colors.success[700];

    return (
        <Modal
            visible={visible}
            animationType={isLargeScreen ? 'fade' : 'slide'}
            transparent={isLargeScreen}
            presentationStyle={isLargeScreen ? undefined : 'pageSheet'}
            onRequestClose={handleClose}
        >
            <View style={isLargeScreen ? styles.modalOverlayDesktop : styles.flex1}>
                <KeyboardAvoidingView
                    style={[
                        styles.container,
                        isLargeScreen && styles.modalContentDesktop
                    ]}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerTitleContainer}>
                            <Text style={styles.title}>Registrar Movimiento</Text>
                        </View>
                        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                            <Ionicons name="close" size={28} color={colors.neutral[600]} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        {/* Toggle de Tipo de Movimiento - Solo se muestra si NO es un pago rápido */}
                        {mode !== 'quick_pay' && (
                            <View style={styles.typeSelector}>
                                <TouchableOpacity
                                    style={[
                                        styles.typeOption,
                                        !isExpense && { backgroundColor: colors.success[50], borderColor: colors.success[500] }
                                    ]}
                                    onPress={() => setMovementType('income')}
                                >
                                    <Ionicons name="add-circle" size={24} color={!isExpense ? colors.success[600] : colors.neutral[400]} />
                                    <Text style={[styles.typeText, !isExpense && { color: colors.success[700], fontWeight: '700' }]}>
                                        A Favor (Ingreso)
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.typeOption,
                                        isExpense && { backgroundColor: colors.error[50], borderColor: colors.error[500] }
                                    ]}
                                    onPress={() => setMovementType('expense')}
                                >
                                    <Ionicons name="remove-circle" size={24} color={isExpense ? colors.error[600] : colors.neutral[400]} />
                                    <Text style={[styles.typeText, isExpense && { color: colors.error[700], fontWeight: '700' }]}>
                                        En Contra (Cargo)
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}
                        {/* Player Info - Only for individual payments */}
                        {!unifiedGroup && (
                            <View style={styles.playerInfo}>
                                <View style={styles.playerInfoHeader}>
                                    <Text style={styles.playerName}>{playerName}</Text>
                                    <Text style={[
                                        styles.playerBalance,
                                        { color: currentBalance < 0 ? colors.error[500] : colors.success[500] }
                                    ]}>
                                        Balance: {formatCurrency(currentBalance)}
                                    </Text>
                                </View>

                                {amount.length > 0 && (
                                    <View style={styles.projectionContainer}>
                                        <Ionicons name="arrow-forward" size={16} color={colors.neutral[400]} />
                                        <Text style={styles.projectionLabel}>Nuevo Balance:</Text>
                                        <Text style={[
                                            styles.projectionAmount,
                                            {
                                                color: (currentBalance + (isExpense ? -1 : 1) * (parseFloat(amount.replace(/[^0-9.]/g, '')) || 0)) < 0
                                                    ? colors.error[600]
                                                    : colors.success[600]
                                            }
                                        ]}>
                                            {formatCurrency(currentBalance + (isExpense ? -1 : 1) * (parseFloat(amount.replace(/[^0-9.]/g, '')) || 0))}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}

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
                            <View style={[styles.amountContainer, { borderColor: mainColor }]}>
                                <Text style={[styles.currencySymbol, { color: mainColor }]}>$</Text>
                                <TextInput
                                    style={[
                                        styles.amountInput,
                                        { color: mainColor, outlineStyle: 'none' } as any
                                    ]}
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


                        {/* Payment Method - Only for Income */}
                        {!isExpense && (
                            <>
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
                            </>
                        )}

                        {/* Description */}
                        <Text style={styles.label}>Descripción (opcional)</Text>
                        <TextInput
                            style={styles.textInput}
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Ej: Cuota enero, Promoción 8 clases..."
                            placeholderTextColor={colors.neutral[400]}
                        />

                        {/* Submit Button */}
                        <Button
                            label={isSubmitting ? 'Registrando...' : (isExpense ? 'Registrar Cargo' : 'Registrar Ingreso')}
                            onPress={handleSubmit}
                            disabled={isSubmitting || !isValidAmount()}
                            style={{ ...styles.submitButton, backgroundColor: mainColor }}
                        />
                    </ScrollView>
                </KeyboardAvoidingView>
            </View>
        </Modal >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.common.white,
    },
    flex1: {
        flex: 1,
    },
    modalOverlayDesktop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100%',
    },
    modalContentDesktop: {
        width: '100%',
        maxWidth: 550, // Slightly reduced width
        maxHeight: 650, // Reduced height to fit comfortably
        borderRadius: 16,
        overflow: 'hidden',
        flexGrow: 0,
        flexBasis: 'auto',
        // Shadow
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.30,
        shadowRadius: 4.65,
        elevation: 8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm, // Reduced padding
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[200],
        position: 'relative',
        backgroundColor: colors.common.white,
    },
    headerTitleContainer: {
        flex: 1,
        alignItems: 'center',
    },
    title: {
        fontSize: typography.size.lg, // Slightly smaller title
        fontWeight: '700',
        color: colors.neutral[900],
    },
    closeButton: {
        padding: spacing.xs,
        position: 'absolute',
        right: spacing.md,
        zIndex: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.sm, // Reduced padding
        width: '100%',
        maxWidth: 550,
        alignSelf: 'center',
    },
    playerInfo: {
        backgroundColor: colors.neutral[50],
        padding: spacing.sm, // Reduced padding
        borderRadius: 12,
        marginBottom: spacing.md, // Reduced margin
    },
    playerInfoHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    projectionContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.xs, // Reduced margin
        paddingTop: spacing.xs,
        borderTopWidth: 1,
        borderTopColor: colors.neutral[200],
        gap: spacing.xs,
    },
    projectionLabel: {
        fontSize: typography.size.xs, // Smaller font
        color: colors.neutral[500],
    },
    projectionAmount: {
        fontSize: typography.size.sm, // Smaller font
        fontWeight: '700',
    },
    playerName: {
        fontSize: typography.size.md, // Smaller font
        fontWeight: '600',
        color: colors.neutral[900],
    },
    playerBalance: {
        fontSize: typography.size.sm, // Smaller font
        marginTop: 0,
    },
    label: {
        fontSize: typography.size.xs, // Smaller font
        fontWeight: '600',
        color: colors.neutral[700],
        marginBottom: 2, // Tighter spacing
        marginTop: spacing.sm, // Reduced margin
    },
    typeSelector: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.sm, // Reduced margin
    },
    typeOption: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.sm, // Reduced padding
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.neutral[200],
        backgroundColor: colors.neutral[50],
        gap: spacing.xs,
    },
    typeText: {
        fontSize: typography.size.xs, // Smaller font
        color: colors.neutral[500],
    },
    amountContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.neutral[300],
        borderRadius: 12,
        paddingHorizontal: spacing.md,
        marginBottom: spacing.sm, // Reduced margin
        backgroundColor: colors.common.white,
    },
    currencySymbol: {
        fontSize: typography.size.xl, // Smaller font
        fontWeight: '700',
        color: colors.primary[500],
    },
    amountInput: {
        flex: 1,
        fontSize: typography.size.xl, // Smaller font
        fontWeight: '700',
        paddingVertical: spacing.sm, // Reduced padding
        marginLeft: spacing.sm,
    },
    quickButton: {
        backgroundColor: colors.primary[50],
        padding: spacing.xs, // Reduced padding
        borderRadius: 8,
        marginBottom: spacing.md,
    },
    quickButtonText: {
        color: colors.primary[600],
        fontSize: typography.size.xs, // Smaller font
        fontWeight: '500',
        textAlign: 'center',
    },
    methodsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs, // Tighter gap
        marginBottom: spacing.md,
    },
    methodButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6, // Specific reduced padding
        paddingHorizontal: spacing.sm,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.neutral[300],
        gap: 4,
    },
    methodButtonSelected: {
        borderColor: colors.primary[500],
        backgroundColor: colors.primary[50],
    },
    methodLabel: {
        fontSize: typography.size.xs, // Smaller font
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
        padding: spacing.sm, // Reduced padding
        fontSize: typography.size.sm, // Smaller font
        color: colors.neutral[900],
        marginBottom: spacing.sm, // Reduced margin
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
        maxWidth: 400,
        alignSelf: 'center',
        width: '100%',
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


