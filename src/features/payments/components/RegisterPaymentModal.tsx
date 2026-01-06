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

interface RegisterPaymentModalProps {
    visible: boolean;
    onClose: () => void;
    playerId: string;
    playerName: string;
    currentBalance?: number;
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
}: RegisterPaymentModalProps) {
    const { t } = useTranslation();
    const { createTransaction } = useTransactionMutations();

    const [amount, setAmount] = useState('');
    const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('cash');
    const [description, setDescription] = useState('');
    const [reference, setReference] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

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
            await createTransaction.mutateAsync({
                player_id: playerId,
                type: 'payment',
                amount: numAmount,
                payment_method: selectedMethod,
                description: description.trim() || `Pago de ${playerName}`,
                reference: reference.trim() || undefined,
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
        setReference('');
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
                            Balance: {formatCurrency(currentBalance)}
                        </Text>
                    </View>

                    {/* Amount Input */}
                    <Text style={styles.label}>Monto</Text>
                    <View style={styles.amountContainer}>
                        <Text style={styles.currencySymbol}>$</Text>
                        <TextInput
                            style={[styles.amountInput, { outlineStyle: 'none' } as any]}
                            value={amount}
                            onChangeText={setAmount}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor={colors.neutral[400]}
                        />
                    </View>

                    {/* Quick Amount Buttons */}
                    {currentBalance < 0 && (
                        <TouchableOpacity
                            style={styles.quickButton}
                            onPress={() => setAmount(Math.abs(currentBalance).toString())}
                        >
                            <Text style={styles.quickButtonText}>
                                Pagar deuda completa ({formatCurrency(Math.abs(currentBalance))})
                            </Text>
                        </TouchableOpacity>
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

                    {/* Reference */}
                    <Text style={styles.label}>Referencia (opcional)</Text>
                    <TextInput
                        style={styles.textInput}
                        value={reference}
                        onChangeText={setReference}
                        placeholder="Nro. comprobante, recibo, etc."
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
    submitButton: {
        marginTop: spacing.md,
        marginBottom: spacing.xl,
    },
});
