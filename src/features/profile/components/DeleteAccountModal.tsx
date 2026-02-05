import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { useAccountDeletion } from '../hooks/useAccountDeletion';

interface DeleteAccountModalProps {
    visible: boolean;
    onClose: () => void;
}

export default function DeleteAccountModal({ visible, onClose }: DeleteAccountModalProps) {
    const { t } = useTranslation();
    const [confirmText, setConfirmText] = useState('');
    const [archiveAcademies, setArchiveAcademies] = useState(false);
    const [step, setStep] = useState<'warning' | 'academies' | 'confirm'>('warning');

    const {
        soleOwnedAcademies,
        hasSoleOwnedAcademies,
        isLoadingAcademies,
        requestDeletion
    } = useAccountDeletion();

    const confirmWord = 'ELIMINAR';
    const isConfirmValid = confirmText.toUpperCase() === confirmWord;

    const handleProceed = () => {
        if (hasSoleOwnedAcademies && step === 'warning') {
            setStep('academies');
        } else if (step === 'academies') {
            setStep('confirm');
        } else {
            setStep('confirm');
        }
    };

    const handleDelete = async () => {
        if (!isConfirmValid) return;

        try {
            const result = await requestDeletion.mutateAsync(archiveAcademies);
            if (!result.success && result.error === 'OWNS_ACADEMIES') {
                // User still owns academies, show academy step
                setStep('academies');
            }
            // If success, hook will sign out user
        } catch (error) {
            console.error('Error requesting deletion:', error);
        }
    };

    const handleClose = () => {
        setConfirmText('');
        setArchiveAcademies(false);
        setStep('warning');
        onClose();
    };

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={handleClose}>
            <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.overlay}>
                <Animated.View entering={ZoomIn} style={styles.container}>

                    {/* Warning Step */}
                    {step === 'warning' && (
                        <>
                            <Ionicons name="warning" size={60} color="#FF3B30" />
                            <Text style={styles.title}>Eliminar cuenta</Text>
                            <ScrollView style={styles.scrollContent}>
                                <Text style={styles.message}>
                                    Esta acción eliminará permanentemente tu cuenta y todos tus datos después de 30 días.
                                </Text>
                                <View style={styles.warningBox}>
                                    <Text style={styles.warningText}>⚠️ Se eliminarán:</Text>
                                    <Text style={styles.listItem}>• Tu perfil y configuración</Text>
                                    <Text style={styles.listItem}>• Membresías en academias</Text>
                                    <Text style={styles.listItem}>• Historial de actividad</Text>
                                </View>
                                <Text style={styles.graceNote}>
                                    Tendrás 30 días para cancelar la eliminación iniciando sesión nuevamente.
                                </Text>
                            </ScrollView>
                            <View style={styles.buttonContainer}>
                                <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
                                    <Text style={styles.cancelButtonText}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.dangerButton, isLoadingAcademies && styles.disabledButton]}
                                    onPress={handleProceed}
                                    disabled={isLoadingAcademies}
                                >
                                    {isLoadingAcademies ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <Text style={styles.buttonText}>Continuar</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </>
                    )}

                    {/* Academies Step (only if user owns academies) */}
                    {step === 'academies' && (
                        <>
                            <Ionicons name="business" size={60} color="#FF9500" />
                            <Text style={styles.title}>Academias sin transferir</Text>
                            <ScrollView style={styles.scrollContent}>
                                <Text style={styles.message}>
                                    Sos el único dueño de las siguientes academias:
                                </Text>
                                {soleOwnedAcademies.map((academy) => (
                                    <View key={academy.id} style={styles.academyItem}>
                                        <Ionicons name="tennisball" size={20} color="#34C759" />
                                        <View style={styles.academyInfo}>
                                            <Text style={styles.academyName}>{academy.name}</Text>
                                            <Text style={styles.academyMembers}>
                                                {academy.member_count} {academy.member_count === 1 ? 'miembro' : 'miembros'}
                                            </Text>
                                        </View>
                                    </View>
                                ))}
                                <TouchableOpacity
                                    style={styles.checkbox}
                                    onPress={() => setArchiveAcademies(!archiveAcademies)}
                                >
                                    <Ionicons
                                        name={archiveAcademies ? "checkbox" : "square-outline"}
                                        size={24}
                                        color={archiveAcademies ? "#FF3B30" : "#666"}
                                    />
                                    <Text style={styles.checkboxText}>
                                        Entiendo que estas academias y todos sus datos serán eliminados
                                    </Text>
                                </TouchableOpacity>
                            </ScrollView>
                            <View style={styles.buttonContainer}>
                                <TouchableOpacity style={styles.cancelButton} onPress={() => setStep('warning')}>
                                    <Text style={styles.cancelButtonText}>Atrás</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.dangerButton, !archiveAcademies && styles.disabledButton]}
                                    onPress={handleProceed}
                                    disabled={!archiveAcademies}
                                >
                                    <Text style={styles.buttonText}>Continuar</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}

                    {/* Confirm Step */}
                    {step === 'confirm' && (
                        <>
                            <Ionicons name="trash" size={60} color="#FF3B30" />
                            <Text style={styles.title}>Confirmar eliminación</Text>
                            <Text style={styles.message}>
                                Escribí <Text style={styles.confirmWord}>{confirmWord}</Text> para confirmar:
                            </Text>
                            <TextInput
                                style={styles.input}
                                value={confirmText}
                                onChangeText={setConfirmText}
                                placeholder={confirmWord}
                                autoCapitalize="characters"
                                autoCorrect={false}
                            />
                            <View style={styles.buttonContainer}>
                                <TouchableOpacity
                                    style={styles.cancelButton}
                                    onPress={() => setStep(hasSoleOwnedAcademies ? 'academies' : 'warning')}
                                >
                                    <Text style={styles.cancelButtonText}>Atrás</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.dangerButton, (!isConfirmValid || requestDeletion.isPending) && styles.disabledButton]}
                                    onPress={handleDelete}
                                    disabled={!isConfirmValid || requestDeletion.isPending}
                                >
                                    {requestDeletion.isPending ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <Text style={styles.buttonText}>Eliminar cuenta</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </>
                    )}

                </Animated.View>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    container: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 25,
        width: '100%',
        maxWidth: 380,
        maxHeight: '80%',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 5,
    },
    scrollContent: {
        width: '100%',
        maxHeight: 300,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        marginTop: 15,
        marginBottom: 10,
        color: '#333',
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 15,
        lineHeight: 22,
    },
    warningBox: {
        backgroundColor: '#FFF5F5',
        borderRadius: 12,
        padding: 15,
        marginBottom: 15,
        width: '100%',
    },
    warningText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#FF3B30',
        marginBottom: 8,
    },
    listItem: {
        fontSize: 14,
        color: '#666',
        marginLeft: 5,
        marginBottom: 4,
    },
    graceNote: {
        fontSize: 14,
        color: '#34C759',
        textAlign: 'center',
        fontStyle: 'italic',
        marginBottom: 15,
    },
    academyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8F8F8',
        borderRadius: 10,
        padding: 12,
        marginBottom: 8,
        gap: 12,
    },
    academyInfo: {
        flex: 1,
    },
    academyName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    academyMembers: {
        fontSize: 12,
        color: '#999',
    },
    checkbox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 10,
        marginBottom: 15,
    },
    checkboxText: {
        flex: 1,
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
    },
    confirmWord: {
        fontWeight: 'bold',
        color: '#FF3B30',
    },
    input: {
        width: '100%',
        borderWidth: 2,
        borderColor: '#E5E5E5',
        borderRadius: 12,
        padding: 15,
        fontSize: 18,
        textAlign: 'center',
        fontWeight: 'bold',
        letterSpacing: 3,
        marginBottom: 20,
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
        marginTop: 10,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: '#F2F2F7',
    },
    cancelButtonText: {
        color: '#666',
        fontSize: 16,
        fontWeight: 'bold',
    },
    dangerButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: '#FF3B30',
    },
    disabledButton: {
        opacity: 0.5,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
