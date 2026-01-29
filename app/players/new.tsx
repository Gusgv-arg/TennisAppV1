import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ActionSheetIOS, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as z from 'zod';

import StatusModal, { StatusType } from '@/src/components/StatusModal';
import { Avatar } from '@/src/design/components/Avatar';
import { Button } from '@/src/design/components/Button';
import { Card } from '@/src/design/components/Card';
import { Input } from '@/src/design/components/Input';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useCurrentAcademy, useUserAcademies } from '@/src/features/academy/hooks/useAcademy';
import SelectPlanModal from '@/src/features/payments/components/SelectPlanModal';
import { usePaymentSettings } from '@/src/features/payments/hooks/usePaymentSettings';
import { useSubscriptions } from '@/src/features/payments/hooks/useSubscriptions';
import { usePlayerMutations } from '@/src/features/players/hooks/usePlayerMutations';
import { useAvatarUpload } from '@/src/hooks/useAvatarUpload';
import { useImagePicker } from '@/src/hooks/useImagePicker';
import { useAuthStore } from '@/src/store/useAuthStore';
import { PricingPlan } from '@/src/types/payments';
import { DominantHand, PlayerLevel } from '@/src/types/player';

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

interface SelectedPlanItem {
    id: string; // temporary id for UI list
    plan: PricingPlan;
    customAmount: number;
    notes?: string;
}

export default function NewPlayerScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const { createPlayer, updatePlayer } = usePlayerMutations();
    const { profile } = useAuthStore();


    // Academy Context
    const { data: academiesData } = useUserAcademies();
    const { data: currentAcademy } = useCurrentAcademy();
    const academies = academiesData?.active || [];
    const hasMultipleAcademies = academies.length > 1;


    const [modalVisible, setModalVisible] = useState(false);
    const [modalConfig, setModalConfig] = useState({
        type: 'success' as StatusType,
        title: '',
        message: '' as string | React.ReactNode,
    });
    const [avatarUri, setAvatarUri] = useState<string | null>(null);

    const { pickImageFromCamera, pickImageFromGallery } = useImagePicker();
    const { uploadAvatar, isUploading } = useAvatarUpload();

    // Payment Plans
    const { assignPlan } = useSubscriptions();
    const { isEnabled: paymentsEnabled } = usePaymentSettings();
    const [selectedPlans, setSelectedPlans] = useState<SelectedPlanItem[]>([]);
    const [selectPlanVisible, setSelectPlanVisible] = useState(false);

    const handleAddPlan = (plan: PricingPlan, customAmount: number, notes?: string) => {
        setSelectedPlans(prev => [
            ...prev,
            {
                id: Math.random().toString(36).substr(2, 9),
                plan,
                customAmount,
                notes
            }
        ]);
        setSelectPlanVisible(false);
    };

    const handleRemovePlan = (itemId: string) => {
        setSelectedPlans(prev => prev.filter(p => p.id !== itemId));
    };

    const { control, handleSubmit, setError, clearErrors, trigger, formState: { errors } } = useForm<FormData>({
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

    const validateField = (name: keyof FormData, value: any) => {
        // @ts-ignore - Dynamic key picking is safe here
        const fieldSchema = schema.pick({ [name]: true });
        const result = fieldSchema.safeParse({ [name]: value });
        if (!result.success) {
            setError(name, { type: 'manual', message: (result as any).error.issues[0].message });
        } else {
            clearErrors(name);
        }
    };

    const handleAvatarPress = async () => {
        // On web, camera is not available, so just open gallery
        if (Platform.OS === 'web') {
            const uri = await pickImageFromGallery();
            if (uri) setAvatarUri(uri);
            return;
        }

        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: ['Cancelar', 'Tomar foto', 'Elegir de galería'],
                    cancelButtonIndex: 0,
                },
                async (buttonIndex) => {
                    if (buttonIndex === 1) {
                        const uri = await pickImageFromCamera();
                        if (uri) setAvatarUri(uri);
                    } else if (buttonIndex === 2) {
                        const uri = await pickImageFromGallery();
                        if (uri) setAvatarUri(uri);
                    }
                }
            );
        } else {
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
        }
    };

    const onSubmit = async (data: FormData) => {
        // Manual Validation
        const result = schema.safeParse(data);
        if (!result.success) {
            result.error.issues.forEach((issue) => {
                const path = issue.path[0] as keyof FormData;
                setError(path, { type: 'manual', message: issue.message });
            });
            return;
        }

        try {
            // Combine date parts into YYYY-MM-DD
            let birth_date = null;
            if (data.birth_month && data.birth_day) {
                const day = data.birth_day.padStart(2, '0');
                const month = data.birth_month.padStart(2, '0');

                if (data.birth_year) {
                    // Full date validation
                    const year = data.birth_year.padStart(4, '0');
                    const d = parseInt(day);
                    const m = parseInt(month);
                    const y = parseInt(year);
                    const date = new Date(y, m - 1, d);
                    const isValid = date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;

                    if (!isValid) {
                        setError('birth_day', { type: 'manual', message: 'invalidDate' });
                        return;
                    }
                    birth_date = `${year}-${month}-${day}`;
                } else {
                    // Day and Month only - use placeholder year 1900
                    birth_date = `1900-${month}-${day}`;
                }
            }

            // Cleanup empty strings to null
            const payload = {
                ...data,
                birth_date,
                contact_email: data.contact_email || null,
                contact_phone: data.contact_phone || null,
                notes: data.notes || null,
            };

            // Remove date parts from payload
            delete (payload as any).birth_day;
            delete (payload as any).birth_month;
            delete (payload as any).birth_year;

            // Create player first to get ID
            const newPlayer = await createPlayer.mutateAsync(payload as any);

            // Assign plans
            if (newPlayer?.id && selectedPlans.length > 0) {
                // Execute sequentially to avoid race conditions or overload
                for (const item of selectedPlans) {
                    await assignPlan({
                        playerId: newPlayer.id,
                        planId: item.plan.id,
                        customAmount: item.customAmount,
                        notes: item.notes
                    });
                }
            }

            // Upload avatar if selected
            if (avatarUri && newPlayer?.id) {
                const avatarUrl = await uploadAvatar(avatarUri, newPlayer.id);
                if (avatarUrl) {
                    // Update player with avatar URL
                    await updatePlayer.mutateAsync({ id: newPlayer.id, input: { avatar_url: avatarUrl } });
                }
            }

            // Construct success message
            let messageContent: string | React.ReactNode = t('playerCreated');

            if (selectedPlans.length === 0) {
                messageContent = (
                    <View style={{ alignItems: 'center', width: '100%', marginBottom: 24 }}>
                        <Text style={styles.messageText}>
                            {t('playerCreated')}
                        </Text>
                        <View style={styles.modalWarningContainer}>
                            <Ionicons name="alert-circle" size={20} color={colors.warning[600]} style={{ marginRight: 8 }} />
                            <Text style={styles.modalWarningText}>
                                Advertencia: Si no le asigna un plan al alumno, no se podrán agendar clases.
                            </Text>
                        </View>
                    </View>
                );
            }

            setModalConfig({
                type: 'success',
                title: t('newPlayer'),
                message: messageContent,
            });
            setModalVisible(true);
        } catch (error: any) {
            setModalConfig({
                type: 'error',
                title: t('saveError'),
                message: error.message || t('errorOccurred'),
            });
            setModalVisible(true);
        }
    };

    const handleModalClose = () => {
        setModalVisible(false);
        if (modalConfig.type === 'success') {
            router.replace('/(tabs)/players');
        }
    };

    const levels: PlayerLevel[] = ['beginner', 'intermediate', 'advanced', 'professional'];
    const hands: DominantHand[] = ['left', 'right', 'ambidextrous'];

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: t('newPlayer'),
                    headerTitleAlign: 'center',
                    headerRight: () => (
                        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
                            <Ionicons name="close" size={24} color={colors.neutral[900]} />
                        </TouchableOpacity>
                    ),
                    headerLeft: () => null,
                    headerBackVisible: false, // Ensure default back button is hidden
                }}
            />
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.formWrapper}>
                    {/* Academy Context Badge (Read-only) - Only if multiple academies */}
                    {hasMultipleAcademies && currentAcademy && (
                        <View style={{ marginBottom: spacing.md, alignItems: 'flex-start' }}>
                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: colors.primary[50],
                                paddingHorizontal: spacing.md,
                                paddingVertical: spacing.xs,
                                borderRadius: 16,
                                borderWidth: 1,
                                borderColor: colors.primary[100],
                                gap: spacing.xs
                            }}>
                                <Ionicons name="business" size={14} color={colors.primary[700]} />
                                <Text style={{
                                    fontSize: 12,
                                    fontWeight: '600',
                                    color: colors.primary[700]
                                }}>
                                    {currentAcademy.name}
                                </Text>
                            </View>
                        </View>
                    )}

                    <View style={styles.avatarContainer}>
                        <Avatar
                            source={avatarUri}
                            size="xl"
                            editable
                            onPress={handleAvatarPress}
                        />
                        <Text style={styles.avatarHint}>Toca para agregar foto</Text>
                    </View>

                    <Controller
                        control={control}
                        name="full_name"
                        render={({ field: { onChange, onBlur, value } }) => (
                            <Input
                                label={t('fullName')}
                                size="sm"
                                onBlur={() => {
                                    onBlur();
                                    validateField('full_name', value);
                                }}
                                onChangeText={onChange}
                                value={value}
                                error={errors.full_name ? t(errors.full_name.message as string) : undefined}
                                placeholder="Ej. Juan Pérez"
                            />
                        )}
                    />

                    {/* Sección de Pagos y Suscripciones */}
                    {paymentsEnabled && (
                        <Card style={styles.paymentsCard} padding="md">
                            <View style={styles.planSectionHeader}>
                                <Text style={styles.cardTitle}>Planes</Text>
                                {selectedPlans.length > 0 && (
                                    <TouchableOpacity onPress={() => setSelectPlanVisible(true)}>
                                        <Text style={styles.addPlanLink}>+ Agregar Plan</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {selectedPlans.length > 0 ? (
                                <View style={styles.subscriptionsList}>
                                    {selectedPlans.map((item) => (
                                        <View key={item.id} style={styles.subscriptionInfo}>
                                            <View style={styles.planHeaderRow}>
                                                <View style={styles.planStatus}>
                                                    <Ionicons name="checkmark-circle" size={20} color={colors.success[500]} />
                                                    <Text style={styles.planName}>{item.plan.name}</Text>
                                                </View>
                                                <TouchableOpacity
                                                    onPress={() => handleRemovePlan(item.id)}
                                                    style={styles.cancelButton}
                                                >
                                                    <Ionicons name="trash-outline" size={20} color={colors.error[500]} />
                                                </TouchableOpacity>
                                            </View>
                                            <Text style={styles.planDetails}>
                                                {item.plan.type === 'monthly' ? 'Plan Mensual' : `Promoción de ${item.plan.package_classes} clases`}
                                                {` • $${item.customAmount}`}
                                                {item.notes ? ` • ${item.notes}` : ''}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            ) : (
                                <View style={styles.emptyPlanContainer}>
                                    <View style={styles.emptyPlan}>
                                        <Text style={styles.emptyPlanText}>Sin planes asignados</Text>
                                        <Button
                                            label="Agregar Plan"
                                            variant="outline"
                                            size="sm"
                                            onPress={() => setSelectPlanVisible(true)}
                                            style={{ marginTop: 8 }}
                                        />
                                    </View>
                                    {/* Warning Message */}
                                    <View style={styles.warningContainer}>
                                        <Ionicons name="alert-circle" size={20} color={colors.warning[600]} />
                                        <Text style={styles.warningText}>
                                            Advertencia: Si no le asigna un plan al alumno, no se podrán agendar clases.
                                        </Text>
                                    </View>
                                </View>
                            )}
                        </Card>
                    )}

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
                                        onBlur={() => {
                                            onBlur();
                                            validateField('birth_day', value);
                                        }}
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
                                        onBlur={() => {
                                            onBlur();
                                            validateField('birth_month', value);
                                        }}
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
                                        onBlur={() => {
                                            onBlur();
                                            validateField('birth_year', value);
                                        }}
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
                                        onBlur={() => {
                                            onBlur();
                                            validateField('contact_email', value);
                                        }}
                                        onChangeText={onChange}
                                        value={value}
                                        error={errors.contact_email ? t(errors.contact_email.message as string) : undefined}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        placeholder="juan@email.com"
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
                                        onBlur={() => {
                                            onBlur();
                                            validateField('contact_phone', value);
                                        }}
                                        onChangeText={onChange}
                                        value={value}
                                        error={errors.contact_phone ? t(errors.contact_phone.message as string) : undefined}
                                        keyboardType="phone-pad"
                                        placeholder="+54 11 ..."
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
                                            style={[
                                                styles.selectorOption,
                                                value === lvl && styles.selectorOptionActive,
                                            ]}
                                            onPress={() => onChange(lvl)}
                                            accessibilityLabel={t(`level.${lvl}`)}
                                        >
                                            <Ionicons
                                                name={levelIcons[lvl]}
                                                size={20}
                                                color={value === lvl ? colors.common.white : colors.neutral[600]}
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
                                            style={[
                                                styles.selectorOption,
                                                value === hand && styles.selectorOptionActive,
                                            ]}
                                            onPress={() => onChange(hand)}
                                            accessibilityLabel={t(`hand.${hand}`)}
                                        >
                                            <Ionicons
                                                name={handIcons[hand]}
                                                size={20}
                                                color={value === hand ? colors.common.white : colors.neutral[600]}
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
                            />
                        )}
                    />

                    <View style={styles.footer}>
                        <View style={{ width: '100%', maxWidth: 200 }}>
                            <Button
                                label={t('save')}
                                variant="primary"
                                onPress={handleSubmit(onSubmit)}
                                loading={createPlayer.isPending || isUploading}
                                style={{ width: '100%' }}
                            />
                        </View>
                    </View>
                </View>
            </ScrollView>

            <SelectPlanModal
                visible={selectPlanVisible}
                onClose={() => setSelectPlanVisible(false)}
                onSelect={handleAddPlan}
            />

            <StatusModal
                visible={modalVisible}
                type={modalConfig.type}
                title={modalConfig.title}
                message={modalConfig.message}
                onClose={handleModalClose}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.common.white,
    },
    formWrapper: {
        flex: 1,
        width: '100%',
        alignSelf: 'center',
        maxWidth: Platform.OS === 'web' ? 800 : '100%',
    },
    scrollContent: {
        padding: spacing.md,
        paddingTop: spacing.xs,
    },
    avatarContainer: {
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    avatarHint: {
        marginTop: spacing.xs,
        fontSize: typography.size.xs,
        color: colors.neutral[400],
    },
    row: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    halfWidth: {
        flex: 1,
    },
    sectionTitle: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        color: colors.neutral[700],
        marginBottom: spacing.xs,
        marginTop: spacing.sm,
    },
    cardTitle: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        color: colors.neutral[500],
    },
    selectorContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    selectorOption: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.xs,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.neutral[200],
        backgroundColor: colors.neutral[50],
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 40,
        flex: 1,
    },
    selectorOptionActive: {
        borderColor: colors.primary[500],
        backgroundColor: colors.primary[500],
    },
    selectorText: {
        fontSize: typography.size.xs,
        color: colors.neutral[600],
        marginTop: 4,
        textAlign: 'center',
    },
    selectorTextActive: {
        color: colors.common.white,
        fontWeight: '700',
    },
    textArea: {
        minHeight: 100,
        textAlignVertical: 'top',
    },
    footer: {
        flexDirection: 'row',
        gap: spacing.md,
        marginTop: spacing.xl,
        marginBottom: spacing.xxl,
        justifyContent: 'center',
        paddingHorizontal: spacing.sm,
    },
    footerButton: {
        flex: 1,
        maxWidth: 160,
    },
    paymentsCard: {
        marginTop: spacing.md,
        backgroundColor: colors.common.white,
        marginBottom: spacing.sm,
    },
    planSectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    addPlanLink: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        color: colors.primary[500],
    },
    subscriptionsList: {
        gap: spacing.sm,
    },
    subscriptionInfo: {
        backgroundColor: colors.primary[50],
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
        fontSize: typography.size.sm,
        fontWeight: '700',
        color: colors.neutral[900],
    },
    planDetails: {
        fontSize: typography.size.xs,
        color: colors.neutral[600],
        marginLeft: 24,
    },
    cancelButton: {
        padding: spacing.xs,
    },
    emptyPlan: {
        padding: spacing.md,
        alignItems: 'center',
        backgroundColor: colors.neutral[50],
        borderRadius: 8,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: colors.neutral[300],
    },
    emptyPlanContainer: {
        gap: spacing.sm,
    },
    emptyPlanText: {
        fontSize: typography.size.xs,
        color: colors.neutral[500],
        textAlign: 'center',
    },
    warningContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.warning[50],
        padding: spacing.sm,
        borderRadius: 8,
        gap: spacing.xs,
        borderWidth: 1,
        borderColor: colors.warning[200],
    },
    warningText: {
        flex: 1,
        fontSize: typography.size.xs,
        color: colors.warning[800],
        fontWeight: '500',
    },
    messageText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 22,
    },
    modalWarningContainer: {
        flexDirection: 'row',
        backgroundColor: colors.warning[50],
        padding: spacing.md,
        borderRadius: 12,
        alignItems: 'center',
        width: '100%',
        borderWidth: 1,
        borderColor: colors.warning[200],
    },
    modalWarningText: {
        color: colors.warning[800],
        fontSize: 14,
        flex: 1,
        lineHeight: 20,
    },
});
