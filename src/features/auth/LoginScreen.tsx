import StatusModal, { StatusType } from '@/src/components/StatusModal';
import { Badge, Button, Input, colors, spacing, typography } from '@/src/design';
import { AntDesign, Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../services/supabaseClient';

export default function LoginScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
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

    async function signInWithEmail() {
        if (!email || !password) {
            showModal('warning', t('auth.error'), t('auth.fillAllFields'));
            return;
        }
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) showModal('error', t('auth.error'), error.message);
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
                            <Ionicons name="tennisball" size={32} color={colors.common.white} />
                        </View>
                        <View style={styles.titleRow}>
                            <Text style={styles.brandName}>TennisApp</Text>
                            <Badge label="Beta" variant="primary" style={styles.betaBadge} />
                        </View>
                        <Text style={styles.tagline}>{t('auth.tagline')}</Text>
                    </View>

                    {/* Login Form */}
                    <View style={styles.formContainer}>
                        <Input
                            label={t('auth.email')}
                            onChangeText={(text) => setEmail(text)}
                            value={email}
                            placeholder="email@ejemplo.com"
                            autoCapitalize={'none'}
                            keyboardType="email-address"
                            leftIcon={<Ionicons name="mail-outline" size={20} color={colors.neutral[400]} />}
                        />

                        <Input
                            label={t('auth.password')}
                            onChangeText={(text) => setPassword(text)}
                            value={password}
                            secureTextEntry={true}
                            placeholder="••••••••"
                            autoCapitalize={'none'}
                            leftIcon={<Ionicons name="lock-closed-outline" size={20} color={colors.neutral[400]} />}
                        />

                        <Button
                            label={t('auth.login')}
                            onPress={() => signInWithEmail()}
                            loading={loading}
                            style={styles.loginButton}
                        />

                        <TouchableOpacity
                            style={styles.forgotPassword}
                            onPress={() => router.push('/forgot-password')}
                        >
                            <Text style={styles.forgotPasswordText}>{t('auth.forgotPassword')}</Text>
                        </TouchableOpacity>
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
                        <Text style={styles.registerText}>{t('auth.noAccount')}</Text>
                        <TouchableOpacity onPress={() => router.push('/register')}>
                            <Text style={styles.registerLink}>{t('auth.register')}</Text>
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.common.white,
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
        backgroundColor: colors.primary[500],
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.sm,
        shadowColor: colors.primary[500],
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    brandName: {
        fontSize: typography.size.xxl,
        fontWeight: '800',
        color: colors.neutral[900],
        letterSpacing: -1,
    },
    tagline: {
        fontSize: typography.size.sm,
        color: colors.neutral[500],
        marginTop: spacing.xs,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    betaBadge: {
        marginTop: 4, // Align slightly better with baseline if needed
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
        color: colors.primary[500],
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
        backgroundColor: colors.neutral[200],
    },
    separatorText: {
        marginHorizontal: spacing.md,
        color: colors.neutral[400],
        fontSize: typography.size.sm,
        fontWeight: '500',
    },
    googleButton: {
        borderColor: colors.neutral[200],
        backgroundColor: colors.common.white,
    },
    googleButtonText: {
        color: colors.neutral[700],
    },
    registerContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: spacing.lg,
        gap: spacing.xs,
    },
    registerText: {
        color: colors.neutral[500],
        fontSize: typography.size.sm,
    },
    registerLink: {
        color: colors.primary[500],
        fontSize: typography.size.sm,
        fontWeight: '600',
    },
});
