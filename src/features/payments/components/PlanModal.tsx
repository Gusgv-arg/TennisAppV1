import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
            // Note: success feedback could be simpler here to avoid blocking flow
        } catch (error) {
            showStatus('error', 'Error', 'No se pudo agregar el precio');
        }
    };

    const showStatus = (type: StatusType, title: string, message: string) => {
        setStatusConfig({ type, title, message });
        setStatusModalVisible(true);
    };

    const handleStatusClose = () => {
        setStatusModalVisible(false);
        if (statusConfig.type === 'success') {
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
            <View style={[styles.overlay, { backgroundColor: theme.background.backdrop }]}>
                <View style={[styles.container, styles.desktopContainer, { shadowColor: '#000' }]}>

                    {/* Header */}
                    <View style={[styles.header, { borderBottomColor: theme.border.subtle }]}>
                        <Text style={[styles.title, { color: theme.text.primary }]}>
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
                                    // New Plan: Amount is handled inside form but PlanDetailsForm doesn't have amount input logic usually?
                                    // Wait, checking PlanDetailsForm.tsx... It does NOT have amount input. 
                                    // new.tsx implements amount input separately? 
                                    // Let's check new.tsx again.
                                    // Ah, I missed that. new.tsx has:
                                    // <Text style={styles.sectionTitle}>2. Precio</Text>
                                    // <Input ... />
                                    // PlanDetailsForm ONLY handles name, type, description.
                                    // So I need to add Amount input here for Create mode.
                                    hideButton={true} // We handle save button outside
                                />

                                {/* Amount Input for New Plan */}
                                {!isEditing && !isSimplifiedMode && (
                                    <View style={{ marginTop: spacing.md }}>
                                        <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Precio Inicial</Text>
                                        <Text style={[styles.helperText, { color: theme.text.secondary }]}>
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
                            </>
                        ) : (
                            /* Pricing Tab */
                            plan && (
                                <View>
                                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: spacing.md }}>
                                        <Button
                                            label="Nuevo Precio"
                                            size="sm"
                                            leftIcon={<Ionicons name="add" size={16} color="white" />}
                                            onPress={() => setAddPriceModalVisible(true)}
                                        />
                                    </View>
                                    <PlanPricingTimeline
                                        prices={plan.prices || []}
                                        onDeletePrice={(priceId) => deletePrice(priceId)}
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
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.md,
    },
    container: {
        backgroundColor: theme.background.surface,
        borderRadius: 20,
        width: '100%',
        maxHeight: '90%',
        display: 'flex',
        flexDirection: 'column',
    },
    desktopContainer: {
        maxWidth: 500,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: 1,
    },
    title: {
        fontSize: typography.size.xl,
        fontWeight: '700',
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
        borderTopWidth: 1,
        borderTopColor: theme.border.subtle,
    },
    footerButton: {
        minWidth: 120,
    },
    sectionTitle: {
        fontSize: typography.size.md,
        fontWeight: '700',
        marginBottom: spacing.xs,
    },
    helperText: {
        fontSize: typography.size.sm,
        marginBottom: spacing.md,
    },
});
