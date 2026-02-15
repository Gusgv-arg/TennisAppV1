import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import React, { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { z } from 'zod';

import { Button } from '@/src/design/components/Button';
import { Input } from '@/src/design/components/Input';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useLocationMutations } from '@/src/features/locations/hooks/useLocationMutations';
import { useTheme } from '@/src/hooks/useTheme';
import { Location } from '@/src/types/location';
import { showError, showSuccess } from '@/src/utils/toast';

const schema = z.object({
    name: z.string().min(1, 'fieldRequired'),
    address: z.string().optional(),
    notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface LocationModalProps {
    visible: boolean;
    onClose: () => void;
    location?: Location | null;
}

export const LocationModal = ({ visible, onClose, location }: LocationModalProps) => {
    const { theme, isDark } = useTheme();
    const styles = React.useMemo(() => createStyles(theme), [theme]);
    const { t } = useTranslation();
    const isEditing = !!location;
    const { createLocation, updateLocation } = useLocationMutations();



    const { control, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            name: '',
            address: '',
            notes: '',
        },
    });

    useEffect(() => {
        if (visible) {
            if (location) {
                reset({
                    name: location.name,
                    address: location.address || '',
                    notes: location.notes || '',
                });
            } else {
                reset({
                    name: '',
                    address: '',
                    notes: '',
                });
            }
        }
    }, [visible, location, reset]);

    const onSubmit = async (data: FormData) => {
        try {
            if (isEditing && location) {
                await updateLocation.mutateAsync({
                    id: location.id,
                    input: {
                        name: data.name,
                        address: data.address || null,
                        notes: data.notes || null,
                    },
                });
                showSuccess(t('success'), t('locationUpdated'));
                onClose();
            } else {
                await createLocation.mutateAsync({
                    name: data.name,
                    address: data.address || null,
                    notes: data.notes || null,
                });
                showSuccess(t('success'), t('locationCreated'));
                onClose();
            }
        } catch (error: any) {
            showError(t('saveError'), error.message || t('errorOccurred'));
        }
    };



    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={[styles.overlay, { backgroundColor: theme.background.backdrop }]}>
                <View style={[styles.container, styles.desktopContainer]}>
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: theme.text.primary }]}>
                            {isEditing ? t('editLocation') : t('newLocation')}
                        </Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={theme.text.secondary} />
                        </TouchableOpacity>
                    </View>


                    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
                                        leftIcon={<Ionicons name="business-outline" size={20} color={theme.text.secondary} />}
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
                                        leftIcon={<Ionicons name="location-outline" size={20} color={theme.text.secondary} />}
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

                    <View style={styles.footer}>

                        <Button
                            label={t('save')}
                            onPress={handleSubmit(onSubmit)}
                            loading={createLocation.isPending || updateLocation.isPending}
                            style={styles.footerButton}
                        />
                    </View>
                </View>


            </View>
        </Modal >
    );
};

const createStyles = (theme: any) => StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.md,
    },
    container: {
        width: '100%',
        borderRadius: 16,
        padding: spacing.md,
        backgroundColor: theme.background.surface,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    desktopContainer: {
        maxWidth: 500,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
        paddingBottom: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: theme.border.subtle,
    },
    title: {
        ...typography.variants.h3,
        fontWeight: 'bold',
    },
    content: {
        paddingBottom: spacing.md,
    },
    formSection: {
        gap: spacing.md,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: spacing.md,
        marginTop: spacing.lg,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: theme.border.subtle,
    },
    footerButton: {
        minWidth: 100,
    }
});


