import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { z } from 'zod';

import StatusModal, { StatusType } from '@/src/components/StatusModal';
import { Button } from '@/src/design/components/Button';
import { Input } from '@/src/design/components/Input';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { useLocationMutations } from '@/src/features/locations/hooks/useLocationMutations';

const schema = z.object({
    name: z.string().min(1, 'fieldRequired'),
    address: z.string().optional(),
    notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NewLocationScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const { createLocation } = useLocationMutations();

    const [modalVisible, setModalVisible] = useState(false);
    const [modalConfig, setModalConfig] = useState({
        type: 'success' as StatusType,
        title: '',
        message: '',
    });

    const { control, handleSubmit, setError, clearErrors, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            name: '',
            address: '',
            notes: '',
        },
    });

    const onSubmit = async (data: FormData) => {
        try {
            await createLocation.mutateAsync({
                name: data.name,
                address: data.address || null,
                notes: data.notes || null,
            });

            setModalConfig({
                type: 'success',
                title: t('success'),
                message: t('locationCreated'),
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
            router.back();
        }
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: t('newLocation') }} />
            <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
                <View style={styles.formSection}>
                    <Controller
                        control={control}
                        name="name"
                        render={({ field: { onChange, onBlur, value } }) => (
                            <Input
                                label={t('locationName')}
                                placeholder={t('locationPlaceholder')}
                                onBlur={onBlur}
                                onChangeText={onChange}
                                value={value}
                                error={errors.name?.message ? t(errors.name.message as any) : undefined}
                                leftIcon={<Ionicons name="business-outline" size={20} color={colors.neutral[400]} />}
                            />
                        )}
                    />

                    <Controller
                        control={control}
                        name="address"
                        render={({ field: { onChange, onBlur, value } }) => (
                            <Input
                                label={t('address')}
                                placeholder="Av. del Libertador 1234, CABA"
                                onBlur={onBlur}
                                onChangeText={onChange}
                                value={value}
                                leftIcon={<Ionicons name="location-outline" size={20} color={colors.neutral[400]} />}
                            />
                        )}
                    />

                    <Controller
                        control={control}
                        name="notes"
                        render={({ field: { onChange, onBlur, value } }) => (
                            <Input
                                label={t('notes')}
                                placeholder={t('locationNotesPlaceholder')}
                                onBlur={onBlur}
                                onChangeText={onChange}
                                value={value}
                            />
                        )}
                    />
                </View>
            </ScrollView>

            <View style={styles.footer} pointerEvents="box-none">
                <Button
                    label={t('cancel')}
                    variant="outline"
                    size="md"
                    leftIcon={<Ionicons name="close-outline" size={20} color={colors.primary[500]} />}
                    onPress={() => router.back()}
                    style={styles.footerButton}
                    shadow
                />
                <Button
                    label={t('save')}
                    size="md"
                    leftIcon={<Ionicons name="checkmark-sharp" size={20} color={colors.common.white} />}
                    onPress={handleSubmit(onSubmit)}
                    loading={createLocation.isPending}
                    style={styles.footerButton}
                    shadow
                />
            </View>

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
    content: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.lg,
        paddingBottom: 150,
    },
    formSection: {
        gap: spacing.md,
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
    },
    footer: {
        position: 'absolute',
        bottom: 60,
        left: 0,
        right: 0,
        flexDirection: 'row',
        gap: spacing.md,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
        zIndex: 10,
        elevation: 10,
    },
    footerButton: {
        minWidth: 100,
    },
});
