import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { spacing } from '../design';
import { Theme } from '../design/theme';
import { useTheme } from '../hooks/useTheme';
import { supabase } from '../services/supabaseClient';

interface TermsAcceptanceModalProps {
    visible: boolean;
    onAccept?: () => void;
    userId: string;
}

export default function TermsAcceptanceModal({ visible, onAccept, userId }: TermsAcceptanceModalProps) {
    const { theme, isDark } = useTheme();
    const styles = React.useMemo(() => createStyles(theme), [theme]);
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleAccept = async () => {
        if (!userId) return;
        setLoading(true);

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ terms_accepted_at: new Date().toISOString() })
                .eq('id', userId);

            if (error) throw error;

            if (onAccept) onAccept();
        } catch (error) {
            console.error('Error accepting terms:', error);
            // Optionally show error toast here
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            statusBarTranslucent
        >
            <View style={[styles.overlay, { backgroundColor: theme.background.backdrop }]}>
                <View style={[
                    styles.modalContainer,
                    { backgroundColor: theme.background.surface },
                    !isDark && {
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 10 },
                        shadowOpacity: 0.25,
                        shadowRadius: 15,
                        elevation: 10
                    },
                    { borderColor: theme.border.subtle }
                ]}>
                    <View style={styles.header}>
                        <View style={[styles.iconContainer, { backgroundColor: theme.background.subtle }]}>
                            <Ionicons name="document-text-outline" size={24} color={theme.components.button.primary.bg} />
                        </View>
                        <Text style={[styles.title, { color: theme.text.primary }]}>Términos y Condiciones</Text>
                        <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
                            Para continuar usando Tenis-Lab, debes leer y aceptar nuestros términos.
                        </Text>
                    </View>

                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        <View style={styles.linksContainer}>
                            <TouchableOpacity
                                onPress={() => router.push('/profile/terms')}
                                // @ts-ignore: Web-only style to remove focus ring
                                style={Platform.OS === 'web' ? { outlineStyle: 'none' } : undefined}
                            >
                                <Text style={[styles.linkHighlight, { color: theme.components.button.primary.bg }]}>Términos y Condiciones</Text>
                            </TouchableOpacity>
                            <Text style={[styles.linkText, { color: theme.text.secondary }]}> y </Text>
                            <TouchableOpacity
                                onPress={() => router.push('/profile/privacy')}
                                // @ts-ignore: Web-only style to remove focus ring
                                style={Platform.OS === 'web' ? { outlineStyle: 'none' } : undefined}
                            >
                                <Text style={[styles.linkHighlight, { color: theme.components.button.primary.bg }]}>Política de Privacidad</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>

                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.acceptButton, { backgroundColor: theme.components.button.primary.bg }]}
                            onPress={handleAccept}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.acceptButtonText, { color: 'white' }]}>
                                {loading ? 'Procesando...' : 'Aceptar y Continuar'}
                            </Text>
                            {!loading && (
                                <Ionicons name="arrow-forward" size={20} color="white" style={{ marginLeft: 8 }} />
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const createStyles = (theme: Theme) => StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    modalContainer: {
        width: '100%',
        maxWidth: 400,
        borderRadius: 24,
        overflow: 'hidden',
        maxHeight: '80%',
    },
    header: {
        paddingTop: spacing.lg,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.sm,
        alignItems: 'center',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 4,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        paddingHorizontal: spacing.md,
    },
    content: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    linksContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
    },
    linkText: {
        fontSize: 14,
        marginTop: spacing.md,
        marginBottom: 4,
    },
    linkHighlight: {
        fontSize: 14,
        fontWeight: 'bold',
        marginTop: spacing.md,
        marginBottom: 4,
    },
    footer: {
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.lg,
        paddingTop: spacing.xs,
    },
    acceptButton: {
        borderRadius: 12,
        height: 44,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    acceptButtonText: {
        fontSize: 16,
        fontWeight: '700',
    },
});
