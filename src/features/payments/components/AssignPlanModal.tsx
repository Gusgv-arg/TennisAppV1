import { commonStyles } from '@/src/design/common';
import { useTheme } from '@/src/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Button } from '../../../design/components/Button';
import { Input } from '../../../design/components/Input';
import { Theme } from '../../../design/theme';
import { spacing } from '../../../design/tokens/spacing';
import { typography } from '../../../design/tokens/typography';
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
    const { theme } = useTheme();
    const styles = React.useMemo(() => createStyles(theme), [theme]);
    const { plans, isLoading: isLoadingPlans } = usePricingPlans();
    const { subscriptions, assignPlan, isAssigning } = useSubscriptions(playerId);

    // Filter out plans already assigned to this player
    const assignedPlanIds = React.useMemo(
        () => new Set(subscriptions?.map(s => s.plan_id) || []),
        [subscriptions]
    );
    const availablePlans = React.useMemo(
        () => plans?.filter(p => !assignedPlanIds.has(p.id)) || [],
        [plans, assignedPlanIds]
    );

    const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);
    const [notes, setNotes] = useState('');

    const togglePlan = (planId: string) => {
        setSelectedPlanIds(prev =>
            prev.includes(planId) ? prev.filter(id => id !== planId) : [...prev, planId]
        );
    };

    const handleAssign = async () => {
        if (selectedPlanIds.length === 0) return;

        try {
            for (const planId of selectedPlanIds) {
                const plan = plans?.find(p => p.id === planId);
                if (plan) {
                    await assignPlan({
                        playerId,
                        planId: plan.id,
                        customAmount: plan.amount,
                        notes: notes || undefined
                    });
                }
            }
            onClose();
            setSelectedPlanIds([]);
            setNotes('');
        } catch (error) {
            console.error('Error assigning plan:', error);
        }
    };

    const handleClose = () => {
        onClose();
        setSelectedPlanIds([]);
        setNotes('');
    };

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent
            onRequestClose={handleClose}
        >
            <View style={commonStyles.modal.overlay}>
                <View style={[
                    commonStyles.modal.content,
                    {
                        backgroundColor: theme.background.surface,
                        borderColor: theme.border.subtle,
                    }
                ]}>
                    {/* Header */}
                    <View style={[styles.header, { borderBottomColor: theme.border.subtle }]}>
                        <View style={{ flex: 1 }}>
                            <Text style={[typography.variants.h3, { color: theme.text.primary }]}>Asignar Plan</Text>
                            <Text style={[typography.variants.bodySmall, { color: theme.text.secondary }]}>{playerName}</Text>
                        </View>
                        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={theme.text.secondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Content */}
                    {isLoadingPlans ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={theme.components.button.primary.bg} />
                        </View>
                    ) : !availablePlans.length ? (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="pricetags-outline" size={48} color={theme.text.tertiary} />
                            <Text style={[typography.variants.bodyMedium, { color: theme.text.secondary, marginTop: spacing.md, textAlign: 'center' }]}>
                                {plans?.length ? 'Todos los planes ya están asignados' : 'No hay planes creados'}
                            </Text>

                        </View>
                    ) : (
                        <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ padding: spacing.lg }}>
                            {/* Plan list */}
                            {availablePlans.map((plan) => {
                                const isSelected = selectedPlanIds.includes(plan.id);
                                return (
                                    <TouchableOpacity
                                        key={plan.id}
                                        style={[
                                            styles.planItem,
                                            isSelected && styles.planItemActive,
                                        ]}
                                        onPress={() => togglePlan(plan.id)}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                                            <Ionicons
                                                name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                                                size={20}
                                                color={isSelected ? theme.text.primary : theme.text.secondary}
                                            />
                                            <Text style={[typography.variants.bodyMedium, { color: theme.text.primary, fontWeight: isSelected ? '600' : '400' }]}>
                                                {plan.name}
                                            </Text>
                                        </View>
                                        <Text style={[typography.variants.bodyMedium, { color: theme.text.primary, fontWeight: '700' }]}>
                                            ${plan.amount.toLocaleString('es-AR')}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}

                            {/* Personalizar section */}
                            <View style={styles.formContainer}>
                                <Text style={[typography.variants.label, { color: theme.text.secondary, marginBottom: spacing.sm }]}>
                                    Personalizar (Opcional)
                                </Text>
                                <Input
                                    label="Notas"
                                    placeholder="Ej: Descuento por hermano"
                                    value={notes}
                                    onChangeText={setNotes}
                                    multiline
                                />
                                <View style={{ alignItems: 'center', marginTop: spacing.lg }}>
                                    <Button
                                        label="Confirmar Asignación"
                                        onPress={handleAssign}
                                        loading={isAssigning}
                                        size="sm"
                                        disabled={selectedPlanIds.length === 0}
                                    />
                                </View>
                            </View>
                        </ScrollView>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const createStyles = (theme: Theme) => StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        padding: spacing.lg,
        borderBottomWidth: 1,
    },
    closeButton: {
        padding: spacing.xs,
        marginTop: -4,
        marginRight: -4,
    },
    loadingContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 200,
    },
    planItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: 12,
        marginBottom: spacing.xs,
        borderWidth: 1,
        borderColor: theme.border.default,
        backgroundColor: theme.background.surface,
    },
    planItemActive: {
        borderColor: theme.text.primary,
        backgroundColor: theme.background.subtle,
    },
    formContainer: {
        marginTop: spacing.lg,
        paddingTop: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: theme.border.subtle,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xl,
    },
});
