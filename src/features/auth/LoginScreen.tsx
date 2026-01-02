import StatusModal, { StatusType } from '@/src/components/StatusModal';
import { Button, Input, colors, spacing } from '@/src/design';
import { AntDesign } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
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
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) showModal('error', 'Error de Inicio', error.message);
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

        if (error) showModal('error', 'Error de Google', error.message);
        setLoading(false);
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>{t('welcome')}</Text>

            <Button
                label="Continuar con Google"
                variant="outline"
                onPress={() => signInWithGoogle()}
                disabled={loading}
                leftIcon={<AntDesign name="google" size={20} color="#DB4437" style={{ marginRight: 10 }} />}
                style={styles.googleButton}
                labelStyle={styles.googleButtonText}
            />

            <View style={styles.separatorContainer}>
                <View style={styles.separatorLine} />
                <Text style={styles.separatorText}>o</Text>
                <View style={styles.separatorLine} />
            </View>

            <Input
                label="Email"
                onChangeText={(text) => setEmail(text)}
                value={email}
                placeholder="email@address.com"
                autoCapitalize={'none'}
                keyboardType="email-address"
            />

            <Input
                label="Contraseña"
                onChangeText={(text) => setPassword(text)}
                value={password}
                secureTextEntry={true}
                placeholder="Tu contraseña"
                autoCapitalize={'none'}
            />

            <Button
                label={t('login')}
                onPress={() => signInWithEmail()}
                loading={loading}
                style={styles.loginButton}
            />

            <View style={styles.linksContainer}>
                <Button
                    label="¿Olvidaste tu contraseña?"
                    variant="ghost"
                    size="sm"
                    onPress={() => router.push('/forgot-password')}
                />

                <Button
                    label="¿No tienes cuenta? Regístrate"
                    variant="ghost"
                    size="sm"
                    onPress={() => router.push('/register')}
                />
            </View>

            <StatusModal
                visible={modalVisible}
                type={modalConfig.type}
                title={modalConfig.title}
                message={modalConfig.message}
                onClose={modalConfig.onClose}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: spacing.xl,
        flex: 1,
        justifyContent: 'center',
        backgroundColor: colors.common.white,
    },
    title: {
        fontSize: 32,
        fontWeight: '700',
        marginBottom: 40,
        textAlign: 'center',
        color: colors.neutral[900],
    },
    googleButton: {
        borderColor: colors.neutral[200],
        marginBottom: spacing.md,
    },
    googleButtonText: {
        color: colors.neutral[700],
    },
    loginButton: {
        marginTop: spacing.md,
    },
    separatorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: spacing.xl,
    },
    separatorLine: {
        flex: 1,
        height: 1,
        backgroundColor: colors.neutral[100],
    },
    separatorText: {
        marginHorizontal: spacing.md,
        color: colors.neutral[400],
        fontSize: 16,
    },
    linksContainer: {
        marginTop: spacing.xl,
        alignItems: 'center',
    },
});
