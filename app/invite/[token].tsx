import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

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

    // Auto-accept when user arrives via magic link with matching email
    useEffect(() => {
        if (status === 'valid' && session?.user && invitation && !showSuccess && !isAccepting) {
            const userEmail = session.user.email?.toLowerCase();
            const inviteEmail = invitation.email?.toLowerCase();

            // If emails match, auto-accept the invitation
            if (userEmail && inviteEmail && userEmail === inviteEmail) {
                console.log('Auto-accepting invitation for matching email:', userEmail);
                handleAccept();
            }
        }
    }, [status, session, invitation]);

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
        <ScrollView
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
        >
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
                        <InlineRegistrationForm
                            email={invitation?.email || ''}
                            inviteToken={token}
                            onRegistrationComplete={async (userId: string) => {
                                console.log('[AcceptInvitation] onRegistrationComplete called with userId:', userId);
                                // Accept invitation directly after registration
                                try {
                                    console.log('[AcceptInvitation] Calling accept_invitation RPC...');
                                    const { error: rpcError } = await supabase
                                        .rpc('accept_invitation', {
                                            token_str: token,
                                            target_user_id: userId
                                        });
                                    console.log('[AcceptInvitation] RPC result:', { error: rpcError });
                                    if (rpcError && !rpcError.message?.includes('duplicate')) {
                                        console.error('Accept invitation error:', rpcError);
                                    }
                                } catch (err) {
                                    console.error('Error accepting invitation:', err);
                                }
                                console.log('[AcceptInvitation] Setting showSuccess to true');
                                setShowSuccess(true);
                            }}
                        />
                    )}
                </View>
            )}
        </ScrollView>
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

// Inline registration form for new users accepting invitations
function InlineRegistrationForm({
    email,
    inviteToken,
    onRegistrationComplete
}: {
    email: string;
    inviteToken: string;
    onRegistrationComplete: (userId: string) => Promise<void>;
}) {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showLogin, setShowLogin] = useState(false);

    const handleRegister = async () => {
        console.log('[InlineRegistrationForm] handleRegister called');

        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            return;
        }
        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            console.log('[InlineRegistrationForm] Calling supabase.auth.signUp for:', email);

            const { data, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { invite_token: inviteToken },
                    // Don't require email confirmation for invited users
                    emailRedirectTo: undefined
                }
            });

            console.log('[InlineRegistrationForm] SignUp response:', { data, error: signUpError });

            if (signUpError) throw signUpError;

            // Check if user is auto-confirmed (no email confirmation needed)
            if (data?.user) {
                console.log('[InlineRegistrationForm] User created, accepting invitation...');
                await onRegistrationComplete(data.user.id);
            } else {
                console.log('[InlineRegistrationForm] Unexpected state:', data);
                setError('Error inesperado. Intentá de nuevo.');
            }
        } catch (err: any) {
            console.error('[InlineRegistrationForm] Registration error:', err);
            if (err.message?.includes('already registered')) {
                // User exists, switch to login mode automatically
                console.log('[InlineRegistrationForm] User already exists, switching to login');
                setShowLogin(true);
                setError('');
            } else if (err.message?.includes('security purposes') || err.status === 429) {
                setError('Demasiados intentos. Esperá 30 segundos e intentá de nuevo.');
            } else {
                setError(err.message || 'Error al crear la cuenta');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogin = async () => {
        if (!password) {
            setError('Ingresá tu contraseña');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const { data, error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (signInError) throw signInError;

            if (data?.user) {
                console.log('[InlineRegistrationForm] Login success, accepting invitation...');
                await onRegistrationComplete(data.user.id);
            }
        } catch (err: any) {
            console.error('Login error:', err);
            setError(err.message || 'Contraseña incorrecta');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={styles.registrationContainer}>
            <View style={styles.registrationHeader}>
                <Ionicons name="person-add" size={32} color={colors.primary[500]} />
                <Text style={styles.registrationTitle}>
                    {showLogin ? 'Iniciá sesión' : 'Creá tu cuenta'}
                </Text>
                <Text style={styles.registrationSubtitle}>
                    {showLogin
                        ? 'Ingresá tu contraseña para continuar'
                        : 'Solo necesitás crear una contraseña para unirte'
                    }
                </Text>
            </View>

            <View style={styles.formContainer}>
                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Email</Text>
                    <View style={styles.emailDisplay}>
                        <Ionicons name="mail" size={18} color={colors.neutral[400]} />
                        <Text style={styles.emailText}>{email}</Text>
                        <Ionicons name="checkmark-circle" size={18} color={colors.success[500]} />
                    </View>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Contraseña</Text>
                    <TextInput
                        style={styles.textInput}
                        placeholder="Mínimo 6 caracteres"
                        placeholderTextColor={colors.neutral[400]}
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                        autoCapitalize="none"
                    />
                </View>

                {!showLogin && (
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Confirmar contraseña</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="Repetí la contraseña"
                            placeholderTextColor={colors.neutral[400]}
                            secureTextEntry
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            autoCapitalize="none"
                        />
                    </View>
                )}

                {error && (
                    <Text style={styles.errorText}>{error}</Text>
                )}

                <Button
                    label={showLogin ? "Iniciar sesión" : "Crear cuenta y unirme"}
                    variant="primary"
                    size="lg"
                    onPress={showLogin ? handleLogin : handleRegister}
                    loading={isLoading}
                    style={{ marginTop: spacing.md }}
                />

                <TouchableOpacity
                    onPress={() => {
                        setShowLogin(!showLogin);
                        setError('');
                        setPassword('');
                        setConfirmPassword('');
                    }}
                    style={{ marginTop: spacing.lg, alignItems: 'center' }}
                >
                    <Text style={styles.switchText}>
                        {showLogin
                            ? '¿No tenés cuenta? Creá una'
                            : '¿Ya tenés cuenta? Iniciá sesión'
                        }
                    </Text>
                </TouchableOpacity>
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
    scrollContainer: {
        flex: 1,
        backgroundColor: colors.neutral[50],
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
        paddingVertical: spacing.xl,
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
        marginBottom: spacing.md,
        textAlign: 'center',
    },
    successTitle: {
        fontSize: typography.size.xl,
        fontWeight: '700',
        color: colors.neutral[900],
        marginBottom: spacing.md,
        textAlign: 'center',
    },
    errorMessage: {
        fontSize: typography.size.md,
        color: colors.neutral[600],
        textAlign: 'center',
        marginBottom: spacing.xl,
    },
    card: {
        minWidth: 320,
        maxWidth: 400,
        backgroundColor: colors.common.white,
        borderRadius: 16,
        padding: spacing.xl,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        alignItems: 'center',
    },
    cardContent: {
        width: '100%',
        marginBottom: spacing.lg,
    },
    header: {
        fontSize: typography.size.xs,
        fontWeight: '600',
        color: colors.neutral[500],
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: spacing.lg,
        alignSelf: 'flex-start',
    },
    academyIcon: {
        marginBottom: spacing.lg,
    },
    academyName: {
        fontSize: typography.size.xl,
        fontWeight: '700',
        color: colors.neutral[900],
        marginBottom: spacing.lg,
        textAlign: 'center',
    },
    inviteText: {
        fontSize: typography.size.md,
        color: colors.neutral[600],
        marginBottom: spacing.md,
        textAlign: 'center',
    },
    roleBadge: {
        backgroundColor: colors.primary[100],
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.md,
        borderRadius: 16,
        marginBottom: spacing.md,
    },
    roleText: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        color: colors.primary[700],
    },
    inviterText: {
        fontSize: typography.size.sm,
        color: colors.neutral[500],
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
    button: {
        width: '100%',
    },
    academyHeader: {
        marginBottom: spacing.lg,
        alignItems: 'center',
    },
    loginPrompt: {
        fontSize: typography.size.sm,
        color: colors.neutral[500],
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    // Inline registration form styles
    registrationContainer: {
        width: '100%',
        backgroundColor: colors.neutral[50],
        borderRadius: 16,
        padding: spacing.lg,
        marginTop: spacing.md,
    },
    registrationHeader: {
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    registrationTitle: {
        fontSize: typography.size.lg,
        fontWeight: '700',
        color: colors.neutral[900],
        marginTop: spacing.sm,
    },
    registrationSubtitle: {
        fontSize: typography.size.sm,
        color: colors.neutral[500],
        textAlign: 'center',
        marginTop: spacing.xs,
    },
    formContainer: {
        width: '100%',
    },
    inputGroup: {
        marginBottom: spacing.md,
    },
    inputLabel: {
        fontSize: typography.size.sm,
        fontWeight: '600',
        color: colors.neutral[700],
        marginBottom: spacing.xs,
    },
    emailDisplay: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.neutral[100],
        padding: spacing.md,
        borderRadius: 12,
        gap: spacing.sm,
    },
    emailText: {
        flex: 1,
        fontSize: typography.size.md,
        color: colors.neutral[700],
    },
    textInput: {
        backgroundColor: colors.common.white,
        borderWidth: 1,
        borderColor: colors.neutral[200],
        borderRadius: 12,
        padding: spacing.md,
        fontSize: typography.size.md,
        color: colors.neutral[900],
    },
    switchText: {
        fontSize: typography.size.sm,
        color: colors.primary[600],
        fontWeight: '500',
    },
});
