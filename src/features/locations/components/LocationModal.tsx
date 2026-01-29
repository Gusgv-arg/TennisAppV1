import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import React, { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { z } from 'zod';

import StatusModal, { StatusType } from '@/src/components/StatusModal';
import { Button } from '@/src/design/components/Button';
import { Input } from '@/src/design/components/Input';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useLocationMutations } from '@/src/features/locations/hooks/useLocationMutations';
import { Location } from '@/src/types/location';

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
    const { t } = useTranslation();
    const isEditing = !!location;
    const { createLocation, updateLocation } = useLocationMutations();

    const [statusModalVisible, setStatusModalVisible] = useState(false);
    const [statusConfig, setStatusConfig] = useState({
        type: 'success' as StatusType,
        title: '',
        message: '',
    });

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
                showStatus('success', t('success'), t('locationUpdated'));
            } else {
                await createLocation.mutateAsync({
                    name: data.name,
                    address: data.address || null,
                    notes: data.notes || null,
                });
                showStatus('success', t('success'), t('locationCreated'));
            }
        } catch (error: any) {
            showStatus('error', t('saveError'), error.message || t('errorOccurred'));
        }
    };

    const showStatus = (type: StatusType, title: string, message: string) => {
        setStatusConfig({ type, title, message });
        setStatusModalVisible(true);
    };

    const handleStatusClose = () => {
        setStatusModalVisible(false);
        if (statusConfig.type === 'success') {
            onClose();
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
            <View style={styles.overlay}>
                <View style={[styles.container, styles.desktopContainer]}>
                    <View style={styles.header}>
                        <Text style={styles.title}>
                            {isEditing ? t('editLocation') : t('newLocation')}
                        </Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={colors.neutral[500]} />
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

                    <View style={styles.footer}>

                        <Button
                            label={t('save')}
                            onPress={handleSubmit(onSubmit)}
                            loading={createLocation.isPending || updateLocation.isPending}
                            style={styles.footerButton}
                        />
                    </View>
                </View>

                <StatusModal
                    visible={statusModalVisible}
                    type={statusConfig.type}
                    title={statusConfig.title}
                    message={statusConfig.message}
                    onClose={handleStatusClose}
                />
            </View>
        </Modal >
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.md,
    },
    container: {
        backgroundColor: colors.common.white,
        borderRadius: 20,
        width: '100%',
        maxHeight: '90%',
        display: 'flex',
        flexDirection: 'column',
    },
    desktopContainer: {
        maxWidth: 500,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.neutral[100],
    },
    title: {
        fontSize: typography.size.xl,
        fontWeight: '700',
        color: colors.neutral[900],
    },
    content: {
        padding: spacing.lg,
    },
    formSection: {
        gap: spacing.md,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.md,
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.neutral[100],
    },
    footerButton: {
        minWidth: 120,
    },
});
