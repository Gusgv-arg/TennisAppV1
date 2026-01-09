import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

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

    const handleSave = async () => {
        if (!formData.name || (!isSimplifiedMode && !formData.amount)) {
            Alert.alert('Error', 'Por favor completa los campos obligatorios');
            return;
        }

        try {
            const planPayload = {
                name: formData.name,
                type: formData.type,
                amount: isSimplifiedMode ? 0 : parseFloat(formData.amount),
                description: formData.description || undefined,
                package_classes: formData.type === 'package' ? parseInt(formData.package_classes) : undefined,
                // We might need to handle valid_from if the API supports it for initial creation, 
                // but usually createPlan defaults to NOW. 
                // If we want to support backdating creation, we need to update createPlan hook logic.
                // For now, let's assume createPlan handles valid_from or defaults to now.
                // Checking usePricingPlans: 
                // const { error: priceError } = await supabase... .insert([{ ..., valid_from: new Date().toISOString() ... }])
                // It currently uses new Date().toISOString(). 
                // We should ideally update createPlan to accept initial price date, but let's stick to default behavior or ask user if this is critical.
                // The new design proposal said: "Precio Inicial (Se guarda como el primer registro del historial con fecha Hoy)".
                // So no need to pass valid_from to API yet unless we mod the hook.
            };

            await createPlan(planPayload);

            Alert.alert(
                '¡Plan Creado!',
                'El nuevo plan de pago ha sido creado exitosamente.',
                [
                    {
                        text: 'Entendido',
                        onPress: () => router.back()
                    }
                ]
            );
        } catch (error) {
            Alert.alert('Error', 'No se pudo guardar el plan');
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
                    <Button
                        label="Crear Plan"
                        onPress={handleSave}
                        loading={isCreating}
                        variant="primary"
                        leftIcon={<Ionicons name="checkmark-sharp" size={20} color={colors.common.white} />}
                    />
                </View>
            </ScrollView>
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
        marginTop: spacing.md,
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
        marginVertical: spacing.md,
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
    }
});
