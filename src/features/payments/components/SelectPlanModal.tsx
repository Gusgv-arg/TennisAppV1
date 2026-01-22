import { Button } from '@/src/design/components/Button';
import { Input } from '@/src/design/components/Input';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { PricingPlan } from '@/src/types/payments';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { usePricingPlans } from '../hooks/usePricingPlans';

interface SelectPlanModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (plan: PricingPlan, customAmount: number, notes?: string) => void;
}

export default function SelectPlanModal({
    visible,
    onClose,
    onSelect
}: SelectPlanModalProps) {
    const { plans, isLoading: isLoadingPlans } = usePricingPlans();

    const [selectedPlan, setSelectedPlan] = useState<PricingPlan | null>(null);
    const [customAmount, setCustomAmount] = useState('');
    const [notes, setNotes] = useState('');

    const handleSelectPlan = (plan: PricingPlan) => {
        setSelectedPlan(plan);
        setCustomAmount(plan.amount.toString());
    };

    const handleConfirm = () => {
        if (!selectedPlan) return;

        onSelect(
            selectedPlan,
            customAmount ? parseFloat(customAmount) : selectedPlan.amount,
            notes || undefined
        );

        // Reset state
        setSelectedPlan(null);
        setCustomAmount('');
        setNotes('');
        onClose();
    };

    const handleClose = () => {
        setSelectedPlan(null);
        setCustomAmount('');
        setNotes('');
        onClose();
    };

    const renderPlanItem = ({ item }: { item: PricingPlan }) => {
        const isActive = selectedPlan?.id === item.id;

        const getDescription = (plan: PricingPlan) => {
            switch (plan.type) {
                case 'monthly':
                    return 'Plan Mensual';
                case 'package':
                    return 'Plan Promocional';
                case 'per_class':
                    return 'Pago por clase';
                case 'custom':
                    return 'Personalizado';
                default:
                    return '';
            }
        };

        return (
            <TouchableOpacity
                style={[
                    styles.planItem,
                    isActive && styles.planItemActive
                ]}
                onPress={() => handleSelectPlan(item)}
            >
                <View style={styles.planHeader}>
                    <Text style={[styles.planName, isActive && styles.planTextActive]}>
                        {item.name}
                    </Text>
                    <Text style={[styles.planAmount, isActive && styles.planTextActive]}>
                        ${item.amount}
                    </Text>
                </View>
                <Text style={[styles.planDescription, isActive && styles.planTextActive]}>
                    {getDescription(item)}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={handleClose}
        >
            <View style={styles.container}>
                <View style={styles.header}>
                    <View>
                        <Text style={styles.title}>Seleccionar Plan</Text>
                        <Text style={styles.subtitle}>Agrega un plan de cobro</Text>
                    </View>
                    <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                        <Ionicons name="close" size={28} color={colors.neutral[600]} />
                    </TouchableOpacity>
                </View>

                {isLoadingPlans ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary[500]} />
                    </View>
                ) : (
                    <FlatList
                        data={plans}
                        keyExtractor={(item) => item.id}
                        renderItem={renderPlanItem}
                        contentContainerStyle={styles.listContent}
                        ListHeaderComponent={
                            <Text style={styles.sectionTitle}>Planes Disponibles</Text>
                        }
                        ListFooterComponent={
                            selectedPlan ? (
                                <View style={styles.formContainer}>
                                    <Text style={styles.sectionTitle}>Personalizar (Opcional)</Text>
                                    <View style={{ marginBottom: spacing.md }}>
                                        <Input
                                            label="Monto Personalizado"
                                            placeholder={selectedPlan.amount.toString()}
                                            value={customAmount}
                                            onChangeText={setCustomAmount}
                                            keyboardType="numeric"
                                        />
                                    </View>
                                    <View style={{ marginBottom: spacing.md }}>
                                        <Input
                                            label="Notas"
                                            placeholder="Ej: Descuento especial"
                                            value={notes}
                                            onChangeText={setNotes}
                                            multiline
                                        />
                                    </View>
                                    <Button
                                        label="Agregar Plan"
                                        onPress={handleConfirm}
                                        style={styles.submitButton}
                                    />
                                </View>
                            ) : null
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Ionicons name="pricetags-outline" size={64} color={colors.neutral[300]} />
                                <Text style={styles.emptyText}>No hay planes creados</Text>
                            </View>
                        }
                    />
                )}
            </View>
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
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.lg,
        backgroundColor: colors.common.white,
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[100],
    },
    title: {
        fontSize: typography.size.xl,
        fontWeight: '700',
        color: colors.neutral[900],
    },
    subtitle: {
        fontSize: typography.size.sm,
        color: colors.neutral[500],
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
        paddingBottom: 40,
    },
    sectionTitle: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        color: colors.neutral[500],
        marginBottom: spacing.md,
        marginTop: spacing.sm,
    },
    planItem: {
        backgroundColor: colors.common.white,
        padding: spacing.md,
        borderRadius: 12,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.neutral[200],
    },
    planItemActive: {
        backgroundColor: colors.primary[500],
        borderColor: colors.primary[500],
    },
    planHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    planName: {
        fontSize: typography.size.md,
        fontWeight: '600',
        color: colors.neutral[900],
    },
    planAmount: {
        fontSize: typography.size.md,
        fontWeight: '700',
        color: colors.primary[500],
    },
    planDescription: {
        fontSize: typography.size.sm,
        color: colors.neutral[500],
    },
    planTextActive: {
        color: colors.common.white,
    },
    formContainer: {
        marginTop: spacing.md,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.neutral[200],
    },
    submitButton: {
        marginTop: spacing.sm,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xl * 2,
    },
    emptyText: {
        fontSize: typography.size.lg,
        fontWeight: '600',
        color: colors.neutral[700],
        marginTop: spacing.md,
    },
});
