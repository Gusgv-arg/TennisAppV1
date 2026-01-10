import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ActionSheetIOS, Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import StatusModal from '@/src/components/StatusModal';
import { Avatar } from '@/src/design/components/Avatar';
import { Button } from '@/src/design/components/Button';
import { Input } from '@/src/design/components/Input';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useCollaboratorMutations } from '@/src/features/collaborators/hooks/useCollaboratorMutations';
import { useAvatarUpload } from '@/src/hooks/useAvatarUpload';
import { useImagePicker } from '@/src/hooks/useImagePicker';
import { CreateCollaboratorInput } from '@/src/types/collaborator';

interface FormData {
    full_name: string;
    email: string;
    phone: string;
    notes: string;
}

export default function NewCollaboratorScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const { createCollaborator, updateCollaborator } = useCollaboratorMutations();
    const [modalVisible, setModalVisible] = useState(false);
    const [modalConfig, setModalConfig] = useState<{ type: 'success' | 'error'; title: string; message: string }>({
        type: 'success',
        title: '',
        message: '',
    });
    const [avatarUri, setAvatarUri] = useState<string | null>(null);

    const { pickImageFromCamera, pickImageFromGallery } = useImagePicker();
    const { uploadAvatar, isUploading } = useAvatarUpload();

    const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
        defaultValues: {
            full_name: '',
            email: '',
            phone: '',
            notes: '',
        },
    });

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
            const input: CreateCollaboratorInput = {
                full_name: data.full_name,
                email: data.email || undefined,
                phone: data.phone || undefined,
                notes: data.notes || undefined,
            };

            const newCollaborator = await createCollaborator.mutateAsync(input);

            // Upload avatar if selected
            if (avatarUri && newCollaborator?.id) {
                const avatarUrl = await uploadAvatar(avatarUri, newCollaborator.id);
                if (avatarUrl) {
                    await updateCollaborator.mutateAsync({ id: newCollaborator.id, input: { avatar_url: avatarUrl } });
                }
            }

            setModalConfig({
                type: 'success',
                title: t('success'),
                message: t('collaboratorCreated'),
            });
            setModalVisible(true);
        } catch (error) {
            setModalConfig({
                type: 'error',
                title: 'Error',
                message: t('saveError'),
            });
            setModalVisible(true);
        }
    };

    const handleModalClose = () => {
        setModalVisible(false);
        if (modalConfig.type === 'success') {
            router.replace('/collaborators' as any);
        }
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{
                title: t('newCollaborator'),
                headerTitleAlign: 'center',
                headerLeft: () => (
                    <Ionicons
                        name="arrow-back"
                        size={24}
                        color={colors.neutral[700]}
                        onPress={() => router.back()}
                        style={{ marginLeft: spacing.sm }}
                    />
                ),
            }} />
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.avatarContainer}>
                    <Avatar
                        source={avatarUri}
                        size="xl"
                        editable
                        onPress={handleAvatarPress}
                    />
                    <Text style={styles.avatarHint}>Toca para agregar foto</Text>
                </View>

                <View style={{ marginTop: spacing.sm }}>
                    <Controller
                        control={control}
                        name="full_name"
                        rules={{ required: true }}
                        render={({ field: { onChange, value } }) => (
                            <Input
                                label={t('fullName')}
                                onChangeText={onChange}
                                value={value}
                                placeholder={t('fullNamePlaceholder')}
                                error={errors.full_name ? t('fieldRequired') : undefined}
                            />
                        )}
                    />
                </View>

                <View style={styles.row}>
                    <View style={styles.halfWidth}>
                        <Controller
                            control={control}
                            name="email"
                            render={({ field: { onChange, value } }) => (
                                <Input
                                    label={t('email')}
                                    onChangeText={onChange}
                                    value={value}
                                    placeholder="ejemplo@email.com"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                            )}
                        />
                    </View>
                    <View style={styles.halfWidth}>
                        <Controller
                            control={control}
                            name="phone"
                            render={({ field: { onChange, value } }) => (
                                <Input
                                    label={t('phone')}
                                    onChangeText={onChange}
                                    value={value}
                                    placeholder="+54 11 ..."
                                    keyboardType="phone-pad"
                                />
                            )}
                        />
                    </View>
                </View>

                <View style={{ marginTop: spacing.md }}>
                    <Controller
                        control={control}
                        name="notes"
                        render={({ field: { onChange, value } }) => (
                            <Input
                                label={t('notes')}
                                onChangeText={onChange}
                                value={value}
                                placeholder={t('notesPlaceholder')}
                                multiline
                                numberOfLines={4}
                                inputStyle={styles.textArea}
                            />
                        )}
                    />
                </View>

                <View style={styles.footer}>
                    <Button
                        label={t('cancel')}
                        variant="outline"
                        leftIcon={<Ionicons name="close-outline" size={20} color={colors.primary[500]} />}
                        onPress={() => router.replace('/collaborators' as any)}
                        style={styles.footerButton}
                    />
                    <Button
                        label={t('save')}
                        variant="primary"
                        leftIcon={<Ionicons name="checkmark-sharp" size={20} color={colors.common.white} />}
                        onPress={handleSubmit(onSubmit)}
                        loading={createCollaborator.isPending}
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
        marginTop: spacing.md,
    },
    halfWidth: {
        flex: 1,
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
