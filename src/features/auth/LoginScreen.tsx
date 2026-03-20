import { Badge, Button, Input, spacing, typography } from '@/src/design';
import { Theme } from '@/src/design/theme';
import { useTheme } from '@/src/hooks/useTheme';
import { showError, showInfo } from '@/src/utils/toast';
import { AntDesign, Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../services/supabaseClient';

export default function LoginScreen() {
    const { theme } = useTheme();
    const styles = React.useMemo(() => createStyles(theme), [theme]);
    const { t } = useTranslation();
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loginMode, setLoginMode] = useState<'password' | 'otp'>('password');
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
                data: { intended_role: 'player' }
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
        const { error } = await supabase.auth.verifyOtp({
            email,
            token: otpCode,
            type: 'email',
        });

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
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: Linking.createURL(''),
            },
        });

        if (error) showError(t('auth.error'), error.message);
        setLoading(false);
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

                                {loginMode === 'password' ? (
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

                                        <TouchableOpacity
                                            style={styles.forgotPassword}
                                            onPress={() => setLoginMode('otp')}
                                        >
                                          <Text style={[styles.forgotPasswordText, { color: theme.components.button.primary.bg }]}>
                                            Entrar como Alumno (Sin contraseña)
                                          </Text>
                                        </TouchableOpacity>
                                    </>
                                ) : (
                                    <>
                                        <Button
                                            label="Enviar código de acceso"
                                            onPress={() => handleSendOtp()}
                                            loading={loading}
                                            style={styles.loginButton}
                                        />

                                        <TouchableOpacity
                                            style={styles.forgotPassword}
                                            onPress={() => setLoginMode('password')}
                                        >
                                          <Text style={[styles.forgotPasswordText, { color: theme.text.secondary }]}>
                                            Volver al login con contraseña
                                          </Text>
                                        </TouchableOpacity>
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
                                    style={{ textAlign: 'center', fontSize: 24 }}
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
