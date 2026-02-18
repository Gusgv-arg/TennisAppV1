import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ActionSheetIOS, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LocationPicker } from '@/src/components/LocationPicker';

import { Avatar } from '@/src/design/components/Avatar';
import { Button } from '@/src/design/components/Button';
import { Input } from '@/src/design/components/Input';
import { Theme } from '@/src/design/theme';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useProfile, useProfileMutations } from '@/src/features/profile/hooks/useProfile';
import { useAvatarUpload } from '@/src/hooks/useAvatarUpload';
import { useImagePicker } from '@/src/hooks/useImagePicker';
import { useTheme } from '@/src/hooks/useTheme';
import { showError, showSuccess } from '@/src/utils/toast';

interface FormData {
    full_name: string;
    phone: string;
    country_code: string;        // ISO code for country
    state_code: string;          // ISO code for state
    city_name: string;           // City name
    postal_code: string;
    bio: string;
}

export default function EditProfileScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    const { data: profile, isLoading: isFetching } = useProfile();
    const { updateProfile } = useProfileMutations();

    const [avatarUri, setAvatarUri] = useState<string | null>(null);

    const { pickImageFromCamera, pickImageFromGallery } = useImagePicker();
    const { uploadAvatar, isUploading } = useAvatarUpload();

    const { control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
        defaultValues: {
            full_name: '',
            phone: '',
            country_code: '',
            state_code: '',
            city_name: '',
            postal_code: '',
            bio: '',
        },
    });

    // Watch geographic fields for LocationPicker
    const countryCode = watch('country_code');
    const stateCode = watch('state_code');
    const cityName = watch('city_name');

    useEffect(() => {
        if (profile) {
            reset({
                full_name: profile.full_name || '',
                phone: profile.phone || '',
                country_code: profile.country || '',
                state_code: profile.state_province || '',
                city_name: profile.city || '',
                postal_code: profile.postal_code || '',
                bio: profile.bio || '',
            });
            if (profile.avatar_url) {
                setAvatarUri(profile.avatar_url);
            }
        }
    }, [profile, reset]);

    const handleAvatarPress = async () => {
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
        try {
            const payload = {
                full_name: data.full_name,
                phone: data.phone || null,
                country: data.country_code || null,
                state_province: data.state_code || null,
                city: data.city_name || null,
                postal_code: data.postal_code || null,
                bio: data.bio || null,
            };

            // Upload avatar if it's a new local file (not already a URL)
            let avatar_url = profile?.avatar_url || null;
            if (avatarUri && !avatarUri.startsWith('http') && profile?.id) {
                try {
                    const uploadedUrl = await uploadAvatar(avatarUri, profile.id);
                    if (uploadedUrl) {
                        avatar_url = uploadedUrl;
                    }
                } catch (uploadErr: any) {
                    showError(t('warning'), t('avatarUploadFailed'));
                }
            }

            await updateProfile.mutateAsync({ ...payload, avatar_url });

            router.back();
            setTimeout(() => {
                showSuccess(t('editProfile'), t('profileUpdated'));
            }, 100);
        } catch (error: any) {
            showError(t('saveError'), error.message || t('errorOccurred'));
        }
    };

    const onInvalid = () => {
        showError('Error', t('checkFormErrors') || 'Por favor revisa los campos requeridos');
    };



    const styles = React.useMemo(() => createStyles(theme), [theme]);

    if (isFetching) {
        return (
            <View style={styles.loadingContainer}>
                <Text>{t('loading')}</Text>
            </View>
        );
    }



    return (
        <View style={styles.container}>
            {/* Custom Header */}
            <View style={[styles.headerContainer, {
                paddingTop: insets.top + 8,
                paddingBottom: 4,
            }]}>
                <View style={styles.headerLeft} />
                <View style={[styles.headerTitleWrapper, { minHeight: 78 }]}>
                    <View style={styles.headerTitleRow}>
                        <Ionicons name="person-circle" size={30} color={theme.components.button.primary.bg} style={{ marginRight: spacing.sm }} />
                        <Text style={styles.headerTitleText}>Mi Perfil</Text>
                    </View>
                </View>
                <View style={styles.headerRight}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={styles.closeButton}
                    >
                        <Ionicons name="close" size={28} color={theme.text.primary} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.formContainer}>
                    <View style={styles.avatarContainer}>
                        <Avatar
                            source={avatarUri}
                            name={profile?.full_name}
                            size="xl"
                            editable
                            onPress={handleAvatarPress}
                        />
                        <Text style={styles.avatarHint}>{t('changeAvatar')}</Text>
                    </View>

                    <Controller
                        control={control}
                        name="full_name"
                        rules={{ required: t('fieldRequired') }}
                        render={({ field: { onChange, onBlur, value } }) => (
                            <Input
                                label={t('fullName')}
                                size="sm"
                                onBlur={onBlur}
                                onChangeText={onChange}
                                value={value}
                                error={errors.full_name?.message}
                                placeholder={t('fullNamePlaceholder')}
                            />
                        )}
                    />

                    <Controller
                        control={control}
                        name="phone"
                        render={({ field: { onChange, onBlur, value } }) => (
                            <Input
                                label={t('phone')}
                                size="sm"
                                onBlur={onBlur}
                                onChangeText={onChange}
                                value={value}
                                keyboardType="phone-pad"
                                placeholder="+54 11 ..."
                            />
                        )}
                    />

                    <Text style={styles.sectionTitle}>{t('personalInfo')}</Text>

                    <LocationPicker
                        countryCode={countryCode}
                        stateCode={stateCode}
                        cityName={cityName}
                        onCountryChange={(code) => setValue('country_code', code)}
                        onStateChange={(code) => setValue('state_code', code)}
                        onCityChange={(name) => setValue('city_name', name)}
                    />

                    <Controller
                        control={control}
                        name="postal_code"
                        render={({ field: { onChange, onBlur, value } }) => (
                            <Input
                                label={t('postalCode')}
                                size="sm"
                                onBlur={onBlur}
                                onChangeText={onChange}
                                value={value}
                                placeholder="7600"
                            />
                        )}
                    />

                    <Text style={styles.sectionTitle}>{t('aboutMe')}</Text>

                    <Controller
                        control={control}
                        name="bio"
                        render={({ field: { onChange, onBlur, value } }) => (
                            <Input
                                label={t('bio')}
                                onBlur={onBlur}
                                onChangeText={onChange}
                                value={value}
                                multiline
                                numberOfLines={4}
                                inputStyle={styles.textArea}
                                placeholder={t('bioPlaceholder')}
                            />
                        )}
                    />

                    <View style={styles.footer}>
                        <Button
                            label={t('save')}
                            variant="primary"
                            onPress={handleSubmit(onSubmit, onInvalid)}
                            loading={updateProfile.isPending || isUploading}
                            style={styles.footerButton}
                        />
                    </View>
                </View>
            </ScrollView>


        </View>
    );
}

const createStyles = (theme: Theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background.default,
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
        color: theme.text.tertiary,
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
        fontWeight: '700',
        color: theme.text.secondary,
        marginBottom: spacing.xs,
        marginTop: spacing.sm,
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
        maxWidth: 200, // Slightly larger single button
    },
    formContainer: {
        width: '100%',
        maxWidth: 500,
        alignSelf: 'center',
    },
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme.background.surface,
        borderBottomWidth: 1,
        borderColor: theme.border.subtle,
        paddingHorizontal: spacing.md,
    },
    headerLeft: {
        width: 40,
        alignItems: 'flex-start',
    },
    headerRight: {
        width: 40,
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    headerTitleWrapper: {
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitleText: {
        fontSize: typography.size.lg,
        fontWeight: '700',
        color: theme.text.primary,
    },
    closeButton: {
        padding: 4,
    },
});
