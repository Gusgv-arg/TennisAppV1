import { Button } from '@/src/design/components/Button';
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
import { colors, spacing, typography } from '../../../design';
import { usePaymentSettings } from '../hooks/usePaymentSettings';

export default function PaymentsOnboarding() {
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
            style={styles.container}
            contentContainerStyle={styles.content}
        >
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.iconContainer}>
                    <Ionicons name="wallet" size={48} color={colors.primary[500]} />
                </View>
                <Text style={styles.title}>Módulo de Pagos</Text>
                <Text style={styles.subtitle}>
                    Gestiona los cobros de tus alumnos de forma simple
                </Text>
            </View>

            {/* Features */}
            <View style={styles.featuresContainer}>
                <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={24} color={colors.success[500]} />
                    <Text style={styles.featureText}>Registrar pagos rápidamente</Text>
                </View>
                <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={24} color={colors.success[500]} />
                    <Text style={styles.featureText}>Ver quién tiene deuda pendiente</Text>
                </View>
                <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={24} color={colors.success[500]} />
                    <Text style={styles.featureText}>Historial de transacciones por alumno</Text>
                </View>
                <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={24} color={colors.success[500]} />
                    <Text style={styles.featureText}>Resumen mensual de cobros</Text>
                </View>
            </View>

            {/* Privacy Warning */}
            <View style={styles.warningContainer}>
                <Ionicons name="shield-checkmark" size={24} color={colors.warning[600]} />
                <View style={styles.warningContent}>
                    <Text style={styles.warningTitle}>Sobre tus datos</Text>
                    <Text style={styles.warningText}>
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
                    leftIcon={<Ionicons name="wallet" size={20} color={colors.common.white} />}
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
                    <View style={styles.modalContent}>
                        <View style={styles.modalIconContainer}>
                            <Ionicons
                                name="server-outline"
                                size={32}
                                color={colors.primary[500]}
                            />
                        </View>
                        <Text style={styles.modalTitle}>¿Estás seguro?</Text>
                        <Text style={styles.modalMessage}>
                            Los datos financieros se enviarán de forma segura y encriptada.
                        </Text>
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => setConfirmVisible(false)}
                            >
                                <Text style={styles.cancelButtonText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.confirmButton, isEnabling && styles.buttonDisabled]}
                                onPress={confirmActivation}
                                disabled={isEnabling}
                            >
                                <Text style={styles.confirmButtonText}>
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.neutral[50], // Keep generic background
    },
    content: {
        padding: spacing.sm,
        paddingBottom: spacing.md,
        maxWidth: 600,
        alignSelf: 'center',
        width: '100%',
        flexGrow: 1, // Allow content to center vertically if needed
        justifyContent: 'center', // Try to center content if space permits
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    iconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primary[50],
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    title: {
        fontSize: typography.size.lg, // Reduced from xl
        fontWeight: '700',
        color: colors.neutral[900],
        marginBottom: 0,
    },
    subtitle: {
        fontSize: typography.size.xs, // Reduced from sm
        color: colors.neutral[600],
        textAlign: 'center',
    },
    featuresContainer: {
        backgroundColor: colors.common.white,
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
        fontSize: typography.size.xs, // Reduced from sm
        color: colors.neutral[700],
    },
    warningContainer: {
        flexDirection: 'row',
        backgroundColor: colors.warning[50],
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
        color: colors.warning[700],
        marginBottom: 0,
    },
    warningText: {
        fontSize: 10, // Explicitly smaller than xs
        color: colors.warning[600],
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
        backgroundColor: colors.common.white,
        borderRadius: 24,
        padding: spacing.xl,
        width: '100%',
        maxWidth: 400,
        alignItems: 'center',
        shadowColor: colors.common.black,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    modalIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.primary[50],
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    modalTitle: {
        fontSize: typography.size.lg,
        fontWeight: '700',
        color: colors.neutral[900],
        marginBottom: spacing.sm,
    },
    modalMessage: {
        fontSize: typography.size.md,
        color: colors.neutral[600],
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
        backgroundColor: colors.neutral[100],
    },
    cancelButtonText: {
        fontSize: typography.size.md,
        fontWeight: '600',
        color: colors.neutral[700],
    },
    confirmButton: {
        flex: 2,
        paddingVertical: spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        backgroundColor: colors.primary[500],
    },
    confirmButtonText: {
        fontSize: typography.size.md,
        fontWeight: '600',
        color: colors.common.white,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
});
