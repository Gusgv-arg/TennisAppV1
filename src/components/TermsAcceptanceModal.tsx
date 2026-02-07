import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, spacing } from '../design';
import { supabase } from '../services/supabaseClient';

interface TermsAcceptanceModalProps {
    visible: boolean;
    onAccept?: () => void;
    userId: string;
}

export default function TermsAcceptanceModal({ visible, onAccept, userId }: TermsAcceptanceModalProps) {
    const { t } = useTranslation();
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
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    <View style={styles.header}>
                        <View style={styles.iconContainer}>
                            <Ionicons name="document-text-outline" size={24} color={colors.primary[600]} />
                        </View>
                        <Text style={styles.title}>Términos y Condiciones</Text>
                        <Text style={styles.subtitle}>
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
                                <Text style={styles.linkHighlight}>Términos y Condiciones</Text>
                            </TouchableOpacity>
                            <Text style={styles.linkText}> y </Text>
                            <TouchableOpacity
                                onPress={() => router.push('/profile/privacy')}
                                // @ts-ignore: Web-only style to remove focus ring
                                style={Platform.OS === 'web' ? { outlineStyle: 'none' } : undefined}
                            >
                                <Text style={styles.linkHighlight}>Política de Privacidad</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>

                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={styles.acceptButton}
                            onPress={handleAccept}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.acceptButtonText}>
                                {loading ? 'Procesando...' : 'Aceptar y Continuar'}
                            </Text>
                            {!loading && (
                                <Ionicons name="arrow-forward" size={20} color={colors.common.white} style={{ marginLeft: 8 }} />
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    modalContainer: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: colors.common.white,
        borderRadius: 24,
        overflow: 'hidden',
        maxHeight: '80%',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10,
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
        backgroundColor: colors.primary[50],
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.neutral[900],
        marginBottom: 4,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: colors.neutral[600],
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
        color: colors.neutral[600],
        marginTop: spacing.md,
        marginBottom: 4,
    },
    linkHighlight: {
        fontSize: 14,
        fontWeight: 'bold',
        color: colors.primary[600],
        marginTop: spacing.md,
        marginBottom: 4,
    },
    footer: {
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.lg,
        paddingTop: spacing.xs,
    },
    acceptButton: {
        backgroundColor: colors.primary[500],
        borderRadius: 12,
        height: 44,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    acceptButtonText: {
        color: colors.common.white,
        fontSize: 16,
        fontWeight: '700',
    },
});
