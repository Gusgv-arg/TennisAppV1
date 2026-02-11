import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { commonStyles } from '@/src/design/common';

import StatusModal, { StatusType } from '@/src/components/StatusModal';
import { Button } from '@/src/design/components/Button';
import { Input } from '@/src/design/components/Input';
import { Theme } from '@/src/design/theme';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useTheme } from '@/src/hooks/useTheme';
import { PricingPlan, PricingPlanType } from '@/src/types/payments';

import { usePaymentSettings } from '../hooks/usePaymentSettings';
import { usePricingPlans } from '../hooks/usePricingPlans';
import { AddPriceModal } from './AddPriceModal';
import { PlanDetailsForm } from './PlanDetailsForm';
import { PlanPricingTimeline } from './PlanPricingTimeline';

interface PlanModalProps {
    visible: boolean;
    onClose: () => void;
    plan?: PricingPlan | null; // If null, creating new plan
}

export const PlanModal = ({ visible, onClose, plan }: PlanModalProps) => {
    const isEditing = !!plan;
    const { theme, isDark } = useTheme();
    const styles = React.useMemo(() => createStyles(theme), [theme]);
    const { createPlan, updatePlan, createPrice, deletePrice, syncSubscriptionsPrice, isCreating, isUpdating, isCreatingPrice, isDeletingPrice } = usePricingPlans();
    const { isSimplifiedMode } = usePaymentSettings();

    // Tabs
    const [activeTab, setActiveTab] = useState<'details' | 'prices'>('details');

    // Nested Modals
    const [addPriceModalVisible, setAddPriceModalVisible] = useState(false);

    // Status Modal
    const [statusModalVisible, setStatusModalVisible] = useState(false);
    const [statusConfig, setStatusConfig] = useState({
        type: 'success' as StatusType,
        title: '',
        message: '',
        onConfirm: undefined as (() => void) | undefined,
        showCancel: false,
    });

    // Form Data
    const [formData, setFormData] = useState({
        name: '',
        type: 'monthly' as PricingPlanType,
        amount: '',
        description: '',
    });

    // Reset or Initialize
    useEffect(() => {
        if (visible) {
            if (plan) {
                // Edit Mode
                setFormData({
                    name: plan.name,
                    type: plan.type,
                    amount: '', // Amount handled by pricing tab in edit mode
                    description: plan.description || '',
                });
                setActiveTab('details');
            } else {
                // Create Mode
                setFormData({
                    name: '',
                    type: 'monthly',
                    amount: '',
                    description: '',
                });
                setActiveTab('details');
            }
        }
    }, [visible, plan]);

    const handleSave = async () => {
        // Validation
        if (!formData.name) {
            showStatus('error', 'Error', 'El nombre es obligatorio');
            return;
        }
        if (!isEditing && !isSimplifiedMode && !formData.amount) {
            showStatus('error', 'Error', 'El monto es obligatorio');
            return;
        }

        try {
            if (isEditing) {
                // Update
                const payload = {
                    name: formData.name,
                    type: formData.type,
                    description: formData.description || undefined,
                };
                await updatePlan({ id: plan.id, updates: payload });
                showStatus('success', '¡Actualizado!', 'El plan ha sido actualizado correctamente.');
            } else {
                // Create
                const payload = {
                    name: formData.name,
                    type: formData.type,
                    amount: isSimplifiedMode ? 0 : parseFloat(formData.amount),
                    description: formData.description || undefined,
                };
                await createPlan(payload);
                showStatus('success', '¡Creado!', 'El nuevo plan ha sido creado exitosamente.');
            }
        } catch (error) {
            showStatus('error', 'Error', 'Ocurrió un error al guardar.');
        }
    };

    const handleAddPrice = async (amount: number, validFrom: string, sync: boolean) => {
        if (!plan) return;
        try {
            await createPrice({
                planId: plan.id,
                amount,
                valid_from: validFrom,
            });

            if (sync) {
                await syncSubscriptionsPrice({ planId: plan.id });
            }

            setAddPriceModalVisible(false);
            showStatus('success', '¡Precio Agregado!', 'El historial ha sido actualizado.');
        } catch (error) {
            showStatus('error', 'Error', 'No se pudo agregar el precio');
        }
    };

    const handleDeletePrice = async (priceId: string) => {
        try {
            await deletePrice(priceId);
            setStatusModalVisible(false);
            // Show success after short delay to let the previous modal close
            setTimeout(() => {
                showStatus('success', 'Precio Eliminado', 'El historial se ha actualizado correctamente.');
            }, 300);
        } catch (error) {
            showStatus('error', 'Error', 'No se pudo eliminar el precio');
        }
    };

    const showStatus = (type: StatusType, title: string, message: string, onConfirm?: () => void, showCancel: boolean = false) => {
        setStatusConfig({ type, title, message, onConfirm, showCancel });
        setStatusModalVisible(true);
    };

    const handleStatusClose = () => {
        setStatusModalVisible(false);
        // Close the main modal ONLY if it was a success message from the 'details' tab (Save/Create plan)
        // or if explicitly desired. Adding/Deleting prices should keep the modal open to see the timeline.
        if (statusConfig.type === 'success' && activeTab === 'details' && !statusConfig.onConfirm) {
            onClose();
        }
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={commonStyles.modal.overlay}>
                <View style={[commonStyles.modal.content, { backgroundColor: theme.background.surface }]}>

                    {/* Header */}
                    <View style={[styles.header, { borderBottomColor: theme.border.default }]}>
                        <Text style={[typography.variants.h3, { color: theme.text.primary }]}>
                            {isEditing ? 'Editar Plan' : 'Nuevo Plan'}
                        </Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={theme.text.secondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Tabs (Only if Editing) */}
                    {isEditing && (
                        <View style={[styles.tabs, { borderBottomColor: theme.border.subtle }]}>
                            <TouchableOpacity
                                style={[styles.tab, activeTab === 'details' && styles.activeTab]}
                                onPress={() => setActiveTab('details')}
                            >
                                <Text style={[styles.tabText, { color: theme.text.secondary }, activeTab === 'details' && styles.activeTabText]}>Detalles</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.tab, activeTab === 'prices' && styles.activeTab]}
                                onPress={() => setActiveTab('prices')}
                            >
                                <Text style={[styles.tabText, { color: theme.text.secondary }, activeTab === 'prices' && styles.activeTabText]}>Precios</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Content */}
                    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                        {activeTab === 'details' ? (
                            <>
                                <PlanDetailsForm
                                    name={formData.name}
                                    onChangeName={(t) => setFormData(prev => ({ ...prev, name: t }))}
                                    description={formData.description}
                                    onChangeDescription={(t) => setFormData(prev => ({ ...prev, description: t }))}
                                    type={formData.type}
                                    onChangeType={(t) => setFormData(prev => ({ ...prev, type: t }))}
                                    hideButton={true}
                                />

                                {/* Amount Input for New Plan */}
                                {!isEditing && !isSimplifiedMode && (
                                    <View style={{ marginTop: spacing.md }}>
                                        <Text style={[typography.variants.label, { color: theme.text.primary }]}>Precio Inicial</Text>
                                        <Text style={[typography.variants.bodySmall, { color: theme.text.secondary, marginBottom: spacing.sm }]}>
                                            Podrás ajustar el precio y programar aumentos futuros después de crear el plan.
                                        </Text>
                                        <Input
                                            label="Monto Mensual / Por Clase"
                                            placeholder="0.00"
                                            keyboardType="numeric"
                                            value={formData.amount}
                                            onChangeText={(t: string) => setFormData(prev => ({ ...prev, amount: t }))}
                                            leftIcon={<Text style={{ color: theme.text.secondary }}>$</Text>}
                                        />
                                    </View>
                                )}

                                {/* Description (last field) */}
                                <Input
                                    label="Descripción (Opcional)"
                                    placeholder="Detalles del plan..."
                                    value={formData.description}
                                    onChangeText={(t: string) => setFormData(prev => ({ ...prev, description: t }))}
                                    multiline
                                    numberOfLines={3}
                                    containerStyle={{ marginTop: spacing.md }}
                                    inputStyle={{ minHeight: 80, textAlignVertical: 'top' }}
                                />
                            </>
                        ) : (
                            /* Pricing Tab */
                            plan && (
                                <View>
                                    <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: spacing.md }}>
                                        <Button
                                            label="Nuevo Precio"
                                            size="sm"
                                            leftIcon={<Ionicons name="add" size={16} color="white" />}
                                            onPress={() => setAddPriceModalVisible(true)}
                                        />
                                    </View>
                                    <PlanPricingTimeline
                                        prices={plan.prices || []}
                                        onDeletePrice={(priceId) => {
                                            showStatus(
                                                'warning',
                                                'Eliminar Precio',
                                                '¿Estás seguro de que quieres eliminar este precio programado?',
                                                () => handleDeletePrice(priceId),
                                                true
                                            );
                                        }}
                                        isDeleting={isDeletingPrice}
                                    />
                                </View>
                            )
                        )}
                    </ScrollView>

                    {/* Footer Actions (Only for Details tab) */}
                    {activeTab === 'details' && (
                        <View style={styles.footer}>

                            <Button
                                label={isEditing ? "Guardar" : "Crear Plan"}
                                onPress={handleSave}
                                loading={isCreating || isUpdating}
                                style={styles.footerButton}
                            />
                        </View>
                    )}
                </View>

                {/* Status Modal */}
                <StatusModal
                    visible={statusModalVisible}
                    type={statusConfig.type}
                    title={statusConfig.title}
                    message={statusConfig.message}
                    onClose={handleStatusClose}
                    onConfirm={statusConfig.onConfirm}
                    showCancel={statusConfig.showCancel}
                    buttonText={statusConfig.onConfirm ? 'Confirmar' : 'Entendido'}
                />

                {/* Add Price Modal (Nested) */}
                <AddPriceModal
                    visible={addPriceModalVisible}
                    onClose={() => setAddPriceModalVisible(false)}
                    onSave={handleAddPrice}
                    isLoading={isCreatingPrice}
                />
            </View>
        </Modal>
    );
};

const createStyles = (theme: Theme) => StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: 1,
    },
    tabs: {
        flexDirection: 'row',
        paddingHorizontal: spacing.lg,
        borderBottomWidth: 1,
    },
    tab: {
        paddingVertical: spacing.md,
        marginRight: spacing.lg,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    activeTab: {
        borderBottomColor: theme.components.button.primary.bg,
    },
    tabText: {
        fontSize: typography.size.md,
        fontWeight: '600',
    },
    activeTabText: {
        color: theme.components.button.primary.bg,
    },
    content: {
        padding: spacing.lg,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.md,
        padding: spacing.lg,
    },
    footerButton: {
        minWidth: 120,
    },
});
