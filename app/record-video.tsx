import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { RecordingTipsModal } from '../src/components/Analyzer/RecordingTipsModal';
import VideoAssignmentModal from '../src/components/VideoAssignmentModal';
import { Button } from '../src/design/components/Button';
import { Theme } from '../src/design/theme';
import { useTheme } from '../src/hooks/useTheme';
import { VideoService } from '../src/services/VideoService';
import { supabase } from '../src/services/supabaseClient';
import { useAuthStore } from '../src/store/useAuthStore';
import { showError, showSuccess } from '../src/utils/toast';

// Video upload guardrails
const MAX_VIDEO_SIZE_MB = 100;
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024; // 100MB
const MAX_VIDEO_DURATION_SECS = 20; // 20 seconds max for stroke analysis

const validateVideo = (asset: ImagePicker.ImagePickerAsset): string | null => {
    if (asset.fileSize && asset.fileSize > MAX_VIDEO_SIZE_BYTES) {
        const sizeMB = (asset.fileSize / (1024 * 1024)).toFixed(1);
        return `El video pesa ${sizeMB}MB y supera el límite de ${MAX_VIDEO_SIZE_MB}MB. Intentá con un video más corto o de menor calidad.`;
    }
    if (asset.duration && (asset.duration / 1000) > MAX_VIDEO_DURATION_SECS) {
        return `El video dura ${Math.round(asset.duration / 1000)} segundos y supera el límite de ${MAX_VIDEO_DURATION_SECS} segundos. Grabá solo el golpe que querés analizar.`;
    }
    return null;
};

const VideoRecordingScreen = () => {
    const { theme } = useTheme();
    const router = useRouter();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const { user, profile } = useAuthStore();

    // Shared State
    const [videoUri, setVideoUri] = useState<string | null>(null);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [assignmentModalVisible, setAssignmentModalVisible] = useState(false);
    const [tipsVisible, setTipsVisible] = useState(true); // Default to true for the first time
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    // Common Handlers
    const handleAssignPlayer = async (playerId: string | null, title: string, stroke: string | null) => {
        if (!videoUri || !user) return;

        try {
            setIsUploading(true);

            // Check video quota before proceeding
            const { data: quota, error: quotaError } = await supabase.rpc('check_video_quota', { p_coach_id: user.id });
            if (quotaError) throw quotaError;
            if (quota && !quota.can_upload) {
                showError(
                    "Límite alcanzado",
                    `Has alcanzado el límite de ${quota.max_allowed} videos. Eliminá videos antiguos para poder subir nuevos.`
                );
                setIsUploading(false);
                return;
            }

            const compressedUri = await VideoService.compressVideo(videoUri);
            const thumbnailUri = await VideoService.generateThumbnail(compressedUri);

            const metadata = {
                duration_secs: recordingDuration,
                folder: playerId ? 'player_videos' : 'general',
                hasThumbnail: !!thumbnailUri,
            };

            const videoRecord = await VideoService.createVideoRecord(
                user.id,
                profile?.current_academy_id || null,
                playerId,
                title,
                stroke,
                metadata
            );

            await VideoService.uploadFiles(
                compressedUri,
                thumbnailUri,
                videoRecord.storage_path,
                videoRecord.thumbnail_path,
                (progress) => setUploadProgress(progress)
            );

            await VideoService.markAsReady(videoRecord.id);

            showSuccess("Éxito", "Video subido correctamente");
            setIsUploading(false);
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
            ) : (
                <UnifiedRecorder
                    onVideoSelected={handleVideoSelected}
                    styles={styles}
                    router={router}
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

            <RecordingTipsModal
                visible={tipsVisible}
                onClose={() => setTipsVisible(false)}
            />

            {isUploading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#CCFF00" />
                    <Text style={{ color: '#fff', marginTop: 15, fontWeight: '600', fontSize: 16 }}>
                        {uploadProgress < 0.05 ? 'Normalizando...' : `Subiendo: ${Math.round(uploadProgress * 100)}%`}
                    </Text>
                </View>
            )}

            {/* Help Button */}
            {!videoUri && !tipsVisible && (
                <TouchableOpacity
                    style={styles.helpButton}
                    onPress={() => setTipsVisible(true)}
                >
                    <Ionicons name="help-circle" size={32} color="#CCFF00" />
                </TouchableOpacity>
            )}
        </SafeAreaView>
    );
};

// Unified Recorder Component (Uses OS Camera for robust rotation)
const UnifiedRecorder = ({ onVideoSelected, styles, router }: any) => {
    const { width } = useWindowDimensions();

    const pickVideo = async () => {
        try {
            // Pedir permisos de cámara (necesario en Android/iOS nativo)
            if (Platform.OS !== 'web') {
                const { status } = await ImagePicker.requestCameraPermissionsAsync();
                if (status !== 'granted') {
                    showError("Permiso Denegado", "Se necesita acceso a la cámara para grabar.");
                    return;
                }
            }

            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                allowsEditing: true, // CLAVE: Fuerzar allowsEditing para que el OS re-codifique y aplique la rotación física del video
                quality: 1,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const video = result.assets[0];
                const validationError = validateVideo(video);
                if (validationError) {
                    showError("Video no válido", validationError);
                    return;
                }
                onVideoSelected(video.uri, video.duration ? Math.round(video.duration / 1000) : 0);
            }
        } catch (error) {
            console.error('Error picking video:', error);
            showError("Error", "No se pudo abrir la cámara");
        }
    };

    const pickFromGallery = async () => {
        try {
            // Pedir permisos de galería
            if (Platform.OS !== 'web') {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') {
                    showError("Permiso Denegado", "Se necesita acceso a tus fotos para elegir un video.");
                    return;
                }
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                allowsEditing: true, // CLAVE: Evita inconsistencias de rotación
                quality: 1,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const video = result.assets[0];
                const validationError = validateVideo(video);
                if (validationError) {
                    showError("Video no válido", validationError);
                    return;
                }
                onVideoSelected(video.uri, video.duration ? Math.round(video.duration / 1000) : 0);
            }
        } catch (error) {
            console.error('Error picking video:', error);
            showError("Error", "No se pudo abrir la galería");
        }
    };

    const isDesktop = Platform.OS === 'web' || Platform.OS === 'windows' || Platform.OS === 'macos';
    const { theme, isDark } = useTheme();

    return (
        <View style={[styles.previewContainer, { backgroundColor: theme.background.default }]}>
            <View style={[styles.glassCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)', borderColor: theme.border.subtle }]}>
                <Ionicons 
                    name="videocam-outline" 
                    size={48} 
                    color={theme.components.button.primary.bg} 
                    style={{ marginBottom: 16 }} 
                />
                <Text style={[styles.instructionText, { color: theme.text.primary, marginBottom: 24, textAlign: 'center' }]}>
                    Graba un nuevo golpe desde tu celular o sube un video desde tu galería para analizar.
                </Text>
                
                <View style={{ gap: 12, width: '100%', maxWidth: 280 }}>
                    {!isDesktop && (
                        <Button
                            label="Grabar Video"
                            onPress={pickVideo}
                            variant="primary"
                            leftIcon={<Ionicons name="camera" size={20} color="white" />}
                            shadow
                        />
                    )}
                    <Button
                        label="Elegir de Galería"
                        onPress={pickFromGallery}
                        variant="outline"
                        leftIcon={<Ionicons name="images" size={20} color={theme.components.button.outline.text} />}
                    />
                    <Button
                        label="Ver Biblioteca"
                        onPress={() => router.push('/analysis')}
                        variant="ghost"
                        leftIcon={<Ionicons name="library" size={20} color={theme.text.tertiary} />}
                        labelStyle={{ color: theme.text.tertiary }}
                    />
                </View>
            </View>

            <Button
                label="Volver"
                onPress={() => router.back()}
                variant="ghost"
                style={{ marginTop: 32 }}
                leftIcon={<Ionicons name="arrow-back" size={18} color={theme.text.tertiary} />}
                labelStyle={{ color: theme.text.tertiary }}
            />
        </View>
    );
};

export default VideoRecordingScreen;

const createStyles = (theme: Theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    previewContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    glassCard: {
        width: '100%',
        maxWidth: 340,
        padding: 32,
        borderRadius: 24,
        alignItems: 'center',
        borderWidth: 1,
    },
    timerText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '600',
    },
    helpButton: {
        position: 'absolute',
        top: Platform.OS === 'web' ? 20 : 50,
        right: 20,
        zIndex: 100,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 20,
    },
    instructionText: {
        fontSize: 14,
        lineHeight: 20,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
    },
});
