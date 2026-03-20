import { Button } from '@/src/design/components/Button';
import { Input } from '@/src/design/components/Input';
import { Theme } from '@/src/design/theme';
import { useTheme } from '@/src/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
    const styles = useMemo(() => createStyles(theme), [theme]);

    const [title, setTitle] = useState(initialTitle);
    const [selectedStroke, setSelectedStroke] = useState<string | null>(initialStroke);

    const strokes = [
        { id: 'Serve', label: 'Saque' },
        { id: 'Forehand', label: 'Drive' },
        { id: 'Backhand', label: 'Revés' },
        { id: 'Volley', label: 'Volea' },
        { id: 'Smash', label: 'Smash' }
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
                        <Text style={styles.title}>Editar Video</Text>
                        <TouchableOpacity onPress={onClose} disabled={loading}>
                            <Ionicons name="close" size={24} color={theme.text.primary} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.formContainer}>
                        <Text style={styles.label}>Título</Text>
                        <Input
                            placeholder="Título del video"
                            value={title}
                            onChangeText={setTitle}
                            style={styles.input}
                            containerStyle={{ marginBottom: 15 }}
                            inputContainerStyle={styles.inputContainer}
                            placeholderTextColor={theme.text.tertiary}
                        />

                        <Text style={styles.label}>Tipo de Golpe</Text>
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
                            label={loading ? "Guardando..." : "Guardar Cambios"}
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
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: isDesktop ? 'center' : 'flex-end',
            padding: isDesktop ? 20 : 0,
        },
        container: {
            backgroundColor: theme.background.surface,
            borderRadius: 16,
            padding: 24,
            paddingBottom: 30,
            width: isDesktop ? '100%' : '90%',
            maxWidth: 500,
            alignSelf: 'center',
            marginTop: isDesktop ? 40 : 0, // Added margin top for desktop
            ...Platform.select({
                android: { elevation: 5 },
                ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
                web: { boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }
            }),
        },
        // ...
        input: {
            fontSize: 15,
            color: theme.text.primary,
        },
        inputContainer: {
            backgroundColor: theme.background.subtle,
            borderWidth: 1,
            borderColor: theme.border.default,
            borderRadius: 12,
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
        },
        title: {
            fontSize: 20,
            fontWeight: 'bold',
            color: theme.text.primary,
        },
        formContainer: {
            marginBottom: 20,
        },
        label: {
            fontSize: 14,
            fontWeight: '600',
            color: theme.text.primary,
            marginBottom: 8,
        },
        chipsContainer: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 10,
        },
        chip: {
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 20,
            backgroundColor: theme.background.subtle,
            borderWidth: 1,
            borderColor: theme.border.default,
        },
        activeChip: {
            backgroundColor: theme.components.button.primary.bg,
            borderColor: theme.components.button.primary.bg,
        },
        chipText: {
            fontSize: 12,
            color: theme.text.primary,
        },
        activeChipText: {
            color: 'white',
            fontWeight: '600',
        },
        buttonContainer: {
            width: '100%',
            maxWidth: 250,
            alignSelf: 'center',
            marginTop: 10,
        },
    });
};
