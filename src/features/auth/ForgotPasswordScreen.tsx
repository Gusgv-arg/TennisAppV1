import StatusModal, { StatusType } from '@/src/components/StatusModal';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../services/supabaseClient';

export default function ForgotPasswordScreen() {
    const router = useRouter();
    const [email, setEmail] = useState('');
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

    async function handleResetPassword() {
        if (!email) {
            showModal('error', 'Error', 'Por favor, ingresa tu email');
            return;
        }

        setLoading(true);
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: Linking.createURL('reset-password'),
        });

        if (error) {
            showModal('error', 'Error', error.message);
        } else {
            showModal('success', '¡Éxito!', 'Se ha enviado un correo para restablecer tu contraseña.', () => {
                router.back();
            });
        }
        setLoading(false);
    }

    return (
        <View style={styles.container}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <Text style={styles.backText}>← Volver</Text>
            </TouchableOpacity>

            <Text style={styles.title}>Restablecer Contraseña</Text>
            <Text style={styles.subtitle}>
                Ingresa tu correo electrónico y te enviaremos un link para cambiar tu contraseña.
            </Text>

            <TextInput
                style={styles.input}
                onChangeText={(text) => setEmail(text)}
                value={email}
                placeholder="email@address.com"
                autoCapitalize={'none'}
                keyboardType="email-address"
            />

            <TouchableOpacity
                style={styles.button}
                onPress={handleResetPassword}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.buttonText}>Enviar correo</Text>
                )}
            </TouchableOpacity>

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
        padding: 20,
        flex: 1,
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
    backButton: {
        position: 'absolute',
        top: 50,
        left: 20,
    },
    backText: {
        color: '#007AFF',
        fontSize: 16,
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
