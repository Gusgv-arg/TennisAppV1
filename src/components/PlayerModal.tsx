import StatusModal from '@/src/components/StatusModal';
import { HelpIcon } from '@/src/design/components/HelpIcon';
import { HelpModal, HelpItem } from '@/src/components/HelpModal';
import { commonStyles } from '@/src/design/common';
import { Avatar } from '@/src/design/components/Avatar';
import { Button } from '@/src/design/components/Button';
import { Card } from '@/src/design/components/Card';
import { Input } from '@/src/design/components/Input';
import { Row } from '@/src/design/components/Row';
import { Section } from '@/src/design/components/Section';
import { Theme } from '@/src/design/theme';
import { colors } from '@/src/design/tokens/colors';
import { iconSize as iconSizes } from '@/src/design/tokens/icons';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useCurrentAcademy, useUserAcademies } from '@/src/features/academy/hooks/useAcademy';
import AssignPlanModal from '@/src/features/payments/components/AssignPlanModal';
import { PlanModal } from '@/src/features/payments/components/PlanModal';
import UnifiedPaymentModal from '@/src/features/payments/components/UnifiedPaymentModal';
import UnifiedPaymentSection from '@/src/features/payments/components/UnifiedPaymentSection';
import { usePaymentSettings } from '@/src/features/payments/hooks/usePaymentSettings';
import { usePricingPlans } from '@/src/features/payments/hooks/usePricingPlans';
import { useSubscriptions } from '@/src/features/payments/hooks/useSubscriptions';
import { useUnifiedPaymentGroup, useUnifiedPaymentGroupMutations } from '@/src/features/payments/hooks/useUnifiedPaymentGroups';
import { usePlayerMutations } from '@/src/features/players/hooks/usePlayerMutations';
import { usePlayer } from '@/src/features/players/hooks/usePlayers';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useAvatarUpload } from '@/src/hooks/useAvatarUpload';
import { useImagePicker } from '@/src/hooks/useImagePicker';
import { useTheme } from '@/src/hooks/useTheme';
import { UnifiedPaymentGroup } from '@/src/types/payments';
import { DominantHand, PlayerLevel } from '@/src/types/player';
import { showError, showSuccess } from '@/src/utils/toast';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { AnalysisHistory } from './Analyzer/AnalysisHistory';
import { toastConfig } from './ToastConfig';
import VideoList from './VideoList';
import { ClassHistoryModal } from '../features/players/components/ClassHistoryModal';

import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Modal } from './Modal';
import * as z from 'zod';

// Schema from edit.tsx
const schema = z.object({
    full_name: z.string().min(1, 'players.modals.player.validation.nameRequired'),
    contact_email: z.string().email('invalidEmail').or(z.literal('')),
    contact_phone: z.string().regex(/^[0-9+\s-]*$/, 'invalidPhone').or(z.literal('')),
    birth_day: z.string().regex(/^(0?[1-9]|[12][0-9]|3[01])$/, 'invalidDay').or(z.literal('')),
    birth_month: z.string().regex(/^(0?[1-9]|1[0-2])$/, 'invalidMonth').or(z.literal('')),
    birth_year: z.string().regex(/^(19|20)\d{2}$/, 'invalidYear').or(z.literal('')),
    notes: z.string().optional(),
    level: z.enum(['beginner', 'intermediate', 'advanced', 'professional']),
    dominant_hand: z.enum(['left', 'right', 'ambidextrous']),
});

type FormData = z.infer<typeof schema>;

interface PlayerModalProps {
    visible: boolean;
    onClose: () => void;
    playerId: string | null;
    mode: 'view' | 'edit' | 'create';
    onPlayerCreated?: (player: any, hasPlan: boolean) => void;
    onPlayerUpdated?: (player: any) => void;
}

export default function PlayerModal({ visible, onClose, playerId, mode: initialMode, onPlayerCreated, onPlayerUpdated }: PlayerModalProps) {
    const { t, i18n } = useTranslation();
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const isDesktop = windowWidth >= 768;
    const router = useRouter();
    const { theme } = useTheme();
    const [mode, setMode] = useState<'view' | 'edit' | 'create'>(initialMode);
    const [activeTab, setActiveTab] = useState<'profile' | 'videos' | 'analysis'>('profile');
    const styles = useMemo(() => createStyles(theme, isDesktop), [theme, isDesktop]);

    useEffect(() => {
        if (visible) {
            setMode(initialMode);
        }
    }, [visible, initialMode]);

    const { data: player, isLoading: isFetching } = usePlayer(playerId || '');
    const { updatePlayer, createPlayer } = usePlayerMutations();
    const { isEnabled: paymentsEnabled } = usePaymentSettings();
    const { subscriptions, isLoading: isLoadingSub, cancelSubscription } = useSubscriptions(playerId || '');
    const { data: unifiedGroup, isLoading: isLoadingUnifiedGroup } = useUnifiedPaymentGroup(player?.unified_payment_group_id || undefined);

    // State for Edit Mode
    const [assignPlanVisible, setAssignPlanVisible] = useState(false);

    useEffect(() => {
        console.log("CRITICAL DEBUG: PlayerModal Tab is now:", activeTab);
    }, [activeTab]);
    const [confirmation, setConfirmation] = useState<{
        visible: boolean;
        subId: string;
        planName: string;
    }>({ visible: false, subId: '', planName: '' });

    const [avatarUri, setAvatarUri] = useState<string | null>(null);
    const [createdPlayerId, setCreatedPlayerId] = useState<string | null>(null);
    const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);
    const [selectedUnifiedGroup, setSelectedUnifiedGroup] = useState<UnifiedPaymentGroup | null>(null);
    const [initialUnifiedGroupId, setInitialUnifiedGroupId] = useState<string | null>(null);
    const [unifiedPaymentModalVisible, setUnifiedPaymentModalVisible] = useState(false);
    const [createPlanModalVisible, setCreatePlanModalVisible] = useState(false);
    const [noPlanWarningVisible, setNoPlanWarningVisible] = useState(false);
    const [pendingSubmitData, setPendingSubmitData] = useState<FormData | null>(null);
    const [helpModalVisible, setHelpModalVisible] = useState(false);
    const [helpModalConfig, setHelpModalConfig] = useState<{ title: string; items?: HelpItem[]; description?: string }>({
        title: '',
        items: [],
        description: ''
    });
    const [classHistoryVisible, setClassHistoryVisible] = useState(false);

    // Hooks
    const { pickImageFromCamera, pickImageFromGallery } = useImagePicker();
    const { uploadAvatar, isUploading } = useAvatarUpload();
    const { data: currentAcademy } = useCurrentAcademy();
    const { plans } = usePricingPlans();
    const { assignPlan } = useSubscriptions();
    const { profile } = useAuthStore();
    const isCoach = profile?.role === 'coach';

    // Labels standard for i18n
    const studentLabel = t('players.labels.name') || (i18n.language === 'es' ? 'Alumno' : 'Student');

    const { data: academiesData } = useUserAcademies();
    const { addMemberToGroup, removeMemberFromGroup } = useUnifiedPaymentGroupMutations();
    const academies = academiesData?.active || [];
    const hasMultipleAcademies = academies.length > 1;

    // Form
    const { control, handleSubmit, reset, watch, setError, clearErrors, formState: { errors } } = useForm<FormData>({
        mode: 'onBlur',
        defaultValues: {
            full_name: '',
            contact_email: '',
            contact_phone: '',
            birth_day: '',
            birth_month: '',
            birth_year: '',
            notes: '',
            level: 'beginner',
            dominant_hand: 'right',
        },
    });

    // Reset form when player changes or modal opens
    useEffect(() => {
        if (visible) {
            if (mode === 'create') {
                reset({
                    full_name: '',
                    contact_email: '',
                    contact_phone: '',
                    birth_day: '',
                    birth_month: '',
                    birth_year: '',
                    notes: '',
                    level: 'beginner',
                    dominant_hand: 'right',
                });
                setAvatarUri(null);
                setSelectedPlanIds([]);
                setSelectedUnifiedGroup(null);
                setInitialUnifiedGroupId(null);
                setActiveTab('profile'); // Reset tab
            } else if (player && mode === 'edit') {
                let bDay = '';
                let bMonth = '';
                let bYear = '';

                if (player.birth_date) {
                    const parts = player.birth_date.split('-');
                    if (parts.length === 3) {
                        bYear = parts[0] === '1900' ? '' : parts[0];
                        bMonth = parts[1];
                        bDay = parts[2];
                    }
                }

                reset({
                    full_name: player.full_name,
                    contact_email: player.contact_email || '',
                    contact_phone: player.contact_phone || '',
                    birth_day: bDay,
                    birth_month: bMonth,
                    birth_year: bYear,
                    notes: player.notes || '',
                    level: player.level || 'beginner',
                    dominant_hand: player.dominant_hand || 'right',
                });
                setAvatarUri(player.avatar_url || null);
                
                // Initialize unified group state from database
                if (player.unified_payment_group_id) {
                    setInitialUnifiedGroupId(player.unified_payment_group_id);
                } else {
                    setInitialUnifiedGroupId(null);
                    setSelectedUnifiedGroup(null);
                }
            }
        }
    }, [visible, player, mode, reset]);

    // Separate effect to fetch the actual group data if exists for Edit mode
    const { data: fetchedGroup } = useUnifiedPaymentGroup(initialUnifiedGroupId || undefined);

    useEffect(() => {
        if (fetchedGroup && mode === 'edit' && !selectedUnifiedGroup) {
            setSelectedUnifiedGroup(fetchedGroup);
        }
    }, [fetchedGroup, mode, initialUnifiedGroupId]);

    const validateField = (name: keyof FormData, value: any) => {
        // @ts-ignore
        const fieldSchema = schema.pick({ [name]: true });
        const result = fieldSchema.safeParse({ [name]: value });
        if (!result.success) {
            setError(name, { type: 'manual', message: (result as any).error.issues[0].message });
        } else {
            clearErrors(name);
        }
    };

    const handleAvatarPress = async () => {
        if (Platform.OS === 'web') {
            const uri = await pickImageFromGallery();
            if (uri) setAvatarUri(uri);
            return;
        }
        Alert.alert(
            t('players.modals.player.avatar.title') || 'Foto de perfil',
            t('players.modals.player.avatar.options') || 'Elige una opción',
            [
                { text: t('cancel') || 'Cancelar', style: 'cancel' },
                {
                    text: t('players.modals.player.avatar.takePhoto') || 'Tomar foto',
                    onPress: async () => {
                        const uri = await pickImageFromCamera();
                        if (uri) setAvatarUri(uri);
                    },
                },
                {
                    text: t('players.modals.player.avatar.fromGallery') || 'Elegir de galería',
                    onPress: async () => {
                        const uri = await pickImageFromGallery();
                        if (uri) setAvatarUri(uri);
                    },
                },
            ]
        );
    };

    const handleCancelSubscription = (subId: string, planName: string) => {
        setConfirmation({ visible: true, subId, planName });
    };

    const handleConfirmCancel = async () => {
        try {
            await cancelSubscription(confirmation.subId);
            setConfirmation({ ...confirmation, visible: false });
        } catch (error: any) {
            setConfirmation({ ...confirmation, visible: false });
            showError(t('saveError'), error.message || t('players.modals.player.validation.cancelSubscriptionError'));
        }
    };

    const onSubmit = async (data: FormData) => {
        const result = schema.safeParse(data);
        if (!result.success) {
            const firstIssue = result.error.issues[0];
            showError(t('error'), t(firstIssue.message));
            return;
        }

        // Warn if no plan selected during creation
        if (mode === 'create' && paymentsEnabled && selectedPlanIds.length === 0) {
            setPendingSubmitData(data);
            setNoPlanWarningVisible(true);
            return;
        }

        await executeSubmit(data);
    };

    const executeSubmit = async (data: FormData) => {
        try {
            let birth_date = null;
            if (data.birth_month && data.birth_day) {
                const day = data.birth_day.padStart(2, '0');
                const month = data.birth_month.padStart(2, '0');
                if (data.birth_year) {
                    const year = data.birth_year.padStart(4, '0');
                    birth_date = `${year}-${month}-${day}`;
                } else {
                    birth_date = `1900-${month}-${day}`;
                }
            }

            const payload = {
                ...data,
                birth_date,
                contact_email: data.contact_email || null,
                contact_phone: data.contact_phone || null,
                notes: data.notes || null,
            };
            delete (payload as any).birth_day;
            delete (payload as any).birth_month;
            delete (payload as any).birth_year;

            if (mode === 'create') {
                const newPlayer = await createPlayer.mutateAsync(payload as any);
                setCreatedPlayerId(newPlayer.id);

                if (avatarUri && !avatarUri.startsWith('http')) {
                    const uploadedUrl = await uploadAvatar(avatarUri, newPlayer.id);
                    if (uploadedUrl) {
                        await updatePlayer.mutateAsync({ id: newPlayer.id, input: { avatar_url: uploadedUrl } as any });
                    }
                }

                if (selectedPlanIds.length > 0) {
                    for (const planId of selectedPlanIds) {
                        const plan = plans?.find(p => p.id === planId);
                        if (plan) {
                            try {
                                await assignPlan({
                                    playerId: newPlayer.id,
                                    planId: planId,
                                    customAmount: plan.amount,
                                });
                            } catch (planError: any) {
                                console.error('Error assigning plan:', planError);
                                showError(t('error'), `${t('players.payments.errors.assignError')} "${plan.name}": ${planError.message || t('errorOccurred')}`);
                            }
                        }
                    }
                }

                if (selectedUnifiedGroup) {
                    try {
                        await addMemberToGroup.mutateAsync({
                            playerId: newPlayer.id,
                            groupId: selectedUnifiedGroup.id
                        });
                    } catch (groupError) {
                        console.error('Error adding to group:', groupError);
                        showError(t('error'), t('players.notifications.addMemberError'));
                    }
                }

                // Notify parent if callback provided
                if (onPlayerCreated) {
                    onPlayerCreated(newPlayer, selectedPlanIds.length > 0);
                }

                // Close modal first, then show success toast from the root layout
                onClose();
                setTimeout(() => {
                    showSuccess(
                        t('players.modals.player.notifications.createSuccess'),
                        t('playerCreated')
                    );
                }, 400); // 400ms allows for the modal fade-out/slide-down animation to complete
            } else {
                let avatar_url = player?.avatar_url || null;
                if (avatarUri && !avatarUri.startsWith('http')) {
                    const uploadedUrl = await uploadAvatar(avatarUri, playerId!);
                    if (uploadedUrl) avatar_url = uploadedUrl;
                }

                await updatePlayer.mutateAsync({ id: playerId!, input: { ...payload, avatar_url } as any });

                // Handle Unified Payment Group changes during Edit
                const currentGroupId = selectedUnifiedGroup?.id || null;
                if (currentGroupId !== initialUnifiedGroupId) {
                    try {
                        if (currentGroupId) {
                            await addMemberToGroup.mutateAsync({ playerId: playerId!, groupId: currentGroupId });
                        } else {
                            await removeMemberFromGroup.mutateAsync(playerId!);
                        }
                    } catch (groupError) {
                        console.error('Error updating group link:', groupError);
                        showError(t('error'), t('players.notifications.addMemberError'));
                    }
                }

                onClose();
                setTimeout(() => {
                    showSuccess(
                        t('players.modals.player.notifications.updateSuccess'),
                        t('playerUpdated')
                    );
                }, 400);
            }
        } catch (error: any) {
            console.error('Error in executeSubmit:', error);
        }
    };
    
    // Help content for Payment Plan
    const showPaymentPlanHelp = () => {
        setHelpModalConfig({
            title: t('players.modals.player.sections.paymentPlan'),
            items: [
                {
                    icon: 'school-outline',
                    title: t('players.modals.player.validation.help.paymentPlan.items.classes.title'),
                    description: t('players.modals.player.validation.help.paymentPlan.items.classes.desc')
                },
                {
                    icon: 'pricetags-outline',
                    title: t('players.modals.player.validation.help.paymentPlan.items.prices.title'),
                    description: t('players.modals.player.validation.help.paymentPlan.items.prices.desc')
                },
                {
                    icon: 'wallet-outline',
                    title: t('players.modals.player.validation.help.paymentPlan.items.modality.title'),
                    description: t('players.modals.player.validation.help.paymentPlan.items.modality.desc')
                },
                {
                    icon: 'trending-up-outline',
                    title: t('players.modals.player.validation.help.paymentPlan.items.debt.title'),
                    description: t('players.modals.player.validation.help.paymentPlan.items.debt.desc')
                },
                {
                    icon: 'shield-checkmark-outline',
                    title: t('players.modals.player.validation.help.paymentPlan.items.requirement.title'),
                    description: t('players.modals.player.validation.help.paymentPlan.items.requirement.desc')
                }
            ]
        });
        setHelpModalVisible(true);
    };

    const showUnifiedPaymentHelp = () => {
        setHelpModalConfig({
            title: t('players.modals.player.sections.unifiedPayment'),
            items: [
                {
                    icon: 'person-outline',
                    title: t('players.modals.player.validation.help.unifiedPayment.items.payer.title') || 'Responsable',
                    description: t('players.modals.player.validation.help.unifiedPayment.items.payer.desc') || 'Centraliza todas las deudas en una sola persona.'
                },
                {
                    icon: 'people-outline',
                    title: t('players.modals.player.validation.help.unifiedPayment.items.family.title') || 'Familia',
                    description: t('players.modals.player.validation.help.unifiedPayment.items.family.desc') || 'Ideal para hermanos o familias que pagan juntos.'
                },
                {
                    icon: 'document-text-outline',
                    title: t('players.modals.player.validation.help.unifiedPayment.items.statement.title') || 'Estado Único',
                    description: t('players.modals.player.validation.help.unifiedPayment.items.statement.desc') || 'Un solo historial de movimientos para todos los miembros.'
                }
            ]
        });
        setHelpModalVisible(true);
    };

    if (!visible) return null;

    const levels: PlayerLevel[] = ['beginner', 'intermediate', 'advanced', 'professional'];
    const hands: DominantHand[] = ['left', 'right', 'ambidextrous'];
    const isLoading = isFetching && !!playerId;

    const renderViewContent = () => {
        if (!player) return <View><Text style={{ color: theme.text.primary }}>{t('players.modals.player.validation.noData') || 'No player data'}</Text></View>;
        return (
            <View style={styles.formWrapper}>
                {/* Header block moved to modal headerRow to save space */}

                {/* Tabs Header */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 'profile' && styles.activeTabButton]}
                        onPress={() => setActiveTab('profile')}
                    >
                        <Text style={[styles.tabText, activeTab === 'profile' && styles.activeTabText]}>{t('players.tabs.profile')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 'videos' && styles.activeTabButton]}
                        onPress={() => setActiveTab('videos')}
                    >
                        <Text style={[styles.tabText, activeTab === 'videos' && styles.activeTabText]}>{t('players.tabs.videos')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 'analysis' && styles.activeTabButton]}
                        onPress={() => setActiveTab('analysis')}
                    >
                        <Text style={[styles.tabText, activeTab === 'analysis' && styles.activeTabText]}>{t('players.tabs.analysis')}</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ flex: 1 }}>
                    {activeTab === 'profile' ? (
                        <ScrollView 
                            style={{ flex: 1 }}
                            showsVerticalScrollIndicator={false} 
                            contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: 40 }}
                        >
                            <View style={{ marginTop: spacing.md }}>
                                <DetailItem label={t('email')} value={player.contact_email || '-'} icon="mail-outline" theme={theme} />
                                <DetailItem label={t('phone')} value={player.contact_phone || '-'} icon="call-outline" theme={theme} />
                                <DetailItem
                                    label={t('birthDate')}
                                    value={player.birth_date ? (
                                        player.birth_date.startsWith('1900-')
                                            ? player.birth_date.split('-').slice(1).reverse().join('/')
                                            : player.birth_date.split('-').reverse().join('/')
                                    ) : '-'}
                                    icon="calendar-outline"
                                    theme={theme}
                                />
                                <DetailItem label={t('dominantHand')} value={t(`hand.${player.dominant_hand || 'right'}`)} icon="hand-right-outline" theme={theme} />
                                <DetailItem label={t('role')} value={t(`roles.${player.intended_role || 'player'}`)} icon="shield-outline" theme={theme} />
                            </View>

                            {player.notes && (
                                <View style={{ marginTop: spacing.lg }}>
                                    <Section title={t('notes')} noMargin>
                                        <Text style={styles.notesText}>{player.notes}</Text>
                                    </Section>
                                </View>
                            )}

                            {paymentsEnabled && (
                                <View style={{ marginTop: spacing.lg, borderTopWidth: 1, borderTopColor: theme.border.subtle, paddingTop: spacing.lg }}>
                                    <Section
                                        title={t('players.modals.player.sections.subscriptions')}
                                        icon="pricetag-outline"
                                        noMargin
                                    >
                                        {isLoadingSub ? (
                                            <ActivityIndicator size="small" color={theme.components.button.primary.bg} />
                                        ) : subscriptions && subscriptions.length > 0 ? (
                                            <View style={styles.subscriptionsList}>
                                                {subscriptions.map((sub) => (
                                                    <View key={sub.id} style={styles.subscriptionInfo}>
                                                        <View style={styles.planHeaderRow}>
                                                            <View style={styles.planStatus}>
                                                                <Ionicons 
                                                                    name={sub.plan?.is_active === false ? "alert-circle" : "checkmark-circle"} 
                                                                    size={20} 
                                                                    color={sub.plan?.is_active === false ? theme.status.warning : theme.text.primary} 
                                                                />
                                                                <Text style={[styles.planName, { color: theme.text.primary }, sub.plan?.is_active === false && { color: theme.status.warning }]}>
                                                                    {sub.plan?.name}
                                                                    {sub.plan?.is_active === false && ` (${t('players.labels.archived')})`}
                                                                </Text>
                                                            </View>
                                                        </View>
                                                    </View>
                                                ))}
                                            </View>
                                        ) : (
                                            <View style={styles.emptyPlan}>
                                                <Text style={styles.emptyPlanText}>{t('players.modals.player.validation.noActivePlans')}</Text>
                                            </View>
                                        )}
                                    </Section>

                                    {mode === 'view' && (
                                        <View style={{ marginTop: spacing.sm }}>
                                            <Section
                                                title={t('payments.title')}
                                                icon="wallet-outline"
                                                noMargin
                                            >
                                                <View style={{ 
                                                    paddingTop: 4, 
                                                    paddingBottom: 8,
                                                    borderBottomWidth: 1,
                                                    borderBottomColor: theme.border.subtle,
                                                    gap: spacing.sm
                                                }}>
                                                    {player.unified_payment_group_id && (
                                                        <View style={{
                                                            flexDirection: 'row',
                                                            alignItems: 'center',
                                                            gap: spacing.sm,
                                                        }}>
                                                            <Ionicons name="people-outline" size={18} color={theme.text.primary} />
                                                            <Text style={{
                                                                ...typography.variants.label,
                                                                color: theme.text.primary,
                                                                flex: 1
                                                            }}>
                                                                <Text style={{ fontWeight: '600' }}>
                                                                    {isLoadingUnifiedGroup ? '...' : (unifiedGroup?.name || t('payments.model.noGroupName'))}
                                                                </Text>
                                                                {unifiedGroup?.members && unifiedGroup.members.length > 0 && (
                                                                    <Text style={{ color: theme.text.primary, fontWeight: 'normal' }}>
                                                                        : {unifiedGroup.members.map(m => m.full_name).join(', ')}
                                                                    </Text>
                                                                )}
                                                            </Text>
                                                        </View>
                                                    )}

                                                    <TouchableOpacity
                                                        style={styles.historyLink}
                                                        onPress={() => {
                                                            onClose();
                                                            if (player.unified_payment_group_id) {
                                                                router.push({
                                                                    pathname: '/payments',
                                                                    params: {
                                                                        unifiedGroupId: player.unified_payment_group_id,
                                                                        playerId: player.id
                                                                    }
                                                                });
                                                            } else {
                                                                router.push({
                                                                    pathname: '/payments',
                                                                    params: {
                                                                        search: player.full_name,
                                                                        playerId: player.id
                                                                    }
                                                                });
                                                            }
                                                        }}
                                                    >
                                                        <Text style={styles.historyLinkText}>{t('players.modals.player.validation.viewPaymentHistory')}</Text>
                                                        <Ionicons 
                                                            name="arrow-forward" 
                                                            size={14} 
                                                            color={theme.text.primary} 
                                                            style={{ marginTop: 1 }}
                                                        />
                                                    </TouchableOpacity>
                                                </View>
                                            </Section>
                                        </View>
                                    )}

                                    {/* Class History Section */}
                                    <View style={{ marginTop: spacing.sm }}>
                                        <Section
                                            title={t('players.modals.player.sections.classes') || 'Clases'}
                                            icon="school-outline"
                                            noMargin
                                        >
                                            <TouchableOpacity 
                                                style={styles.historyLink}
                                                onPress={() => setClassHistoryVisible(true)}
                                            >
                                                <Text style={styles.historyLinkText}>
                                                    {t('players.modals.player.validation.viewClassHistory') || 'Ver historial de clases'}
                                                </Text>
                                                <Ionicons 
                                                    name="arrow-forward" 
                                                    size={14} 
                                                    color={theme.text.primary} 
                                                    style={{ marginTop: 1 }}
                                                />
                                            </TouchableOpacity>
                                        </Section>
                                    </View>
                                </View>
                            )}

                            {mode === 'edit' && (
                                <View style={{ marginTop: -spacing.md }}>
                                    <UnifiedPaymentSection player={player} playerId={playerId || ''} />
                                </View>
                            )}
                        </ScrollView>
                    ) : activeTab === 'videos' ? (
                        <View style={{ flex: 1 }}>
                            <VideoList playerId={player.id} />
                        </View>
                    ) : (
                        <View style={{ flex: 1 }}>
                            <AnalysisHistory playerId={player.id} />
                        </View>
                    )}
                </View>

                {player && (
                    <ClassHistoryModal
                        visible={classHistoryVisible}
                        onClose={() => setClassHistoryVisible(false)}
                        playerId={player.id}
                        playerName={player.full_name}
                    />
                )}
            </View>
        );
    };

    const renderEditContent = () => (
        <View style={styles.formWrapper}>

            <View style={styles.avatarContainer}>
                <Avatar
                    source={avatarUri}
                    name={mode === 'edit' ? player?.full_name : undefined}
                    size="xl"
                    editable
                    onPress={handleAvatarPress}
                />
            </View>

            <Section title={t('fullName')} style={{ marginBottom: spacing.lg }}>
                <Controller
                    control={control}
                    name="full_name"
                    render={({ field: { onChange, onBlur, value } }) => (
                        <View>
                            <Input
                                size="sm"
                                onBlur={onBlur}
                                onChangeText={onChange}
                                value={value}
                                placeholder={t('players.modals.player.validation.fullNamePlaceholder')}
                            />
                        </View>
                    )}
                />
            </Section>

            <Section style={{ marginBottom: spacing.lg }}>
                <View style={{ gap: spacing.md }}>
                    <Controller
                        control={control}
                        name="contact_email"
                        render={({ field: { onChange, onBlur, value } }) => (
                            <Input
                                label="Correo electrónico"
                                labelStyle={styles.sectionTitle}
                                size="sm"
                                onBlur={onBlur}
                                onChangeText={onChange}
                                value={value}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                        )}
                    />
                    <Controller
                        control={control}
                        name="contact_phone"
                        render={({ field: { onChange, onBlur, value } }) => (
                            <Input
                                label={t('phone')}
                                labelStyle={styles.sectionTitle}
                                size="sm"
                                onBlur={onBlur}
                                onChangeText={onChange}
                                value={value}
                                keyboardType="phone-pad"
                            />
                        )}
                    />
                </View>
            </Section>

            <Section title={t('players.modals.player.sections.birthInfo')} style={{ marginBottom: spacing.lg }}>
                <Row align="flex-start" gap="md">
                    <View style={{ flex: 1 }}>
                        <Controller
                            control={control}
                            name="birth_day"
                            render={({ field: { onChange, onBlur, value } }) => (
                                <Input
                                    size="sm"
                                    onBlur={onBlur}
                                    onChangeText={onChange}
                                    value={value}
                                    placeholder="DD"
                                    keyboardType="number-pad"
                                    maxLength={2}
                                />
                            )}
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Controller
                            control={control}
                            name="birth_month"
                            render={({ field: { onChange, onBlur, value } }) => (
                                <Input
                                    size="sm"
                                    onBlur={onBlur}
                                    onChangeText={onChange}
                                    value={value}
                                    placeholder="MM"
                                    keyboardType="number-pad"
                                    maxLength={2}
                                />
                            )}
                        />
                    </View>
                    <View style={{ flex: 1.5 }}>
                        <Controller
                            control={control}
                            name="birth_year"
                            render={({ field: { onChange, onBlur, value } }) => (
                                <Input
                                    size="sm"
                                    onBlur={onBlur}
                                    onChangeText={onChange}
                                    value={value}
                                    placeholder="YYYY"
                                    keyboardType="number-pad"
                                    maxLength={4}
                                />
                            )}
                        />
                    </View>
                </Row>
            </Section>

            <Section title={t('level')} style={{ marginBottom: spacing.lg }}>
                <Controller
                    control={control}
                    name="level"
                    render={({ field: { onChange, value } }) => {
                        const levelIcons: Record<PlayerLevel, keyof typeof Ionicons.glyphMap> = {
                            beginner: 'star-outline',
                            intermediate: 'star-half-outline',
                            advanced: 'star',
                            professional: 'trophy-outline',
                        };
                        const content = (
                            <>
                                {levels.map((lvl) => (
                                    <TouchableOpacity
                                        key={lvl}
                                        style={[styles.selectorOption, value === lvl && styles.selectorOptionActive]}
                                        onPress={() => onChange(lvl)}
                                    >
                                        <Ionicons
                                            name={levelIcons[lvl]}
                                            size={20}
                                            color={value === lvl ? theme.components.button.primary.text : theme.text.secondary}
                                        />
                                        <Text style={[styles.selectorText, value === lvl && styles.selectorTextActive]}>
                                            {t(`level.${lvl}`)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </>
                        );

                        return Platform.OS === 'web' ? (
                            <View style={styles.selectorContainer}>{content}</View>
                        ) : (
                            <ScrollView 
                                horizontal 
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={[styles.selectorContainer, { paddingHorizontal: 2 }]}
                            >
                                {content}
                            </ScrollView>
                        );
                    }}
                />
            </Section>

            <Section title={t('dominantHand')} style={{ marginBottom: spacing.lg }}>
                <Controller
                    control={control}
                    name="dominant_hand"
                    render={({ field: { onChange, value } }) => {
                        const handIcons: Record<DominantHand, keyof typeof Ionicons.glyphMap> = {
                            left: 'hand-left-outline',
                            right: 'hand-right-outline',
                            ambidextrous: 'infinite-outline',
                        };
                        const content = (
                            <>
                                {hands.map((hand) => (
                                    <TouchableOpacity
                                        key={hand}
                                        style={[styles.selectorOption, value === hand && styles.selectorOptionActive]}
                                        onPress={() => onChange(hand)}
                                    >
                                        <Ionicons
                                            name={handIcons[hand]}
                                            size={20}
                                            color={value === hand ? theme.components.button.primary.text : theme.text.secondary}
                                        />
                                        <Text style={[styles.selectorText, value === hand && styles.selectorTextActive]}>
                                            {t(`hand.${hand}`)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </>
                        );

                        return Platform.OS === 'web' ? (
                            <View style={styles.selectorContainer}>{content}</View>
                        ) : (
                            <ScrollView 
                                horizontal 
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={[styles.selectorContainer, { paddingHorizontal: 2 }]}
                            >
                                {content}
                            </ScrollView>
                        );
                    }}
                />
            </Section>

            {paymentsEnabled && mode === 'edit' && player && (
                <>
                    <View style={styles.planSectionHeader}>
                        <View style={styles.titleRow}>
                            <Ionicons name="pricetag-outline" size={18} color={theme.text.secondary} />
                            <Text style={styles.sectionTitle}>{t('players.modals.player.sections.paymentPlans')}</Text>
                            <HelpIcon 
                                onPress={showPaymentPlanHelp} 
                                size={14} 
                                style={{ marginLeft: spacing.xs }} 
                            />
                        </View>
                        <TouchableOpacity onPress={() => setAssignPlanVisible(true)}>
                            <Text style={styles.addPlanLink}>+ {t('common.assign')}</Text>
                        </TouchableOpacity>
                    </View>

                    <Card style={styles.paymentsCard} padding="md">
                        {isLoadingSub ? (
                            <ActivityIndicator size="small" color={theme.components.button.primary.bg} />
                        ) : subscriptions && subscriptions.length > 0 ? (
                            <View style={styles.subscriptionsList}>
                                {subscriptions.map((sub) => (
                                    <View key={sub.id} style={styles.subscriptionInfo}>
                                        <View style={styles.planHeaderRow}>
                                            <View style={styles.planStatus}>
                                                <Ionicons name="checkmark-circle" size={20} color={theme.status.success} />
                                                <Text style={styles.planName}>{sub.plan?.name}</Text>
                                            </View>
                                            <TouchableOpacity
                                                style={styles.cancelButton}
                                                onPress={() => handleCancelSubscription(sub.id, sub.plan?.name || '')}
                                            >
                                                <Ionicons name="close-circle-outline" size={20} color={theme.status.error} />
                                            </TouchableOpacity>
                                        </View>
                                        <Text style={styles.planDetails}>
                                            {sub.plan?.type === 'monthly' ? t('players.planType.monthly') : t('players.planType.perClass')}
                                            {sub.custom_amount && ` • $${sub.custom_amount}`}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <View style={styles.emptyPlan}>
                                <Ionicons name="alert-circle-outline" size={24} color={theme.text.tertiary} />
                                <Text style={styles.emptyPlanText}>{t('players.modals.player.validation.noActivePlansDescription')}</Text>
                                <TouchableOpacity style={styles.linkButton} onPress={() => setAssignPlanVisible(true)}>
                                    <Text style={styles.linkButtonText}>{t('players.modals.player.validation.assignFirstPlan')}</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </Card>
                </>
            )}



            {paymentsEnabled && mode === 'create' && (
                <Section
                    title={t('players.modals.player.sections.paymentPlan')}
                    icon="pricetag-outline"
                    onHelpPress={showPaymentPlanHelp}
                >
                    <View style={styles.selectorContainer}>
                        {plans?.map((plan) => {
                            const isSelected = selectedPlanIds.includes(plan.id);
                            return (
                                <TouchableOpacity
                                    key={plan.id}
                                    style={[
                                        styles.selectorOption,
                                        isSelected && styles.paymentOptionActive,
                                        { width: '100%', marginBottom: spacing.xs, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.md }
                                    ]}
                                    onPress={() => setSelectedPlanIds(prev =>
                                        isSelected ? prev.filter(id => id !== plan.id) : [...prev, plan.id]
                                    )}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                                        <Ionicons
                                            name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                                            size={20}
                                            color={isSelected ? theme.text.primary : theme.text.secondary}
                                        />
                                        <Text style={[styles.selectorText, isSelected && styles.paymentOptionTextActive]}>
                                            {plan.name}
                                        </Text>
                                    </View>
                                    <Text style={[styles.selectorText, isSelected && styles.paymentOptionTextActive, { fontWeight: '700' }]}>
                                        ${plan.amount.toLocaleString('es-AR')}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}

                    </View>
                    <Card style={{ backgroundColor: theme.background.surface, borderColor: theme.border.default }} padding="sm">
                        <View style={{ alignItems: 'center' }}>
                            <Text style={[typography.variants.bodySmall, { color: theme.text.secondary, textAlign: 'center', marginBottom: spacing.xs }]}>
                                {t('players.modals.player.validation.createPlanDescription')}
                            </Text>
                            <Button
                                label={t('players.payments.createPlan')}
                                variant="outline"
                                size="sm"
                                onPress={() => setCreatePlanModalVisible(true)}
                            />
                        </View>
                    </Card>
                </Section>
            )}

            {(paymentsEnabled && (mode === 'create' || mode === 'edit')) && (
                <Section
                    title={t('players.modals.player.sections.unifiedPayment')}
                    icon="wallet-outline"
                    onHelpPress={showUnifiedPaymentHelp}
                >
                    <Card style={{ backgroundColor: theme.background.surface, borderColor: theme.border.default }} padding="sm">
                        {selectedUnifiedGroup ? (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                                    <Ionicons name="wallet" size={20} color={theme.status.success} />
                                    <View>
                                        <Text style={[typography.variants.label, { color: theme.text.primary }]}>{selectedUnifiedGroup.name}</Text>
                                        {selectedUnifiedGroup.contact_name && (
                                            <Text style={[typography.variants.bodySmall, { color: theme.text.secondary }]}>{t('players.payments.responsible', { name: selectedUnifiedGroup.contact_name })}</Text>
                                        )}
                                    </View>
                                </View>
                                <TouchableOpacity onPress={() => setSelectedUnifiedGroup(null)} style={{ padding: spacing.xs }}>
                                    <Ionicons name="close-circle-outline" size={24} color={theme.status.error} />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={{ alignItems: 'center' }}>
                                <Text style={[typography.variants.bodySmall, { color: theme.text.secondary, textAlign: 'center', marginBottom: spacing.xs }]}>
                                    {t('players.modals.player.validation.unifiedPaymentDescription')}
                                </Text>
                                <Button
                                    label={t('players.modals.player.validation.linkToGroup')}
                                    variant="outline"
                                    size="sm"
                                    onPress={() => setUnifiedPaymentModalVisible(true)}
                                />
                            </View>
                        )}
                    </Card>

                    <UnifiedPaymentModal
                        visible={unifiedPaymentModalVisible}
                        onClose={() => setUnifiedPaymentModalVisible(false)}
                        playerName={watch('full_name') || t('players.modals.player.validation.newPlayer')}
                        onSelectGroup={(group) => setSelectedUnifiedGroup(group)}
                    />
                </Section>
            )}

            <Section title={t('notes')} style={{ marginBottom: spacing.lg }}>
                <Controller
                    control={control}
                    name="notes"
                    render={({ field: { onChange, onBlur, value } }) => (
                        <Input
                            onBlur={onBlur}
                            onChangeText={onChange}
                            value={value}
                            multiline
                            numberOfLines={4}
                            inputStyle={styles.textArea}
                            placeholder={t('notesPlaceholder')}
                        />
                    )}
                />
            </Section>
        </View>
    );

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={[styles.modalOverlay, { backgroundColor: theme.background.backdrop }]}>
                <View style={[
                    styles.modalContainer,
                    isDesktop && { 
                        width: 500, 
                        height: Math.min(650, windowHeight * 0.85),
                        borderRadius: 12, 
                        overflow: 'hidden' 
                    },
                ]}>
                    <View style={[styles.headerRow, { zIndex: 10 }, (mode === 'view' && !isFetching) && { paddingVertical: spacing.md }]}>
                        {(mode === 'view' && player && !isLoading) ? (
                            <>
                                <View style={{ width: 44 }} />
                                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                                    <Avatar name={player.full_name} source={player.avatar_url || undefined} size="lg" />
                                    <View style={{ marginLeft: spacing.md }}>
                                        <Text style={styles.name}>{player.full_name}</Text>
                                        <View style={styles.badgeContainer}>
                                            <View style={styles.levelContainer}>
                                                <Text style={styles.badgeText}>{t(`level.${player.level || 'beginner'}`)}</Text>
                                            </View>
                                            {player.is_archived && (
                                                <View style={[styles.badge, styles.archivedBadge]}>
                                                    <Text style={styles.archivedBadgeText}>{t('archived')}</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                </View>
                            </>
                        ) : (
                            <>
                                <View style={{ width: 44 }} />
                                <Text style={styles.headerTitle} numberOfLines={1}>
                                    {!isLoading && (
                                        mode === 'edit' ? t('players.modals.player.titleEdit') : 
                                        mode === 'create' ? t('players.modals.player.titleCreate') : 
                                        t('players.modals.player.titleView')
                                    )}
                                </Text>
                            </>
                        )}
                        <TouchableOpacity onPress={onClose} style={[styles.closeButton, { paddingRight: spacing.md, width: 44, alignItems: 'center' }]}>
                            <Ionicons name="close" size={24} color={theme.text.primary} />
                        </TouchableOpacity>
                    </View>

                        <View style={{ flex: 1 }}>
                            {isLoading ? (
                                <ActivityIndicator size="large" color={theme.components.button.primary.bg} style={{ marginTop: 24 }} />
                            ) : (
                                (mode === 'edit' || mode === 'create') ? (
                                        <View style={{ flex: 1 }}>
                                            <ScrollView 
                                                showsVerticalScrollIndicator={false} 
                                                contentContainerStyle={styles.scrollContent}
                                                keyboardShouldPersistTaps="handled"
                                            >
                                                {renderEditContent()}
                                            </ScrollView>
                                            
                                            <View style={[
                                                styles.footer, 
                                                { paddingBottom: Math.max(insets.bottom, spacing.md) }
                                            ]}>
                                                <View style={{ width: '100%', maxWidth: 200, alignSelf: 'center' }}>
                                                    <Button
                                                        label={mode === 'create' ? t('common.create') : t('common.save')}
                                                        variant="primary"
                                                        onPress={handleSubmit(onSubmit)}
                                                        loading={updatePlayer.isPending || createPlayer.isPending || isUploading}
                                                        style={{ width: '100%' }}
                                                    />
                                                </View>
                                            </View>
                                        </View>
                                ) : (
                                    <View style={{ flex: 1 }}>
                                        {renderViewContent()}
                                    </View>
                                )
                            )}
                        </View>


                </View>
            </View>

            {/* Nested Modals */}
            <AssignPlanModal
                visible={assignPlanVisible}
                onClose={() => setAssignPlanVisible(false)}
                playerId={playerId || ''}
                playerName={player?.full_name || ''}
            />
            <PlanModal
                visible={createPlanModalVisible}
                onClose={() => setCreatePlanModalVisible(false)}
            />
            <StatusModal
                visible={noPlanWarningVisible}
                type="warning"
                title={t('players.modals.player.validation.noPaymentPlan')}
                message={t('players.modals.player.validation.noPaymentPlanWarning')}
                showCancel
                cancelText={t('common.back')}
                buttonText={t('common.continue')}
                onClose={() => {
                    setNoPlanWarningVisible(false);
                    setPendingSubmitData(null);
                }}
                onConfirm={() => {
                    setNoPlanWarningVisible(false);
                    if (pendingSubmitData) {
                        executeSubmit(pendingSubmitData);
                        setPendingSubmitData(null);
                    }
                }}
            />

            <StatusModal
                visible={confirmation.visible}
                type="warning"
                title={t('players.modals.player.validation.cancelPlan')}
                message={t('players.modals.player.validation.cancelPlanConfirm', { planName: confirmation.planName })}
                onClose={() => setConfirmation({ ...confirmation, visible: false })}
                onConfirm={handleConfirmCancel}
                buttonText={t('confirm')}
                showCancel
                cancelText={t('cancel')}
            />
            {/* Modal-local Toast to ensure visibility on web/mobile fullscreen modals */}
            <Toast config={toastConfig} topOffset={40} />
            
            <HelpModal
                visible={helpModalVisible}
                onClose={() => setHelpModalVisible(false)}
                title={helpModalConfig.title}
                items={helpModalConfig.items}
                description={helpModalConfig.description}
            />
        </Modal>
    );
}

const DetailItem = ({ label, value, icon, theme }: { label: string; value: string; icon: any, theme: Theme }) => (
    <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
    }}>
        <View style={{
            marginRight: spacing.sm,
            justifyContent: 'center',
            alignItems: 'center',
        }}>
            <Ionicons name={icon} size={20} color={theme.text.secondary} />
        </View>
        <View style={{ flex: 1 }}>
            <Text style={{
                fontSize: typography.size.xs,
                color: theme.text.secondary,
                fontWeight: '500',
            }}>{label}</Text>
            <Text style={{
                fontSize: typography.size.md,
                color: theme.text.primary,
                fontWeight: '600',
            }}>{value}</Text>
        </View>
    </View>
);

const createStyles = (theme: Theme, isDesktop: boolean): any => StyleSheet.create({
    modalOverlay: {
        ...commonStyles.modal.overlay,
    },
    modalContainer: {
        ...commonStyles.modal.content,
        backgroundColor: theme.background.surface,
        borderWidth: 1,
        borderColor: theme.border.subtle,
        // Fix robusto: Altura definida para evitar el "baile" al cambiar de pestañas o cargar datos.
        height: Platform.OS === 'web' && !isDesktop ? '92%' : (Platform.OS !== 'web' ? '92%' : 'auto'),
        minHeight: !isDesktop ? '80%' : 'auto',
        maxHeight: !isDesktop ? '92%' : '85%',
        width: !isDesktop ? '100%' : '100%',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: theme.border.subtle,
    },
    headerTitle: {
        ...typography.variants.h3,
        color: theme.text.primary,
        textAlign: 'center',
        flex: 1,
    },
    closeButton: {
        padding: 8,
        // Removed marginLeft: -8 as it's no longer needed with flex: 1 on title
    },
    headerButton: {
        padding: 8,
        marginRight: -8,
    },
    scrollContent: {
        padding: spacing.md,
        paddingBottom: spacing.sm,
        flexGrow: 1,
    },
    formWrapper: {
        width: '100%',
        flex: 1,
        ...(Platform.OS !== 'web' && {
            height: '100%',
        })
    },
    footer: {
        padding: spacing.md,
        borderTopWidth: 1,
        borderTopColor: theme.border.subtle,
    },
    // View Styles
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: spacing.sm,
        paddingHorizontal: spacing.md,
    },
    name: {
        ...typography.variants.h3,
        color: theme.text.primary,
        marginTop: 0,
    },
    badgeContainer: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: 4,
    },
    badge: {
        backgroundColor: theme.components.badge.primary,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: 12,
        alignSelf: 'flex-start',
    },
    levelContainer: {
        paddingVertical: 2,
        alignSelf: 'flex-start',
    },
    archivedBadge: {
        backgroundColor: theme.background.subtle,
    },
    badgeText: {
        fontSize: typography.size.xs,
        fontWeight: '600',
        color: theme.text.primary,
        textTransform: 'capitalize',
    },
    archivedBadgeText: {
        ...typography.variants.label,
        color: theme.text.secondary,
    },
    tabContainer: {
        flexDirection: 'row',
        marginTop: spacing.sm,
        marginBottom: spacing.none,
        marginHorizontal: spacing.md,
    },
    tabButton: {
        marginRight: spacing.lg,
        paddingVertical: spacing.sm,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    activeTabButton: {
        borderBottomColor: theme.components.button.primary.bg,
    },
    tabText: {
        fontSize: typography.size.md,
        color: theme.text.secondary,
        fontWeight: '500',
    },
    activeTabText: {
        color: theme.text.primary,
        fontWeight: '700',
    },
    infoCard: {
        marginBottom: spacing.lg,
    },
    notesCard: {
        marginBottom: spacing.lg,
    },

    // Restored styles for compatibility
    sectionTitle: {
        ...commonStyles.sectionTitle,
        color: theme.text.primary,
    },
    notesText: {
        ...typography.variants.bodyLarge,
        color: theme.text.primary,
        lineHeight: 22,
    },
    historyLink: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        gap: spacing.xs,
    },
    historyLinkText: {
        ...typography.variants.label,
        color: theme.text.primary,
    },
    // Edit Styles
    avatarContainer: {
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    avatarHint: {
        marginTop: spacing.xs,
        fontSize: typography.size.xs,
        color: theme.text.tertiary,
    },
    selectorContainer: {
        flexDirection: 'row',
        flexWrap: Platform.OS === 'web' ? 'wrap' : 'nowrap',
        gap: spacing.sm,
    },
    selectorOption: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.border.default,
        backgroundColor: theme.background.subtle,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 48,
    },
    selectorOptionActive: {
        borderColor: theme.components.button.primary.bg,
        backgroundColor: theme.components.button.primary.bg,
    },
    selectorText: {
        fontSize: typography.size.xs,
        color: theme.text.secondary,
        marginTop: 4,
        textAlign: 'center',
    },
    selectorTextActive: {
        color: theme.components.button.primary.text,
    },
    paymentsCard: {
        marginBottom: spacing.lg,
    },
    paymentOptionActive: {
        borderColor: theme.components.button.primary.bg,
        backgroundColor: 'transparent',
    },
    paymentOptionTextActive: {
        color: theme.text.primary,
        fontWeight: '700',
    },
    planSectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    addPlanLink: {
        color: theme.text.primary,
        ...typography.variants.label,
    },
    subscriptionsList: {
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    subscriptionInfo: {
        paddingHorizontal: 0,
        paddingTop: 4,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: theme.border.subtle,
    },
    planHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 2,
    },
    planStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    planName: {
        ...typography.variants.label,
        color: theme.text.primary,
    },
    cancelButton: {
        padding: spacing.xs,
    },
    planDetails: {
        ...typography.variants.bodyMedium,
        color: theme.text.primary,
    },
    planNotes: {
        ...typography.variants.bodySmall,
        color: theme.text.tertiary,
        fontStyle: 'italic',
        marginTop: spacing.xs,
    },
    emptyPlan: {
        paddingVertical: spacing.md,
        alignItems: 'center',
    },
    emptyPlanText: {
        color: theme.text.tertiary,
        ...typography.variants.bodyMedium,
    },
    linkButton: {
        marginTop: spacing.sm,
    },
    linkButtonText: {
        color: theme.text.primary,
        fontWeight: '600',
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
});
