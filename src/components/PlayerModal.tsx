import { Ionicons } from '@expo/vector-icons';
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

import StatusModal, { StatusType } from '@/src/components/StatusModal';
import { Avatar } from '@/src/design/components/Avatar';
import { Button } from '@/src/design/components/Button';
import { Card } from '@/src/design/components/Card';
import { Input } from '@/src/design/components/Input';
import { Theme } from '@/src/design/theme';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useCurrentAcademy, useUserAcademies } from '@/src/features/academy/hooks/useAcademy';
import AssignPlanModal from '@/src/features/payments/components/AssignPlanModal';
import UnifiedPaymentSection from '@/src/features/payments/components/UnifiedPaymentSection';
import { usePaymentSettings } from '@/src/features/payments/hooks/usePaymentSettings';
import { useSubscriptions } from '@/src/features/payments/hooks/useSubscriptions';
import { usePlayerMutations } from '@/src/features/players/hooks/usePlayerMutations';
import { usePlayer } from '@/src/features/players/hooks/usePlayers';
import { useAvatarUpload } from '@/src/hooks/useAvatarUpload';
import { useImagePicker } from '@/src/hooks/useImagePicker';
import { useTheme } from '@/src/hooks/useTheme';
import { DominantHand, PlayerLevel } from '@/src/types/player';
import { useRouter } from 'expo-router';

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
}

export default function PlayerModal({ visible, onClose, playerId, mode }: PlayerModalProps) {
    const { t } = useTranslation();
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const isDesktop = windowWidth >= 768;
    const router = useRouter();
    const { theme } = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

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
    const [modalVisible, setModalVisible] = useState(false); // For StatusModal (success/error)
    const [modalConfig, setModalConfig] = useState({
        type: 'success' as StatusType,
        title: '',
        message: '',
    });
    const [avatarUri, setAvatarUri] = useState<string | null>(null);
    const [createdPlayerId, setCreatedPlayerId] = useState<string | null>(null);

    // Hooks
    const { pickImageFromCamera, pickImageFromGallery } = useImagePicker();
    const { uploadAvatar, isUploading } = useAvatarUpload();
    const { data: currentAcademy } = useCurrentAcademy();
    const { data: academiesData } = useUserAcademies();
    const academies = academiesData?.active || [];
    const hasMultipleAcademies = academies.length > 1;

    // Form
    const { control, handleSubmit, reset, setError, clearErrors, formState: { errors } } = useForm<FormData>({
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
            setTimeout(() => {
                setModalConfig({
                    type: 'error',
                    title: t('saveError'),
                    message: error.message || 'No se pudo anular la suscripción',
                });
                setModalVisible(true);
            }, 300);
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

                setModalConfig({
                    type: 'success',
                    title: t('createPlayer') || 'Nuevo Alumno',
                    message: t('playerCreated') || 'Alumno creado correctamente',
                });
                setModalVisible(true);
            } else {
                let avatar_url = player?.avatar_url || null;
                if (avatarUri && !avatarUri.startsWith('http')) {
                    const uploadedUrl = await uploadAvatar(avatarUri, playerId!);
                    if (uploadedUrl) avatar_url = uploadedUrl;
                }

                await updatePlayer.mutateAsync({ id: playerId!, input: { ...payload, avatar_url } as any });

                setModalConfig({
                    type: 'success',
                    title: t('editPlayer'),
                    message: t('playerUpdated'),
                });
                setModalVisible(true);
            }
        } catch (error: any) {
            setModalConfig({
                type: 'error',
                title: t('saveError'),
                message: error.message || t('errorOccurred'),
            });
            setModalVisible(true);
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
                        <Text style={styles.sectionTitle}>{t('notes')}</Text>
                        <Text style={styles.notesText}>{player.notes}</Text>
                    </Card>
                )}

                {paymentsEnabled && (
                    <Card style={styles.paymentsCard} padding="md">
                        <View style={styles.planSectionHeader}>
                            <Text style={styles.sectionTitle}>Suscripciones</Text>
                        </View>

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
                                            {sub.plan?.type === 'monthly' ? 'Plan Mensual' : `Promoción de ${sub.plan?.package_classes} clases`}
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
                            <Ionicons name="arrow-forward" size={16} color={theme.components.button.primary.bg} />
                        </TouchableOpacity>
                    </Card>
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
                        <Text style={{ fontSize: 12, fontWeight: '600', color: theme.components.button.primary.bg }}>
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
                <Text style={styles.avatarHint}>Toca para cambiar foto</Text>
            </View>

            <Controller
                control={control}
                name="full_name"
                render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                        label={t('fullName')}
                        size="sm"
                        onBlur={() => { onBlur(); validateField('full_name', value); }}
                        onChangeText={onChange}
                        value={value}
                        error={errors.full_name ? t(errors.full_name.message as string) : undefined}
                        placeholder="Ej. Juan Pérez"
                    />
                )}
            />

            <Text style={[styles.sectionTitle, { marginTop: spacing.xs }]}>{t('birthDate')}</Text>
            <View style={[styles.row, { marginBottom: spacing.sm }]}>
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
            </View>

            <View style={styles.row}>
                <View style={styles.halfWidth}>
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
                <View style={styles.halfWidth}>
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
            </View>

            <Text style={styles.sectionTitle}>{t('level')}</Text>
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

            <Text style={styles.sectionTitle}>{t('dominantHand')}</Text>
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

            {paymentsEnabled && mode === 'edit' && (
                <>
                    <Card style={styles.paymentsCard} padding="md">
                        <View style={styles.planSectionHeader}>
                            <View style={styles.titleRow}>
                                <Ionicons name="card" size={18} color={theme.components.button.primary.bg} />
                                <Text style={styles.sectionTitle}>Suscripciones</Text>
                            </View>
                            <TouchableOpacity onPress={() => setAssignPlanVisible(true)}>
                                <Text style={styles.addPlanLink}>+ Asignar</Text>
                            </TouchableOpacity>
                        </View>

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
                                            {sub.plan?.type === 'monthly' ? 'Plan Mensual' : `Promoción de ${sub.plan?.package_classes} clases`}
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
                        player={player!}
                        playerId={playerId!}
                    />
                </>
            )}

            <Controller
                control={control}
                name="notes"
                render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                        label={t('notes')}
                        onBlur={onBlur}
                        onChangeText={onChange}
                        value={value}
                        multiline
                        numberOfLines={4}
                        inputStyle={styles.textArea}
                        placeholder={t('notesPlaceholder')}
                        containerStyle={{ marginTop: spacing.md }}
                    />
                )}
            />
        </View>
    );

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={[
                    styles.modalContainer,
                    isDesktop && { width: 500, maxHeight: windowHeight * 0.9, borderRadius: 12, overflow: 'hidden' }
                ]}>
                    <View style={styles.headerRow}>
                        <Text style={styles.headerTitle}>
                            {mode === 'edit' ? t('editPlayer') : mode === 'create' ? (t('createPlayer') || 'Nuevo Alumno') : t('playerDetails')}
                        </Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={theme.text.secondary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                    >
                        {isLoading ? (
                            <ActivityIndicator size="large" color={theme.components.button.primary.bg} style={{ marginTop: 24 }} />
                        ) : (
                            (mode === 'edit' || mode === 'create') ? (
                                <>
                                    {renderEditContent()}
                                    <View style={[styles.footer, { borderTopWidth: 0 }]}>
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
            <StatusModal
                visible={modalVisible}
                type={modalConfig.type}
                title={modalConfig.title}
                message={modalConfig.message}
                onClose={() => {
                    setModalVisible(false);
                    if (modalConfig.type === 'success') {
                        onClose();
                        if (mode === 'create' && createdPlayerId) {
                            router.setParams({ viewPlayerId: createdPlayerId });
                        }
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
            <Ionicons name={icon} size={20} color={theme.components.button.primary.bg} />
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

const createStyles = (theme: Theme) => StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        width: '100%',
        height: '100%', // Full screen on mobile
        backgroundColor: theme.background.modal,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: theme.border.subtle,
    },
    headerTitle: {
        fontSize: typography.size.lg,
        fontWeight: '700',
        color: theme.text.primary,
    },
    closeButton: {
        padding: 4,
    },
    scrollContent: {
        padding: spacing.md,
        paddingBottom: spacing.xxl,
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
        marginBottom: spacing.lg,
        marginTop: spacing.sm,
    },
    name: {
        fontSize: typography.size.xl,
        fontWeight: '700',
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
        color: theme.components.button.primary.bg,
        fontSize: typography.size.sm,
        fontWeight: '600',
    },
    archivedBadgeText: {
        color: theme.text.secondary,
        fontSize: typography.size.sm,
        fontWeight: '600',
    },
    infoCard: {
        marginBottom: spacing.md,
    },
    notesCard: {
        marginBottom: spacing.md,
    },
    sectionTitle: {
        fontSize: typography.size.xs,
        fontWeight: '700',
        color: theme.text.secondary,
        marginBottom: spacing.xs,
        marginTop: spacing.sm,
    },
    notesText: {
        fontSize: typography.size.md,
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
        color: theme.components.button.primary.bg,
        fontSize: typography.size.sm,
        fontWeight: '600',
    },
    // Edit Styles
    avatarContainer: {
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    avatarHint: {
        marginTop: spacing.xs,
        fontSize: typography.size.xs,
        color: theme.text.tertiary,
    },
    row: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    halfWidth: {
        flex: 1,
    },
    selectorContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginBottom: spacing.sm,
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
    planSectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    addPlanLink: {
        color: theme.components.button.primary.bg,
        fontSize: typography.size.sm,
        fontWeight: '600',
    },
    subscriptionsList: {
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    subscriptionInfo: {
        backgroundColor: theme.components.badge.primary,
        padding: spacing.md,
        borderRadius: 12,
        marginBottom: spacing.sm,
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
        fontSize: typography.size.md,
        fontWeight: '700',
        color: theme.text.primary,
    },
    cancelButton: {
        padding: spacing.xs,
    },
    planDetails: {
        fontSize: typography.size.sm,
        color: theme.text.secondary,
    },
    planNotes: {
        fontSize: typography.size.xs,
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
        fontSize: typography.size.sm,
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
