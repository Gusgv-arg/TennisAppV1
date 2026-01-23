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
import { colors, spacing, typography } from '../../../design';
import { Button } from '../../../design/components/Button';
import { Input } from '../../../design/components/Input';
import { PricingPlan } from '../../../types/payments';
import { usePricingPlans } from '../hooks/usePricingPlans';
import { useSubscriptions } from '../hooks/useSubscriptions';

interface AssignPlanModalProps {
    visible: boolean;
    onClose: () => void;
    playerId: string;
    playerName: string;
}

export default function AssignPlanModal({
    visible,
    onClose,
    playerId,
    playerName
}: AssignPlanModalProps) {
    const { plans, isLoading: isLoadingPlans } = usePricingPlans();
    const { assignPlan, isAssigning } = useSubscriptions(playerId);

    const [selectedPlan, setSelectedPlan] = useState<PricingPlan | null>(null);
    const [notes, setNotes] = useState('');

    const handleSelectPlan = (plan: PricingPlan) => {
        setSelectedPlan(plan);
    };

    const handleAssign = async () => {
        if (!selectedPlan) return;

        try {
            await assignPlan({
                playerId,
                planId: selectedPlan.id,
                customAmount: selectedPlan.amount,
                notes: notes || undefined
            });
            onClose();
            setSelectedPlan(null);
            setNotes('');
        } catch (error) {
            console.error('Error assigning plan:', error);
        }
    };

    const renderPlanItem = ({ item }: { item: PricingPlan }) => {
        const isActive = selectedPlan?.id === item.id;

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
                    {item.type === 'monthly' ? 'Mensual' : `Promoción de ${item.package_classes} clases`}
                </Text>
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
                <View style={styles.header}>
                    <View>
                        <Text style={styles.title}>Asignar Plan</Text>
                        <Text style={styles.subtitle}>{playerName}</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
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
                            <Text style={styles.sectionTitle}>Selecciona un plan</Text>
                        }
                        ListFooterComponent={
                            selectedPlan ? (
                                <View style={styles.formContainer}>
                                    <Text style={styles.sectionTitle}>Personalizar (Opcional)</Text>
                                    <Input
                                        label="Notas"
                                        placeholder="Ej: Descuento por hermano"
                                        value={notes}
                                        onChangeText={setNotes}
                                        multiline
                                    />
                                    <Button
                                        label="Confirmar Asignación"
                                        onPress={handleAssign}
                                        loading={isAssigning}
                                        style={styles.submitButton}
                                    />
                                </View>
                            ) : null
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Ionicons name="pricetags-outline" size={64} color={colors.neutral[300]} />
                                <Text style={styles.emptyText}>No hay planes creados</Text>
                                <Button
                                    label="Crear primer plan"
                                    variant="outline"
                                    onPress={onClose}
                                    style={{ marginTop: spacing.md }}
                                />
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
        marginTop: spacing.xl,
        paddingTop: spacing.xl,
        borderTopWidth: 1,
        borderTopColor: colors.neutral[200],
    },
    submitButton: {
        marginTop: spacing.lg,
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
