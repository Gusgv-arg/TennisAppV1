import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Modal } from '@/src/components/Modal';
import { useTranslation } from 'react-i18next';

import { commonStyles } from '@/src/design/common';

import StatusModal, { StatusType } from '@/src/components/StatusModal';
import { Button } from '@/src/design/components/Button';
import { Input } from '@/src/design/components/Input';
import { Theme } from '@/src/design/theme';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useTheme } from '@/src/hooks/useTheme';
import { PricingPlan, PricingPlanType } from '@/src/types/payments';
import { showError, showSuccess } from '@/src/utils/toast';

import { usePaymentSettings } from '../hooks/usePaymentSettings';
import { usePricingPlans } from '../hooks/usePricingPlans';
import { useCurrentAcademy } from '@/src/features/academy/hooks/useAcademy';
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
    const { t } = useTranslation();
    const { theme, isDark } = useTheme();
    const styles = React.useMemo(() => createStyles(theme), [theme]);
    const { data: academy } = useCurrentAcademy();
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

    const handleAmountChange = (text: string) => {
        let filtered = text.replace(/[^0-9.]/g, '');
        const points = filtered.split('.');
        if (points.length > 2) {
            filtered = points[0] + '.' + points.slice(1).join('');
        }
        setFormData(prev => ({ ...prev, amount: filtered }));
    };

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
            showError(t('error'), t('pricingPlans.modals.main.notifications.nameRequired'));
            return;
        }
        if (!isEditing && !isSimplifiedMode && !formData.amount) {
            showError(t('error'), t('pricingPlans.modals.main.notifications.amountRequired'));
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
                onClose();
                setTimeout(() => showSuccess(t('pricingPlans.modals.main.notifications.updateSuccess'), t('pricingPlans.modals.main.notifications.updateDetail')), 400);
            } else {
                // Create
                const payload = {
                    name: formData.name,
                    type: formData.type,
                    amount: isSimplifiedMode ? 0 : parseFloat(formData.amount),
                    description: formData.description || undefined,
                };
                await createPlan(payload);
                onClose();
                setTimeout(() => showSuccess(t('pricingPlans.modals.main.notifications.createSuccess'), t('pricingPlans.modals.main.notifications.createDetail')), 400);
            }
        } catch (error) {
            showError(t('error'), t('pricingPlans.modals.main.notifications.saveError'));
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
            showSuccess(t('pricingPlans.modals.addPrice.notifications.success'), t('pricingPlans.modals.addPrice.notifications.detail'));
        } catch (error) {
            showError(t('error'), t('pricingPlans.modals.addPrice.notifications.error'));
        }
    };

    const handleDeletePrice = async (priceId: string) => {
        try {
            await deletePrice(priceId);
            setStatusModalVisible(false);
            // Show success after short delay to let the previous modal close
            setTimeout(() => {
                setTimeout(() => {
                    showSuccess(t('pricingPlans.modals.priceTimeline.deleteSuccess'), t('pricingPlans.modals.priceTimeline.deleteDetail'));
                }, 300);
            }, 300);
        } catch (error) {
            showError(t('error'), t('pricingPlans.modals.priceTimeline.deleteError'));
        }
    };

    const showStatus = (type: StatusType, title: string, message: string, onConfirm?: () => void, showCancel: boolean = false) => {
        setStatusConfig({ type, title, message, onConfirm, showCancel });
        setStatusModalVisible(true);
    };

    const handleStatusClose = () => {
        setStatusModalVisible(false);
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
                <View style={[
                    commonStyles.modal.content,
                    {
                        backgroundColor: theme.background.surface,
                        borderColor: theme.border.subtle,
                    }
                ]}>

                    {/* Header */}
                    <View style={[styles.header, { borderBottomColor: theme.border.default }]}>
                        <View style={{ flex: 1 }}>
                            <Text style={[typography.variants.h3, { color: theme.text.primary }]}>
                                {isEditing ? t('pricingPlans.modals.main.titleEdit') : t('pricingPlans.modals.main.titleCreate')}
                            </Text>
                            {academy?.name && (
                                <Text style={{ 
                                    fontSize: 12, 
                                    color: theme.text.secondary, 
                                    fontWeight: '500',
                                    marginTop: 2
                                }}>
                                    {academy.name}
                                </Text>
                            )}
                        </View>
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
                                <Text style={[styles.tabText, { color: theme.text.secondary }, activeTab === 'details' && styles.activeTabText]}>{t('pricingPlans.modals.main.tabs.details')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.tab, activeTab === 'prices' && styles.activeTab]}
                                onPress={() => setActiveTab('prices')}
                            >
                                <Text style={[styles.tabText, { color: theme.text.secondary }, activeTab === 'prices' && styles.activeTabText]}>{t('pricingPlans.modals.main.tabs.prices')}</Text>
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
                                        <Text style={[typography.variants.label, { color: theme.text.primary }]}>{t('pricingPlans.modals.main.fields.initialPrice')}</Text>
                                        <Text style={[typography.variants.bodySmall, { color: theme.text.secondary, marginBottom: spacing.sm }]}>
                                            {t('pricingPlans.modals.main.fields.initialPriceDescription')}
                                        </Text>
                                        <Input
                                            placeholder="0.00"
                                            keyboardType="numeric"
                                            value={formData.amount}
                                            onChangeText={handleAmountChange}
                                            leftIcon={<Text style={{ color: theme.text.secondary }}>$</Text>}
                                        />
                                    </View>
                                )}

                                {/* Description (last field) */}
                                <Input
                                    label={t('pricingPlans.modals.main.fields.descriptionLabel')}
                                    placeholder={t('pricingPlans.modals.main.fields.descriptionPlaceholder')}
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
                                            label={t('pricingPlans.modals.priceTimeline.newPrice')}
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
                                                t('pricingPlans.modals.priceTimeline.deleteTitle'),
                                                t('pricingPlans.modals.priceTimeline.deleteConfirm'),
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
                                label={isEditing ? t('save') : t('pricingPlans.modals.main.buttons.create')}
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
                    buttonText={statusConfig.onConfirm ? t('confirm') : t('common.ok')}
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
