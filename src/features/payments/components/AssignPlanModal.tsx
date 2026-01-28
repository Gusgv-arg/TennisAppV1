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
            animationType="fade"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.dialog}>
                    <View style={styles.header}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.title}>Asignar Plan</Text>
                            <Text style={styles.subtitle}>{playerName}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
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
        flexGrow: 0, // Allow list to scroll but don't force full height expansion unnecessarily
    },
    listContent: {
        padding: spacing.lg,
    },
    sectionTitle: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        color: colors.neutral[500],
        marginBottom: spacing.md,
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
        marginTop: spacing.lg,
        paddingTop: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.neutral[200],
    },
    submitButton: {
        marginTop: spacing.lg,
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
