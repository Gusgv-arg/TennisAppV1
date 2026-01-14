import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import StatusModal, { StatusType } from '@/src/components/StatusModal';

import { Button } from '@/src/design/components/Button';
import { Card } from '@/src/design/components/Card';
import { Input } from '@/src/design/components/Input';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { PlanDetailsForm } from '@/src/features/payments/components/PlanDetailsForm';
import { usePaymentSettings } from '@/src/features/payments/hooks/usePaymentSettings';
import { usePricingPlans } from '@/src/features/payments/hooks/usePricingPlans';
import { PricingPlanType } from '@/src/types/payments';

export default function NewPlanScreen() {
    const router = useRouter();
    const { createPlan, isCreating } = usePricingPlans();
    const { isSimplifiedMode } = usePaymentSettings();

    const [formData, setFormData] = useState({
        name: '',
        type: 'monthly' as PricingPlanType,
        amount: '',
        package_classes: '',
        description: '',
        valid_from: new Date().toISOString().split('T')[0],
    });

    const [statusModalVisible, setStatusModalVisible] = useState(false);
    const [statusConfig, setStatusConfig] = useState({
        type: 'success' as StatusType,
        title: '',
        message: '',
    });

    const handleSave = async () => {
        if (!formData.name || (!isSimplifiedMode && !formData.amount)) {
            setStatusConfig({
                type: 'error',
                title: 'Error',
                message: 'Por favor completa los campos obligatorios',
            });
            setStatusModalVisible(true);
            return;
        }

        try {
            const planPayload = {
                name: formData.name,
                type: formData.type,
                amount: isSimplifiedMode ? 0 : parseFloat(formData.amount),
                description: formData.description || undefined,
                package_classes: formData.type === 'package' ? parseInt(formData.package_classes) : undefined,
            };

            await createPlan(planPayload);

            setStatusConfig({
                type: 'success',
                title: '¡Plan Creado!',
                message: 'El nuevo plan de pago ha sido creado exitosamente.',
            });
            setStatusModalVisible(true);
        } catch (error) {
            setStatusConfig({
                type: 'error',
                title: 'Error',
                message: 'No se pudo guardar el plan',
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
                    title: 'Nuevo Plan',
                    headerTitleAlign: 'center',
                    headerShown: true,
                }}
            />

            <ScrollView contentContainerStyle={styles.formContainer}>

                <Text style={styles.sectionTitle}>1. Detalles del Plan</Text>
                <PlanDetailsForm
                    name={formData.name}
                    description={formData.description}
                    type={formData.type}
                    packageClasses={formData.package_classes}
                    onChangeName={(text) => setFormData({ ...formData, name: text })}
                    onChangeDescription={(text) => setFormData({ ...formData, description: text })}
                    onChangeType={(t) => setFormData({ ...formData, type: t })}
                    onChangePackageClasses={(text) => setFormData({ ...formData, package_classes: text })}
                    hideButton
                />

                {!isSimplifiedMode && (
                    <>
                        <View style={styles.divider} />
                        <Text style={styles.sectionTitle}>2. Precio Inicial</Text>
                        <Card padding="md" style={styles.priceCard}>
                            <Text style={styles.priceCardHint}>Este será el precio base a partir de hoy.</Text>
                            <Input
                                label="Monto"
                                placeholder="0"
                                keyboardType="numeric"
                                value={formData.amount}
                                onChangeText={(text) => setFormData({ ...formData, amount: text })}
                            />
                        </Card>
                    </>
                )}

                <View style={styles.footer}>
                    <View style={styles.buttonRow}>
                        <Button
                            label="Cancelar"
                            onPress={() => router.back()}
                            variant="outline"
                            style={{ flex: 1 }}
                        />
                        <Button
                            label="Crear Plan"
                            onPress={handleSave}
                            loading={isCreating}
                            variant="primary"
                            leftIcon={<Ionicons name="checkmark-sharp" size={20} color={colors.common.white} />}
                            style={{ flex: 1 }}
                        />
                    </View>
                </View>
            </ScrollView>

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
    formContainer: {
        padding: spacing.lg,
        gap: spacing.md,
    },
    sectionTitle: {
        fontSize: typography.size.md,
        fontWeight: '700',
        color: colors.neutral[900],
        marginTop: spacing.sm,
        marginBottom: spacing.xs,
    },
    formLabel: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        color: colors.neutral[700],
        marginBottom: -8,
    },
    typeSelector: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    typeButton: {
        flex: 1,
        paddingVertical: spacing.sm,
        alignItems: 'center',
        borderRadius: 8,
        backgroundColor: colors.neutral[100],
        borderWidth: 1,
        borderColor: colors.neutral[200],
    },
    typeButtonActive: {
        backgroundColor: colors.primary[50],
        borderColor: colors.primary[500],
    },
    typeButtonText: {
        fontSize: typography.size.xs,
        fontWeight: '600',
        color: colors.neutral[600],
    },
    typeButtonTextActive: {
        color: colors.primary[600],
    },
    divider: {
        height: 1,
        backgroundColor: colors.neutral[200],
        marginVertical: spacing.sm,
    },
    priceCard: {
        borderColor: colors.primary[200],
        backgroundColor: colors.primary[50],
    },
    priceCardHint: {
        fontSize: typography.size.xs,
        color: colors.primary[700],
        marginBottom: spacing.sm,
    },
    footer: {
        marginTop: spacing.xl,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
});
