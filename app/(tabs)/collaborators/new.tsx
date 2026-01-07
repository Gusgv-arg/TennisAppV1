import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import StatusModal from '@/src/components/StatusModal';
import { Button } from '@/src/design/components/Button';
import { Input } from '@/src/design/components/Input';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { useCollaboratorMutations } from '@/src/features/collaborators/hooks/useCollaboratorMutations';
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
    const { createCollaborator } = useCollaboratorMutations();
    const [modalVisible, setModalVisible] = useState(false);
    const [modalConfig, setModalConfig] = useState<{ type: 'success' | 'error'; title: string; message: string }>({
        type: 'success',
        title: '',
        message: '',
    });

    const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
        defaultValues: {
            full_name: '',
            email: '',
            phone: '',
            notes: '',
        },
    });

    const onSubmit = async (data: FormData) => {
        try {
            const input: CreateCollaboratorInput = {
                full_name: data.full_name,
                email: data.email || undefined,
                phone: data.phone || undefined,
                notes: data.notes || undefined,
            };

            await createCollaborator.mutateAsync(input);

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
            <Stack.Screen options={{ title: t('newCollaborator'), headerTitleAlign: 'center' }} />
            <ScrollView contentContainerStyle={styles.scrollContent}>
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
                        onPress={() => router.replace('/collaborators' as any)}
                        style={styles.footerButton}
                    />
                    <Button
                        label={t('save')}
                        variant="primary"
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
