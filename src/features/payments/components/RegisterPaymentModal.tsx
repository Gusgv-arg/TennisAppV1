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
import { showError, showSuccess } from '../../../utils/toast';
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

const paymentMethods: { method: PaymentMethod; labelKey: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { method: 'cash', labelKey: 'payments.methods.cash', icon: 'cash-outline' },
    { method: 'transfer', labelKey: 'payments.methods.transfer', icon: 'swap-horizontal-outline' },
    { method: 'mercadopago', labelKey: 'payments.methods.mercadopago', icon: 'phone-portrait-outline' },
    { method: 'card', labelKey: 'payments.methods.card', icon: 'card-outline' },
    { method: 'other', labelKey: 'payments.methods.other', icon: 'ellipsis-horizontal-outline' },
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
    const { theme, isDark } = useTheme();
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
    
    const handleAmountChange = (text: string) => {
        // Filter: only numbers and one dot
        let filtered = text.replace(/[^0-9.]/g, '');
        const points = filtered.split('.');
        if (points.length > 2) {
            filtered = points[0] + '.' + points.slice(1).join('');
        }
        setAmount(filtered);
    };

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
            showError('Error', t('payments.modals.registerPayment.notifications.invalidAmount'));
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
                    ? t(`payments.modals.registerPayment.notifications.${movementType === 'income' ? 'paymentGroup' : 'adjustmentGroup'}`, { name: unifiedGroup.name })
                    : t(`payments.modals.registerPayment.notifications.${movementType === 'income' ? 'paymentOf' : 'adjustmentOf'}`, { name: playerName })),
            });

            showSuccess(
                t(`payments.modals.registerPayment.notifications.${movementType === 'income' ? 'paymentSuccess' : 'adjustmentSuccess'}`),
                t('payments.modals.registerPayment.notifications.successDetail')
            );
            handleClose();
        } catch (error) {
            // El error ya se muestra en el hook
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
        return new Intl.NumberFormat(t('i18n.locale') === 'en' ? 'en-US' : 'es-AR', {
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
            transparent={true}
            animationType="fade"
            onRequestClose={handleClose}
        >
            <View style={[styles.modalOverlayDesktop, { backgroundColor: theme.background.backdrop }]}>
                <KeyboardAvoidingView
                    style={[
                        styles.container,
                        { backgroundColor: theme.background.surface, shadowColor: '#000' },
                        isLargeScreen && styles.modalContentDesktop
                    ]}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    {/* Header */}
                    <View style={[styles.header, { backgroundColor: theme.background.surface, borderBottomColor: theme.border.subtle }]}>
                        <View style={styles.headerTitleContainer}>
                            <Text style={[styles.title, { color: theme.text.primary }]}>
                                {t('payments.modals.registerPayment.title')}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={theme.text.secondary} />
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
                                        {t('payments.modals.registerPayment.types.income')}
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
                                        {t('payments.modals.registerPayment.types.expense')}
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
                                        {t('payments.modals.registerPayment.balance.current', { amount: formatCurrency(currentBalance) })}
                                    </Text>
                                </View>

                                {amount.length > 0 && (
                                    <View style={[styles.projectionContainer, { borderTopColor: theme.border.subtle }]}>
                                        <Ionicons name="arrow-forward" size={16} color={theme.text.tertiary} />
                                        <Text style={[styles.projectionLabel, { color: theme.text.secondary }]}>
                                            {t('payments.modals.registerPayment.balance.projected')}
                                        </Text>
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

                        {/* Unified Payment Info - Ultra Compact Version */}
                        {unifiedGroup && (
                            <View style={[styles.unifiedPaymentSection, { backgroundColor: theme.background.subtle, padding: spacing.sm, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                                <Ionicons name="people" size={18} color={theme.components.button.primary.bg} />
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 11, color: theme.text.secondary }}>
                                        <Text style={{ fontWeight: '700', color: theme.text.primary }}>
                                            {t('payments.modals.registerPayment.unified.title')}:
                                        </Text>{" "}
                                        {unifiedGroup.name}
                                        {unifiedGroup.members && unifiedGroup.members.length > 0 && 
                                            `, ${unifiedGroup.members
                                                .filter(m => m.full_name !== unifiedGroup.name)
                                                .map(m => m.full_name)
                                                .join(', ')}`
                                        }
                                    </Text>
                                </View>
                            </View>
                        )}

                        {/* Amount Input */}
                        <Text style={[styles.label, { color: theme.text.primary }]}>
                            {t('payments.modals.registerPayment.fields.amount')}
                        </Text>
                        {mode === 'quick_pay' ? (
                            <View style={[styles.readOnlyAmountContainer, { backgroundColor: theme.components.badge.primary, borderColor: theme.components.button.primary.bg }]}>
                                <Text style={[styles.readOnlyLabel, { color: theme.text.primary }]}>
                                    {t('payments.modals.registerPayment.fields.totalToPay')}
                                </Text>
                                <Text style={[styles.readOnlyAmount, { color: theme.text.primary }]}>
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
                                    onChangeText={handleAmountChange}
                                    keyboardType="numeric"
                                    placeholder="0"
                                    placeholderTextColor={mainColor + '80'}
                                    autoFocus={mode === 'default'}
                                />
                            </View>
                        )}

                        {/* Quick Amount Button - Only show in default mode and for INCOME */}
                        {mode === 'default' && !isExpense && currentBalance < 0 && (
                            <TouchableOpacity
                                style={styles.quickButton}
                                onPress={() => setAmount(Math.abs(currentBalance).toString())}
                            >
                                <Text style={styles.quickButtonText}>
                                    {t('payments.modals.registerPayment.fields.fullDebt', { amount: formatCurrency(Math.abs(currentBalance)) })}
                                </Text>
                            </TouchableOpacity>
                        )}


                        {/* Payment Method - Only for Income */}
                        {!isExpense && (
                            <>
                                <Text style={[styles.label, { color: theme.text.primary }]}>
                                    {t('payments.modals.registerPayment.fields.method')}
                                </Text>
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
                                                {t(item.labelKey)}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </>
                        )}

                        {/* Description */}
                        <Text style={[styles.label, { color: theme.text.primary }]}>
                            {t('payments.modals.registerPayment.fields.description')}
                        </Text>
                        <TextInput
                            style={[styles.textInput, { borderColor: theme.border.default, color: theme.text.primary }]}
                            value={description}
                            onChangeText={setDescription}
                            placeholder={t('payments.modals.registerPayment.fields.descriptionPlaceholder')}
                            placeholderTextColor={theme.text.tertiary}
                        />

                        {/* Submit Button */}
                        <Button
                            label={isSubmitting
                                ? t('payments.modals.registerPayment.notifications.registering')
                                : (isExpense
                                    ? t('payments.modals.registerPayment.notifications.adjustmentDefault')
                                    : t('payments.modals.registerPayment.notifications.paymentDefault'))}
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
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100%',
    },
    modalContentDesktop: {
        width: '100%',
        maxWidth: 420,
        maxHeight: 520,
        borderRadius: 16,
        overflow: 'hidden',
        flexGrow: 0,
        flexBasis: 'auto',
        borderWidth: 1,
        borderColor: theme.border.subtle,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
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
        paddingHorizontal: spacing.md,
        paddingTop: spacing.xs,
        width: '100%',
        maxWidth: 420,
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
        marginTop: 4,
    },
    typeSelector: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.xs,
    },
    typeOption: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.sm,
        borderRadius: 12,
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
        fontSize: typography.size.lg,
        fontWeight: '700',
    },
    amountInput: {
        flex: 1,
        fontSize: typography.size.lg,
        fontWeight: '700',
        paddingVertical: spacing.sm,
        marginLeft: spacing.sm,
    },
    quickButton: {
        padding: spacing.xs,
        borderRadius: 8,
        marginBottom: spacing.md,
        alignSelf: 'center',
    },
    quickButtonText: {
        fontSize: typography.size.xs,
        fontWeight: '500',
        textAlign: 'center',
        color: theme.text.secondary,
    },
    methodsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
        marginBottom: spacing.sm,
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
        marginBottom: spacing.xs,
        backgroundColor: theme.background.input,
        borderColor: theme.border.default,
    },
    unifiedPaymentSection: {
        marginBottom: spacing.xs,
    },
    unifiedPaymentToggle: {
        borderRadius: 12,
        padding: spacing.md,
    },
    unifiedPaymentToggleActive: {
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
        fontSize: 16,
        fontWeight: '700',
        marginTop: 2,
    },
    unifiedMembersList: {
        marginTop: 4,
        borderRadius: 8,
        padding: spacing.sm,
    },
    unifiedMembersLabel: {
        display: 'none',
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
        marginBottom: spacing.sm,
        paddingHorizontal: spacing.xl,
        alignSelf: 'center',
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
        padding: spacing.sm,
        alignItems: 'center',
        marginBottom: spacing.sm,
        borderWidth: 1,
    },
    readOnlyLabel: {
        fontSize: typography.size.xs,
        fontWeight: '600',
        marginBottom: 2,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    readOnlyAmount: {
        fontSize: 24,
        fontWeight: '800',
    },
});


