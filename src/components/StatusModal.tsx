import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

import { iconSize as iconSizes } from '@/src/design/tokens/icons';
import { useTheme } from '@/src/hooks/useTheme';

export type StatusType = 'success' | 'error' | 'info' | 'warning';

interface StatusModalProps {
    visible: boolean;
    type: StatusType;
    title: string;
    message: string | React.ReactNode;
    onClose: () => void;
    onConfirm?: () => void;
    buttonText?: string;
    cancelText?: string;
    showCancel?: boolean;
}

export default function StatusModal({
    visible,
    type,
    title,
    message,
    onClose,
    onConfirm,
    buttonText,
    cancelText = 'Cancelar',
    showCancel = false
}: StatusModalProps) {
    const { theme, isDark } = useTheme();

    const getIcon = () => {
        switch (type) {
            case 'success': return 'checkmark-circle';
            case 'error': return 'close-circle';
            case 'info': return 'information-circle';
            case 'warning': return 'alert-circle';
        }
    };

    const getIconColor = () => {
        switch (type) {
            case 'success': return theme.status.success;
            case 'error': return theme.status.error;
            case 'info': return theme.status.info;
            case 'warning': return theme.status.warning;
        }
    };

    const defaultButtonText = onConfirm ? 'Confirmar' : 'Entendido';
    const finalButtonText = buttonText || defaultButtonText;

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
            <Animated.View
                entering={Platform.OS === 'web' ? undefined : FadeIn}
                exiting={Platform.OS === 'web' ? undefined : FadeOut}
                style={[styles.overlay, { backgroundColor: theme.background.backdrop }]}
            >
                <Animated.View
                    entering={Platform.OS === 'web' ? undefined : ZoomIn}
                    style={[styles.container, { backgroundColor: theme.background.surface, shadowColor: '#000' }]}
                >
                    <Ionicons name={getIcon()} size={iconSizes.xxxl} color={getIconColor()} />

                    <Text style={[styles.title, { color: theme.text.primary }]}>{title}</Text>
                    {typeof message === 'string' ? (
                        <Text style={[styles.message, { color: theme.text.secondary }]}>{message}</Text>
                    ) : (
                        message
                    )}

                    <View style={styles.buttonContainer}>
                        {showCancel && (
                            <TouchableOpacity
                                style={[styles.button, styles.cancelButton, { backgroundColor: theme.background.subtle }]}
                                onPress={onClose}
                            >
                                <Text style={[styles.cancelButtonText, { color: theme.text.secondary }]}>{cancelText}</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: getIconColor(), flex: showCancel ? 1 : 0 }]}
                            onPress={() => {
                                console.log('StatusModal confirm button pressed');
                                if (onConfirm) {
                                    console.log('Calling onConfirm...');
                                    onConfirm();
                                } else {
                                    console.log('No onConfirm, calling onClose...');
                                    onClose();
                                }
                            }}
                        >
                            <Text style={[styles.buttonText, { color: theme.text.inverse }]}>{finalButtonText}</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    container: {
        borderRadius: 20,
        padding: 25,
        width: '100%',
        maxWidth: 340,
        alignItems: 'center',
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        marginTop: 15,
        marginBottom: 10,
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 25,
        lineHeight: 22,
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
        justifyContent: 'center',
    },
    button: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 120,
        flex: 1,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    cancelButton: {
        // Handled via theme.background.subtle in JSX
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
});
