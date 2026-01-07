import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button } from '@/src/design/components/Button';
import { Card } from '@/src/design/components/Card';
import { Input } from '@/src/design/components/Input';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { usePaymentSettings } from '@/src/features/payments/hooks/usePaymentSettings';
import { usePricingPlans } from '@/src/features/payments/hooks/usePricingPlans';
import { PricingPlanType } from '@/src/types/payments';

export default function EditPlanScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { plans, updatePlan, createPrice, deletePrice, syncSubscriptionsPrice, isUpdating, isCreatingPrice, isDeletingPrice, isSyncing } = usePricingPlans();
    const { isSimplifiedMode } = usePaymentSettings();

    const plan = (plans ?? []).find(p => p.id === id);

    const [formData, setFormData] = useState({
        name: '',
        type: 'monthly' as PricingPlanType,
        amount: '',
        package_classes: '',
        description: '',
    });

    // Sync logic
    const [syncPrice, setSyncPrice] = useState(false);

    // New Price logic
    const [newPrice, setNewPrice] = useState({
        amount: '',
        valid_from: new Date().toISOString().split('T')[0],
    });

    useEffect(() => {
        if (plan) {
            setFormData({
                name: plan.name,
                type: plan.type,
                amount: plan.amount.toString(),
                package_classes: plan.package_classes?.toString() || '',
                description: plan.description || '',
            });
        }
    }, [plan]);

    if (!plan) {
        return <ActivityIndicator size="large" color={colors.primary[500]} style={{ flex: 1 }} />;
    }

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

            await updatePlan({ id: plan.id, updates: planPayload });

            if (syncPrice && parseFloat(formData.amount) !== plan.amount) {
                await syncSubscriptionsPrice({ planId: plan.id });
            }

            router.back();
        } catch (error) {
            Alert.alert('Error', 'No se pudo actualizar el plan');
        }
    };

    const handleAddPrice = async () => {
        if (!newPrice.amount || !newPrice.valid_from) {
            Alert.alert('Error', 'Completa el monto y la fecha');
            return;
        }

        try {
            await createPrice({
                planId: plan.id,
                amount: parseFloat(newPrice.amount),
                valid_from: new Date(newPrice.valid_from).toISOString(),
            });

            if (syncPrice) {
                await syncSubscriptionsPrice({ planId: plan.id });
            }

            Alert.alert('Éxito', 'Precio añadido al historial');
            setNewPrice({ amount: '', valid_from: new Date().toISOString().split('T')[0] });
            setSyncPrice(false);
        } catch (error) {
            Alert.alert('Error', 'No se pudo añadir el precio');
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

                {!isSimplifiedMode && parseFloat(formData.amount) !== plan.amount && (
                    <TouchableOpacity
                        style={styles.syncToggle}
                        onPress={() => setSyncPrice(!syncPrice)}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.checkbox, syncPrice && styles.checkboxActive]}>
                            {syncPrice && <Ionicons name="checkmark" size={14} color="white" />}
                        </View>
                        <Text style={styles.syncText}>Actualizar precio para todos los alumnos suscritos</Text>
                    </TouchableOpacity>
                )}

                <Button
                    label="Guardar Cambios"
                    onPress={handleSave}
                    loading={isUpdating}
                    variant="primary"
                    style={{ marginTop: spacing.md }}
                />

                {/* Historial y Futuros cambios */}
                {!isSimplifiedMode && (
                    <View style={styles.historySection}>
                        <View style={styles.historyDivider} />
                        <Text style={styles.sectionTitle}>Historial de Precios</Text>

                        {/* Lista de precios existentes */}
                        <View style={styles.priceList}>
                            {plan.prices?.map((price) => (
                                <View key={price.id} style={styles.priceItem}>
                                    <View>
                                        <Text style={styles.priceDate}>
                                            Desde: {new Date(price.valid_from).toLocaleDateString()}
                                        </Text>
                                        <Text style={styles.priceAmount}>
                                            ${new Intl.NumberFormat('es-AR').format(price.amount)}
                                        </Text>
                                    </View>
                                    {new Date(price.valid_from) > new Date() && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                                            <Text style={styles.futureBadge}>Programado</Text>
                                            <TouchableOpacity
                                                onPress={() => {
                                                    Alert.alert(
                                                        'Eliminar Cambio',
                                                        '¿Estás seguro de que quieres eliminar este cambio de precio programado?',
                                                        [
                                                            { text: 'Cancelar', style: 'cancel' },
                                                            { text: 'Eliminar', style: 'destructive', onPress: () => deletePrice(price.id) },
                                                        ]
                                                    );
                                                }}
                                                disabled={isDeletingPrice}
                                            >
                                                <Ionicons name="trash-outline" size={18} color={colors.error[500]} />
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            ))}
                        </View>

                        {/* Formulario para nuevo precio */}
                        <Card padding="md" style={styles.newPriceCard}>
                            <Text style={styles.newPriceTitle}>Programar Cambio de Precio</Text>
                            <View style={styles.newPriceRow}>
                                <View style={{ flex: 1 }}>
                                    <Input
                                        label="Nuevo Monto"
                                        placeholder="0"
                                        keyboardType="numeric"
                                        value={newPrice.amount}
                                        onChangeText={(text) => setNewPrice({ ...newPrice, amount: text })}
                                    />
                                </View>
                                <View style={{ flex: 1.5 }}>
                                    <Input
                                        label="Vence (YYYY-MM-DD)"
                                        placeholder="2026-01-01"
                                        value={newPrice.valid_from}
                                        onChangeText={(text) => setNewPrice({ ...newPrice, valid_from: text })}
                                    />
                                </View>
                            </View>

                            <TouchableOpacity
                                style={styles.syncToggle}
                                onPress={() => setSyncPrice(!syncPrice)}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.checkbox, syncPrice && styles.checkboxActive]}>
                                    {syncPrice && <Ionicons name="checkmark" size={14} color="white" />}
                                </View>
                                <Text style={styles.syncText}>Actualizar alumnos actuales al entrar en vigencia</Text>
                            </TouchableOpacity>

                            <Button
                                label="Añadir Precio Futuro"
                                onPress={handleAddPrice}
                                loading={isCreatingPrice || isSyncing}
                                size="sm"
                            />
                        </Card>
                    </View>
                )}
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
        paddingBottom: 40,
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
    syncToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        gap: spacing.sm,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: colors.primary[500],
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxActive: {
        backgroundColor: colors.primary[500],
    },
    syncText: {
        fontSize: typography.size.sm,
        color: colors.neutral[700],
        flex: 1,
    },
    historySection: {
        marginTop: spacing.xl,
        gap: spacing.md,
    },
    historyDivider: {
        height: 1,
        backgroundColor: colors.neutral[200],
        marginBottom: spacing.md,
    },
    sectionTitle: {
        fontSize: typography.size.md,
        fontWeight: '700',
        color: colors.neutral[900],
    },
    priceList: {
        gap: spacing.sm,
    },
    priceItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
        backgroundColor: colors.common.white,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.neutral[200],
    },
    priceDate: {
        fontSize: typography.size.xs,
        color: colors.neutral[500],
    },
    priceAmount: {
        fontSize: typography.size.md,
        fontWeight: '700',
        color: colors.neutral[900],
        marginTop: 2,
    },
    futureBadge: {
        fontSize: typography.size.xs,
        fontWeight: '600',
        color: colors.primary[600],
        backgroundColor: colors.primary[50],
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    newPriceCard: {
        marginTop: spacing.sm,
        backgroundColor: colors.neutral[100],
        borderStyle: 'dashed',
    },
    newPriceTitle: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        color: colors.neutral[800],
        marginBottom: spacing.sm,
    },
    newPriceRow: {
        flexDirection: 'row',
        gap: spacing.md,
    },
});
