import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import StatusModal, { StatusType } from '@/src/components/StatusModal';

import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { AddPriceModal } from '@/src/features/payments/components/AddPriceModal';
import { PlanDetailsForm } from '@/src/features/payments/components/PlanDetailsForm';
import { PlanPricingTimeline } from '@/src/features/payments/components/PlanPricingTimeline';
import { usePaymentSettings } from '@/src/features/payments/hooks/usePaymentSettings';
import { usePricingPlans } from '@/src/features/payments/hooks/usePricingPlans';
import { PricingPlanType } from '@/src/types/payments';

export default function EditPlanScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { plans, updatePlan, createPrice, deletePrice, syncSubscriptionsPrice, isUpdating, isCreatingPrice, isDeletingPrice, isSyncing } = usePricingPlans();
    const { isSimplifiedMode } = usePaymentSettings();

    const plan = (plans ?? []).find(p => p.id === id);

    // Tab State
    const [activeTab, setActiveTab] = useState<'details' | 'prices'>('details');
    const [addPriceModalVisible, setAddPriceModalVisible] = useState(false);

    // Status Modal State
    const [statusModalVisible, setStatusModalVisible] = useState(false);
    const [statusConfig, setStatusConfig] = useState({
        type: 'success' as StatusType,
        title: '',
        message: '',
    });

    // Form State (Details)
    const [formData, setFormData] = useState({
        name: '',
        type: 'monthly' as PricingPlanType,
        package_classes: '',
        description: '',
    });

    useEffect(() => {
        if (plan) {
            setFormData({
                name: plan.name,
                type: plan.type,
                package_classes: plan.package_classes?.toString() || '',
                description: plan.description || '',
            });
        }
    }, [plan]);

    if (!plan) {
        return <ActivityIndicator size="large" color={colors.primary[500]} style={{ flex: 1 }} />;
    }

    const handleSaveDetails = async () => {
        if (!formData.name) {
            setStatusConfig({
                type: 'error',
                title: 'Error',
                message: 'Por favor completa el nombre del plan',
            });
            setStatusModalVisible(true);
            return;
        }

        try {
            const planPayload = {
                name: formData.name,
                type: formData.type,
                description: formData.description || undefined,
                package_classes: formData.type === 'package' ? parseInt(formData.package_classes) : undefined,
            };

            await updatePlan({ id: plan.id, updates: planPayload });

            setStatusConfig({
                type: 'success',
                title: 'Éxito',
                message: 'Detalles del plan actualizados correctamente',
            });
            setStatusModalVisible(true);
        } catch (error) {
            setStatusConfig({
                type: 'error',
                title: 'Error',
                message: 'No se pudo actualizar el plan',
            });
            setStatusModalVisible(true);
        }
    };

    const handleAddPrice = async (amount: number, validFrom: string, sync: boolean) => {
        try {
            await createPrice({
                planId: plan.id,
                amount,
                valid_from: new Date(validFrom).toISOString(),
            });

            if (sync) {
                await syncSubscriptionsPrice({ planId: plan.id });
            }

            setAddPriceModalVisible(false);

            setStatusConfig({
                type: 'success',
                title: 'Éxito',
                message: 'Precio programado correctamente',
            });
            setStatusModalVisible(true);
        } catch (error) {
            setAddPriceModalVisible(false); // Close the add modal so we can show the error
            setStatusConfig({
                type: 'error',
                title: 'Error',
                message: 'No se pudo añadir el precio',
            });
            setStatusModalVisible(true);
        }
    };

    const handleModalClose = () => {
        setStatusModalVisible(false);
        if (statusConfig.type === 'success') {
            router.back();
        }
    };

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: 'Editar Plan',
                    headerTitleAlign: 'center',
                    headerShown: true,
                }}
            />

            {/* Tabs Header */}
            <View style={styles.tabsHeader}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'details' && styles.tabActive]}
                    onPress={() => setActiveTab('details')}
                >
                    <Text style={[styles.tabText, activeTab === 'details' && styles.tabTextActive]}>Detalles</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'prices' && styles.tabActive]}
                    onPress={() => setActiveTab('prices')}
                >
                    <Text style={[styles.tabText, activeTab === 'prices' && styles.tabTextActive]}>Precios y Vigencia</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {activeTab === 'details' ? (
                    <PlanDetailsForm
                        name={formData.name}
                        description={formData.description}
                        type={formData.type}
                        packageClasses={formData.package_classes}
                        onChangeName={(text) => setFormData({ ...formData, name: text })}
                        onChangeDescription={(text) => setFormData({ ...formData, description: text })}
                        onChangeType={(t) => setFormData({ ...formData, type: t })}
                        onChangePackageClasses={(text) => setFormData({ ...formData, package_classes: text })}
                        onSave={handleSaveDetails}
                        isLoading={isUpdating}
                    />
                ) : (
                    <View style={{ gap: spacing.lg }}>
                        <TouchableOpacity
                            style={styles.addPriceButton}
                            onPress={() => setAddPriceModalVisible(true)}
                        >
                            <View style={styles.addPriceIcon}>
                                <Ionicons name="add" size={24} color={colors.primary[600]} />
                            </View>
                            <View>
                                <Text style={styles.addPriceTitle}>Programar Nuevo Precio</Text>
                                <Text style={styles.addPriceSubtitle}>Define un aumento futuro o corrige el actual</Text>
                            </View>
                        </TouchableOpacity>

                        <PlanPricingTimeline
                            prices={plan.prices || []}
                            onDeletePrice={deletePrice}
                            isDeleting={isDeletingPrice}
                        />
                    </View>
                )}
            </ScrollView>

            <AddPriceModal
                visible={addPriceModalVisible}
                onClose={() => setAddPriceModalVisible(false)}
                onSave={handleAddPrice}
                isLoading={isCreatingPrice || isSyncing}
            />

            <StatusModal
                visible={statusModalVisible}
                type={statusConfig.type}
                title={statusConfig.title}
                message={statusConfig.message}
                onClose={handleModalClose}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.common.white,
    },
    tabsHeader: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[200],
        paddingHorizontal: spacing.md,
        justifyContent: 'flex-start', // Left align
        gap: spacing.lg, // Add some gap between tabs if they are not flex:1
    },
    tab: {
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.sm, // Reduced padding
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabActive: {
        borderBottomColor: colors.primary[500],
    },
    tabText: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        color: colors.neutral[500],
    },
    tabTextActive: {
        color: colors.primary[500],
    },
    content: {
        padding: spacing.lg,
    },
    addPriceButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        backgroundColor: colors.primary[50],
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.primary[100],
        gap: spacing.md,
    },
    addPriceIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.common.white,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addPriceTitle: {
        fontSize: typography.size.sm,
        fontWeight: '700',
        color: colors.primary[900],
    },
    addPriceSubtitle: {
        fontSize: typography.size.xs,
        color: colors.primary[700],
    },
});
