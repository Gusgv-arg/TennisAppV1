import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    Alert,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { colors, spacing, typography } from '../../../design';
import { usePaymentSettings } from '../hooks/usePaymentSettings';

export default function PaymentsOnboarding() {
    const { enablePayments, isEnabling } = usePaymentSettings();
    const [simplified, setSimplified] = useState(false);
    const [confirmVisible, setConfirmVisible] = useState(false);

    const handleActivate = () => {
        setConfirmVisible(true);
    };

    const confirmActivation = async () => {
        try {
            await enablePayments({ simplified });
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
                        Los datos financieros se almacenan de forma segura y encriptada.
                        Solo tú tienes acceso a esta información. Puedes desactivar el módulo
                        en cualquier momento desde tu perfil.
                    </Text>
                </View>
            </View>

            {/* Simplified Mode Option */}
            <TouchableOpacity
                style={styles.optionContainer}
                onPress={() => setSimplified(!simplified)}
                activeOpacity={0.7}
            >
                <View style={styles.optionContent}>
                    <Text style={styles.optionTitle}>Modo simplificado</Text>
                    <Text style={styles.optionDescription}>
                        No mostrar montos exactos, solo estados de pago (pagó/debe)
                    </Text>
                </View>
                <Switch
                    value={simplified}
                    onValueChange={setSimplified}
                    trackColor={{ false: colors.neutral[300], true: colors.primary[300] }}
                    thumbColor={simplified ? colors.primary[500] : colors.neutral[100]}
                />
            </TouchableOpacity>

            {/* Actions */}
            <View style={styles.actions}>
                <TouchableOpacity
                    style={[styles.activateButton, isEnabling && styles.buttonDisabled]}
                    onPress={handleActivate}
                    disabled={isEnabling}
                >
                    <Ionicons name="wallet" size={20} color={colors.common.white} />
                    <Text style={styles.activateButtonText}>
                        {isEnabling ? 'Activando...' : 'Activar Módulo de Pagos'}
                    </Text>
                </TouchableOpacity>
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
                                name={simplified ? "shield-outline" : "server-outline"}
                                size={32}
                                color={colors.primary[500]}
                            />
                        </View>
                        <Text style={styles.modalTitle}>¿Estás seguro?</Text>
                        <Text style={styles.modalMessage}>
                            {simplified
                                ? 'Los datos se guardarán de forma simplificada (sin montos exactos). Podrás cambiar esto más adelante.'
                                : 'Los datos financieros se almacenarán de forma segura y encriptada en nuestra infraestructura en la nube.'}
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
        backgroundColor: colors.neutral[50],
    },
    content: {
        padding: spacing.lg,
        paddingBottom: spacing.xl * 2,
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    iconContainer: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: colors.primary[50],
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    title: {
        fontSize: typography.size.xxl,
        fontWeight: '700',
        color: colors.neutral[900],
        marginBottom: spacing.xs,
    },
    subtitle: {
        fontSize: typography.size.md,
        color: colors.neutral[600],
        textAlign: 'center',
    },
    featuresContainer: {
        backgroundColor: colors.common.white,
        borderRadius: 16,
        padding: spacing.lg,
        marginBottom: spacing.lg,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.sm,
    },
    featureText: {
        fontSize: typography.size.md,
        color: colors.neutral[700],
    },
    warningContainer: {
        flexDirection: 'row',
        backgroundColor: colors.warning[50],
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.lg,
        gap: spacing.sm,
    },
    warningContent: {
        flex: 1,
    },
    warningTitle: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        color: colors.warning[700],
        marginBottom: spacing.xs,
    },
    warningText: {
        fontSize: typography.size.sm,
        color: colors.warning[600],
        lineHeight: 20,
    },
    optionContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.common.white,
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.xl,
    },
    optionContent: {
        flex: 1,
        marginRight: spacing.md,
    },
    optionTitle: {
        fontSize: typography.size.md,
        fontWeight: '600',
        color: colors.neutral[900],
        marginBottom: 4,
    },
    optionDescription: {
        fontSize: typography.size.sm,
        color: colors.neutral[500],
    },
    actions: {
        gap: spacing.md,
    },
    activateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: colors.primary[500],
        paddingVertical: spacing.md,
        borderRadius: 12,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    activateButtonText: {
        fontSize: typography.size.md,
        fontWeight: '600',
        color: colors.common.white,
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
});
