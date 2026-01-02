import StatusModal, { StatusType } from '@/src/components/StatusModal';
import * as Linking from 'expo-linking';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../src/services/supabaseClient';
import { useAuthStore } from '../../src/store/useAuthStore';

export default function ProfileScreen() {
    const { t, i18n } = useTranslation();
    const { profile } = useAuthStore();

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

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) showModal('error', 'Error al Salir', error.message);
    };

    const toggleLanguage = () => {
        const newLang = i18n.language === 'en' ? 'es' : 'en';
        i18n.changeLanguage(newLang);
    };

    const handleResetPassword = async () => {
        if (!profile?.email) return;

        const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
            redirectTo: Linking.createURL('reset-password'),
        });

        if (error) {
            showModal('error', 'Error', error.message);
        } else {
            showModal('success', '¡Correo Enviado!', 'Te enviamos un link para restablecer tu contraseña.');
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.name}>{profile?.full_name || 'Coach'}</Text>
            <Text style={styles.email}>{profile?.email}</Text>

            <TouchableOpacity style={styles.button} onPress={handleResetPassword}>
                <Text style={styles.buttonText}>Restablecer Contraseña</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.button} onPress={toggleLanguage}>
                <Text style={styles.buttonText}>
                    {i18n.language === 'en' ? 'Switch to Spanish' : 'Cambiar a Inglés'}
                </Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.button, styles.logoutButton]} onPress={handleLogout}>
                <Text style={styles.buttonText}>Logout</Text>
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
        flex: 1,
        padding: 20,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    name: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    email: {
        fontSize: 16,
        color: '#666',
        marginBottom: 40,
    },
    button: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
        width: '100%',
        alignItems: 'center',
        marginBottom: 15,
    },
    logoutButton: {
        backgroundColor: '#FF3B30',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
