import { Button } from '@/src/design/components/Button';
import { useTheme } from '@/src/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    Alert,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Theme } from '../../../design/theme';
import { spacing } from '../../../design/tokens/spacing';
import { typography } from '../../../design/tokens/typography';
import { usePaymentSettings } from '../hooks/usePaymentSettings';

export default function PaymentsOnboarding() {
    const { theme } = useTheme();
    const styles = React.useMemo(() => createStyles(theme), [theme]);
    const { enablePayments, isEnabling } = usePaymentSettings();
    const [confirmVisible, setConfirmVisible] = useState(false);

    const handleActivate = () => {
        setConfirmVisible(true);
    };

    const confirmActivation = async () => {
        try {
            await enablePayments({ simplified: false });
            setConfirmVisible(false);
        } catch (error) {
            if (Platform.OS === 'web') {
                alert('No se pudo activar el módulo');
            } else {
                Alert.alert('Error', 'No se pudo activar el módulo');
            }
        }
    };

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: theme.background.default }]}
            contentContainerStyle={styles.content}
        >
            {/* Header */}
            <View style={styles.header}>
                <View style={[styles.iconContainer, { backgroundColor: theme.components.badge.primary }]}>
                    <Ionicons name="wallet" size={48} color={theme.components.button.primary.bg} />
                </View>
                <Text style={[styles.title, { color: theme.text.primary }]}>Módulo de Pagos</Text>
                <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
                    Gestiona los cobros de tus alumnos de forma simple
                </Text>
            </View>

            {/* Features */}
            {/* Features */}
            <View style={[styles.featuresContainer, { backgroundColor: theme.background.surface }]}>
                <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={24} color={theme.status.success} />
                    <Text style={[styles.featureText, { color: theme.text.primary }]}>Registrar pagos rápidamente</Text>
                </View>
                <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={24} color={theme.status.success} />
                    <Text style={[styles.featureText, { color: theme.text.primary }]}>Ver quién tiene deuda pendiente</Text>
                </View>
                <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={24} color={theme.status.success} />
                    <Text style={[styles.featureText, { color: theme.text.primary }]}>Historial de transacciones por alumno</Text>
                </View>
                <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={24} color={theme.status.success} />
                    <Text style={[styles.featureText, { color: theme.text.primary }]}>Resumen mensual de cobros</Text>
                </View>
            </View>

            {/* Privacy Warning */}
            {/* Privacy Warning */}
            <View style={[styles.warningContainer, { backgroundColor: theme.status.warningBackground }]}>
                <Ionicons name="shield-checkmark" size={24} color={theme.status.warning} />
                <View style={styles.warningContent}>
                    <Text style={[styles.warningTitle, { color: theme.status.warning }]}>Sobre tus datos</Text>
                    <Text style={[styles.warningText, { color: theme.status.warningText }]}>
                        Los datos financieros se envían de forma segura y encriptada.
                        Puedes desactivar el módulo en cualquier momento desde tu perfil.
                    </Text>
                </View>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
                <Button
                    label={isEnabling ? 'Activando...' : 'Activar Módulo de Pagos'}
                    onPress={handleActivate}
                    disabled={isEnabling}
                    loading={isEnabling}
                    variant="primary"
                    leftIcon={<Ionicons name="wallet" size={20} color={theme.components.button.primary.text} />}
                />
            </View>

            {/* Professional Confirm Modal */}
            <Modal
                visible={confirmVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setConfirmVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.background.surface }]}>
                        <View style={[styles.modalIconContainer, { backgroundColor: theme.components.badge.primary }]}>
                            <Ionicons
                                name="server-outline"
                                size={32}
                                color={theme.components.button.primary.bg}
                            />
                        </View>
                        <Text style={[styles.modalTitle, { color: theme.text.primary }]}>¿Estás seguro?</Text>
                        <Text style={[styles.modalMessage, { color: theme.text.secondary }]}>
                            Los datos financieros se enviarán de forma segura y encriptada.
                        </Text>
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.cancelButton, { backgroundColor: theme.background.subtle }]}
                                onPress={() => setConfirmVisible(false)}
                            >
                                <Text style={[styles.cancelButtonText, { color: theme.text.primary }]}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.confirmButton, isEnabling && styles.buttonDisabled, { backgroundColor: theme.components.button.primary.bg }]}
                                onPress={confirmActivation}
                                disabled={isEnabling}
                            >
                                <Text style={[styles.confirmButtonText, { color: theme.components.button.primary.text }]}>
                                    {isEnabling ? 'Activando...' : 'Sí, Activar'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

const createStyles = (theme: Theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background.default,
    },
    content: {
        padding: spacing.sm,
        paddingBottom: spacing.md,
        maxWidth: 600,
        alignSelf: 'center',
        width: '100%',
        flexGrow: 1,
        justifyContent: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    iconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: theme.components.badge.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    title: {
        fontSize: typography.size.lg,
        fontWeight: '700',
        color: theme.text.primary,
        marginBottom: 0,
    },
    subtitle: {
        fontSize: typography.size.xs,
        color: theme.text.secondary,
        textAlign: 'center',
    },
    featuresContainer: {
        backgroundColor: theme.background.surface,
        borderRadius: 12,
        padding: spacing.sm,
        marginBottom: spacing.sm,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: 2,
    },
    featureText: {
        fontSize: typography.size.xs,
        color: theme.text.primary,
    },
    warningContainer: {
        flexDirection: 'row',
        backgroundColor: theme.status.warningBackground,
        borderRadius: 8,
        padding: spacing.xs,
        marginBottom: spacing.md,
        gap: spacing.sm,
    },
    warningContent: {
        flex: 1,
    },
    warningTitle: {
        fontSize: typography.size.xs,
        fontWeight: '600',
        color: theme.status.warning,
        marginBottom: 0,
    },
    warningText: {
        fontSize: 10,
        color: theme.status.warningText,
        lineHeight: 14,
    },
    actions: {
        gap: spacing.sm,
        alignItems: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    modalContent: {
        backgroundColor: theme.background.surface,
        borderRadius: 24,
        padding: spacing.xl,
        width: '100%',
        maxWidth: 400,
        alignItems: 'center',
        shadowColor: 'black',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    modalIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: theme.components.badge.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    modalTitle: {
        fontSize: typography.size.lg,
        fontWeight: '700',
        color: theme.text.primary,
        marginBottom: spacing.sm,
    },
    modalMessage: {
        fontSize: typography.size.md,
        color: theme.text.secondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: spacing.xl,
    },
    modalActions: {
        flexDirection: 'row',
        gap: spacing.md,
        width: '100%',
    },
    cancelButton: {
        flex: 1,
        paddingVertical: spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        backgroundColor: theme.background.subtle,
    },
    cancelButtonText: {
        fontSize: typography.size.md,
        fontWeight: '600',
        color: theme.text.primary,
    },
    confirmButton: {
        flex: 2,
        paddingVertical: spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        backgroundColor: theme.components.button.primary.bg,
    },
    confirmButtonText: {
        fontSize: typography.size.md,
        fontWeight: '600',
        color: theme.components.button.primary.text,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
});
