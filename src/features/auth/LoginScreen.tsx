import { Badge, Button, Input, spacing, typography } from '@/src/design';
import { Theme } from '@/src/design/theme';
import { useTheme } from '@/src/hooks/useTheme';
import { showError, showInfo } from '@/src/utils/toast';
import { AntDesign, Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../services/supabaseClient';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
    const { theme } = useTheme();
    const styles = React.useMemo(() => createStyles(theme), [theme]);
    const { t } = useTranslation();
    const router = useRouter();
    const params = useLocalSearchParams();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loginRole, setLoginRole] = useState<'coach' | 'player'>(params.role === 'player' ? 'player' : 'coach');
    const [otpStep, setOtpStep] = useState(false);
    const [otpCode, setOtpCode] = useState('');

    async function handleSendOtp() {
        if (!email) {
            showInfo(t('auth.error'), t('auth.fillAllFields'));
            return;
        }
        setLoading(true);
        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                shouldCreateUser: true,
                emailRedirectTo: Linking.createURL('login'),
                data: { intended_role: loginRole }
            }
        });

        if (error) {
            showError(t('auth.error'), error.message);
        } else {
            setOtpStep(true);
            showInfo("Código enviado", "Revisá tu casilla de correo.");
        }
        setLoading(false);
    }

    async function handleVerifyOtp() {
        if (!otpCode) return;
        setLoading(true);
        console.log('[handleVerifyOtp] Verifying OTP...');
        const { data, error } = await supabase.auth.verifyOtp({
            email,
            token: otpCode,
            type: 'email',
        });

        console.log('[handleVerifyOtp] Result:', { hasSession: !!data.session, error });

        if (error) {
            showError("Código inválido", "El código ingresado no es correcto o expiró.");
        }
        setLoading(false);
    }

    // Modal state


    async function signInWithEmail() {
        if (!email || !password) {
            showInfo(t('auth.error'), t('auth.fillAllFields'));
            return;
        }
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) showError(t('auth.error'), error.message);
        setLoading(false);
    }

    async function signInWithGoogle() {
        setLoading(true);
        try {
            if (Platform.OS === 'web') {
                const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: Linking.createURL(''),
                    },
                });
                if (error) throw error;
            } else {
                // Native flow using expo-web-browser
                const { data, error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: 'tennisappv1://google-auth',
                        skipBrowserRedirect: true,
                    },
                });

                if (error) throw error;

                const result = await WebBrowser.openAuthSessionAsync(
                    data?.url ?? '',
                    'tennisappv1://google-auth'
                );

                if (result.type === 'success' && result.url) {
                    const { url } = result;
                    console.debug('[signInWithGoogle] Callback URL:', url);
                    
                    const parsed = Linking.parse(url);
                    if (!parsed) {
                        console.error('[signInWithGoogle] Failed to parse URL');
                        return;
                    }

                    // Try to get tokens from queryParams or from the raw URL string (fragments)
                    const qp = parsed.queryParams || {};
                    const access_token = (qp.access_token || url.match(/access_token=([^&#]+)/)?.[1]) as string | undefined;
                    const refresh_token = (qp.refresh_token || url.match(/refresh_token=([^&#]+)/)?.[1]) as string | undefined;

                    if (access_token && refresh_token) {
                        console.debug('[signInWithGoogle] Setting session...');
                        const { error: sessionError } = await supabase.auth.setSession({
                            access_token,
                            refresh_token,
                        });
                        if (sessionError) throw sessionError;
                    } else {
                        console.error('[signInWithGoogle] Tokens not found. Found queryParams:', qp);
                        showError(t('auth.error'), "No se pudieron obtener las credenciales del login.");
                    }
                }
            }
        } catch (error: any) {
            showError(t('auth.error'), error.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.content}>
                    {/* Logo/Brand */}
                    <View style={styles.brandContainer}>
                        <View style={styles.logoCircle}>
                            <Ionicons name="tennisball" size={32} color="white" />
                        </View>
                        <View style={styles.titleRow}>
                            <Text style={styles.brandName}>Tenis-Lab</Text>
                            <Badge label="Beta" variant="primary" size="sm" style={styles.betaBadge} />
                        </View>
                        <Text style={styles.tagline}>{t('auth.tagline')}</Text>
                    </View>

                    {!otpStep && (
                        <View style={{ flexDirection: 'row', backgroundColor: theme.background.subtle, padding: 4, borderRadius: 24, marginBottom: 20 }}>
                            <TouchableOpacity 
                                style={{ flex: 1, paddingVertical: 10, borderRadius: 20, backgroundColor: loginRole === 'player' ? theme.components.button.primary.bg : 'transparent', alignItems: 'center' }}
                                onPress={() => setLoginRole('player')}
                            >
                                <Text style={{ color: loginRole === 'player' ? '#FFF' : theme.text.secondary, fontWeight: '600' }}>Soy Alumno</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={{ flex: 1, paddingVertical: 10, borderRadius: 20, backgroundColor: loginRole === 'coach' ? theme.components.button.primary.bg : 'transparent', alignItems: 'center' }}
                                onPress={() => setLoginRole('coach')}
                            >
                                <Text style={{ color: loginRole === 'coach' ? '#fff' : theme.text.secondary, fontWeight: '600' }}>Soy Profesor</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Login Form */}
                    <View style={styles.formContainer}>
                        {!otpStep ? (
                            <>
                                <Input
                                    label={t('auth.email')}
                                    onChangeText={(text) => setEmail(text)}
                                    value={email}
                                    placeholder="email@ejemplo.com"
                                    autoCapitalize={'none'}
                                    keyboardType="email-address"
                                    leftIcon={<Ionicons name="mail-outline" size={20} color={theme.text.tertiary} />}
                                />

                                {loginRole === 'coach' ? (
                                    <>
                                        <Input
                                            label={t('auth.password')}
                                            onChangeText={(text) => setPassword(text)}
                                            value={password}
                                            secureTextEntry={!showPassword}
                                            placeholder="••••••••"
                                            autoCapitalize={'none'}
                                            leftIcon={<Ionicons name="lock-closed-outline" size={20} color={theme.text.tertiary} />}
                                            rightIcon={
                                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                                    <Ionicons
                                                        name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                                                        size={20}
                                                        color={theme.text.tertiary}
                                                    />
                                                </TouchableOpacity>
                                            }
                                        />

                                        <Button
                                            label={t('auth.login')}
                                            onPress={() => signInWithEmail()}
                                            loading={loading}
                                            style={styles.loginButton}
                                        />
                                    </>
                                ) : (
                                    <>
                                        <Button
                                            label="Enviar Código de Acceso (Sin contraseña)"
                                            onPress={() => handleSendOtp()}
                                            loading={loading}
                                            style={styles.loginButton}
                                        />
                                        <Text style={{ textAlign: 'center', color: theme.text.tertiary, fontSize: 13, marginTop: 12 }}>Te enviaremos un código de 6 números</Text>
                                    </>
                                )}
                            </>
                        ) : (
                            <>
                                <View style={{ alignItems: 'center', marginBottom: 20 }}>
                                    <View style={[styles.logoCircle, { width: 48, height: 48, backgroundColor: theme.background.subtle }]}>
                                        <Ionicons name="mail-open-outline" size={24} color={theme.components.button.primary.bg} />
                                    </View>
                                    <Text style={[styles.tagline, { textAlign: 'center', color: theme.text.primary, fontWeight: '600' }]}>
                                        Ingresá el código que te enviamos a{"\n"}{email}
                                    </Text>
                                </View>

                                <Input
                                    label="Código de acceso"
                                    onChangeText={(text) => setOtpCode(text)}
                                    value={otpCode}
                                    placeholder="Ingresa tu código"
                                    keyboardType="number-pad"
                                    style={{ textAlign: 'center', fontSize: 24, color: '#FFFFFF' }}
                                />

                                <Button
                                    label="Verificar y Entrar"
                                    onPress={() => handleVerifyOtp()}
                                    loading={loading}
                                    disabled={otpCode.trim().length === 0}
                                    style={styles.loginButton}
                                />

                                <TouchableOpacity
                                    style={styles.forgotPassword}
                                    onPress={() => setOtpStep(false)}
                                >
                                  <Text style={[styles.forgotPasswordText, { color: theme.text.secondary }]}>
                                    Usar otro email
                                  </Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>

                    {loginRole === 'coach' && !otpStep && (
                        <>
                            {/* Separator */}
                            <View style={styles.separatorContainer}>
                                <View style={styles.separatorLine} />
                                <Text style={styles.separatorText}>{t('auth.or')}</Text>
                                <View style={styles.separatorLine} />
                            </View>

                            {/* Social Login */}
                            <Button
                                label={t('auth.continueWithGoogle')}
                                variant="outline"
                                onPress={() => signInWithGoogle()}
                                disabled={loading}
                                leftIcon={<AntDesign name="google" size={20} color="#DB4437" style={{ marginRight: 10 }} />}
                                style={styles.googleButton}
                                labelStyle={styles.googleButtonText}
                            />

                            {/* Register Link */}
                            <View style={styles.registerContainer}>
                                <Text style={[styles.registerText, { color: theme.text.secondary }]}>{t('auth.noAccount')}</Text>
                                <TouchableOpacity onPress={() => router.push('/register')}>
                                    <Text style={[styles.registerLink, { color: theme.components.button.primary.bg }]}>{t('auth.register')}</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </View>
            </ScrollView>


        </KeyboardAvoidingView>
    );
}

const createStyles = (theme: Theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background.surface,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingVertical: spacing.md,
    },
    content: {
        paddingHorizontal: spacing.xl,
        maxWidth: 400,
        width: '100%',
        alignSelf: 'center',
    },
    brandContainer: {
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    logoCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: theme.components.button.primary.bg,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.sm,
        shadowColor: theme.components.button.primary.bg,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    brandName: {
        fontSize: typography.size.xxl,
        fontWeight: '800',
        color: theme.text.primary,
        letterSpacing: -1,
    },
    tagline: {
        fontSize: typography.size.sm,
        color: theme.text.secondary,
        marginTop: spacing.xs,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    betaBadge: {
        marginLeft: spacing.xs,
        marginTop: 2,
    },
    formContainer: {
        gap: spacing.sm,
    },
    loginButton: {
        marginTop: spacing.md,
    },
    forgotPassword: {
        alignSelf: 'center',
        marginTop: spacing.sm,
    },
    forgotPasswordText: {
        fontSize: typography.size.sm,
        fontWeight: '500',
    },
    separatorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: spacing.md,
    },
    separatorLine: {
        flex: 1,
        height: 1,
        backgroundColor: theme.border.default,
    },
    separatorText: {
        marginHorizontal: spacing.md,
        color: theme.text.tertiary,
        fontSize: typography.size.sm,
        fontWeight: '500',
    },
    googleButton: {
        borderColor: theme.border.default,
        backgroundColor: theme.background.surface,
    },
    googleButtonText: {
        color: theme.text.primary,
    },
    registerContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: spacing.lg,
        gap: spacing.xs,
    },
    registerText: {
        fontSize: typography.size.sm,
    },
    registerLink: {
        fontSize: typography.size.sm,
        fontWeight: '600',
    },
});
