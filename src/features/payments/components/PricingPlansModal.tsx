import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { colors, spacing, typography } from '../../../design';
import { Button } from '../../../design/components/Button';
import { Card } from '../../../design/components/Card';
import { Input } from '../../../design/components/Input';
import { PricingPlan, PricingPlanType } from '../../../types/payments';
import { usePricingPlans } from '../hooks/usePricingPlans';

interface PricingPlansModalProps {
    visible: boolean;
    onClose: () => void;
}

export default function PricingPlansModal({ visible, onClose }: PricingPlansModalProps) {
    const { plans, isLoading, createPlan, updatePlan, deletePlan, createPrice, syncSubscriptionsPrice, isCreating, isUpdating, isSyncing, isCreatingPrice } = usePricingPlans();
    const [view, setView] = useState<'list' | 'form'>('list');
    const [editingPlan, setEditingPlan] = useState<PricingPlan | null>(null);
    const [syncPrice, setSyncPrice] = useState(false);

    // New price state
    const [newPrice, setNewPrice] = useState({
        amount: '',
        valid_from: new Date().toISOString().split('T')[0],
    });

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        type: 'monthly' as PricingPlanType,
        amount: '',
        package_classes: '',
        description: '',
    });

    const handleBack = () => {
        setView('list');
        setEditingPlan(null);
        setSyncPrice(false);
        setFormData({
            name: '',
            type: 'monthly',
            amount: '',
            package_classes: '',
            description: '',
        });
    };

    const handleEdit = (plan: PricingPlan) => {
        setEditingPlan(plan);
        setFormData({
            name: plan.name,
            type: plan.type,
            amount: plan.amount.toString(),
            package_classes: plan.package_classes?.toString() || '',
            description: plan.description || '',
        });
        setNewPrice({
            amount: '',
            valid_from: new Date().toISOString().split('T')[0],
        });
        setView('form');
    };

    const handleAddPrice = async () => {
        if (!editingPlan || !newPrice.amount || !newPrice.valid_from) {
            Alert.alert('Error', 'Completa el monto y la fecha');
            return;
        }

        try {
            await createPrice({
                planId: editingPlan.id,
                amount: parseFloat(newPrice.amount),
                valid_from: new Date(newPrice.valid_from).toISOString(),
            });

            if (syncPrice) {
                await syncSubscriptionsPrice({ planId: editingPlan.id });
            }

            Alert.alert('Éxito', 'Precio añadido al historial');
            setNewPrice({ amount: '', valid_from: new Date().toISOString().split('T')[0] });
            setSyncPrice(false);
        } catch (error) {
            Alert.alert('Error', 'No se pudo añadir el precio');
        }
    };

    const handleSave = async () => {
        if (!formData.name || !formData.amount) {
            Alert.alert('Error', 'Por favor completa los campos obligatorios');
            return;
        }

        try {
            const planPayload = {
                name: formData.name,
                type: formData.type,
                amount: parseFloat(formData.amount),
                description: formData.description || undefined,
                package_classes: formData.type === 'package' ? parseInt(formData.package_classes) : undefined,
            };

            if (editingPlan) {
                await updatePlan({ id: editingPlan.id, updates: planPayload });
                if (syncPrice && planPayload.amount !== editingPlan.amount) {
                    await syncSubscriptionsPrice({ planId: editingPlan.id });
                }
            } else {
                await createPlan(planPayload);
            }
            handleBack();
        } catch (error) {
            Alert.alert('Error', 'No se pudo guardar el plan');
        }
    };

    const handleDelete = (id: string) => {
        Alert.alert(
            'Eliminar Plan',
            '¿Estás seguro de que quieres eliminar este plan? No afectará a los alumnos que ya lo tengan asignado.',
            [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Eliminar', style: 'destructive', onPress: () => deletePlan(id) },
            ]
        );
    };

    const renderPlanItem = ({ item }: { item: PricingPlan }) => (
        <Card style={styles.planCard} padding="md">
            <View style={styles.planHeader}>
                <View style={styles.planInfo}>
                    <Text style={styles.planName}>{item.name}</Text>
                    <Text style={styles.planType}>{item.type.replace('_', ' ')}</Text>
                </View>
                <Text style={styles.planAmount}>
                    ${new Intl.NumberFormat('es-AR').format(item.amount)}
                </Text>
            </View>
            {item.description && (
                <Text style={styles.planDescription} numberOfLines={2}>
                    {item.description}
                </Text>
            )}
            <View style={styles.planActions}>
                <TouchableOpacity onPress={() => handleEdit(item)} style={styles.actionButton}>
                    <Ionicons name="create-outline" size={20} color={colors.primary[500]} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.actionButton}>
                    <Ionicons name="trash-outline" size={20} color={colors.error[500]} />
                </TouchableOpacity>
            </View>
        </Card>
    );

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={view === 'form' ? handleBack : onClose} style={styles.backButton}>
                            <Ionicons name={view === 'form' ? "arrow-back" : "close"} size={24} color={colors.neutral[600]} />
                        </TouchableOpacity>
                        <Text style={styles.title}>
                            {view === 'list' ? 'Planes de Precio' : (editingPlan ? 'Editar Plan' : 'Nuevo Plan')}
                        </Text>
                        <View style={{ width: 40 }} />
                    </View>

                    {view === 'list' ? (
                        <>
                            {isLoading ? (
                                <ActivityIndicator size="large" color={colors.primary[500]} style={{ flex: 1 }} />
                            ) : (
                                <FlatList
                                    data={plans}
                                    renderItem={renderPlanItem}
                                    keyExtractor={(item) => item.id}
                                    contentContainerStyle={styles.listContent}
                                    ListEmptyComponent={
                                        <View style={styles.emptyContainer}>
                                            <Ionicons name="pricetags-outline" size={48} color={colors.neutral[300]} />
                                            <Text style={styles.emptyText}>No tienes planes creados</Text>
                                        </View>
                                    }
                                />
                            )}
                            <View style={styles.footer}>
                                <Button
                                    label="Crear Nuevo Plan"
                                    onPress={() => setView('form')}
                                    leftIcon={<Ionicons name="add" size={20} color="white" />}
                                />
                            </View>
                        </>
                    ) : (
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

                            <Input
                                label="Monto"
                                placeholder="0"
                                keyboardType="numeric"
                                value={formData.amount}
                                onChangeText={(text) => setFormData({ ...formData, amount: text })}
                            />

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
                            />

                            {editingPlan && parseFloat(formData.amount) !== editingPlan.amount && (
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
                                label={editingPlan ? "Actualizar Datos del Plan" : "Crear Plan"}
                                onPress={handleSave}
                                style={styles.saveButton}
                                loading={isCreating || isUpdating}
                                variant={editingPlan ? "outline" : "primary"}
                            />

                            {editingPlan && (
                                <View style={styles.historySection}>
                                    <View style={styles.historyDivider} />
                                    <Text style={styles.sectionTitle}>Historial de Precios</Text>

                                    {/* Lista de precios existentes */}
                                    <View style={styles.priceList}>
                                        {editingPlan.prices?.map((price) => (
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
                                                    <Text style={styles.futureBadge}>Programado</Text>
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
                                                    label="Vence/Vigencia (YYYY-MM-DD)"
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
                                            label="Añadir Precio"
                                            onPress={handleAddPrice}
                                            loading={isCreatingPrice || isSyncing}
                                            size="sm"
                                        />
                                    </Card>
                                </View>
                            )}
                        </ScrollView>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: colors.neutral[50],
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        height: '90%',
        width: '100%',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[200],
    },
    title: {
        fontSize: typography.size.lg,
        fontWeight: '700',
        color: colors.neutral[900],
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
    },
    listContent: {
        padding: spacing.md,
    },
    planCard: {
        marginBottom: spacing.md,
    },
    planHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    planInfo: {
        flex: 1,
    },
    planName: {
        fontSize: typography.size.md,
        fontWeight: '600',
        color: colors.neutral[900],
    },
    planType: {
        fontSize: typography.size.xs,
        color: colors.neutral[500],
        textTransform: 'uppercase',
        marginTop: 2,
    },
    planAmount: {
        fontSize: typography.size.md,
        fontWeight: '700',
        color: colors.primary[600],
    },
    planDescription: {
        fontSize: typography.size.sm,
        color: colors.neutral[600],
        marginTop: spacing.sm,
    },
    planActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: spacing.md,
        marginTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.neutral[100],
        paddingTop: spacing.sm,
    },
    actionButton: {
        padding: spacing.xs,
    },
    footer: {
        padding: spacing.lg,
        backgroundColor: colors.common.white,
        borderTopWidth: 1,
        borderTopColor: colors.neutral[200],
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
    saveButton: {
        marginTop: spacing.md,
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
