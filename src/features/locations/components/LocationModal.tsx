import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import React, { useEffect, useState, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Keyboard, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { z } from 'zod';

import { Button } from '@/src/design/components/Button';
import { Input } from '@/src/design/components/Input';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useLocationMutations } from '@/src/features/locations/hooks/useLocationMutations';
import { useCurrentAcademy } from '@/src/features/academy/hooks/useAcademy';
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
    const { data: academy } = useCurrentAcademy();
    const isEditing = !!location;
    const { createLocation, updateLocation } = useLocationMutations();
    
    // Keyboard and ScrollView handling
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const scrollViewRef = useRef<ScrollView>(null);

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSubscription = Keyboard.addListener(showEvent, (e) => {
            setKeyboardHeight(e.endCoordinates.height);
        });
        const hideSubscription = Keyboard.addListener(hideEvent, () => {
            setKeyboardHeight(0);
        });

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

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
                onClose();
                setTimeout(() => showSuccess(t('success'), t('locationUpdated')), 100);
            } else {
                await createLocation.mutateAsync({
                    name: data.name,
                    address: data.address || null,
                    notes: data.notes || null,
                });
                onClose();
                setTimeout(() => showSuccess(t('success'), t('locationCreated')), 100);
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
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.title, { color: theme.text.primary }]}>
                                {isEditing ? t('editLocation') : t('newLocation')}
                            </Text>
                            {academy?.name && (
                                <Text style={{ 
                                    fontSize: 12, 
                                    color: theme.text.secondary, 
                                    fontWeight: '500',
                                    marginTop: 2
                                }}>
                                    {academy.name}
                                </Text>
                            )}
                        </View>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={theme.text.secondary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView 
                        ref={scrollViewRef}
                        contentContainerStyle={[
                            styles.content,
                            // Extra space at bottom when keyboard is up to allow scrolling
                            { paddingBottom: keyboardHeight > 0 ? keyboardHeight / 2 : spacing.md }
                        ]} 
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
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
                                        placeholder={t('addressPlaceholder')}
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
                                        onFocus={() => {
                                            // Ensure the input scrolls into view
                                            setTimeout(() => {
                                                scrollViewRef.current?.scrollToEnd({ animated: true });
                                            }, 200);
                                        }}
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
        borderWidth: 1,
        borderColor: theme.border.subtle,
        // Added flexShrink to adapt to smaller keyboard-restricted areas
        flexShrink: 1,
        maxHeight: '100%',
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
        color: theme.text.primary,
    },
    content: {
        paddingBottom: spacing.md,
    },
    formSection: {
        gap: spacing.md,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.md,
        marginTop: spacing.lg,
        paddingTop: spacing.md,
    },
    footerButton: {
        minWidth: 100,
    }
});
