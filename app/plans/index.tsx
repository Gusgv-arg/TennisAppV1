import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import StatusModal from '@/src/components/StatusModal';
// Input moved to raw implementation, removing import

import { Button } from '@/src/design/components/Button';
import { Card } from '@/src/design/components/Card';
import { Theme } from '@/src/design/theme';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { PlanModal } from '@/src/features/payments/components/PlanModal';
import { usePaymentSettings } from '@/src/features/payments/hooks/usePaymentSettings';
import { usePricingPlans } from '@/src/features/payments/hooks/usePricingPlans';
import { useTheme } from '@/src/hooks/useTheme';
import { PricingPlan } from '@/src/types/payments';

export default function PlansIndexScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const { plans, isLoading, togglePlanStatus, checkPlanUsage } = usePricingPlans();
    const { isSimplifiedMode } = usePaymentSettings();
    const [showArchived, setShowArchived] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const [planModalVisible, setPlanModalVisible] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<PricingPlan | null>(null);

    const [modalVisible, setModalVisible] = useState(false);
    const [modalConfig, setModalConfig] = useState<{
        type: 'warning' | 'success' | 'info' | 'error';
        title: string;
        message: string;
        onConfirm: () => void;
        confirmText?: string;
    }>({
        type: 'info',
        title: '',
        message: '',
        onConfirm: () => { }
    });

    const filteredPlans = plans?.filter(plan => {
        const matchesSearch = plan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            plan.type.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = showArchived ? !plan.is_active : plan.is_active;
        return matchesSearch && matchesStatus;
    }) || [];

    const archivedCount = plans?.filter(plan => !plan.is_active).length || 0;

    const handleArchivePress = async (id: string) => {
        try {
            const usages = await checkPlanUsage(id);

            if (usages && usages.length > 0) {
                // Limit list to avoid huge modal
                const limit = 5;
                const usageList = usages.slice(0, limit).map((u: { date: Date; playerName: string }) =>
                    `• ${u.date.getDate()}/${u.date.getMonth() + 1} - ${u.playerName} `
                ).join('\n');

                const moreCount = usages.length - limit;
                const suffix = moreCount > 0 ? `\n...y ${moreCount} clases más.` : '';

                setModalConfig({
                    type: 'warning',
                    title: '⚠️ Plan en Uso',
                    message: `Este plan está programado en ${usages.length} clases futuras:\n\n${usageList}${suffix}\n\nNota: Al archivar estas clases se mantendrán en el Calendario. Podés editarlas asignando un plan activo.`,
                    confirmText: 'Ok entiendo',
                    onConfirm: async () => {
                        await togglePlanStatus({ id, is_active: false });
                        setModalVisible(false);
                    }
                });
            } else {
                setModalConfig({
                    type: 'warning',
                    title: 'Archivar Plan',
                    message: '¿Estás seguro de que deseas archivar este plan? Dejará de estar visible para nuevas asignaciones.',
                    confirmText: 'Archivar',
                    onConfirm: async () => {
                        await togglePlanStatus({ id, is_active: false });
                        setModalVisible(false);
                    }
                });
            }
            setModalVisible(true);
        } catch (error) {
            console.error('Error checking plan usage:', error);
            // Fallback to standard flow
            setModalConfig({
                type: 'warning',
                title: 'Archivar Plan',
                message: '¿Estás seguro de que deseas archivar este plan?',
                confirmText: 'Archivar',
                onConfirm: async () => {
                    await togglePlanStatus({ id, is_active: false });
                    setModalVisible(false);
                }
            });
            setModalVisible(true);
        }
    };

    const handleRestorePress = (id: string) => {
        setModalConfig({
            type: 'success',
            title: 'Reactivar Plan',
            message: '¿Deseas reactivar este plan? Volverá a estar visible en la lista de planes activos.',
            confirmText: 'Reactivar',
            onConfirm: async () => {
                await togglePlanStatus({ id, is_active: true });
                setModalVisible(false);
            }
        });
        setModalVisible(true);
    };

    const getPlanTypeLabel = (type: string) => {
        const types: Record<string, string> = {
            monthly: 'Mensual',
            per_class: 'Por Clase',
            package: 'Promoción',
            custom: 'Personalizado'
        };
        return types[type] || type;
    };

    const getCurrentPrice = (plan: PricingPlan) => {
        if (!plan.prices || plan.prices.length === 0) return plan.amount;

        const today = new Date().toISOString().split('T')[0];

        // Filter prices valid as of today and sort by date descending
        const validPrices = plan.prices
            .filter(p => p.valid_from.split('T')[0] <= today)
            .sort((a, b) => b.valid_from.localeCompare(a.valid_from));

        return validPrices.length > 0 ? validPrices[0].amount : plan.amount;
    };

    const getNextPriceInfo = (plan: PricingPlan) => {
        if (!plan.prices || plan.prices.length === 0) return null;

        const today = new Date().toISOString().split('T')[0];

        // Filter prices valid in the future and sort by date ascending (the closest one first)
        const futurePrices = plan.prices
            .filter(p => p.valid_from.split('T')[0] > today)
            .sort((a, b) => a.valid_from.localeCompare(b.valid_from));

        return futurePrices.length > 0 ? futurePrices[0] : null;
    };

    const renderPlanItem = ({ item }: { item: PricingPlan }) => (
        <Card style={styles.planCard} padding="md">
            <View style={styles.cardContent}>
                <View style={styles.planMainInfo}>
                    <View style={styles.headerRow}>
                        <View style={styles.iconContainer}>
                            <Ionicons name="pricetag" size={16} color={theme.components.button.primary.bg} />
                        </View>
                        <Text style={styles.planName}>{item.name}</Text>

                        {!isSimplifiedMode && (
                            <Text style={styles.planAmount}>
                                ${new Intl.NumberFormat('es-AR').format(getCurrentPrice(item))}
                            </Text>
                        )}

                        <View style={styles.typeBadge}>
                            <Text style={styles.typeBadgeText}>{getPlanTypeLabel(item.type)}</Text>
                        </View>

                        {(() => {
                            const nextPrice = getNextPriceInfo(item);
                            if (nextPrice) {
                                return (
                                    <View style={styles.nextPriceContainer}>
                                        <Ionicons name="calendar-outline" size={10} color={theme.text.secondary} />
                                        <Text style={styles.nextPriceText}>
                                            Precio programado: <Text style={{ fontWeight: '700', color: theme.status.info }}>${new Intl.NumberFormat('es-AR').format(nextPrice.amount)}</Text> el {new Date(nextPrice.valid_from).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                                        </Text>
                                    </View>
                                );
                            }
                            return null;
                        })()}
                    </View>

                    {item.description && (
                        <Text style={styles.planDescription} numberOfLines={1}>
                            {item.description}
                        </Text>
                    )}
                </View>

                <View style={styles.actionButtonsRow}>
                    <TouchableOpacity
                        onPress={() => {
                            setSelectedPlan(item);
                            setPlanModalVisible(true);
                        }}
                        style={styles.actionButton}
                    >
                        <Ionicons name="create-outline" size={20} color={theme.status.warning} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => showArchived ? handleRestorePress(item.id) : handleArchivePress(item.id)}
                        style={styles.actionButton}
                    >
                        <Ionicons
                            name={showArchived ? "refresh-outline" : "trash-outline"}
                            size={20}
                            color={showArchived ? theme.status.success : theme.status.error}
                        />
                    </TouchableOpacity>
                </View>
            </View>
        </Card>
    );

    const styles = React.useMemo(() => createStyles(theme), [theme]);

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    headerTitle: () => (
                        <View style={styles.headerTitleContainer}>
                            <Ionicons name="pricetags" size={24} color={theme.components.button.primary.bg} style={{ marginRight: spacing.sm }} />
                            <Text style={styles.headerTitleText}>Planes de Pago</Text>
                        </View>
                    ),
                    headerTitleAlign: 'center',
                    headerLeft: () => (
                        <TouchableOpacity
                            onPress={() => router.back()}
                            style={{ marginLeft: spacing.sm }}
                        >
                            <Ionicons name="arrow-back" size={24} color={theme.text.primary} />
                        </TouchableOpacity>
                    ),
                    headerShown: true,
                }}
            />

            {/* Unified Header Section */}
            <View style={styles.headerSection}>
                <Text style={styles.descriptionText}>
                    Crea y administra los planes para tus alumnos
                </Text>

                <View style={styles.controlsWrapper}>
                    <View style={styles.searchInputContainer}>
                        <Ionicons name="search" size={20} color={theme.text.tertiary} />
                        <TextInput
                            placeholder="Buscar por nombre..."
                            placeholderTextColor={theme.text.tertiary}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            style={styles.searchInputText}
                            textAlignVertical="center"
                        />
                    </View>
                    <Button
                        label="Nuevo"
                        leftIcon={<Ionicons name="add" size={20} color="#FFFFFF" />}
                        onPress={() => {
                            setSelectedPlan(null);
                            setPlanModalVisible(true);
                        }}
                        style={styles.addButton}
                        size="sm"
                        shadow
                    />
                </View>
            </View>

            {/* Desktop Center Wrapper */}
            <View style={styles.centerWrapper}>

                {/* Filters */}
                <View style={styles.filterContainer}>
                    <TouchableOpacity
                        style={[styles.filterTab, !showArchived && styles.activeFilterTab]}
                        onPress={() => setShowArchived(false)}
                    >
                        <Ionicons
                            name="checkmark-circle"
                            size={16}
                            color={!showArchived ? theme.text.inverse : theme.text.tertiary}
                        />
                        <Text style={[styles.filterTabText, !showArchived && styles.activeFilterTabText]}>
                            Activos
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.filterTab, showArchived && styles.activeFilterTab]}
                        onPress={() => setShowArchived(true)}
                    >
                        <Ionicons
                            name="archive"
                            size={16}
                            color={showArchived ? theme.text.inverse : theme.text.tertiary}
                        />
                        <Text style={[styles.filterTabText, showArchived && styles.activeFilterTabText]}>
                            Archivados
                        </Text>
                        {archivedCount > 0 && (
                            <View style={styles.countBadge}>
                                <Text style={styles.countBadgeText}>{archivedCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                {isLoading ? (
                    <ActivityIndicator size="large" color={theme.components.button.primary.bg} style={{ flex: 1 }} />
                ) : (
                    <FlatList
                        data={filteredPlans}
                        renderItem={renderPlanItem}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Ionicons name="pricetags-outline" size={48} color={theme.text.disabled} />
                                <Text style={styles.emptyText}>
                                    {showArchived ? 'No hay planes archivados' : 'No tienes planes creados'}
                                </Text>
                            </View>
                        }
                    />
                )}
            </View>

            <StatusModal
                visible={modalVisible}
                type={modalConfig.type}
                title={modalConfig.title}
                message={modalConfig.message}
                onClose={() => setModalVisible(false)}
                onConfirm={modalConfig.onConfirm}
                buttonText={modalConfig.confirmText}
                showCancel
            />

            <PlanModal
                visible={planModalVisible}
                onClose={() => setPlanModalVisible(false)}
                plan={plans?.find(p => p.id === selectedPlan?.id) || selectedPlan}
            />
        </View>
    );
}

const createStyles = (theme: Theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background.default,
    },
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitleText: {
        ...typography.variants.h3,
        color: theme.text.primary,
    },
    headerSection: {
        backgroundColor: theme.background.surface,
        paddingTop: spacing.md,
        paddingBottom: spacing.md + 15,
        paddingHorizontal: spacing.md,
        alignItems: 'center',
        gap: spacing.md,
        borderBottomWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    descriptionText: {
        ...typography.variants.bodyMedium,
        textAlign: 'center',
        color: theme.text.secondary,
    },
    controlsWrapper: {
        flexDirection: 'row',
        gap: spacing.sm,
        width: '100%',
        maxWidth: 800,
        alignItems: 'center',
    },
    searchInputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 8,
        paddingHorizontal: spacing.sm,
        height: 48,
        backgroundColor: theme.background.input,
    },
    searchInputText: {
        flex: 1,
        height: '100%',
        ...typography.variants.bodyMedium,
        marginLeft: spacing.xs,
        paddingVertical: 0,
        color: theme.text.primary,
        outlineStyle: 'none' as any,
    },
    addButton: {
        paddingHorizontal: spacing.md,
        height: 48,
    },
    filterContainer: {
        flexDirection: 'row',
        paddingHorizontal: spacing.md,
        marginBottom: spacing.sm,
        marginTop: 15,
        gap: spacing.lg,
        justifyContent: 'center', // Center the tabs
    },
    filterTab: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: 20,
        backgroundColor: theme.background.subtle,
    },
    activeFilterTab: {
        backgroundColor: theme.components.button.primary.bg,
    },
    filterTabText: {
        ...typography.variants.labelSmall,
        color: theme.text.tertiary,
    },
    activeFilterTabText: {
        color: theme.text.inverse,
    },
    listContent: {
        padding: spacing.md,
        paddingTop: 0,
    },
    planCard: {
        marginBottom: spacing.sm,
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
    },
    planMainInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2,
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    iconContainer: {
        marginRight: spacing.xs,
        padding: 4,
        borderRadius: 4,
        backgroundColor: theme.background.subtle,
    },
    planName: {
        ...typography.variants.bodyMedium,
        fontWeight: '600',
        color: theme.text.primary,
    },
    typeBadge: {
        backgroundColor: theme.background.subtle,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    typeBadgeText: {
        fontSize: 10,
        color: theme.text.tertiary,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    planDescription: {
        ...typography.variants.bodySmall,
        color: theme.text.secondary,
        marginTop: 2,
    },
    nextPriceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: theme.background.subtle,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: theme.status.info + '20',
    },
    nextPriceText: {
        fontSize: 10,
        color: theme.text.secondary,
        fontWeight: '500',
    },
    planAmount: {
        ...typography.variants.bodyLarge,
        fontWeight: '700',
        color: theme.components.button.primary.bg,
    },
    actionButtonsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    actionButton: {
        padding: spacing.xs,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 100,
        gap: spacing.md,
    },
    emptyText: {
        ...typography.variants.bodyMedium,
        color: theme.text.tertiary,
    },
    countBadge: {
        backgroundColor: theme.components.button.primary.bg,
        borderRadius: 10,
        paddingHorizontal: 4,
        height: 14,
        minWidth: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: spacing.xs,
    },
    countBadgeText: {
        color: theme.text.inverse,
        fontSize: 9,
        fontWeight: '800',
        lineHeight: 12,
    },
    centerWrapper: {
        width: '100%',
        maxWidth: 800,
        alignSelf: 'center',
        flex: 1, // Ensure it takes height
    },
});
