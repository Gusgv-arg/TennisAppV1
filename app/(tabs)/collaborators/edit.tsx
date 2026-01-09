import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import StatusModal, { StatusType } from '@/src/components/StatusModal';
import { Avatar } from '@/src/design/components/Avatar';
import { Button } from '@/src/design/components/Button';
import { Input } from '@/src/design/components/Input';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useCollaboratorMutations } from '@/src/features/collaborators/hooks/useCollaboratorMutations';
import { useCollaborator } from '@/src/features/collaborators/hooks/useCollaborators';
import { UpdateCollaboratorInput } from '@/src/types/collaborator';

interface FormData {
    full_name: string;
    email: string;
    phone: string;
    notes: string;
}

export default function EditCollaboratorScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { data: collaborator, isLoading } = useCollaborator(id!);
    const { updateCollaborator } = useCollaboratorMutations();

    const [modalVisible, setModalVisible] = useState(false);
    const [modalConfig, setModalConfig] = useState<{ type: StatusType; title: string; message: string }>({
        type: 'success',
        title: '',
        message: '',
    });

    const { control, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
        defaultValues: {
            full_name: '',
            email: '',
            phone: '',
            notes: '',
        },
    });

    useEffect(() => {
        if (collaborator) {
            reset({
                full_name: collaborator.full_name,
                email: collaborator.email || '',
                phone: collaborator.phone || '',
                notes: collaborator.notes || '',
            });
        }
    }, [collaborator, reset]);

    const onSubmit = async (data: FormData) => {
        try {
            const input: UpdateCollaboratorInput = {
                full_name: data.full_name,
                email: data.email || undefined,
                phone: data.phone || undefined,
                notes: data.notes || undefined,
            };

            await updateCollaborator.mutateAsync({ id: id!, input });

            setModalConfig({
                type: 'success',
                title: t('success'),
                message: t('collaboratorUpdated'),
            });
            setModalVisible(true);
        } catch (error: any) {
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

    if (isLoading || !collaborator) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary[500]} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    title: t('editCollaborator'),
                    headerTitleAlign: 'center',
                }}
            />
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.avatarSection}>
                    <Avatar name={collaborator.full_name} size="xl" />
                </View>

                <View style={{ marginTop: spacing.md }}>
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
                        loading={updateCollaborator.isPending}
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
    loadingText: {
        fontSize: typography.size.md,
        color: colors.neutral[500],
    },
    scrollContent: {
        padding: spacing.md,
        paddingTop: spacing.xs,
    },
    avatarSection: {
        alignItems: 'center',
        marginBottom: spacing.lg,
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
