import { showError, showSuccess } from '@/src/utils/toast';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../services/supabaseClient';
import { useTranslation } from 'react-i18next';

export default function ResetPasswordScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    // Modal state


    async function handleUpdatePassword() {
        console.log('Attempting to update password...');
        if (!password) {
            showError(t('auth.error'), t('auth.resetPassword.passwordRequired'));
            return;
        }

        if (password.length < 6) {
            showError(t('auth.error'), t('auth.passwordTooShort'));
            return;
        }

        if (password !== confirmPassword) {
            showError(t('auth.error'), t('auth.passwordMismatch'));
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase.auth.updateUser({
                password: password,
            });

            if (error) {
                console.error('Error updating password:', error);
                showError(t('auth.error'), error.message);
            } else {
                console.log('Password updated successfully:', data);
                showSuccess(t('auth.success'), t('auth.resetPassword.success'));
                router.replace('/login');
            }
        } catch (err) {
            console.error('Unexpected error:', err);
            showError(t('auth.error'), t('errorOccurred'));
        } finally {
            setLoading(false);
        }
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>{t('auth.resetPassword.title')}</Text>
            <Text style={styles.subtitle}>
                {t('auth.resetPassword.subtitle')}
            </Text>

            <TextInput
                style={styles.input}
                onChangeText={(text) => setPassword(text)}
                value={password}
                placeholder={t('auth.resetPassword.placeholder')}
                secureTextEntry={true}
                autoCapitalize={'none'}
            />

            <TextInput
                style={styles.input}
                onChangeText={(text) => setConfirmPassword(text)}
                value={confirmPassword}
                placeholder={t('auth.resetPassword.confirmPlaceholder')}
                secureTextEntry={true}
                autoCapitalize={'none'}
            />

            <TouchableOpacity
                style={styles.button}
                onPress={handleUpdatePassword}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.buttonText}>{t('auth.resetPassword.button')}</Text>
                )}
            </TouchableOpacity>


        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 20,
        flex: 1,
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
        textAlign: 'center',
        color: '#333',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 30,
    },
    input: {
        height: 50,
        borderColor: '#ddd',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 15,
        marginBottom: 20,
        fontSize: 16,
    },
    button: {
        backgroundColor: '#007AFF',
        height: 50,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
});
