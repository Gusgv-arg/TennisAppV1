import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ActionSheetIOS, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as z from 'zod';

import StatusModal, { StatusType } from '@/src/components/StatusModal';
import { Avatar } from '@/src/design/components/Avatar';
import { Button } from '@/src/design/components/Button';
import { Input } from '@/src/design/components/Input';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { usePlayerMutations } from '@/src/features/players/hooks/usePlayerMutations';
import { usePlayer } from '@/src/features/players/hooks/usePlayers';
import { useAvatarUpload } from '@/src/hooks/useAvatarUpload';
import { useImagePicker } from '@/src/hooks/useImagePicker';
import { useAuthStore } from '@/src/store/useAuthStore';
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

export default function EditPlayerScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { data: player, isLoading: isFetching } = usePlayer(id!);
    const { updatePlayer } = usePlayerMutations();
    const { profile } = useAuthStore();
    const isAdmin = profile?.role === 'admin';
    const [intendedRole, setIntendedRole] = useState<'coach' | 'collaborator' | 'player'>('player');

    const [modalVisible, setModalVisible] = useState(false);
    const [modalConfig, setModalConfig] = useState({
        type: 'success' as StatusType,
        title: '',
        message: '',
    });
    const [avatarUri, setAvatarUri] = useState<string | null>(null);

    const { pickImageFromCamera, pickImageFromGallery } = useImagePicker();
    const { uploadAvatar, isUploading } = useAvatarUpload();

    const { control, handleSubmit, reset, setError, clearErrors, trigger, formState: { errors } } = useForm<FormData>({
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

    useEffect(() => {
        if (player) {
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
            // Set initial avatar if exists
            if (player.avatar_url) {
                setAvatarUri(player.avatar_url);
            }
            // Set initial role
            setIntendedRole((player as any).intended_role || 'player');
        }
    }, [player, reset]);

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

            // Upload avatar if it's a new local file (not already a URL)
            let avatar_url = player?.avatar_url || null;
            if (avatarUri && !avatarUri.startsWith('http')) {
                const uploadedUrl = await uploadAvatar(avatarUri, id!);
                if (uploadedUrl) {
                    avatar_url = uploadedUrl;
                }
            }

            // Include intended_role if admin changed it
            const finalPayload = isAdmin
                ? { ...payload, avatar_url, intended_role: intendedRole }
                : { ...payload, avatar_url };

            await updatePlayer.mutateAsync({ id: id!, input: finalPayload as any });
            setModalConfig({
                type: 'success',
                title: t('editPlayer'),
                message: t('playerUpdated'),
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

    if (isFetching) {
        return (
            <View style={styles.loadingContainer}>
                <Text>{t('loading')}</Text>
            </View>
        );
    }

    const levels: PlayerLevel[] = ['beginner', 'intermediate', 'advanced', 'professional'];
    const hands: DominantHand[] = ['left', 'right', 'ambidextrous'];

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: t('editPlayer'),
                    headerTitleAlign: 'center',
                }}
            />
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.avatarContainer}>
                    <Avatar
                        source={avatarUri}
                        name={player?.full_name}
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

                {/* Role selector - Only for admins */}
                {isAdmin && (
                    <>
                        <Text style={styles.sectionTitle}>{t('role')}</Text>
                        <View style={styles.selectorContainer}>
                            {(['player', 'collaborator', 'coach'] as const).map((role) => (
                                <TouchableOpacity
                                    key={role}
                                    style={[
                                        styles.selectorOption,
                                        intendedRole === role && styles.selectorOptionActive,
                                    ]}
                                    onPress={() => setIntendedRole(role)}
                                    accessibilityLabel={t(`roles.${role}`)}
                                >
                                    <Ionicons
                                        name={role === 'coach' ? 'school-outline' : role === 'collaborator' ? 'people-outline' : 'person-outline'}
                                        size={20}
                                        color={intendedRole === role ? colors.common.white : colors.neutral[600]}
                                    />
                                    <Text style={[styles.selectorText, intendedRole === role && styles.selectorTextActive]}>
                                        {t(`roles.${role}`)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
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
                        />
                    )}
                />

                <View style={styles.footer}>
                    <Button
                        label={t('cancel')}
                        variant="outline"
                        onPress={() => router.replace('/(tabs)/players')}
                        disabled={updatePlayer.isPending || isUploading}
                        style={styles.footerButton}
                    />
                    <Button
                        label={t('save')}
                        variant="primary"
                        onPress={handleSubmit(onSubmit)}
                        loading={updatePlayer.isPending || isUploading}
                        style={styles.footerButton}
                    />
                </View>
            </ScrollView>

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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
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
        fontSize: typography.size.xs,
        fontWeight: '700',
        color: colors.neutral[500],
        marginBottom: spacing.xs,
        marginTop: spacing.sm,
        textTransform: 'uppercase',
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
        borderColor: colors.neutral[200],
        backgroundColor: colors.neutral[50],
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 48,
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
});
