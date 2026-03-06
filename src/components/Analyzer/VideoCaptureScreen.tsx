import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import React, { useRef, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface VideoCaptureScreenProps {
    onVideoSelected: (videoUri: string) => void;
    onCancel: () => void;
}

export const VideoCaptureScreen: React.FC<VideoCaptureScreenProps> = ({ onVideoSelected, onCancel }) => {

    // UI States
    const [facing, setFacing] = useState<'back' | 'front'>('back');
    const [isRecording, setIsRecording] = useState(false);
    const cameraRef = useRef<CameraView>(null);

    // Expo Permissions (Camera & Mic requeridos para grabar un MP4 con sonido ambiental)
    const [camPermission, requestCamPermission] = useCameraPermissions();
    const [micPermission, requestMicPermission] = useMicrophonePermissions();

    if (!camPermission || !micPermission) {
        return <View style={styles.container} />; // Loading permissions...
    }

    if (!camPermission.granted || !micPermission.granted) {
        return (
            <View style={styles.permissionContainer}>
                <Text style={styles.permissionText}>El Análisis Biomecánico requiere acceso a la Cámara y al Micrófono para grabar tu saque.</Text>
                <TouchableOpacity style={styles.actionBtn} onPress={() => {
                    requestCamPermission();
                    requestMicPermission();
                }}>
                    <Text style={styles.btnText}>Conceder Permisos</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#333', marginTop: 10 }]} onPress={onCancel}>
                    <Text style={styles.btnText}>Volver</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const toggleCameraFacing = () => {
        setFacing(current => (current === 'back' ? 'front' : 'back'));
    };

    const handleRecordVideo = async () => {
        if (!cameraRef.current) return;

        if (isRecording) {
            cameraRef.current.stopRecording();
            setIsRecording(false);
        } else {
            setIsRecording(true);
            try {
                // Graba hasta que se llame a stopRecording()
                const videoData = await cameraRef.current.recordAsync({
                    maxDuration: 60, // Límite de 60 segundos por precaución de peso
                });

                if (videoData && videoData.uri) {
                    onVideoSelected(videoData.uri);
                }
            } catch (error) {
                console.error("Error al grabar:", error);
                Alert.alert("Error", "No se pudo grabar el video.");
            } finally {
                setIsRecording(false);
            }
        }
    };

    const handlePickFromGallery = async () => {
        // Pedimos permiso de Galería (MediaLibrary) on-the-fly
        const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!mediaPermission.granted) {
            Alert.alert("Permiso Denegado", "Necesitamos acceso a tus fotos para elegir un video.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['videos'], // Solo Videos
            allowsEditing: true, // Permite recortarle el inicio/fin para aislar el saque
            quality: 1, // Max calidad
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            onVideoSelected(result.assets[0].uri);
        }
    };

    return (
        <View style={styles.container}>
            {/* Viewfinder Hides Status bar naturally in full screen modes */}
            <CameraView
                style={styles.camera}
                facing={facing}
                mode="video"
                ref={cameraRef}
            >
                {/* Header Controls */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.iconBtn} onPress={onCancel}>
                        <Ionicons name="close" size={28} color="#FFF" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={toggleCameraFacing} disabled={isRecording}>
                        <Ionicons name="camera-reverse-outline" size={28} color={isRecording ? '#888' : '#FFF'} />
                    </TouchableOpacity>
                </View>

                {/* Footer Controls (Shoot / Gallery) */}
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={styles.galleryBtn}
                        onPress={handlePickFromGallery}
                        disabled={isRecording}
                    >
                        <Ionicons name="images-outline" size={28} color={isRecording ? '#888' : '#FFF'} />
                        <Text style={styles.galleryText}>Galería</Text>
                    </TouchableOpacity>

                    {/* Shutter Button Central */}
                    <TouchableOpacity
                        style={[styles.recordBtn, isRecording && styles.recordingState]}
                        onPress={handleRecordVideo}
                    >
                        <View style={[styles.innerRecordBtn, isRecording && styles.innerRecordingState]} />
                    </TouchableOpacity>

                    {/* Placeholder fantasma para balancear el flex row (espacio simétrico) */}
                    <View style={{ width: 60 }} />
                </View>

                {/* Status Indicator flotante */}
                {isRecording && (
                    <View style={styles.recordingIndicator}>
                        <View style={styles.redDot} />
                        <Text style={styles.recordingText}>GRABANDO</Text>
                    </View>
                )}

            </CameraView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        backgroundColor: '#121212', // Premium Dark
    },
    permissionText: {
        color: '#FFF',
        textAlign: 'center',
        marginBottom: 24,
        fontSize: 16,
        lineHeight: 24,
    },
    actionBtn: {
        backgroundColor: '#CCFF00', // Premium Lime
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 8,
        width: '100%',
        alignItems: 'center'
    },
    btnText: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: 16,
    },
    camera: {
        flex: 1,
        justifyContent: 'space-between',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 50 : 30, // SafeArea in-place avoidance
    },
    iconBtn: {
        padding: 10,
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderRadius: 20,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 30,
        paddingBottom: 50,
        backgroundColor: 'rgba(0,0,0,0.3)', // Slight shadow base
        paddingTop: 20,
    },
    galleryBtn: {
        alignItems: 'center',
        padding: 10,
    },
    galleryText: {
        color: '#FFF',
        fontSize: 12,
        marginTop: 4,
        fontWeight: '600'
    },
    recordBtn: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'transparent',
        borderWidth: 4,
        borderColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    recordingState: {
        borderColor: '#FF4444',
    },
    innerRecordBtn: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#FF4444',
    },
    innerRecordingState: {
        width: 30,
        height: 30,
        borderRadius: 4, // Square red stop symbol
    },
    recordingIndicator: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 60 : 40,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 0, 0, 0.2)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    redDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#FF4444',
        marginRight: 8,
    },
    recordingText: {
        color: '#FF4444',
        fontWeight: 'bold',
        fontSize: 14,
        letterSpacing: 1,
    }
});
