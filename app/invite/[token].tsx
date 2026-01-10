import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import StatusModal from '@/src/components/StatusModal';
import { Button } from '@/src/design/components/Button';
import { colors } from '@/src/design/tokens/colors';
import { spacing } from '@/src/design/tokens/spacing';
import { typography } from '@/src/design/tokens/typography';
import { supabase } from '@/src/services/supabaseClient';
import { useAuthStore } from '@/src/store/useAuthStore';
import { AcademyInvitation } from '@/src/types/academy';

type InviteStatus = 'loading' | 'valid' | 'expired' | 'used' | 'error' | 'not_found';

export default function AcceptInvitationScreen() {
    const { token } = useLocalSearchParams<{ token: string }>();
    const router = useRouter();
    const { session, profile } = useAuthStore();

    const [status, setStatus] = useState<InviteStatus>('loading');
    const [invitation, setInvitation] = useState<AcademyInvitation | null>(null);
    const [isAccepting, setIsAccepting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (token) {
            fetchInvitation();
        }
    }, [token]);

    const fetchInvitation = async () => {
        setStatus('loading');

        const { data, error } = await supabase
            .from('academy_invitations')
            .select(`
                *,
                academy:academies(id, name, logo_url),
                inviter:profiles!academy_invitations_invited_by_fkey(full_name, email)
            `)
            .eq('token', token)
            .single();

        if (error || !data) {
            setStatus('not_found');
            return;
        }

        // Check if already used
        if (data.accepted_at) {
            setStatus('used');
            return;
        }

        // Check if expired
        if (new Date(data.expires_at) < new Date()) {
            setStatus('expired');
            return;
        }

        setInvitation(data as AcademyInvitation);
        setStatus('valid');
    };

    const handleAccept = async () => {
        if (!invitation || !session?.user) return;

        setIsAccepting(true);
        setError('');

        try {
            // Add user as member
            const { error: memberError } = await supabase
                .from('academy_members')
                .insert({
                    academy_id: invitation.academy_id,
                    user_id: session.user.id,
                    role: invitation.role,
                    invited_by: invitation.invited_by,
                    accepted_at: new Date().toISOString(),
                });

            if (memberError) throw memberError;

            // Mark invitation as accepted
            await supabase
                .from('academy_invitations')
                .update({ accepted_at: new Date().toISOString() })
                .eq('id', invitation.id);

            // Set as current academy if user doesn't have one
            if (!profile?.current_academy_id) {
                await supabase
                    .from('profiles')
                    .update({ current_academy_id: invitation.academy_id })
                    .eq('id', session.user.id);
            }

            setShowSuccess(true);
        } catch (err: any) {
            if (err.message?.includes('duplicate')) {
                setError('Ya sos miembro de esta academia');
            } else {
                setError(err.message || 'Error al aceptar la invitación');
            }
        } finally {
            setIsAccepting(false);
        }
    };

    const handleSuccessClose = () => {
        setShowSuccess(false);
        router.replace('/(tabs)');
    };

    const handleLogin = () => {
        router.push('/login');
    };

    const getRoleLabel = (role: string) => {
        const labels: Record<string, string> = {
            coach: 'Entrenador',
            assistant: 'Asistente',
            viewer: 'Observador',
        };
        return labels[role] || role;
    };

    // Loading state
    if (status === 'loading') {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color={colors.primary[500]} />
                <Text style={styles.loadingText}>Verificando invitación...</Text>
            </View>
        );
    }

    // Error states
    if (status === 'not_found') {
        return (
            <View style={styles.container}>
                <View style={styles.errorIcon}>
                    <Ionicons name="alert-circle" size={64} color={colors.error[500]} />
                </View>
                <Text style={styles.errorTitle}>Invitación no encontrada</Text>
                <Text style={styles.errorMessage}>
                    El enlace de invitación no es válido o fue eliminado.
                </Text>
                <Button
                    label="Ir al inicio"
                    variant="outline"
                    onPress={() => router.replace('/')}
                    style={styles.button}
                />
            </View>
        );
    }

    if (status === 'expired') {
        return (
            <View style={styles.container}>
                <View style={styles.errorIcon}>
                    <Ionicons name="time" size={64} color={colors.warning[500]} />
                </View>
                <Text style={styles.errorTitle}>Invitación expirada</Text>
                <Text style={styles.errorMessage}>
                    Esta invitación ya no es válida. Pedí una nueva al administrador de la academia.
                </Text>
                <Button
                    label="Ir al inicio"
                    variant="outline"
                    onPress={() => router.replace('/')}
                    style={styles.button}
                />
            </View>
        );
    }

    if (status === 'used') {
        return (
            <View style={styles.container}>
                <View style={styles.successIcon}>
                    <Ionicons name="checkmark-circle" size={64} color={colors.success[500]} />
                </View>
                <Text style={styles.successTitle}>Invitación ya aceptada</Text>
                <Text style={styles.errorMessage}>
                    Esta invitación ya fue utilizada.
                </Text>
                <Button
                    label="Ir a la app"
                    variant="primary"
                    onPress={() => router.replace('/(tabs)')}
                    style={styles.button}
                />
            </View>
        );
    }

    // Valid invitation - show acceptance UI
    return (
        <View style={styles.container}>
            <View style={styles.card}>
                {/* Academy info */}
                <View style={styles.academyHeader}>
                    <View style={styles.academyIcon}>
                        <Ionicons name="school" size={40} color={colors.primary[500]} />
                    </View>
                    <Text style={styles.academyName}>
                        {(invitation as any)?.academy?.name || 'Academia'}
                    </Text>
                </View>

                <Text style={styles.inviteText}>
                    Te han invitado a unirte como
                </Text>

                <View style={styles.roleBadge}>
                    <Text style={styles.roleText}>
                        {getRoleLabel(invitation?.role || '')}
                    </Text>
                </View>

                <Text style={styles.inviterText}>
                    Invitado por: {(invitation as any)?.inviter?.full_name || (invitation as any)?.inviter?.email}
                </Text>

                {error ? (
                    <Text style={styles.errorText}>{error}</Text>
                ) : null}

                {/* Actions */}
                {session ? (
                    <View style={styles.actions}>
                        <Button
                            label="Aceptar invitación"
                            variant="primary"
                            size="lg"
                            leftIcon={<Ionicons name="checkmark" size={24} color={colors.common.white} />}
                            onPress={handleAccept}
                            loading={isAccepting}
                            style={styles.acceptButton}
                        />
                        <Button
                            label="Cancelar"
                            variant="ghost"
                            onPress={() => router.back()}
                        />
                    </View>
                ) : (
                    <View style={styles.actions}>
                        <Text style={styles.loginPrompt}>
                            Necesitás iniciar sesión para aceptar esta invitación
                        </Text>
                        <Button
                            label="Iniciar sesión"
                            variant="primary"
                            size="lg"
                            onPress={handleLogin}
                            style={styles.acceptButton}
                        />
                        <Button
                            label="Crear cuenta"
                            variant="outline"
                            onPress={() => router.push('/register')}
                        />
                    </View>
                )}
            </View>

            <StatusModal
                visible={showSuccess}
                type="success"
                title="¡Te uniste a la academia!"
                message={`Ahora sos parte de ${(invitation as any)?.academy?.name}`}
                onClose={handleSuccessClose}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.neutral[50],
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    loadingText: {
        marginTop: spacing.md,
        fontSize: typography.size.md,
        color: colors.neutral[500],
    },
    errorIcon: {
        marginBottom: spacing.lg,
    },
    successIcon: {
        marginBottom: spacing.lg,
    },
    errorTitle: {
        fontSize: typography.size.xl,
        fontWeight: '700',
        color: colors.neutral[900],
        marginBottom: spacing.sm,
    },
    successTitle: {
        fontSize: typography.size.xl,
        fontWeight: '700',
        color: colors.success[600],
        marginBottom: spacing.sm,
    },
    errorMessage: {
        fontSize: typography.size.md,
        color: colors.neutral[500],
        textAlign: 'center',
        marginBottom: spacing.xl,
    },
    button: {
        minWidth: 200,
    },
    card: {
        backgroundColor: colors.common.white,
        borderRadius: 20,
        padding: spacing.xl,
        width: '100%',
        maxWidth: 400,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
    },
    academyHeader: {
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    academyIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.primary[50],
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    academyName: {
        fontSize: typography.size.xl,
        fontWeight: '700',
        color: colors.neutral[900],
        textAlign: 'center',
    },
    inviteText: {
        fontSize: typography.size.md,
        color: colors.neutral[500],
        marginBottom: spacing.sm,
    },
    roleBadge: {
        backgroundColor: colors.primary[100],
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: 20,
        marginBottom: spacing.md,
    },
    roleText: {
        fontSize: typography.size.lg,
        fontWeight: '600',
        color: colors.primary[700],
    },
    inviterText: {
        fontSize: typography.size.sm,
        color: colors.neutral[500],
        marginBottom: spacing.xl,
    },
    errorText: {
        color: colors.error[500],
        fontSize: typography.size.sm,
        marginBottom: spacing.md,
        textAlign: 'center',
    },
    actions: {
        width: '100%',
        gap: spacing.sm,
    },
    acceptButton: {
        width: '100%',
    },
    loginPrompt: {
        fontSize: typography.size.sm,
        color: colors.neutral[500],
        textAlign: 'center',
        marginBottom: spacing.md,
    },
});
