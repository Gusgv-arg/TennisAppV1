import StatusModal from '@/src/components/StatusModal';
import { commonStyles } from '@/src/design/common';
import { Avatar } from '@/src/design/components/Avatar';
import { Button } from '@/src/design/components/Button';
import { Card } from '@/src/design/components/Card';
import { Input } from '@/src/design/components/Input';
import { Row } from '@/src/design/components/Row';
import { Section } from '@/src/design/components/Section';
import { Theme } from '@/src/design/theme';
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
import { useUnifiedPaymentGroupMutations } from '@/src/features/payments/hooks/useUnifiedPaymentGroups';
import { usePlayerMutations } from '@/src/features/players/hooks/usePlayerMutations';
import { usePlayer } from '@/src/features/players/hooks/usePlayers';
import { useAvatarUpload } from '@/src/hooks/useAvatarUpload';
import { useImagePicker } from '@/src/hooks/useImagePicker';
import { useTheme } from '@/src/hooks/useTheme';
import { UnifiedPaymentGroup } from '@/src/types/payments';
import { DominantHand, PlayerLevel } from '@/src/types/player';
import { showError, showSuccess } from '@/src/utils/toast';
import { Ionicons } from '@expo/vector-icons';
import VideoList from './VideoList';

import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions
} from 'react-native';
import * as z from 'zod';

// Schema from edit.tsx
const schema = z.object({
    full_name: z.string().min(1, 'fieldRequired'),
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
    const { t } = useTranslation();
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const isDesktop = windowWidth >= 768;
    const router = useRouter();
    const { theme } = useTheme();
    const [mode, setMode] = useState<'view' | 'edit' | 'create'>(initialMode);
    const [activeTab, setActiveTab] = useState<'profile' | 'videos'>('profile');
    const styles = useMemo(() => createStyles(theme), [theme]);

    useEffect(() => {
        if (visible) {
            setMode(initialMode);
        }
    }, [visible, initialMode]);

    const { data: player, isLoading: isFetching } = usePlayer(playerId || '');
    const { updatePlayer, createPlayer } = usePlayerMutations();
    const { isEnabled: paymentsEnabled } = usePaymentSettings();
    const { subscriptions, isLoading: isLoadingSub, cancelSubscription } = useSubscriptions(playerId || '');

    // State for Edit Mode
    const [assignPlanVisible, setAssignPlanVisible] = useState(false);
    const [confirmation, setConfirmation] = useState<{
        visible: boolean;
        subId: string;
        planName: string;
    }>({ visible: false, subId: '', planName: '' });

    const [avatarUri, setAvatarUri] = useState<string | null>(null);
    const [createdPlayerId, setCreatedPlayerId] = useState<string | null>(null);
    const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);
    const [selectedUnifiedGroup, setSelectedUnifiedGroup] = useState<UnifiedPaymentGroup | null>(null);
    const [unifiedPaymentModalVisible, setUnifiedPaymentModalVisible] = useState(false);
    const [createPlanModalVisible, setCreatePlanModalVisible] = useState(false);
    const [noPlanWarningVisible, setNoPlanWarningVisible] = useState(false);
    const [pendingSubmitData, setPendingSubmitData] = useState<FormData | null>(null);

    // Hooks
    const { pickImageFromCamera, pickImageFromGallery } = useImagePicker();
    const { uploadAvatar, isUploading } = useAvatarUpload();
    const { data: currentAcademy } = useCurrentAcademy();
    const { plans } = usePricingPlans();
    const { assignPlan } = useSubscriptions();
    const { addMemberToGroup } = useUnifiedPaymentGroupMutations();
    const { data: academiesData } = useUserAcademies();
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
            }
        }
    }, [visible, player, mode, reset]);

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
            'Foto de perfil',
            'Elige una opción',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Tomar foto',
                    onPress: async () => {
                        const uri = await pickImageFromCamera();
                        if (uri) setAvatarUri(uri);
                    },
                },
                {
                    text: 'Elegir de galería',
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
            showError(t('saveError'), error.message || 'No se pudo anular la suscripción');
        }
    };

    const onSubmit = async (data: FormData) => {
        const result = schema.safeParse(data);
        if (!result.success) {
            result.error.issues.forEach((issue) => {
                const path = issue.path[0] as keyof FormData;
                setError(path, { type: 'manual', message: issue.message });
            });
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
                    await uploadAvatar(avatarUri, newPlayer.id);
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
                                showError('Error', `No se pudo asignar el plan "${plan.name}": ${planError.message || 'Error desconocido'}`);
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
                    }
                }

                // Notify parent if callback provided
                if (onPlayerCreated) {
                    onPlayerCreated(newPlayer, selectedPlanIds.length > 0);
                }

                showSuccess(t('createPlayer') || 'Nuevo Alumno', t('playerCreated') || 'Alumno creado correctamente');
                onClose();
            } else {
                let avatar_url = player?.avatar_url || null;
                if (avatarUri && !avatarUri.startsWith('http')) {
                    const uploadedUrl = await uploadAvatar(avatarUri, playerId!);
                    if (uploadedUrl) avatar_url = uploadedUrl;
                }

                await updatePlayer.mutateAsync({ id: playerId!, input: { ...payload, avatar_url } as any });

                showSuccess(t('editPlayer'), t('playerUpdated'));
                if (onPlayerUpdated) {
                    onPlayerUpdated(payload);
                }
                onClose();
            }
        } catch (error: any) {
            showError(t('saveError'), error.message || t('errorOccurred'));
        }
    };

    if (!visible) return null;

    const levels: PlayerLevel[] = ['beginner', 'intermediate', 'advanced', 'professional'];
    const hands: DominantHand[] = ['left', 'right', 'ambidextrous'];
    const isLoading = isFetching && !!playerId;

    const renderViewContent = () => {
        if (!player) return <View><Text style={{ color: theme.text.primary }}>No player data</Text></View>;
        return (
            <View style={styles.formWrapper}>
                <View style={styles.header}>
                    <Avatar name={player.full_name} source={player.avatar_url || undefined} size="lg" />
                    <Text style={styles.name}>{player.full_name}</Text>
                    <View style={styles.badgeContainer}>
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{t(`level.${player.level || 'beginner'}`)}</Text>
                        </View>
                        {player.is_archived && (
                            <View style={[styles.badge, styles.archivedBadge]}>
                                <Text style={styles.archivedBadgeText}>{t('archived')}</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Tabs Header */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 'profile' && styles.activeTabButton]}
                        onPress={() => setActiveTab('profile')}
                    >
                        <Text style={[styles.tabText, activeTab === 'profile' && styles.activeTabText]}>Perfil</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 'videos' && styles.activeTabButton]}
                        onPress={() => setActiveTab('videos')}
                    >
                        <Text style={[styles.tabText, activeTab === 'videos' && styles.activeTabText]}>Videos</Text>
                    </TouchableOpacity>
                </View>

                {activeTab === 'profile' ? (
                    <>
                        <Card style={styles.infoCard} padding="md">
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
                        </Card>

                        {player.notes && (
                            <Card style={styles.notesCard} padding="md">
                                <Section title={t('notes')} noMargin>
                                    <Text style={styles.notesText}>{player.notes}</Text>
                                </Section>
                            </Card>
                        )}

                        {paymentsEnabled && (
                            <Card style={styles.paymentsCard} padding="md">
                                <Section
                                    title="Suscripciones"
                                    icon="pricetag-outline"
                                >
                                    <View />
                                </Section>

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
                                                </View>
                                                <Text style={styles.planDetails}>
                                                    {sub.plan?.type === 'monthly' ? 'Plan Mensual' : 'Por Clase'}
                                                    {sub.custom_amount && ` • $${sub.custom_amount}`}
                                                </Text>
                                                {sub.notes && <Text style={styles.planNotes}>{sub.notes}</Text>}
                                            </View>
                                        ))}
                                    </View>
                                ) : (
                                    <View style={styles.emptyPlan}>
                                        <Text style={styles.emptyPlanText}>Sin planes asignados</Text>
                                    </View>
                                )}

                                <TouchableOpacity
                                    style={styles.historyLink}
                                    onPress={() => {
                                        onClose(); // Close modal when navigating
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
                                    <Text style={styles.historyLinkText}>Ver Historial de Pagos</Text>
                                    <Ionicons name="arrow-forward" size={iconSizes.sm} color={theme.components.button.primary.bg} />
                                </TouchableOpacity>
                            </Card>
                        )}
                    </>
                ) : (
                    <View style={{ flex: 1, minHeight: 300 }}>
                        <VideoList playerId={player.id} />
                    </View>
                )}
            </View>
        );
    };

    const renderEditContent = () => (
        <View style={styles.formWrapper}>
            {hasMultipleAcademies && currentAcademy && (
                <View style={{ marginBottom: spacing.md, alignItems: 'flex-start' }}>
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: theme.components.badge.primary,
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.xs,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: theme.components.badge.primary,
                        gap: spacing.xs
                    }}>
                        <Ionicons name="business" size={14} color={theme.components.button.primary.bg} />
                        <Text style={[typography.variants.labelSmall, { color: theme.components.button.primary.bg }]}>
                            {currentAcademy.name}
                        </Text>
                    </View>
                </View>
            )}

            <View style={styles.avatarContainer}>
                <Avatar
                    source={avatarUri}
                    name={mode === 'edit' ? player?.full_name : undefined}
                    size="xl"
                    editable
                    onPress={handleAvatarPress}
                />
            </View>

            <Section title={t('fullName')}>
                <Controller
                    control={control}
                    name="full_name"
                    render={({ field: { onChange, onBlur, value } }) => (
                        <View>
                            <Input
                                size="sm"
                                onBlur={() => { onBlur(); validateField('full_name', value); }}
                                onChangeText={onChange}
                                value={value}
                                error={errors.full_name ? t(errors.full_name.message as string) : undefined}
                                placeholder="Ej. Juan Pérez"
                            />
                        </View>
                    )}
                />
            </Section>

            <Section title="Datos de Nacimiento">
                <Row align="flex-start" gap="md">
                    <View style={{ flex: 1 }}>
                        <Controller
                            control={control}
                            name="birth_day"
                            render={({ field: { onChange, onBlur, value } }) => (
                                <Input
                                    label={t('day')}
                                    size="sm"
                                    onBlur={() => { onBlur(); validateField('birth_day', value); }}
                                    onChangeText={onChange}
                                    value={value}
                                    placeholder="DD"
                                    keyboardType="number-pad"
                                    maxLength={2}
                                    error={errors.birth_day ? t(errors.birth_day.message as string) : undefined}
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
                                    label={t('month')}
                                    size="sm"
                                    onBlur={() => { onBlur(); validateField('birth_month', value); }}
                                    onChangeText={onChange}
                                    value={value}
                                    placeholder="MM"
                                    keyboardType="number-pad"
                                    maxLength={2}
                                    error={errors.birth_month ? t(errors.birth_month.message as string) : undefined}
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
                                    label={t('year')}
                                    size="sm"
                                    onBlur={() => { onBlur(); validateField('birth_year', value); }}
                                    onChangeText={onChange}
                                    value={value}
                                    placeholder="YYYY"
                                    keyboardType="number-pad"
                                    maxLength={4}
                                    error={errors.birth_year ? t(errors.birth_year.message as string) : undefined}
                                />
                            )}
                        />
                    </View>
                </Row>
            </Section>

            <Section title={t('contactInfo')}>
                <Row align="flex-start" gap="md">
                    <View style={{ flex: 1 }}>
                        <Controller
                            control={control}
                            name="contact_email"
                            render={({ field: { onChange, onBlur, value } }) => (
                                <Input
                                    label={t('email')}
                                    size="sm"
                                    onBlur={() => { onBlur(); validateField('contact_email', value); }}
                                    onChangeText={onChange}
                                    value={value}
                                    error={errors.contact_email ? t(errors.contact_email.message as string) : undefined}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                            )}
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Controller
                            control={control}
                            name="contact_phone"
                            render={({ field: { onChange, onBlur, value } }) => (
                                <Input
                                    label={t('phone')}
                                    size="sm"
                                    onBlur={() => { onBlur(); validateField('contact_phone', value); }}
                                    onChangeText={onChange}
                                    value={value}
                                    error={errors.contact_phone ? t(errors.contact_phone.message as string) : undefined}
                                    keyboardType="phone-pad"
                                />
                            )}
                        />
                    </View>
                </Row>
            </Section>

            <Section title={t('level')}>
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
                        return (
                            <View style={styles.selectorContainer}>
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
                            </View>
                        );
                    }}
                />
            </Section>

            <Section title={t('dominantHand')}>
                <Controller
                    control={control}
                    name="dominant_hand"
                    render={({ field: { onChange, value } }) => {
                        const handIcons: Record<DominantHand, keyof typeof Ionicons.glyphMap> = {
                            left: 'hand-left-outline',
                            right: 'hand-right-outline',
                            ambidextrous: 'infinite-outline',
                        };
                        return (
                            <View style={styles.selectorContainer}>
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
                            </View>
                        );
                    }}
                />
            </Section>

            {paymentsEnabled && mode === 'edit' && player && (
                <>
                    <View style={styles.planSectionHeader}>
                        <View style={styles.titleRow}>
                            <Ionicons name="pricetag-outline" size={18} color={theme.text.secondary} />
                            <Text style={styles.sectionTitle}>Planes de pago</Text>
                        </View>
                        <TouchableOpacity onPress={() => setAssignPlanVisible(true)}>
                            <Text style={styles.addPlanLink}>+ Asignar</Text>
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
                                            {sub.plan?.type === 'monthly' ? 'Plan Mensual' : 'Por Clase'}
                                            {sub.custom_amount && ` • $${sub.custom_amount}`}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <View style={styles.emptyPlan}>
                                <Ionicons name="alert-circle-outline" size={24} color={theme.text.tertiary} />
                                <Text style={styles.emptyPlanText}>El alumno no tiene planes activos actualmente</Text>
                                <TouchableOpacity style={styles.linkButton} onPress={() => setAssignPlanVisible(true)}>
                                    <Text style={styles.linkButtonText}>Asignar primer plan</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </Card>

                    <UnifiedPaymentSection
                        player={player}
                        playerId={playerId!}
                    />
                </>
            )}



            {paymentsEnabled && mode === 'create' && (
                <Section
                    title="Plan de Pago"
                    icon="pricetag-outline"
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
                                Podés crear un nuevo plan de pago desde aquí.
                            </Text>
                            <Button
                                label="Crear Plan"
                                variant="outline"
                                size="sm"
                                onPress={() => setCreatePlanModalVisible(true)}
                            />
                        </View>
                    </Card>
                </Section>
            )}

            {paymentsEnabled && mode === 'create' && (
                <Section
                    title="Pago Unificado"
                    icon="wallet-outline"
                >
                    <Card style={{ backgroundColor: theme.background.surface, borderColor: theme.border.default }} padding="sm">
                        {selectedUnifiedGroup ? (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                                    <Ionicons name="wallet" size={20} color={theme.status.success} />
                                    <View>
                                        <Text style={[typography.variants.label, { color: theme.text.primary }]}>{selectedUnifiedGroup.name}</Text>
                                        {selectedUnifiedGroup.contact_name && (
                                            <Text style={[typography.variants.bodySmall, { color: theme.text.secondary }]}>Resp: {selectedUnifiedGroup.contact_name}</Text>
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
                                    La deuda y el pago serán unificados para todos los miembros del grupo.
                                </Text>
                                <Button
                                    label="Vincular a Grupo"
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
                        playerName={watch('full_name') || 'Nuevo Alumno'}
                        onSelectGroup={(group) => setSelectedUnifiedGroup(group)}
                    />
                </Section>
            )}

            <Section title={t('notes')}>
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
                    isDesktop && { width: 500, maxHeight: windowHeight * 0.9, borderRadius: 12, overflow: 'hidden' },
                ]}>
                    <View style={styles.headerRow}>
                        <View style={{ width: 44 }}>
                            {mode === 'view' && (
                                <TouchableOpacity onPress={() => setMode('edit')} style={styles.headerButton}>
                                    <Ionicons name="create-outline" size={24} color={theme.status.warning} />
                                </TouchableOpacity>
                            )}
                        </View>
                        <Text style={styles.headerTitle}>
                            {mode === 'edit' ? t('editPlayer') : mode === 'create' ? (t('createPlayer') || 'Nuevo Alumno') : t('playerDetails')}
                        </Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={theme.text.primary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                    >
                        {isFetching ? (
                            <ActivityIndicator size="large" color={theme.components.button.primary.bg} style={{ marginTop: 24 }} />
                        ) : (
                            (mode === 'edit' || mode === 'create') ? (
                                <>
                                    {renderEditContent()}
                                    <View style={styles.footer}>
                                        <View style={{ width: '100%', maxWidth: 200, alignSelf: 'center' }}>
                                            <Button
                                                label={mode === 'create' ? (t('create') || 'Crear') : t('save')}
                                                variant="primary"
                                                onPress={handleSubmit(onSubmit)}
                                                loading={updatePlayer.isPending || createPlayer.isPending || isUploading}
                                                style={{ width: '100%' }}
                                            />
                                        </View>
                                    </View>
                                </>
                            ) : renderViewContent()
                        )}
                    </ScrollView>


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
                title="Sin plan de pago"
                message="Asignale un Plan de Pago para poder programar clases."
                showCancel
                cancelText="Volver"
                buttonText="Continuar"
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
                title="Anular suscripción"
                message={`¿Estás seguro de que deseas anular el plan "${confirmation.planName}" para este alumno?`}
                onClose={() => setConfirmation({ ...confirmation, visible: false })}
                onConfirm={handleConfirmCancel}
                buttonText="Anular"
                showCancel
                cancelText="Cancelar"
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
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: theme.components.badge.primary,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: spacing.md,
        }}>
            <Ionicons name={icon} size={20} color={theme.text.primary} />
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

const createStyles = (theme: Theme): any => StyleSheet.create({
    modalOverlay: {
        ...commonStyles.modal.overlay,
    },
    modalContainer: {
        ...commonStyles.modal.content,
        backgroundColor: theme.background.surface,
        borderWidth: 1,
        borderColor: theme.border.subtle,
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
    },
    formWrapper: {
        width: '100%',
    },
    footer: {
        padding: spacing.md,
        borderTopWidth: 1,
        borderTopColor: theme.border.subtle,
    },
    // View Styles
    header: {
        alignItems: 'center',
        marginTop: spacing.sm,
    },
    name: {
        ...typography.variants.h2,
        color: theme.text.primary,
        marginTop: spacing.md,
    },
    badgeContainer: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.sm,
    },
    badge: {
        backgroundColor: theme.components.badge.primary,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: 20,
    },
    archivedBadge: {
        backgroundColor: theme.background.subtle,
    },
    badgeText: {
        ...typography.variants.label,
        color: theme.components.button.primary.bg,
    },
    archivedBadgeText: {
        ...typography.variants.label,
        color: theme.text.secondary,
    },
    tabContainer: {
        flexDirection: 'row',
        marginBottom: spacing.md,
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
        marginBottom: spacing.md,
    },
    notesCard: {
        marginBottom: spacing.md,
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
        justifyContent: 'center',
        paddingVertical: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: theme.border.subtle,
        gap: spacing.xs,
    },
    historyLinkText: {
        ...typography.variants.label,
        color: theme.components.button.primary.bg,
    },
    // Edit Styles
    avatarContainer: {
        alignItems: 'center',
    },
    avatarHint: {
        marginTop: spacing.xs,
        fontSize: typography.size.xs,
        color: theme.text.tertiary,
    },
    selectorContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
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
        marginBottom: spacing.md,
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
        color: theme.components.button.primary.bg,
        ...typography.variants.label,
    },
    subscriptionsList: {
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    subscriptionInfo: {
        backgroundColor: theme.components.badge.primary,
        padding: spacing.md,
        borderRadius: 12,
    },
    planHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
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
        color: theme.text.secondary,
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
        color: theme.components.button.primary.bg,
        fontWeight: '600',
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
});
