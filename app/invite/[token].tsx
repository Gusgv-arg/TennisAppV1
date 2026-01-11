import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

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

    interface InvitationRPCResponse {
        id: string;
        email: string;
        role: string;
        academy_id: string;
        academy_name: string;
        academy_logo_url: string;
        inviter_id: string;
        inviter_name: string;
        inviter_email: string;
        expires_at: string;
        accepted_at: string | null;
    }

    const fetchInvitation = async () => {
        setStatus('loading');

        try {
            // Use RPC to bypass RLS and get all details securely
            const { data, error } = await supabase
                .rpc('get_invitation_by_token', { lookup_token: token })
                .single();

            if (error || !data) {
                console.error('Error fetching invitation:', error);
                setStatus('not_found');
                return;
            }

            const rpcData = data as InvitationRPCResponse;

            // Check if already used
            if (rpcData.accepted_at) {
                setStatus('used');
                return;
            }

            // Check if expired
            if (new Date(rpcData.expires_at) < new Date()) {
                setStatus('expired');
                return;
            }

            // Transform RPC result to AcademyInvitation shape
            const invitationData: AcademyInvitation = {
                id: rpcData.id,
                email: rpcData.email,
                role: rpcData.role as any,
                academy_id: rpcData.academy_id,
                invited_by: rpcData.inviter_id,
                token: token,
                expires_at: rpcData.expires_at,
                accepted_at: rpcData.accepted_at,
                created_at: new Date().toISOString(), // Mock, not returned by RPC
                academy: {
                    id: rpcData.academy_id,
                    name: rpcData.academy_name,
                    logo_url: rpcData.academy_logo_url,
                    created_by: '', // Mock, not display
                    slug: '', // Mock
                    created_at: '', // Mock
                    settings: {
                        currency: 'ARS',
                        timezone: 'America/Argentina/Buenos_Aires',
                        payments_enabled: false
                    }, // Mock
                    updated_at: '', // Mock
                },
                inviter: {
                    full_name: rpcData.inviter_name,
                    email: rpcData.inviter_email,
                }
            };

            setInvitation(invitationData);
            setStatus('valid');

        } catch (err) {
            console.error('Unexpected error:', err);
            setStatus('not_found');
        }
    };

    const handleAccept = async () => {
        if (!invitation || !session?.user) return;

        setIsAccepting(true);
        setError('');

        try {
            // Use Secure RPC for atomic acceptance (Member Insert + Invite Update)
            const { error: rpcError } = await supabase
                .rpc('accept_invitation', {
                    token_str: token,
                    target_user_id: session.user.id
                });

            if (rpcError) throw rpcError;

            setShowSuccess(true);
        } catch (err: any) {
            console.error('Accept Invitation Error:', err);
            // Even if RPC fails, check if it was due to 'duplicate' (already member) to show success
            if (err.message?.includes('duplicate') || err.message?.includes('violates unique constraint')) {
                setShowSuccess(true);
            } else {
                setError('Error al aceptar la invitación. Intenta nuevamente.');
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
            coach: 'Profesor',
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
            {showSuccess ? (
                <SuccessView
                    academyName={(invitation as any)?.academy?.name || 'la Academia'}
                    onContinue={handleSuccessClose}
                />
            ) : (
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
                        <View style={styles.errorContainer}>
                            <Ionicons name="information-circle" size={24} color={colors.primary[600]} />
                            <Text style={styles.errorTextHighlight}>{error}</Text>
                        </View>
                    ) : null}

                    {/* Actions */}
                    {session ? (
                        session.user.email?.toLowerCase() === invitation?.email?.toLowerCase() ? (
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
                            <View style={styles.warningContainer}>
                                <Ionicons name="warning" size={32} color={colors.warning[500]} />
                                <Text style={styles.warningTitle}>Cuenta incorrecta</Text>
                                <Text style={styles.warningText}>
                                    Estás conectado como <Text style={{ fontWeight: '700' }}>{session.user.email}</Text>,
                                    pero esta invitación fue enviada a <Text style={{ fontWeight: '700' }}>{invitation?.email}</Text>.
                                </Text>
                                <Button
                                    label="Cerrar sesión y cambiar cuenta"
                                    variant="outline"
                                    onPress={async () => {
                                        await supabase.auth.signOut();
                                        router.push('/login');
                                    }}
                                    style={{ marginTop: spacing.md }}
                                />
                            </View>
                        )
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
            )}
        </View>
    );
}

// Separate component for success state to keep main component clean
function SuccessView({ academyName, onContinue }: { academyName: string, onContinue: () => void }) {
    return (
        <View style={styles.card}>
            <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
                <View style={[styles.successIcon, { marginBottom: spacing.lg }]}>
                    <Ionicons name="rocket" size={64} color={colors.primary[500]} />
                </View>

                <Text style={[styles.successTitle, { fontSize: typography.size.xl, marginBottom: spacing.sm, textAlign: 'center' }]}>
                    ¡Bienvenido a bordo! 🚀
                </Text>

                <Text style={[styles.errorMessage, { marginBottom: spacing.xl, maxWidth: 300 }]}>
                    Ya sos oficialmente parte del equipo de <Text style={{ fontWeight: '700', color: colors.neutral[900] }}>{academyName}</Text>.
                </Text>

                <View style={{ width: '100%', gap: spacing.md }}>
                    <Button
                        label="Ir al Dashboard"
                        variant="primary"
                        size="lg"
                        onPress={onContinue}
                        style={{ width: '100%' }}
                        rightIcon={<Ionicons name="arrow-forward" size={20} color={colors.common.white} />}
                    />
                </View>

                <Text style={{ marginTop: spacing.xl, fontSize: typography.size.xs, color: colors.neutral[400], textAlign: 'center' }}>
                    Todo listo para empezar a gestionar tus clases y alumnos.
                </Text>
            </View>
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
        shadowColor: 'rgba(0,0,0,0.1)',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
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
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary[50],
        padding: spacing.md,
        borderRadius: 12,
        marginBottom: spacing.lg,
        gap: spacing.sm,
    },
    errorTextHighlight: {
        color: colors.primary[700],
        fontSize: typography.size.sm,
        fontWeight: '500',
        flex: 1,
    },
    warningContainer: {
        alignItems: 'center',
        backgroundColor: colors.warning[50],
        padding: spacing.lg,
        borderRadius: 12,
        marginBottom: spacing.md,
        width: '100%',
    },
    warningTitle: {
        fontSize: typography.size.lg,
        fontWeight: '700',
        color: colors.warning[700],
        marginTop: spacing.sm,
        marginBottom: spacing.xs,
    },
    warningText: {
        fontSize: typography.size.md,
        color: colors.warning[800],
        textAlign: 'center',
        marginBottom: spacing.md,
        lineHeight: 22,
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
