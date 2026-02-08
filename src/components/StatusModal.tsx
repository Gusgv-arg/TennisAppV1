import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

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
    const { theme } = useTheme();

    if (!visible) return null;

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
                entering={FadeIn}
                exiting={FadeOut}
                style={[styles.overlay, { backgroundColor: theme.background.backdrop }]}
            >
                <Animated.View
                    entering={ZoomIn}
                    style={[styles.container, { backgroundColor: theme.background.surface }]}
                >
                    <Ionicons name={getIcon()} size={60} color={getIconColor()} />

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
                            <Text style={styles.buttonText}>{finalButtonText}</Text>
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
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    container: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 25,
        width: '100%',
        maxWidth: 340,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 5,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        marginTop: 15,
        marginBottom: 10,
        color: '#333',
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        color: '#666',
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
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    cancelButton: {
        backgroundColor: '#F2F2F7',
    },
    cancelButtonText: {
        color: '#666',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
