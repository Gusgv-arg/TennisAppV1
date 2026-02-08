import StatusModal, { StatusType } from '@/src/components/StatusModal';
import { Badge, Button, Input, spacing, typography } from '@/src/design';
import { Theme } from '@/src/design/theme';
import { useTheme } from '@/src/hooks/useTheme';
import { AntDesign, Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../services/supabaseClient';

export default function RegisterScreen() {
    const { theme } = useTheme();
    const styles = React.useMemo(() => createStyles(theme), [theme]);
    const { t } = useTranslation();
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    // Modal state
    const [modalVisible, setModalVisible] = useState(false);
    const [modalConfig, setModalConfig] = useState<{
        type: StatusType;
        title: string;
        message: string;
        onClose: () => void;
    }>({
        type: 'info',
        title: '',
        message: '',
        onClose: () => setModalVisible(false)
    });

    const showModal = (type: StatusType, title: string, message: string, onClose?: () => void) => {
        setModalConfig({
            type,
            title,
            message,
            onClose: () => {
                setModalVisible(false);
                if (onClose) onClose();
            }
        });
        setModalVisible(true);
    };

    async function signUpWithEmail() {
        if (!fullName || !email || !password || !confirmPassword) {
            showModal('warning', t('auth.error'), t('auth.fillAllFields'));
            return;
        }
        if (password !== confirmPassword) {
            showModal('warning', t('auth.error'), t('auth.passwordMismatch'));
            return;
        }
        if (password.length < 6) {
            showModal('warning', t('auth.error'), t('auth.passwordTooShort'));
            return;
        }

        setLoading(true);
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: fullName,
                },
            },
        });

        if (error) {
            showModal('error', t('auth.error'), error.message);
            setLoading(false);
        } else if (data.session) {
            // Auto-login successful (e.g. dev environment or email confirm disabled).
            // Do NOT show "Check Email" modal.
            // Do NOT setLoading(false) to keep UI blocked while redirect happens via _layout auth listener.
        } else {
            // Email confirmation required
            showModal('success', t('auth.success'), t('auth.checkEmail'), () => router.back());
            setLoading(false);
        }
    }

    async function signUpWithGoogle() {
        setLoading(true);
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: Linking.createURL(''),
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                },
            },
        });

        if (error) showModal('error', t('auth.error'), error.message);
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
                            <Badge label="Beta" variant="primary" style={styles.betaBadge} />
                        </View>
                        <Text style={styles.tagline}>{t('auth.createAccount')}</Text>
                    </View>

                    {/* Register Form */}
                    <View style={styles.formContainer}>
                        <Input
                            label={t('auth.fullName')}
                            onChangeText={(text) => setFullName(text)}
                            value={fullName}
                            placeholder={t('auth.fullNamePlaceholder')}
                            autoCapitalize="words"
                            leftIcon={<Ionicons name="person-outline" size={20} color={theme.text.tertiary} />}
                        />

                        <Input
                            label={t('auth.email')}
                            onChangeText={(text) => setEmail(text)}
                            value={email}
                            placeholder="email@ejemplo.com"
                            autoCapitalize={'none'}
                            keyboardType="email-address"
                            leftIcon={<Ionicons name="mail-outline" size={20} color={theme.text.tertiary} />}
                        />

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

                        <Input
                            label={t('auth.confirmPassword')}
                            onChangeText={(text) => setConfirmPassword(text)}
                            value={confirmPassword}
                            secureTextEntry={!showConfirmPassword}
                            placeholder="••••••••"
                            autoCapitalize={'none'}
                            leftIcon={<Ionicons name="lock-closed-outline" size={20} color={theme.text.tertiary} />}
                            rightIcon={
                                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                                    <Ionicons
                                        name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                                        size={20}
                                        color={theme.text.tertiary}
                                    />
                                </TouchableOpacity>
                            }
                        />

                        <Button
                            label={t('auth.register')}
                            onPress={() => signUpWithEmail()}
                            loading={loading}
                            style={styles.registerButton}
                        />
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
                        onPress={() => signUpWithGoogle()}
                        disabled={loading}
                        leftIcon={<AntDesign name="google" size={20} color="#DB4437" style={{ marginRight: 10 }} />}
                        style={styles.googleButton}
                        labelStyle={styles.googleButtonText}
                    />

                    {/* Login Link */}
                    <View style={styles.loginContainer}>
                        <Text style={[styles.loginText, { color: theme.text.secondary }]}>{t('auth.hasAccount')}</Text>
                        <TouchableOpacity onPress={() => router.back()}>
                            <Text style={[styles.loginLink, { color: theme.components.button.primary.bg }]}>{t('auth.login')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>

            <StatusModal
                visible={modalVisible}
                type={modalConfig.type}
                title={modalConfig.title}
                message={modalConfig.message}
                onClose={modalConfig.onClose}
            />
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
        alignItems: 'center',
        gap: spacing.xs,
    },
    betaBadge: {
        marginTop: 4,
    },
    formContainer: {
        gap: spacing.sm,
    },
    registerButton: {
        marginTop: spacing.md,
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
    loginContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: spacing.lg,
        gap: spacing.xs,
    },
    loginText: {
        fontSize: typography.size.sm,
    },
    loginLink: {
        fontSize: typography.size.sm,
        fontWeight: '600',
    },
    termsContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: spacing.md,
        gap: spacing.sm,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: theme.border.default,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 2,
    },
    checkboxChecked: {
        backgroundColor: theme.components.button.primary.bg,
        borderColor: theme.components.button.primary.bg,
    },
    termsText: {
        flex: 1,
        fontSize: typography.size.sm,
        color: theme.text.secondary,
        lineHeight: 20,
    },
    termsLink: {
        color: theme.components.button.primary.bg,
        fontWeight: '600',
    },
});
