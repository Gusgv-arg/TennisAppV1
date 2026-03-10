import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

import { iconSize as iconSizes } from '@/src/design/tokens/icons';
import { useTheme } from '@/src/hooks/useTheme';
import { supabase } from '@/src/services/supabaseClient';
import { showError, showSuccess } from '@/src/utils/toast';

interface BetaIAModalProps {
    visible: boolean;
    onClose: () => void;
    userEmail: string | undefined;
    userName: string | undefined;
    userPhone?: string | undefined;
}

export default function BetaIAModal({
    visible,
    onClose,
    userEmail,
    userName,
    userPhone
}: BetaIAModalProps) {
    const { theme } = useTheme();
    const [loading, setLoading] = useState(false);

    const handleRequestAccess = async () => {
        if (!userEmail) {
            showError('Error', 'No se pudo identificar tu correo electrónico.');
            return;
        }

        try {
            setLoading(true);

            // Check if user already exists in beta_leads
            const { data: existingLead } = await supabase
                .from('beta_leads')
                .select('id')
                .eq('email', userEmail)
                .single();

            if (existingLead) {
                onClose();
                setTimeout(() => {
                    showSuccess('Solicitud recibida', 'Ya hemos recibido tu solicitud. Te avisaremos cuando tengas acceso.');
                }, 300);
                return;
            }

            const { error } = await supabase
                .from('beta_leads')
                .insert({
                    email: userEmail,
                    nombre: userName || 'Usuario App',
                    whatsapp: userPhone || null,
                    source: 'App',
                    notes: 'Solicitud de acceso a IA desde el modal de análisis.',
                    authorized_ia: false
                });

            if (error) throw error;

            onClose();
            setTimeout(() => {
                showSuccess('Solicitud Enviada', 'Tu solicitud ha sido registrada correctamente. Te contactaremos pronto.');
            }, 300);
        } catch (error: any) {
            console.error('Error requesting AI access:', error);
            // In case of error, we might want to keep the modal open or close it. 
            // The user says the error modal was behind, so let's close first.
            onClose();
            setTimeout(() => {
                showError('Error', 'No se pudo enviar la solicitud. Por favor intenta de nuevo.');
            }, 300);
        } finally {
            setLoading(false);
        }
    };

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
                    {/* Botón X para cerrar */}
                    <TouchableOpacity
                        style={styles.closeIcon}
                        onPress={onClose}
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    >
                        <Ionicons name="close" size={24} color={theme.text.secondary} />
                    </TouchableOpacity>

                    <View style={styles.iconContainer}>
                        <Ionicons name="sparkles" size={iconSizes.xl} color="#FFD700" />
                    </View>

                    <Text style={[styles.title, { color: theme.text.primary }]}>Análisis IA</Text>

                    <Text style={[styles.message, { color: theme.text.secondary }]}>
                        El análisis de video mediante IA está en pleno desarrollo. Si quieres colaborar testeando la herramienta puedes solicitar acceso y se contactarán contigo para avisarte.
                    </Text>

                    <TouchableOpacity
                        style={[
                            styles.button,
                            {
                                backgroundColor: theme.components.button.primary.bg,
                                opacity: loading ? 0.7 : 1
                            }
                        ]}
                        onPress={handleRequestAccess}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color={theme.components.button.primary.text} size="small" />
                        ) : (
                            <Text style={[styles.buttonText, { color: theme.components.button.primary.text }]}>
                                Solicitar acceso
                            </Text>
                        )}
                    </TouchableOpacity>
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
        elevation: 5,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    iconContainer: {
        marginBottom: 15,
        backgroundColor: 'rgba(255, 215, 0, 0.1)',
        padding: 15,
        borderRadius: 30,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 10,
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 25,
        lineHeight: 22,
    },
    button: {
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    buttonText: {
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    closeIcon: {
        position: 'absolute',
        top: 15,
        right: 15,
        zIndex: 10,
    }
});
