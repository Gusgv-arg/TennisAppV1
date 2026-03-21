import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

import { useTheme } from '@/src/hooks/useTheme';

interface ShareModalProps {
    visible: boolean;
    onClose: () => void;
    onWhatsApp: () => void;
    onCopy: () => void;
    onOther: () => void;
    title?: string;
}

export default function ShareModal({
    visible,
    onClose,
    onWhatsApp,
    onCopy,
    onOther,
    title = 'Compartir'
}: ShareModalProps) {
    const { theme } = useTheme();

    const canNativeShare = Platform.OS === 'web' ? !!navigator.share : true;

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
            <Animated.View
                entering={Platform.OS === 'web' ? undefined : FadeIn}
                exiting={Platform.OS === 'web' ? undefined : FadeOut}
                style={[styles.overlay, { backgroundColor: theme.background.backdrop }]}
            >
                <Animated.View
                    entering={Platform.OS === 'web' ? undefined : ZoomIn}
                    style={[
                        styles.container,
                        {
                            backgroundColor: theme.background.surface,
                            shadowColor: '#000',
                        }
                    ]}
                >
                    <TouchableOpacity
                        style={styles.closeIcon}
                        onPress={onClose}
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    >
                        <Ionicons name="close" size={24} color={theme.text.secondary} />
                    </TouchableOpacity>

                    <Text style={[styles.title, { color: theme.text.primary }]}>{title}</Text>
                    
                    <View style={styles.optionsContainer}>
                        <TouchableOpacity 
                            style={[styles.optionButton, { backgroundColor: '#25D366' }]} 
                            onPress={onWhatsApp}
                        >
                            <Ionicons name="logo-whatsapp" size={24} color="#FFF" />
                            <Text style={styles.optionText}>WhatsApp</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={[styles.optionButton, { backgroundColor: theme.components.button.primary.bg }]} 
                            onPress={onCopy}
                        >
                            <Ionicons name="copy-outline" size={24} color="#FFF" />
                            <Text style={styles.optionText}>Copiar Mensaje</Text>
                        </TouchableOpacity>

                        {canNativeShare && (
                            <TouchableOpacity 
                                style={[styles.optionButton, { backgroundColor: theme.background.neutral }]} 
                                onPress={onOther}
                            >
                                <Ionicons name="share-outline" size={24} color={theme.text.primary} />
                                <Text style={[styles.optionText, { color: theme.text.primary }]}>Más opciones</Text>
                            </TouchableOpacity>
                        )}
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
        borderRadius: 24,
        padding: 25,
        width: '100%',
        maxWidth: 360,
        alignItems: 'center',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 25,
        textAlign: 'center',
    },
    optionsContainer: {
        width: '100%',
        gap: 12,
    },
    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 16,
        gap: 12,
    },
    optionText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFF',
    },
    closeIcon: {
        position: 'absolute',
        top: 20,
        right: 20,
        zIndex: 10,
    }
});
