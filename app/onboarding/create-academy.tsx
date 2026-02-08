import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import StatusModal from '@/src/components/StatusModal';
import { Button } from '@/src/design/components/Button';
import { Input } from '@/src/design/components/Input';
import { Theme } from '@/src/design/theme';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { useAcademyMutations } from '@/src/features/academy/hooks/useAcademy';
import { useTheme } from '@/src/hooks/useTheme';

export default function CreateAcademyScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const { theme } = useTheme();
    const { createAcademy } = useAcademyMutations();

    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);
    const [showErrorModal, setShowErrorModal] = useState(false);

    const handleCreate = async () => {
        if (!name.trim()) {
            setError('El nombre de la academia es requerido');
            return;
        }

        if (name.trim().length < 3) {
            setError('El nombre debe tener al menos 3 caracteres');
            return;
        }

        setError('');

        try {
            await createAcademy.mutateAsync({ name: name.trim() });
            setShowSuccess(true);
        } catch (err: any) {
            if (err.message?.includes('duplicate')) {
                setError('Ya existe una academia con ese nombre');
            } else {
                setError(err.message || 'Error al crear la academia');
            }
            setShowErrorModal(true);
        }
    };

    const handleSuccessClose = () => {
        setShowSuccess(false);
        router.replace('/(tabs)');
    };

    const styles = React.useMemo(() => createStyles(theme), [theme]);

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="school" size={48} color={theme.components.button.primary.bg} />
                    </View>
                    <Text style={styles.title}>Crea tu Academia</Text>
                    <Text style={styles.subtitle}>
                        Una academia te permite organizar tus alumnos, sesiones y pagos.
                        Podrás invitar a otros entrenadores y colaboradores.
                    </Text>
                </View>

                {/* Form */}
                <View style={styles.form}>
                    <Input
                        label="Nombre de la Academia"
                        placeholder="Ej: Academia de Tenis Norte"
                        value={name}
                        onChangeText={(text) => {
                            setName(text);
                            setError('');
                            setShowErrorModal(false);
                        }}
                        error={error}
                        leftIcon={<Ionicons name="business-outline" size={20} color={theme.text.tertiary} />}
                        autoFocus
                    />

                    <View style={styles.infoBox}>
                        <Ionicons name="information-circle-outline" size={20} color={theme.components.button.primary.bg} />
                        <Text style={styles.infoText}>
                            Serás el dueño de esta academia con acceso completo.
                            Podrás invitar a otros miembros más adelante.
                        </Text>
                    </View>
                </View>

                {/* Features preview */}
                <View style={styles.features}>
                    <Text style={styles.featuresTitle}>Con tu academia podrás:</Text>

                    <View style={styles.featureItem}>
                        <Ionicons name="people" size={24} color={theme.status.success} />
                        <View style={styles.featureText}>
                            <Text style={styles.featureLabel}>Gestionar alumnos</Text>
                            <Text style={styles.featureDesc}>Perfil, historial y seguimiento</Text>
                        </View>
                    </View>

                    <View style={styles.featureItem}>
                        <Ionicons name="calendar" size={24} color={theme.text.secondary} />
                        <View style={styles.featureText}>
                            <Text style={styles.featureLabel}>Organizar clases</Text>
                            <Text style={styles.featureDesc}>Calendario y sesiones grupales</Text>
                        </View>
                    </View>

                    <View style={styles.featureItem}>
                        <Ionicons name="cash" size={24} color={theme.status.warning} />
                        <View style={styles.featureText}>
                            <Text style={styles.featureLabel}>Cobrar cuotas</Text>
                            <Text style={styles.featureDesc}>Planes, pagos y recordatorios</Text>
                        </View>
                    </View>

                    <View style={styles.featureItem}>
                        <Ionicons name="people-circle" size={24} color={theme.components.button.primary.bg} />
                        <View style={styles.featureText}>
                            <Text style={styles.featureLabel}>Trabajar en equipo</Text>
                            <Text style={styles.featureDesc}>Invita coaches y colaboradores</Text>
                        </View>
                    </View>
                </View>

                {/* Action */}
                <View style={styles.actions}>
                    <Button
                        label="Crear Academia"
                        variant="primary"
                        size="lg"
                        leftIcon={<Ionicons name="add-circle" size={24} color="white" />}
                        onPress={handleCreate}
                        loading={createAcademy.isPending}
                        disabled={!name.trim()}
                        style={styles.createButton}
                    />
                </View>
            </ScrollView>

            <StatusModal
                visible={showSuccess}
                type="success"
                title="¡Academia creada!"
                message={`"${name}" está lista. Ya podés comenzar a agregar alumnos.`}
                onClose={handleSuccessClose}
                buttonText="Ir al Dashboard"
            />

            <StatusModal
                visible={!!error && showErrorModal}
                type="error"
                title="Error al crear"
                message={error}
                onClose={() => setShowErrorModal(false)}
            />
        </KeyboardAvoidingView>
    );
}

const createStyles = (theme: Theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background.default,
    },
    scrollContent: {
        flexGrow: 1,
        padding: spacing.lg,
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    iconContainer: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: theme.components.button.primary.bg + '15',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    title: {
        fontSize: typography.size.xxl,
        fontWeight: '700',
        color: theme.text.primary,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    subtitle: {
        fontSize: typography.size.md,
        color: theme.text.secondary,
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: spacing.md,
    },
    form: {
        marginBottom: spacing.xl,
    },
    infoBox: {
        flexDirection: 'row',
        backgroundColor: theme.components.button.primary.bg + '15',
        padding: spacing.md,
        borderRadius: 12,
        gap: spacing.sm,
        alignItems: 'flex-start',
    },
    infoText: {
        flex: 1,
        fontSize: typography.size.sm,
        color: theme.text.primary,
        lineHeight: 20,
    },
    features: {
        backgroundColor: theme.background.surface,
        padding: spacing.lg,
        borderRadius: 16,
        marginBottom: spacing.xl,
    },
    featuresTitle: {
        fontSize: typography.size.md,
        fontWeight: '600',
        color: theme.text.primary,
        marginBottom: spacing.md,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.sm,
    },
    featureText: {
        flex: 1,
    },
    featureLabel: {
        fontSize: typography.size.md,
        fontWeight: '600',
        color: theme.text.primary,
    },
    featureDesc: {
        fontSize: typography.size.sm,
        color: theme.text.secondary,
    },
    actions: {
        marginTop: 'auto',
        paddingBottom: spacing.lg,
    },
    createButton: {
        width: '100%',
    },
});
