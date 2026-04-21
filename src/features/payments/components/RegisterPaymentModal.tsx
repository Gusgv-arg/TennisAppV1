import { useTheme } from '@/src/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
    Dimensions
} from 'react-native';
import { Modal } from '@/src/components/Modal';
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
    { method: 'cash', labelKey: 'payments.methods.cash', icon: 'wallet-outline' },
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
    const { width } = useWindowDimensions();
    const isLargeScreen = width > 768;
    const { t } = useTranslation();
    const { theme, isDark } = useTheme();
    const styles = React.useMemo(() => createStyles(theme, isLargeScreen), [theme, isLargeScreen]);
    const { createTransaction } = useTransactionMutations();
    const { profile } = useAuthStore();

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

            // Close modal FIRST so the success toast is shown on the global instance
            // (otherwise it would be unmounted with the modal)
            handleClose();
            
            setTimeout(() => {
                showSuccess(
                    t(`payments.modals.registerPayment.notifications.${movementType === 'income' ? 'paymentSuccess' : 'adjustmentSuccess'}`),
                    t('payments.modals.registerPayment.notifications.successDetail')
                );
            }, 400);
        } catch (error: any) {
            console.error('[RegisterPaymentModal] Error:', error);
            showError(
                t('payments.errors.transactionFailed', { defaultValue: 'Error al registrar' }),
                error.message || t('common.errors.unknown')
            );
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
    const mainColor = isExpense ? theme.status.error : theme.components.button.primary.bg;
    const lightColor = isExpense ? theme.status.errorBackground : theme.components.badge.primary;
    const darkColor = isExpense ? theme.status.errorText : theme.components.button.primary.bg;

    return (
        <Modal
            visible={visible}
            animationType="fade"
            onRequestClose={handleClose}
            transparent={true}
        >
            <View style={[
                isLargeScreen ? styles.modalOverlayDesktop : [styles.container, styles.mobileOverlay],
                { backgroundColor: theme.background.backdrop }
            ]}>
                <View
                    style={[
                        !isLargeScreen && styles.container,
                        { backgroundColor: theme.background.surface, shadowColor: '#000' },
                        isLargeScreen ? styles.modalContentDesktop : styles.modalContent
                    ]}
                >
                    {/* Header */}
                    {/* Header: Flex 3-column structure to avoid overlap */}
                    <View style={[styles.header, { backgroundColor: theme.background.surface, borderBottomColor: theme.border.subtle }]}>
                        <View style={styles.headerContent}>
                            {/* Left Spacer to balance the close button */}
                            <View style={styles.headerSideItem} />
                            
                            <View style={styles.headerTitleContainer}>
                                <Text 
                                    style={[styles.title, { color: theme.text.primary }]}
                                    numberOfLines={1}
                                    adjustsFontSizeToFit
                                    minimumFontScale={0.8}
                                >
                                    {t('payments.modals.registerPayment.titleShort', { defaultValue: 'Registrar' })}
                                </Text>
                            </View>
                            
                            <TouchableOpacity onPress={handleClose} style={[styles.headerSideItem, styles.closeButton]}>
                                <Ionicons name="close" size={24} color={theme.text.secondary} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <ScrollView 
                        style={styles.content} 
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={styles.scrollContent}
                        bounces={false}
                    >
                        {/* Toggle de Tipo de Movimiento - Solo se muestra si NO es un pago rápido */}
                        {mode !== 'quick_pay' && (
                            <View style={styles.typeSelector}>
                                <TouchableOpacity
                                    style={[
                                        styles.typeOption,
                                        { backgroundColor: theme.background.default, borderColor: theme.border.default },
                                        movementType === 'income' && { backgroundColor: isDark ? theme.status.successBackground : '#DCFCE7', borderColor: theme.status.success }
                                    ]}
                                    onPress={() => setMovementType('income')}
                                >
                                    <Text style={[styles.typeText, { color: theme.text.secondary }, movementType === 'income' && { color: theme.status.successText, fontWeight: '700' }]}>
                                        {t('payments.modals.registerPayment.types.income')}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.typeOption,
                                        { backgroundColor: theme.background.default, borderColor: theme.border.default },
                                        movementType === 'expense' && { backgroundColor: isDark ? theme.status.errorBackground : '#FEE2E2', borderColor: theme.status.error }
                                    ]}
                                    onPress={() => setMovementType('expense')}
                                >
                                    <Text style={[styles.typeText, { color: theme.text.secondary }, movementType === 'expense' && { color: theme.status.errorText, fontWeight: '700' }]}>
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

                                {amount.length > 0 && mode !== 'quick_pay' && (
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
                                <Ionicons name="people" size={18} color={theme.text.primary} />
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
                        <View style={styles.amountRow}>
                            <View style={styles.amountControls}>
                                {mode === 'quick_pay' ? (
                                    <View style={[
                                        styles.readOnlyAmountContainer, 
                                        { 
                                            backgroundColor: isExpense ? 'rgba(239, 44, 44, 0.08)' : 'rgba(16, 185, 129, 0.12)', 
                                            borderWidth: 1, 
                                            borderColor: isExpense ? 'rgba(239, 44, 44, 0.25)' : 'rgba(16, 185, 129, 0.3)' 
                                        }
                                    ]}>
                                        <Text style={[styles.readOnlyLabel, { color: theme.components.button.primary.text }]}>
                                            {t('payments.modals.registerPayment.fields.totalToPay')}
                                        </Text>
                                        <Text style={[styles.readOnlyAmount, { color: theme.components.button.primary.text }]}>
                                            {formatCurrency(Math.abs(currentBalance))}
                                        </Text>
                                    </View>
                                ) : (
                                    <View style={[styles.amountContainer, { borderColor: isExpense ? theme.status.error : theme.text.primary, backgroundColor: theme.background.input, marginBottom: 0 }]}>
                                        <Text style={[styles.currencySymbol, { color: isExpense ? theme.status.error : theme.text.primary }]}>$</Text>
                                        <TextInput
                                            style={[
                                                styles.amountInput,
                                                { color: isExpense ? theme.status.error : theme.text.primary, outlineStyle: 'none' } as any
                                            ]}
                                            value={amount}
                                            onChangeText={handleAmountChange}
                                            keyboardType="numeric"
                                            placeholder="0"
                                            placeholderTextColor={isExpense ? theme.status.error + '80' : theme.text.primary + '80'}
                                        />
                                    </View>
                                )}

                                {/* Quick Amount Button - Only show in default mode and for INCOME */}
                                {mode === 'default' && !isExpense && currentBalance < 0 && (
                                    <TouchableOpacity
                                        style={[styles.quickButton, { alignSelf: 'center', marginTop: spacing.xs, marginBottom: 0 }]}
                                        onPress={() => setAmount(Math.abs(currentBalance).toString())}
                                    >
                                        <Text style={[styles.quickButtonText, { color: theme.text.primary, fontWeight: '700' }]}>
                                            {t('payments.modals.registerPayment.fields.fullDebt', { amount: formatCurrency(Math.abs(currentBalance)) })}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>


                        {/* Payment Method - Only for Income */}
                        {/* Payment Method - Only for Income, with Height Stability */}
                        {!isExpense ? (
                            <>
                                <Text style={[styles.label, { color: theme.text.primary }]}>
                                    {t('payments.modals.registerPayment.fields.method')}
                                </Text>
                                <View style={isLargeScreen ? styles.methodsContainerDesktop : null}>
                                    <ScrollView 
                                        horizontal={!isLargeScreen}
                                        showsHorizontalScrollIndicator={false}
                                        style={!isLargeScreen ? styles.methodsScrollView : null}
                                        contentContainerStyle={!isLargeScreen ? styles.methodsContentContainer : null}
                                        scrollEnabled={!isLargeScreen}
                                    >
                                        <View style={isLargeScreen ? styles.methodsContainerDesktop : styles.methodsContainer}>
                                            {paymentMethods.map((item) => (
                                                <TouchableOpacity
                                                    key={item.method}
                                                    style={[
                                                        styles.methodButton,
                                                        { borderColor: theme.border.default },
                                                        selectedMethod === item.method && [styles.methodButtonSelected, { borderColor: theme.components.button.primary.bg, backgroundColor: isDark ? theme.components.badge.primary : '#D9F99D' }],
                                                    ]}
                                                    onPress={() => setSelectedMethod(item.method)}
                                                >
                                                    <Ionicons
                                                        name={item.icon}
                                                        size={20}
                                                        color={selectedMethod === item.method ? '#000000' : theme.text.secondary}
                                                    />
                                                    <Text style={[
                                                        styles.methodLabel,
                                                        { color: theme.text.secondary },
                                                        selectedMethod === item.method && [styles.methodLabelSelected, { color: '#000000' }],
                                                    ]}>
                                                        {t(item.labelKey)}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </ScrollView>
                                </View>
                            </>
                        ) : (
                            /* Space placeholder to maintain modal height stability - reduced for compactness */
                            <View style={[styles.methodsPlaceholder, { height: spacing.md }]} />
                        )}

                        {/* Description */}
                        <Text style={[styles.label, { color: theme.text.primary }]}>
                            {t('payments.modals.registerPayment.fields.description')}
                        </Text>
                        <TextInput
                            style={[styles.textInput, { borderColor: theme.border.default, color: theme.text.primary, minHeight: 44 }]}
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
                </View>
            </View>
        </Modal>
    );
}

const createStyles = (theme: Theme, isLargeScreen: boolean) => StyleSheet.create({
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
    mobileOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        width: '100%',
        height: '100%',
    },
    modalContent: {
        width: '100%',
        maxWidth: 420,
        height: !isLargeScreen ? '100%' : 'auto',
        flex: !isLargeScreen ? 1 : 0,
        borderTopLeftRadius: isLargeScreen ? 16 : 32,
        borderTopRightRadius: isLargeScreen ? 16 : 32,
        overflow: 'hidden',
    },
    modalContentDesktop: {
        width: '100%',
        maxWidth: 420,
        maxHeight: 520,
        minHeight: 480, 
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: theme.border.subtle,
    },
    header: {
        paddingTop: !isLargeScreen && Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0,
        borderBottomWidth: 1,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 56,
        paddingHorizontal: spacing.sm,
    },
    headerSideItem: {
        width: 48, 
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitleContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: typography.size.lg,
        fontWeight: '700',
        textAlign: 'center',
        includeFontPadding: false,
    },
    closeButton: {
        zIndex: 1,
    },
    content: {
        flex: 1,
        paddingTop: spacing.md,
        width: '100%',
        maxWidth: 420,
        alignSelf: 'center',
    },
    scrollContent: {
        paddingBottom: spacing.xxxl, // Extra space at bottom for keyboard
    },
    playerInfo: {
        padding: spacing.sm,
        borderRadius: 12,
        marginBottom: spacing.md,
        marginHorizontal: isLargeScreen ? spacing.md : spacing.sm,
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
        marginBottom: 6,
        marginTop: 12,
        marginHorizontal: isLargeScreen ? spacing.md : spacing.sm,
    },
    typeSelector: {
        flexDirection: 'row',
        gap: spacing.md,
        marginBottom: spacing.md,
        marginHorizontal: isLargeScreen ? spacing.md : spacing.sm,
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
        marginBottom: spacing.md,
        width: isLargeScreen ? 180 : 220,
    },
    amountRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.md,
        marginVertical: spacing.md,
    },
    amountControls: {
        alignItems: 'center',
    },
    currencySymbol: {
        fontSize: typography.size.sm,
        fontWeight: '600',
    },
    amountInput: {
        flex: 1,
        fontSize: typography.size.sm,
        fontWeight: '600',
        paddingVertical: spacing.sm,
        marginLeft: spacing.xs,
    },
    quickButton: {
        padding: spacing.xs,
        borderRadius: 8,
        marginBottom: spacing.xs,
        alignSelf: 'center',
    },
    quickButtonText: {
        fontSize: typography.size.xs,
        fontWeight: '500',
        textAlign: 'center',
        color: theme.text.secondary,
    },
    methodsScrollView: {
        marginBottom: spacing.md,
    },
    methodsContentContainer: {
        paddingHorizontal: isLargeScreen ? spacing.md : spacing.sm,
    },
    methodsContainer: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    methodsContainerDesktop: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginBottom: spacing.md,
        paddingLeft: spacing.lg,
    },
    methodsPlaceholder: {
        height: 65, // Approximated height of label + buttons row to freeze layout
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
        marginHorizontal: isLargeScreen ? spacing.md : spacing.sm,
    },
    unifiedPaymentSection: {
        marginBottom: spacing.xs,
        marginHorizontal: isLargeScreen ? spacing.md : spacing.sm,
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
        borderRadius: 16,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
        marginHorizontal: isLargeScreen ? spacing.md : spacing.sm,
        alignSelf: 'center',
        width: 'auto',
        minWidth: 160,
    },
    readOnlyLabel: {
        fontSize: typography.size.xs,
        fontWeight: '800',
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    readOnlyAmount: {
        fontSize: typography.size.xl,
        fontWeight: '800',
    },
});


