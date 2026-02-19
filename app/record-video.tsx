import VideoAssignmentModal from '@/src/components/VideoAssignmentModal';
import { Button } from '@/src/design/components/Button';
import { Theme } from '@/src/design/theme';
import { useTheme } from '@/src/hooks/useTheme';
import { VideoService } from '@/src/services/VideoService';
import { useAuthStore } from '@/src/store/useAuthStore';
import { showError, showSuccess } from '@/src/utils/toast';
import { Ionicons } from '@expo/vector-icons';
import { CameraType, CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function VideoRecordingScreen() {
    const { theme } = useTheme();
    const router = useRouter();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const { user } = useAuthStore();

    const [permission, requestPermission] = useCameraPermissions();
    const [micPermission, requestMicPermission] = useMicrophonePermissions();
    const cameraRef = useRef<CameraView>(null);

    const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'stopping' | 'processing'>('idle');
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [videoUri, setVideoUri] = useState<string | null>(null);
    const [cameraType, setCameraType] = useState<CameraType>('back');
    const [isUploading, setIsUploading] = useState(false); // Renamed from isProcessing to avoid confusion

    // Assignment Modal State
    const [assignmentModalVisible, setAssignmentModalVisible] = useState(false);

    // Timer ref
    const timerRef = useRef<any>(null);

    useEffect(() => {
        if (!permission?.granted) requestPermission();
        if (!micPermission?.granted) requestMicPermission();

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const toggleCameraType = () => {
        if (recordingStatus !== 'idle') return;
        setCameraType(current => (current === 'back' ? 'front' : 'back'));
    };

    const startRecording = async () => {
        if (recordingStatus !== 'idle') return; // Strict guard

        if (cameraRef.current) {
            try {
                console.log('Starting recording...');
                setRecordingStatus('recording');
                setRecordingDuration(0);

                if (timerRef.current) clearInterval(timerRef.current);
                timerRef.current = setInterval(() => {
                    setRecordingDuration(prev => prev + 1);
                }, 1000);

                const video = await cameraRef.current.recordAsync({
                    maxDuration: 60,
                });

                console.log('Recording stopped. Result:', video);

                // Clear timer
                if (timerRef.current) clearInterval(timerRef.current);

                if (video?.uri) {
                    console.log('Video URI captured:', video.uri);
                    setVideoUri(video.uri);
                    setRecordingStatus('processing'); // Prevent immediate restart
                    setAssignmentModalVisible(true);
                } else {
                    console.warn('No video URI returned.');
                    setRecordingStatus('idle');
                    showError("Error", "No se pudo capturar el video");
                }
            } catch (error) {
                console.error('Recording failed error:', error);
                setRecordingStatus('idle');
                if (timerRef.current) clearInterval(timerRef.current);
                showError("Error", "Falló la grabación del video");
            }
        }
    };

    const stopRecording = () => {
        console.log('Stop recording requested...');
        if (cameraRef.current && recordingStatus === 'recording') {
            setRecordingStatus('stopping');
            try {
                cameraRef.current.stopRecording();
            } catch (e) {
                console.error('Error calling stopRecording:', e);
                setRecordingStatus('idle'); // Fallback
            }
        }
    };

    const pickVideo = async () => {
        try {
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                allowsEditing: true,
                quality: 1,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const video = result.assets[0];
                console.log('Web Video captured:', video.uri);
                setVideoUri(video.uri);
                setRecordingDuration(video.duration ? Math.round(video.duration / 1000) : 0);
                setAssignmentModalVisible(true);
            }
        } catch (error) {
            console.error('Error picking video:', error);
            showError("Error", "No se pudo abrir la cámara");
        }
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleAssignPlayer = async (playerId: string | null) => {
        if (!videoUri || !user) return;

        try {
            setIsUploading(true);
            setAssignmentModalVisible(false); // Hide modal, show loading overlay or stay on screen

            // 1. Compress
            const compressedUri = await VideoService.compressVideo(videoUri);

            // 2. Thumbnail
            const thumbnailUri = await VideoService.generateThumbnail(compressedUri);

            // 3. Create DB Record
            const metadata = {
                duration_secs: recordingDuration,
                folder: playerId ? 'player_videos' : 'general',
            };

            const videoRecord = await VideoService.createVideoRecord(
                user.id,
                playerId,
                `Video ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
                metadata
            );

            // 4. Upload Files
            await VideoService.uploadFiles(
                compressedUri,
                thumbnailUri,
                videoRecord.storage_path,
                videoRecord.thumbnail_path
            );

            // 5. Mark as Ready
            await VideoService.markAsReady(videoRecord.id);

            showSuccess("Éxito", "Video subido correctamente");
            router.back();

        } catch (error: any) {
            console.error(error);
            showError("Error", error.message || "Falló el procesamiento del video");
            setIsUploading(false);
            setAssignmentModalVisible(true); // Re-open modal to allow retry? or just stay here
            // setVideoUri(null); // Keep videoUri to allow retry
        }
    };

    // Render permissions check
    if (!permission?.granted || !micPermission?.granted) {
        return (
            <View style={styles.container}>
                <Text style={{ textAlign: 'center', color: theme.text.primary, marginTop: 100 }}>Necesitamos permiso para usar la cámara y micrófono.</Text>
                <Button label="Otorgar Permisos" onPress={() => { requestPermission(); requestMicPermission(); }} style={{ marginTop: 20, alignSelf: 'center' }} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {videoUri ? (
                // Captured State (Background or Preview)
                <View style={styles.previewContainer}>
                    <Text style={styles.timerText}>Video Capturado</Text>
                </View>
            ) : Platform.OS === 'web' ? (
                <View style={styles.previewContainer}>
                    <Text style={[styles.instructionText, { marginBottom: 20 }]}>
                        En la versión web, utilizaremos la grabadora nativa de tu dispositivo.
                    </Text>
                    <Button
                        label="Abrir Cámara"
                        onPress={pickVideo}
                        variant="primary"
                    />
                    <Button
                        label="Volver"
                        onPress={() => router.back()}
                        variant="outline"
                        style={{ marginTop: 20 }}
                    />
                </View>
            ) : (
                <CameraView
                    style={styles.camera}
                    facing={cameraType}
                    mode="video"
                    ref={cameraRef}
                >
                    <View style={styles.controlsContainer}>
                        <View style={styles.topControls}>
                            <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
                                <Ionicons name="close" size={28} color="white" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={toggleCameraType} style={styles.iconButton}>
                                <Ionicons name="camera-reverse" size={28} color="white" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.bottomControls}>
                            <View style={styles.timerContainer}>
                                {recordingStatus === 'recording' && <View style={styles.redDot} />}
                                <Text style={styles.timerText}>{formatDuration(recordingDuration)}</Text>
                            </View>

                            <TouchableOpacity
                                onPress={recordingStatus === 'recording' ? stopRecording : startRecording}
                                disabled={recordingStatus === 'stopping' || recordingStatus === 'processing'}
                                style={[
                                    styles.recordButton,
                                    recordingStatus === 'recording' && styles.recordingButton,
                                    (recordingStatus === 'stopping' || recordingStatus === 'processing') && { opacity: 0.5 }
                                ]}
                            >
                                <View style={[styles.recordButtonInner, recordingStatus === 'recording' && styles.recordingButtonInner]} />
                            </TouchableOpacity>

                            <Text style={styles.instructionText}>
                                {recordingStatus === 'stopping' || recordingStatus === 'processing'
                                    ? 'Procesando...'
                                    : (recordingStatus === 'recording' ? 'Toque para detener' : 'Toque para grabar')
                                }
                            </Text>
                        </View>
                    </View>
                </CameraView>
            )}

            <VideoAssignmentModal
                visible={assignmentModalVisible}
                onClose={() => {
                    setAssignmentModalVisible(false);
                    setVideoUri(null);
                    setRecordingStatus('idle'); // Allow new recording
                }}
                onSelectPlayer={handleAssignPlayer}
                isUploading={isUploading}
            />

            {isUploading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={{ color: '#fff', marginTop: 10 }}>Procesando y Subiendo...</Text>
                </View>
            )}
        </SafeAreaView>
    );
}

const createStyles = (theme: Theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    camera: {
        flex: 1,
    },
    previewContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'black',
    },
    controlsContainer: {
        flex: 1,
        justifyContent: 'space-between',
        padding: 20,
    },
    topControls: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 40,
    },
    bottomControls: {
        alignItems: 'center',
        marginBottom: 40,
    },
    iconButton: {
        padding: 10,
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 25,
    },
    recordButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 6,
        borderColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    recordingButton: {
        borderColor: 'red',
    },
    recordButtonInner: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'red',
    },
    recordingButtonInner: {
        width: 40,
        height: 40,
        borderRadius: 6, // Square when recording
    },
    timerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginBottom: 20,
    },
    redDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: 'red',
        marginRight: 8,
    },
    timerText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '600',
    },
    instructionText: {
        color: 'white',
        fontSize: 14,
        marginTop: 10,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
    }
});
