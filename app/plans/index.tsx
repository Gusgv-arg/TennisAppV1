import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import StatusModal from '@/src/components/StatusModal';
import { Input } from '@/src/design/components/Input';

import { Button } from '@/src/design/components/Button';
import { Card } from '@/src/design/components/Card';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { PlanModal } from '@/src/features/payments/components/PlanModal';
import { usePaymentSettings } from '@/src/features/payments/hooks/usePaymentSettings';
import { usePricingPlans } from '@/src/features/payments/hooks/usePricingPlans';
import { PricingPlan } from '@/src/types/payments';

export default function PlansIndexScreen() {
    const router = useRouter();
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

    const renderPlanItem = ({ item }: { item: PricingPlan }) => (
        <Card style={styles.planCard} padding="md">
            <View style={styles.cardContent}>
                <View style={styles.planMainInfo}>
                    <View style={styles.headerRow}>
                        <Text style={styles.planName}>{item.name}</Text>

                        {!isSimplifiedMode && (
                            <Text style={styles.planAmount}>
                                ${new Intl.NumberFormat('es-AR').format(item.amount)}
                            </Text>
                        )}

                        <View style={styles.typeBadge}>
                            <Text style={styles.typeBadgeText}>{getPlanTypeLabel(item.type)}</Text>
                        </View>
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
                        <Ionicons name="create-outline" size={20} color={colors.primary[500]} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => showArchived ? handleRestorePress(item.id) : handleArchivePress(item.id)}
                        style={styles.actionButton}
                    >
                        <Ionicons
                            name={showArchived ? "refresh-outline" : "trash-outline"}
                            size={20}
                            color={showArchived ? colors.success[500] : colors.error[500]}
                        />
                    </TouchableOpacity>
                </View>
            </View>
        </Card>
    );

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    headerTitle: () => (
                        <View style={styles.headerTitleContainer}>
                            <Ionicons name="pricetags" size={24} color={colors.primary[500]} style={{ marginRight: spacing.sm }} />
                            <Text style={styles.headerTitleText}>Planes de Pago</Text>
                        </View>
                    ),
                    headerTitleAlign: 'center',
                    headerLeft: () => (
                        <TouchableOpacity
                            onPress={() => router.back()}
                            style={{ marginLeft: spacing.sm }}
                        >
                            <Ionicons name="arrow-back" size={24} color={colors.neutral[900]} />
                        </TouchableOpacity>
                    ),
                    headerShown: true,
                }}
            />

            {/* Description Section */}
            <View style={styles.descriptionSection}>
                <Text style={styles.descriptionText}>
                    Crea y administra los planes para tus alumnos
                </Text>
            </View>

            {/* Desktop Center Wrapper */}
            <View style={styles.centerWrapper}>
                <View style={styles.header}>
                    <View style={styles.searchBar}>
                        <Input
                            placeholder="Buscar por nombre..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            leftIcon={<Ionicons name="search" size={20} color={colors.neutral[400]} />}
                            style={styles.searchInput}
                            containerStyle={{ marginBottom: 0 }}
                            size="sm"
                        />
                    </View>
                    <Button
                        label="Nuevo"
                        leftIcon={<Ionicons name="add" size={20} color={colors.common.white} />}
                        onPress={() => {
                            setSelectedPlan(null);
                            setPlanModalVisible(true);
                        }}
                        style={styles.addButton}
                        size="sm"
                        shadow
                    />
                </View>

                {/* Filters */}
                <View style={styles.filterContainer}>
                    <TouchableOpacity
                        style={[styles.filterTab, !showArchived && styles.activeFilterTab]}
                        onPress={() => setShowArchived(false)}
                    >
                        <Ionicons
                            name="checkmark-circle"
                            size={16}
                            color={!showArchived ? colors.common.white : colors.neutral[400]}
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
                            color={showArchived ? colors.common.white : colors.neutral[400]}
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
                    <ActivityIndicator size="large" color={colors.primary[500]} style={{ flex: 1 }} />
                ) : (
                    <FlatList
                        data={filteredPlans}
                        renderItem={renderPlanItem}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Ionicons name="pricetags-outline" size={48} color={colors.neutral[300]} />
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
                plan={selectedPlan}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.neutral[50],
    },
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitleText: {
        fontSize: typography.size.lg,
        fontWeight: '700',
        color: colors.neutral[900],
    },
    descriptionSection: {
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
        backgroundColor: colors.common.white,
    },
    descriptionText: {
        fontSize: typography.size.sm,
        color: colors.neutral[500],
    },
    header: {
        flexDirection: 'row',
        padding: spacing.md,
        paddingBottom: spacing.sm,
        gap: spacing.sm,
        alignItems: 'center',
    },
    searchBar: {
        flex: 1,
    },
    searchInput: {
        backgroundColor: colors.common.white,
    },
    addButton: {
        paddingHorizontal: spacing.md,
    },
    filterContainer: {
        flexDirection: 'row',
        paddingHorizontal: spacing.md,
        marginBottom: spacing.sm,
        gap: spacing.md,
    },
    filterTab: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: 20,
        backgroundColor: colors.neutral[100],
    },
    activeFilterTab: {
        backgroundColor: colors.primary[500],
    },
    filterTabText: {
        fontSize: typography.size.xs,
        fontWeight: '600',
        color: colors.neutral[600],
    },
    activeFilterTabText: {
        color: colors.common.white,
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
    planName: {
        fontSize: typography.size.md,
        fontWeight: '600',
        color: colors.neutral[900],
    },
    typeBadge: {
        backgroundColor: colors.neutral[100],
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    typeBadgeText: {
        fontSize: 10,
        color: colors.neutral[600],
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    planDescription: {
        fontSize: typography.size.xs,
        color: colors.neutral[500],
    },
    planAmount: {
        fontSize: typography.size.md,
        fontWeight: '700',
        color: colors.primary[600],
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
        fontSize: typography.size.md,
        color: colors.neutral[400],
    },
    countBadge: {
        backgroundColor: colors.primary[500],
        borderRadius: 10,
        paddingHorizontal: 4,
        height: 14,
        minWidth: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: spacing.xs,
    },
    countBadgeText: {
        color: colors.common.white,
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
