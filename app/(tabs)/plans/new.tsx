import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button } from '@/src/design/components/Button';
import { Input } from '@/src/design/components/Input';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
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
                <Input
                    label="Nombre del Plan"
                    placeholder="Ej: Clase Individual, 8 Clases/Mes"
                    value={formData.name}
                    onChangeText={(text) => setFormData({ ...formData, name: text })}
                />

                <Text style={styles.formLabel}>Tipo de Plan</Text>
                <View style={styles.typeSelector}>
                    {['monthly', 'per_class', 'package'].map((t) => (
                        <TouchableOpacity
                            key={t}
                            style={[
                                styles.typeButton,
                                formData.type === t && styles.typeButtonActive
                            ]}
                            onPress={() => setFormData({ ...formData, type: t as PricingPlanType })}
                        >
                            <Text style={[
                                styles.typeButtonText,
                                formData.type === t && styles.typeButtonTextActive
                            ]}>
                                {t === 'monthly' ? 'Mensual' : t === 'per_class' ? 'Por Clase' : 'Paquete'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {!isSimplifiedMode && (
                    <Input
                        label="Monto"
                        placeholder="0"
                        keyboardType="numeric"
                        value={formData.amount}
                        onChangeText={(text) => setFormData({ ...formData, amount: text })}
                    />
                )}

                {formData.type === 'package' && (
                    <Input
                        label="Cantidad de Clases"
                        placeholder="8"
                        keyboardType="numeric"
                        value={formData.package_classes}
                        onChangeText={(text) => setFormData({ ...formData, package_classes: text })}
                    />
                )}

                <Input
                    label="Descripción (Opcional)"
                    placeholder="Detalles del plan..."
                    value={formData.description}
                    onChangeText={(text) => setFormData({ ...formData, description: text })}
                    multiline
                    numberOfLines={3}
                    inputStyle={{ minHeight: 80, textAlignVertical: 'top' }}
                />

                <View style={styles.footer}>
                    <Button
                        label="Crear Plan"
                        onPress={handleSave}
                        loading={isCreating}
                        variant="primary"
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
    footer: {
        marginTop: spacing.md,
    }
});
