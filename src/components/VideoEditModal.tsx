import { Button } from '@/src/design/components/Button';
import { Input } from '@/src/design/components/Input';
import { Theme } from '@/src/design/theme';
import { useTheme } from '@/src/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Modal from './Modal';

interface VideoEditModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (title: string, stroke: string | null) => void;
    initialTitle: string;
    initialStroke: string | null;
    loading?: boolean;
}

export default function VideoEditModal({
    visible,
    onClose,
    onSave,
    initialTitle,
    initialStroke,
    loading
}: VideoEditModalProps) {
    const { theme } = useTheme();
    const { t } = useTranslation();
    const styles = useMemo(() => createStyles(theme), [theme]);

    const [title, setTitle] = useState(initialTitle);
    const [selectedStroke, setSelectedStroke] = useState<string | null>(initialStroke);

    const strokes = [
        { id: 'Serve', label: t('videoHub.strokes.serve') },
        { id: 'Forehand', label: t('videoHub.strokes.drive') },
        { id: 'Backhand', label: t('videoHub.strokes.backhand') },
        { id: 'Volley', label: t('videoHub.strokes.volley') },
        { id: 'Smash', label: t('videoHub.strokes.smash') }
    ];

    useEffect(() => {
        if (visible) {
            setTitle(initialTitle);
            setSelectedStroke(initialStroke);
        }
    }, [visible, initialTitle, initialStroke]);

    const handleSave = () => {
        onSave(title, selectedStroke);
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>{t('videoHub.modals.edit.title')}</Text>
                        <TouchableOpacity onPress={onClose} disabled={loading} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={theme.text.secondary} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.formContainer}>
                        <Text style={styles.label}>{t('videoHub.modals.assignment.titleLabel').toUpperCase()}</Text>
                        <Input
                            placeholder={t('videoHub.modals.assignment.titleLabel')}
                            value={title}
                            onChangeText={setTitle}
                            style={styles.input}
                            containerStyle={{ marginBottom: 20 }}
                            inputContainerStyle={styles.inputContainer}
                            placeholderTextColor={theme.text.tertiary}
                        />

                        <Text style={styles.label}>{t('videoHub.modals.assignment.strokeLabel').toUpperCase()}</Text>
                        <View style={styles.chipsContainer}>
                            {strokes.map((stroke) => (
                                <TouchableOpacity
                                    key={stroke.id}
                                    style={[
                                        styles.chip,
                                        selectedStroke === stroke.id && styles.activeChip
                                    ]}
                                    onPress={() => setSelectedStroke(stroke.id)}
                                >
                                    <Text style={[
                                        styles.chipText,
                                        selectedStroke === stroke.id && styles.activeChipText
                                    ]}>{stroke.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View style={styles.buttonContainer}>
                        <Button
                            label={loading ? t('videoHub.modals.edit.saving') : t('videoHub.modals.edit.saveButton')}
                            onPress={handleSave}
                            variant="primary"
                            disabled={loading}
                        />
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const createStyles = (theme: Theme) => {
    const isDesktop = Platform.OS === 'web' || Platform.OS === 'windows' || Platform.OS === 'macos';

    return StyleSheet.create({
        overlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
        },
        container: {
            backgroundColor: theme.background.surface,
            borderRadius: 24,
            padding: 24,
            width: '100%',
            maxWidth: 450,
            ...Platform.select({
                android: { elevation: 10 },
                ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12 },
                web: { boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }
            }),
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 24,
        },
        title: {
            fontSize: 22,
            fontWeight: '800',
            color: theme.text.primary,
            letterSpacing: -0.5,
        },
        closeButton: {
            padding: 6,
            backgroundColor: theme.background.subtle,
            borderRadius: 20,
        },
        formContainer: {
            marginBottom: 24,
        },
        label: {
            fontSize: 12,
            fontWeight: '700',
            color: theme.text.tertiary,
            marginBottom: 10,
            letterSpacing: 1,
        },
        input: {
            fontSize: 16,
            color: theme.text.primary,
        },
        inputContainer: {
            backgroundColor: theme.background.subtle,
            borderWidth: 1,
            borderColor: theme.border.default,
            borderRadius: 12,
            paddingHorizontal: 12,
        },
        chipsContainer: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 10,
        },
        chip: {
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 24,
            backgroundColor: theme.background.subtle,
            borderWidth: 1,
            borderColor: theme.border.default,
        },
        activeChip: {
            backgroundColor: theme.components.button.primary.bg,
            borderColor: theme.components.button.primary.bg,
        },
        chipText: {
            fontSize: 14,
            color: theme.text.secondary,
            fontWeight: '600',
        },
        activeChipText: {
            color: 'white',
            fontWeight: '700',
        },
        buttonContainer: {
            width: '100%',
            marginTop: 8,
        },
    });
};
