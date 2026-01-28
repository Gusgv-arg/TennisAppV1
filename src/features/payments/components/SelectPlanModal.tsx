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
    Platform,
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
    const [notes, setNotes] = useState('');

    const handleSelectPlan = (plan: PricingPlan) => {
        setSelectedPlan(plan);
    };

    const handleConfirm = () => {
        if (!selectedPlan) return;

        onSelect(
            selectedPlan,
            selectedPlan.amount,
            notes || undefined
        );

        // Reset state
        setSelectedPlan(null);
        setNotes('');
        onClose();
    };

    const handleClose = () => {
        setSelectedPlan(null);
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
            animationType="fade"
            transparent={true}
            onRequestClose={handleClose}
        >
            <View style={styles.overlay}>
                <View style={styles.dialog}>
                    <View style={styles.header}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.title}>Seleccionar Plan</Text>
                            <Text style={styles.subtitle}>Agrega un plan de cobro</Text>
                        </View>
                        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={colors.neutral[600]} />
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
                            style={styles.list}
                            ListHeaderComponent={
                                <Text style={styles.sectionTitle}>Planes Disponibles</Text>
                            }
                            ListFooterComponent={
                                selectedPlan ? (
                                    <View style={styles.formContainer}>
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
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.md,
    },
    dialog: {
        backgroundColor: colors.common.white,
        borderRadius: 16,
        width: '100%',
        maxWidth: Platform.OS === 'web' ? 600 : '100%',
        maxHeight: Platform.OS === 'web' ? '90%' : '100%',
        flex: Platform.OS === 'web' ? undefined : 1, // On mobile take full space if needed or behave like dialog
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[100],
        backgroundColor: colors.common.white,
    },
    title: {
        fontSize: typography.size.lg,
        fontWeight: '700',
        color: colors.neutral[900],
        marginBottom: 4,
    },
    subtitle: {
        fontSize: typography.size.sm,
        color: colors.neutral[500],
    },
    closeButton: {
        padding: spacing.xs,
        marginTop: -4,
        marginRight: -4,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 200,
    },
    list: {
        flexGrow: 0,
    },
    listContent: {
        padding: spacing.lg,
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
        padding: spacing.sm,
        borderRadius: 8,
        marginBottom: spacing.xs,
        borderWidth: 1,
        borderColor: colors.neutral[200],
    },
    planItemActive: {
        backgroundColor: colors.primary[50],
        borderColor: colors.primary[500],
    },
    planHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 2,
    },
    planName: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        color: colors.neutral[900],
    },
    planAmount: {
        fontSize: typography.size.sm,
        fontWeight: '700',
        color: colors.primary[500],
    },
    planDescription: {
        fontSize: typography.size.xs,
        color: colors.neutral[500],
    },
    planTextActive: {
        color: colors.neutral[900],
    },
    formContainer: {
        marginTop: spacing.lg,
        paddingTop: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.neutral[200],
    },
    submitButton: {
        marginTop: spacing.sm,
        alignSelf: 'center',
        minWidth: 200,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xl,
    },
    emptyText: {
        fontSize: typography.size.md,
        color: colors.neutral[500],
        marginTop: spacing.md,
    },
});
