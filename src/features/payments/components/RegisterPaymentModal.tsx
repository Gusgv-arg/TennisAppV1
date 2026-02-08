import { useTheme } from '@/src/hooks/useTheme';
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
import { Button } from '../../../design';
import { Theme } from '../../../design/theme';
import { spacing } from '../../../design/tokens/spacing';
import { typography } from '../../../design/tokens/typography';
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
    const { theme } = useTheme();
    const styles = React.useMemo(() => createStyles(theme), [theme]);
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
    const mainColor = isExpense ? theme.status.error : theme.status.success;
    const lightColor = isExpense ? theme.status.errorBackground : theme.status.successBackground;
    const darkColor = isExpense ? theme.status.errorText : theme.status.successText;

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
                    <View style={[styles.header, { backgroundColor: theme.background.surface, borderBottomColor: theme.border.subtle }]}>
                        <View style={styles.headerTitleContainer}>
                            <Text style={[styles.title, { color: theme.text.primary }]}>Registrar Movimiento</Text>
                        </View>
                        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                            <Ionicons name="close" size={28} color={theme.text.secondary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        {/* Toggle de Tipo de Movimiento - Solo se muestra si NO es un pago rápido */}
                        {mode !== 'quick_pay' && (
                            <View style={styles.typeSelector}>
                                <TouchableOpacity
                                    style={[
                                        styles.typeOption,
                                        { backgroundColor: theme.background.default, borderColor: theme.border.default },
                                        !isExpense && { backgroundColor: theme.status.successBackground, borderColor: theme.status.success }
                                    ]}
                                    onPress={() => setMovementType('income')}
                                >
                                    <Ionicons name="add-circle" size={24} color={!isExpense ? theme.status.success : theme.text.tertiary} />
                                    <Text style={[styles.typeText, { color: theme.text.secondary }, !isExpense && { color: theme.status.successText, fontWeight: '700' }]}>
                                        A Favor (Ingreso)
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.typeOption,
                                        { backgroundColor: theme.background.default, borderColor: theme.border.default },
                                        isExpense && { backgroundColor: theme.status.errorBackground, borderColor: theme.status.error }
                                    ]}
                                    onPress={() => setMovementType('expense')}
                                >
                                    <Ionicons name="remove-circle" size={24} color={isExpense ? theme.status.error : theme.text.tertiary} />
                                    <Text style={[styles.typeText, { color: theme.text.secondary }, isExpense && { color: theme.status.errorText, fontWeight: '700' }]}>
                                        En Contra (Cargo)
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}
                        {/* Player Info - Only for individual payments */}
                        {!unifiedGroup && (
                            <View style={[styles.playerInfo, { backgroundColor: theme.background.subtle }]}>
                                <View style={styles.playerInfoHeader}>
                                    <Text style={[styles.playerName, { color: theme.text.primary }]}>{playerName}</Text>
                                    <Text style={[
                                        styles.playerBalance,
                                        { color: currentBalance < 0 ? theme.status.error : theme.status.success }
                                    ]}>
                                        Balance: {formatCurrency(currentBalance)}
                                    </Text>
                                </View>

                                {amount.length > 0 && (
                                    <View style={[styles.projectionContainer, { borderTopColor: theme.border.subtle }]}>
                                        <Ionicons name="arrow-forward" size={16} color={theme.text.tertiary} />
                                        <Text style={[styles.projectionLabel, { color: theme.text.secondary }]}>Nuevo Balance:</Text>
                                        <Text style={[
                                            styles.projectionAmount,
                                            {
                                                color: (currentBalance + (isExpense ? -1 : 1) * (parseFloat(amount.replace(/[^0-9.]/g, '')) || 0)) < 0
                                                    ? theme.status.error
                                                    : theme.status.success
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
                                        <Ionicons name="people" size={24} color={theme.components.button.primary.bg} />
                                        <View style={{ flex: 1, marginLeft: spacing.sm }}>
                                            <Text style={[styles.unifiedPaymentTitle, { color: theme.text.primary }]}>Pago Unificado</Text>
                                            <Text style={[styles.unifiedPaymentGroupName, { color: theme.components.button.primary.bg }]}>{unifiedGroup.name}</Text>
                                        </View>
                                        <View style={[styles.unifiedBadge, { backgroundColor: theme.components.button.primary.bg }]}>
                                            <Text style={[styles.unifiedBadgeText, { color: 'white' }]}>CUENTA ÚNICA</Text>
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
                                                    { backgroundColor: theme.background.subtle },
                                                    member.id === playerId && [styles.unifiedMemberChipCurrent, { backgroundColor: theme.components.badge.primary, borderColor: theme.components.button.primary.bg }]
                                                ]}>
                                                    <Ionicons
                                                        name="person"
                                                        size={12}
                                                        color={member.id === playerId ? theme.components.button.primary.bg : theme.text.tertiary}
                                                    />
                                                    <Text style={[
                                                        styles.unifiedMemberName,
                                                        { color: theme.text.secondary },
                                                        member.id === playerId && [styles.unifiedMemberNameCurrent, { color: theme.components.button.primary.bg }]
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
                        <Text style={[styles.label, { color: theme.text.primary }]}>Monto</Text>
                        {mode === 'quick_pay' ? (
                            <View style={[styles.readOnlyAmountContainer, { backgroundColor: theme.components.badge.primary, borderColor: theme.components.button.primary.bg }]}>
                                <Text style={[styles.readOnlyLabel, { color: theme.components.button.primary.bg }]}>Total a Pagar</Text>
                                <Text style={[styles.readOnlyAmount, { color: theme.components.button.primary.bg }]}>
                                    {formatCurrency(Math.abs(currentBalance))}
                                </Text>
                            </View>
                        ) : (
                            <View style={[styles.amountContainer, { borderColor: mainColor, backgroundColor: theme.background.input }]}>
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
                                    placeholderTextColor={theme.text.tertiary}
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
                                <Text style={[styles.label, { color: theme.text.primary }]}>Método de Pago</Text>
                                <View style={styles.methodsContainer}>
                                    {paymentMethods.map((item) => (
                                        <TouchableOpacity
                                            key={item.method}
                                            style={[
                                                styles.methodButton,
                                                { borderColor: theme.border.default },
                                                selectedMethod === item.method && [styles.methodButtonSelected, { borderColor: theme.components.button.primary.bg, backgroundColor: theme.components.badge.primary }],
                                            ]}
                                            onPress={() => setSelectedMethod(item.method)}
                                        >
                                            <Ionicons
                                                name={item.icon}
                                                size={20}
                                                color={selectedMethod === item.method ? theme.components.button.primary.bg : theme.text.secondary}
                                            />
                                            <Text style={[
                                                styles.methodLabel,
                                                { color: theme.text.secondary },
                                                selectedMethod === item.method && [styles.methodLabelSelected, { color: theme.components.button.primary.bg }],
                                            ]}>
                                                {item.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </>
                        )}

                        {/* Description */}
                        <Text style={[styles.label, { color: theme.text.primary }]}>Descripción (opcional)</Text>
                        <TextInput
                            style={[styles.textInput, { borderColor: theme.border.default, color: theme.text.primary }]}
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Ej: Cuota enero, Promoción 8 clases..."
                            placeholderTextColor={theme.text.tertiary}
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

const createStyles = (theme: Theme) => StyleSheet.create({
    container: {
        flex: 1,
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
        maxWidth: 550,
        maxHeight: 650,
        borderRadius: 16,
        overflow: 'hidden',
        flexGrow: 0,
        flexBasis: 'auto',
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
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        position: 'relative',
    },
    headerTitleContainer: {
        flex: 1,
        alignItems: 'center',
    },
    title: {
        fontSize: typography.size.lg,
        fontWeight: '700',
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
        paddingTop: spacing.sm,
        width: '100%',
        maxWidth: 550,
        alignSelf: 'center',
    },
    playerInfo: {
        padding: spacing.sm,
        borderRadius: 12,
        marginBottom: spacing.md,
    },
    playerInfoHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    projectionContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.xs,
        paddingTop: spacing.xs,
        borderTopWidth: 1,
        gap: spacing.xs,
    },
    projectionLabel: {
        fontSize: typography.size.xs,
    },
    projectionAmount: {
        fontSize: typography.size.sm,
        fontWeight: '700',
    },
    playerName: {
        fontSize: typography.size.md,
        fontWeight: '600',
    },
    playerBalance: {
        fontSize: typography.size.sm,
        marginTop: 0,
    },
    label: {
        fontSize: typography.size.xs,
        fontWeight: '600',
        marginBottom: 2,
        marginTop: spacing.sm,
    },
    typeSelector: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    typeOption: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.sm,
        borderRadius: 12,
        borderWidth: 1,
        gap: spacing.xs,
    },
    typeText: {
        fontSize: typography.size.xs,
    },
    amountContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: spacing.md,
        marginBottom: spacing.sm,
    },
    currencySymbol: {
        fontSize: typography.size.xl,
        fontWeight: '700',
    },
    amountInput: {
        flex: 1,
        fontSize: typography.size.xl,
        fontWeight: '700',
        paddingVertical: spacing.sm,
        marginLeft: spacing.sm,
    },
    quickButton: {
        padding: spacing.xs,
        borderRadius: 8,
        marginBottom: spacing.md,
    },
    quickButtonText: {
        fontSize: typography.size.xs,
        fontWeight: '500',
        textAlign: 'center',
    },
    methodsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
        marginBottom: spacing.md,
    },
    methodButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: spacing.sm,
        borderRadius: 16,
        borderWidth: 1,
        gap: 4,
    },
    methodButtonSelected: {
        borderWidth: 1.5,
    },
    methodLabel: {
        fontSize: typography.size.xs,
    },
    methodLabelSelected: {
        fontWeight: '500',
    },
    textInput: {
        borderWidth: 1,
        borderRadius: 8,
        padding: spacing.sm,
        fontSize: typography.size.sm,
        marginBottom: spacing.sm,
    },
    unifiedPaymentSection: {
        marginBottom: spacing.lg,
    },
    unifiedPaymentToggle: {
        borderWidth: 1,
        borderRadius: 12,
        padding: spacing.md,
    },
    unifiedPaymentToggleActive: {
        borderWidth: 1.5,
    },
    unifiedPaymentHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    unifiedPaymentTitle: {
        fontSize: typography.size.sm,
        fontWeight: '600',
    },
    unifiedPaymentGroupName: {
        fontSize: typography.size.xs,
        marginTop: 2,
    },
    unifiedMembersList: {
        marginTop: spacing.sm,
        borderRadius: 8,
        padding: spacing.sm,
        borderWidth: 1,
    },
    unifiedMembersLabel: {
        fontSize: typography.size.xs,
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
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 12,
    },
    unifiedMemberChipCurrent: {
        borderWidth: 1,
    },
    unifiedMemberName: {
        fontSize: typography.size.xs,
    },
    unifiedMemberNameCurrent: {
        fontWeight: '600',
    },
    submitButton: {
        marginTop: spacing.md,
        marginBottom: spacing.xl,
        maxWidth: 400,
        alignSelf: 'center',
        width: '100%',
    },
    unifiedBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 4,
    },
    unifiedBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    readOnlyAmountContainer: {
        borderRadius: 12,
        padding: spacing.lg,
        alignItems: 'center',
        marginBottom: spacing.md,
        borderWidth: 1,
    },
    readOnlyLabel: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        marginBottom: spacing.xs,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    readOnlyAmount: {
        fontSize: 32,
        fontWeight: '800',
    },
});


