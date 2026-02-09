import { useTheme } from '@/src/hooks/useTheme';
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
import { Button } from '../../../design/components/Button';
import { Input } from '../../../design/components/Input';
import { Theme } from '../../../design/theme';
import { spacing } from '../../../design/tokens/spacing';
import { typography } from '../../../design/tokens/typography';
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
    const { theme, isDark } = useTheme();
    const styles = React.useMemo(() => createStyles(theme), [theme]);
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
                    <Text style={[styles.planName, isActive && { color: 'white' }]}>
                        {item.name}
                    </Text>
                    <Text style={[styles.planAmount, { color: theme.components.button.primary.bg }, isActive && { color: 'white' }]}>
                        ${item.amount}
                    </Text>
                </View>
                <Text style={[styles.planDescription, { color: theme.text.secondary }, isActive && { color: 'white' }]}>
                    {item.type === 'monthly' ? 'Mensual' : 'Por Clase'}
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
            <View style={[styles.overlay, { backgroundColor: theme.background.backdrop }]}>
                <View style={[styles.dialog, { shadowColor: '#000' }]}>
                    <View style={styles.header}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.title}>Asignar Plan</Text>
                            <Text style={styles.subtitle}>{playerName}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={theme.text.secondary} />
                        </TouchableOpacity>
                    </View>

                    {isLoadingPlans ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={theme.components.button.primary.bg} />
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
                                    <Ionicons name="pricetags-outline" size={64} color={theme.text.disabled || theme.text.tertiary} />
                                    <Text style={[styles.emptyText, { color: theme.text.secondary }]}>No hay planes creados</Text>
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

const createStyles = (theme: Theme) => StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.md,
    },
    dialog: {
        backgroundColor: theme.background.surface,
        borderRadius: 16,
        width: '100%',
        maxWidth: Platform.OS === 'web' ? 600 : '100%',
        maxHeight: Platform.OS === 'web' ? '90%' : '100%',
        flex: Platform.OS === 'web' ? undefined : 1,
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
        borderBottomColor: theme.border.subtle,
        backgroundColor: theme.background.surface,
    },
    title: {
        ...typography.variants.h3,
        color: theme.text.primary,
        marginBottom: 4,
    },
    subtitle: {
        ...typography.variants.bodySmall,
        color: theme.text.secondary,
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
    },
    sectionTitle: {
        ...typography.variants.label,
        color: theme.text.secondary,
        marginBottom: spacing.md,
    },
    planItem: {
        backgroundColor: theme.background.surface,
        padding: spacing.md,
        borderRadius: 12,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: theme.border.default,
    },
    planItemActive: {
        backgroundColor: theme.components.button.primary.bg,
        borderColor: theme.components.button.primary.bg,
    },
    planHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    planName: {
        ...typography.variants.bodyLarge,
        fontWeight: '600',
        color: theme.text.primary,
    },
    planAmount: {
        ...typography.variants.bodyLarge,
        fontWeight: '700',
    },
    planDescription: {
        ...typography.variants.bodySmall,
    },
    formContainer: {
        marginTop: spacing.lg,
        paddingTop: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: theme.border.subtle,
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
        ...typography.variants.bodyLarge,
        color: theme.text.secondary,
        marginTop: spacing.md,
    },
});
