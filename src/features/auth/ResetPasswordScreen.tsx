import StatusModal, { StatusType } from '@/src/components/StatusModal';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../services/supabaseClient';

export default function ResetPasswordScreen() {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
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

    async function handleUpdatePassword() {
        console.log('Attempting to update password...');
        if (!password) {
            showModal('error', 'Error', 'Por favor, ingresa una nueva contraseña');
            return;
        }

        if (password.length < 6) {
            showModal('error', 'Error', 'La contraseña debe tener al menos 6 caracteres');
            return;
        }

        if (password !== confirmPassword) {
            showModal('error', 'Error', 'Las contraseñas no coinciden');
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase.auth.updateUser({
                password: password,
            });

            if (error) {
                console.error('Error updating password:', error);
                showModal('error', 'Error', error.message);
            } else {
                console.log('Password updated successfully:', data);
                showModal('success', '¡Éxito!', 'Tu contraseña ha sido actualizada correctamente.', () => {
                    router.replace('/login');
                });
            }
        } catch (err) {
            console.error('Unexpected error:', err);
            showModal('error', 'Error', 'Ocurrió un error inesperado.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Nueva Contraseña</Text>
            <Text style={styles.subtitle}>
                Ingresa tu nueva contraseña a continuación.
            </Text>

            <TextInput
                style={styles.input}
                onChangeText={(text) => setPassword(text)}
                value={password}
                placeholder="Nueva contraseña"
                secureTextEntry={true}
                autoCapitalize={'none'}
            />

            <TextInput
                style={styles.input}
                onChangeText={(text) => setConfirmPassword(text)}
                value={confirmPassword}
                placeholder="Confirmar contraseña"
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
                    <Text style={styles.buttonText}>Actualizar Contraseña</Text>
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
