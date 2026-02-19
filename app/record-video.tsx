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

const VideoRecordingScreen = () => {
    const { theme } = useTheme();
    const router = useRouter();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const { user } = useAuthStore();

    // Shared State
    const [videoUri, setVideoUri] = useState<string | null>(null);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [assignmentModalVisible, setAssignmentModalVisible] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // Common Handlers
    const handleAssignPlayer = async (playerId: string | null, title: string, stroke: string | null) => {
        if (!videoUri || !user) return;

        try {
            setIsUploading(true);
            const compressedUri = await VideoService.compressVideo(videoUri);
            const thumbnailUri = await VideoService.generateThumbnail(compressedUri);

            const metadata = {
                duration_secs: recordingDuration,
                folder: playerId ? 'player_videos' : 'general',
                hasThumbnail: !!thumbnailUri,
            };

            const videoRecord = await VideoService.createVideoRecord(
                user.id,
                playerId,
                title,
                stroke,
                metadata
            );

            await VideoService.uploadFiles(
                compressedUri,
                thumbnailUri,
                videoRecord.storage_path,
                videoRecord.thumbnail_path
            );

            await VideoService.markAsReady(videoRecord.id);

            showSuccess("Éxito", "Video subido correctamente");
            router.back();

        } catch (error: any) {
            console.error(error);
            showError("Error", error.message || "Falló el procesamiento del video");
            setIsUploading(false);
            setAssignmentModalVisible(true);
        }
    };

    const handleVideoSelected = (uri: string, duration: number) => {
        setVideoUri(uri);
        setRecordingDuration(duration);
        setAssignmentModalVisible(true);
    };

    return (
        <SafeAreaView style={styles.container}>
            {videoUri ? (
                <View style={styles.previewContainer}>
                    <Text style={styles.timerText}>Video Capturado</Text>
                </View>
            ) : Platform.OS === 'web' ? (
                <WebRecorder
                    onVideoSelected={handleVideoSelected}
                    styles={styles}
                    router={router}
                />
            ) : (
                <NativeCameraRecorder
                    onVideoCaptured={handleVideoSelected}
                    styles={styles}
                    router={router}
                    theme={theme}
                />
            )}

            <VideoAssignmentModal
                visible={assignmentModalVisible}
                onClose={() => {
                    setAssignmentModalVisible(false);
                    setVideoUri(null);
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
};

// Web Component (No Camera Hooks)
const WebRecorder = ({ onVideoSelected, styles, router }: any) => {
    const pickVideo = async () => {
        try {
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                allowsEditing: true,
                quality: 1,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const video = result.assets[0];
                onVideoSelected(video.uri, video.duration ? Math.round(video.duration / 1000) : 0);
            }
        } catch (error) {
            console.error('Error picking video:', error);
            showError("Error", "No se pudo abrir la cámara");
        }
    };

    const pickFromGallery = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                allowsEditing: true,
                quality: 1,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const video = result.assets[0];
                onVideoSelected(video.uri, video.duration ? Math.round(video.duration / 1000) : 0);
            }
        } catch (error) {
            console.error('Error picking video:', error);
            showError("Error", "No se pudo abrir la galería");
        }
    };

    return (
        <View style={styles.previewContainer}>
            <Text style={[styles.instructionText, { marginBottom: 20 }]}>
                Sube un video grabado previamente desde tu dispositivo.
            </Text>
            <View style={{ gap: 15 }}>
                <Button
                    label="Grabar/Subir Video"
                    onPress={pickVideo}
                    variant="primary"
                />
                <Button
                    label="Elegir de Galería"
                    onPress={pickFromGallery}
                    variant="outline"
                />
            </View>
            <Button
                label="Volver"
                onPress={() => router.back()}
                variant="ghost"
                style={{ marginTop: 20 }}
            />
        </View>
    );
};

// Native Component (Has Camera Hooks)
const NativeCameraRecorder = ({ onVideoCaptured, styles, router, theme }: any) => {
    const [permission, requestPermission] = useCameraPermissions();
    const [micPermission, requestMicPermission] = useMicrophonePermissions();
    const cameraRef = useRef<CameraView>(null);
    const [cameraType, setCameraType] = useState<CameraType>('back');
    const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'stopping' | 'processing'>('idle');
    const [recordingDuration, setRecordingDuration] = useState(0);
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
        if (recordingStatus !== 'idle' || !cameraRef.current) return;
        try {
            setRecordingStatus('recording');
            setRecordingDuration(0);
            timerRef.current = setInterval(() => setRecordingDuration(p => p + 1), 1000);

            const video = await cameraRef.current.recordAsync({
                maxDuration: 60,
                // @ts-ignore - Codec might not be typed in all versions but supported
                codec: 'avc1', // Force H.264/AVC for compatibility
            });

            if (timerRef.current) clearInterval(timerRef.current);
            if (video?.uri) {
                setRecordingStatus('processing');
                onVideoCaptured(video.uri, recordingDuration);
            } else {
                setRecordingStatus('idle');
                showError("Error", "No se pudo capturar el video");
            }
        } catch (error) {
            console.error(error);
            setRecordingStatus('idle');
            if (timerRef.current) clearInterval(timerRef.current);
            showError("Error", "Falló la grabación");
        }
    };

    const stopRecording = () => {
        if (cameraRef.current && recordingStatus === 'recording') {
            setRecordingStatus('stopping');
            cameraRef.current.stopRecording();
        }
    };

    const pickFromGallery = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                allowsEditing: true,
                quality: 1,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const video = result.assets[0];
                onVideoCaptured(video.uri, video.duration ? Math.round(video.duration / 1000) : 0);
            }
        } catch (error) {
            showError("Error", "No se pudo abrir la galería");
        }
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (!permission?.granted || !micPermission?.granted) {
        return (
            <View style={styles.container}>
                <Text style={{ textAlign: 'center', color: theme.text.primary, marginTop: 100 }}>Necesitamos permiso para usar la cámara y micrófono.</Text>
                <Button label="Otorgar Permisos" onPress={() => { requestPermission(); requestMicPermission(); }} style={{ marginTop: 20, alignSelf: 'center' }} />
            </View>
        );
    }

    return (
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

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 40 }}>
                        <TouchableOpacity
                            onPress={pickFromGallery}
                            disabled={recordingStatus !== 'idle'}
                            style={styles.galleryButton}
                        >
                            <Ionicons name="images-outline" size={28} color="white" />
                        </TouchableOpacity>

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

                        <View style={{ width: 40 }} />
                    </View>

                    <Text style={styles.instructionText}>
                        {recordingStatus === 'stopping' || recordingStatus === 'processing'
                            ? 'Procesando...'
                            : (recordingStatus === 'recording' ? 'Toque para detener' : 'Toque para grabar')
                        }
                    </Text>
                </View>
            </View>
        </CameraView>
    );
};

export default VideoRecordingScreen;

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
    },
    galleryButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.5)',
    },
});
