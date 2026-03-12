import { Theme } from '@/src/design/theme';
import { useTheme } from '@/src/hooks/useTheme';
import { supabase } from '@/src/services/supabaseClient';
import { showError, showSuccess } from '@/src/utils/toast';
import { Ionicons } from '@expo/vector-icons';
import { AVPlaybackStatus, ResizeMode, Video, VideoFullscreenUpdate, VideoFullscreenUpdateEvent } from 'expo-av';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Platform, RefreshControl, Share, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { VideoService } from '../services/VideoService';
import { useAuthStore } from '../store/useAuthStore';
import { AnalysisModal } from './Analyzer/AnalysisModal';
import BetaIAModal from './BetaIAModal';
import StatusModal from './StatusModal';
import VideoEditModal from './VideoEditModal';
import { ProVideoPlayer } from './ProVideoPlayer';

const IS_NATIVE_MOBILE = Platform.OS === 'android' || Platform.OS === 'ios';

interface VideoListProps {
    playerId: string | null;
}

interface VideoItem {
    id: string;
    title: string;
    description: string;
    thumbnail_path: string;
    storage_path: string;
    created_at: string;
    duration_secs: number;
    folder: string;
    stroke: string | null;
}

export default function VideoList({ playerId }: VideoListProps) {
    const { theme } = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const { width } = useWindowDimensions();

    const numColumns = 1;
    const gap = 15;
    const itemWidth = width > 500 ? 400 : (width - 40);

    const [videos, setVideos] = useState<VideoItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Playback state
    const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
    const [modalVisible, setModalVisible] = useState(false); // Only used on web
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
    const [videoLoading, setVideoLoading] = useState(false);

    // Native mobile app: hidden persistent Video ref for native fullscreen
    const nativeVideoRef = useRef<Video>(null);
    const [nativeVideoSource, setNativeVideoSource] = useState<string | null>(null);
    const [nativeVideoReady, setNativeVideoReady] = useState(false);

    // Delete Modal State
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [videoToDelete, setVideoToDelete] = useState<VideoItem | null>(null);

    const [editModalVisible, setEditModalVisible] = useState(false);
    const [videoToEdit, setVideoToEdit] = useState<VideoItem | null>(null);

    // AI Analysis State
    const [analysisModalVisible, setAnalysisModalVisible] = useState(false);
    const [betaIAModalVisible, setBetaIAModalVisible] = useState(false);
    const [videoToAnalyze, setVideoToAnalyze] = useState<{ uri: string, id: string } | null>(null);
    const { user, profile } = useAuthStore(); // Para obtener el ID del coach/usuario actual

    // Guardrail State
    const [guardrailModalVisible, setGuardrailModalVisible] = useState(false);
    const [videoToAnalyzeBlocked, setVideoToAnalyzeBlocked] = useState<VideoItem | null>(null);

    const fetchVideos = async () => {
        try {
            setLoading(true);
            let query = supabase
                .from('videos')
                .select('*')
                .eq('upload_status', 'ready')
                .order('created_at', { ascending: false });

            if (playerId) {
                query = query.eq('player_id', playerId);
            } else {
                query = query.is('player_id', null);
            }

            const { data, error } = await query;
            if (error) throw error;
            setVideos(data || []);
        } catch (error) {
            console.error('Error fetching videos:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchVideos();
        }, [playerId])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchVideos();
    };

    const confirmDelete = (video: VideoItem) => {
        setVideoToDelete(video);
        setDeleteModalVisible(true);
    };

    const performDelete = async () => {
        if (!videoToDelete) return;

        try {
            setDeleteModalVisible(false); // Close modal first
            setLoading(true);

            // 1. Delete from Storage (Video)
            const { error: storageError1 } = await supabase.storage
                .from('videos')
                .remove([videoToDelete.storage_path]);

            if (storageError1) console.warn("Error deleting video file:", storageError1);

            // 2. Delete from Storage (Thumbnail) - if exists
            if (videoToDelete.thumbnail_path) {
                const { error: storageError2 } = await supabase.storage
                    .from('videos')
                    .remove([videoToDelete.thumbnail_path]);
                if (storageError2) console.warn("Error deleting thumbnail file:", storageError2);
            }

            // 3. Delete from Database
            const { error: dbError, count } = await supabase
                .from('videos')
                .delete({ count: 'exact' })
                .eq('id', videoToDelete.id);

            if (dbError) throw dbError;
            if (count === 0) throw new Error("No se pudo eliminar el registro de la base de datos (posible error de permisos).");

            showSuccess("Éxito", "Video eliminado correctamente.");

            // Refresh list
            fetchVideos();
        } catch (error) {
            console.error("Error deleting video:", error);
            showError("Error", "No se pudo eliminar el video.");
            setLoading(false);
        } finally {
            setVideoToDelete(null);
        }
    };

    // Clean up native video player
    const cleanupNativeVideo = useCallback(async () => {
        try {
            if (nativeVideoRef.current) {
                await nativeVideoRef.current.stopAsync();
                await nativeVideoRef.current.unloadAsync();
            }
        } catch (e) {
            // Ignore cleanup errors
        } finally {
            setNativeVideoSource(null);
            setNativeVideoReady(false);
        }
    }, []);

    const handlePlayVideo = async (video: VideoItem) => {
        try {
            // Get Video URL from public bucket
            const { data: videoData } = supabase.storage
                .from('videos')
                .getPublicUrl(video.storage_path);

            // Get Thumbnail URL (if exists)
            let thumbUrl = null;
            if (video.thumbnail_path) {
                const { data: thumbData } = supabase.storage
                    .from('videos')
                    .getPublicUrl(video.thumbnail_path);
                if (thumbData?.publicUrl) thumbUrl = thumbData.publicUrl;
            }

            if (videoData?.publicUrl) {
                setSelectedVideo(video);
                setThumbnailUrl(thumbUrl);

                if (IS_NATIVE_MOBILE) {
                    // Native mobile app: load into hidden Video and open native fullscreen
                    setNativeVideoSource(videoData.publicUrl);
                } else {
                    // Web (desktop & mobile browser): open Modal with embedded player
                    setVideoUrl(videoData.publicUrl);
                    setModalVisible(true);
                }
            }
        } catch (e) {
            console.error("Error getting video url", e);
            showError("Error", "No se pudo reproducir el video.");
        }
    };

    // Mobile: when the hidden video loads, present native fullscreen
    const handleNativeVideoLoad = useCallback(async (_status: AVPlaybackStatus) => {
        setNativeVideoReady(true);
        try {
            await nativeVideoRef.current?.presentFullscreenPlayer();
        } catch (e) {
            console.error('Failed to present fullscreen:', e);
            cleanupNativeVideo();
            showError('Error', 'No se pudo abrir el reproductor de video.');
        }
    }, [cleanupNativeVideo]);

    // Mobile: handle fullscreen lifecycle events
    const handleNativeFullscreenUpdate = useCallback((event: VideoFullscreenUpdateEvent) => {
        if (event.fullscreenUpdate === VideoFullscreenUpdate.PLAYER_DID_DISMISS) {
            cleanupNativeVideo();
        }
    }, [cleanupNativeVideo]);

    // Mobile: handle native video errors 
    const handleNativeVideoError = useCallback((error: string) => {
        console.error('Native video error:', error);
        cleanupNativeVideo();
        showError('Error de Reproducción', 'El formato de video no es compatible o hubo un error de red.');
    }, [cleanupNativeVideo]);

    const handleEditVideo = (video: VideoItem) => {
        setVideoToEdit(video);
        setEditModalVisible(true);
    };

    const performEdit = async (title: string, stroke: string | null) => {
        if (!videoToEdit) return;
        try {
            setLoading(true);
            await VideoService.updateVideo(videoToEdit.id, { title, stroke });
            setEditModalVisible(false);
            setVideoToEdit(null);
            setTimeout(() => {
                showSuccess("Éxito", "Video actualizado correctamente.");
            }, 500);
            fetchVideos();
        } catch (error) {
            console.error("Error updating video:", error);
            showError("Error", "No se pudo actualizar el video.");
            setLoading(false);
        }
    };

    const handleShare = async (video: VideoItem) => {
        try {
            const url = `https://app.tenis-lab.com/v/${video.id}`;
            const strokePart = video.stroke ? `\nGolpe: ${getStrokeLabel(video.stroke)}` : '';

            // Build the complete share text with Link: prefix on its own line.
            // IMPORTANT: We pass this as a single string everywhere (no separate `url` field)
            // because navigator.share and Share.share auto-append the `url` field
            // without "Link:" prefix and without proper line breaks.
            const fullText = `🎾 ¡Te compartieron un video desde Tenis-Lab!\n\nTítulo: ${video.title}${strokePart}\nLink: ${url}\n\n¡A seguir mejorando! 💪💪`;

            if (Platform.OS === 'web') {
                if (navigator.share) {
                    await navigator.share({
                        title: video.title,
                        text: fullText
                    });
                } else {
                    await navigator.clipboard.writeText(fullText);
                    showSuccess("Enlace copiado", "El enlace se ha copiado al portapapeles para que puedas compartirlo.");
                }
            } else {
                await Share.share({
                    message: fullText,
                    title: video.title
                });
            }
        } catch (error: any) {
            console.error("Error sharing video:", error.message);
            showError("Error", "No se pudo compartir el video.");
        }
    };

    const handleAIAnalysisPress = async (item: VideoItem) => {
        const userEmail = user?.email || profile?.email;

        // 1. Check if user is the super admin
        if (userEmail === 'gusgvillafane@gmail.com') {
            // Even admin should respect the stroke guardrail? 
            // The user said "salio el mensaje de que la herramienta por ahora solo analiza saque"
            // so they want to see the beta modal first if unauthorized.
            // If authorized (admin or beta), THEN check stroke.
            proceedWithAnalysisCheck(item);
            return;
        }

        // 2. Check if user is authorized in beta_leads
        try {
            if (!userEmail) throw new Error('No user email found');

            const { data: leadData, error } = await supabase
                .from('beta_leads')
                .select('authorized_ia')
                .eq('email', userEmail)
                .single();

            if (error || !leadData?.authorized_ia) {
                // Not authorized or not in list
                setBetaIAModalVisible(true);
                return;
            }

            // Authorized beta user
            proceedWithAnalysisCheck(item);
        } catch (error) {
            console.error('Error checking AI authorization:', error);
            // Default to showing beta modal if check fails
            setBetaIAModalVisible(true);
        }
    };

    const proceedWithAnalysisCheck = (item: VideoItem) => {
        if (item.stroke && item.stroke.toLowerCase() !== 'serve') {
            setVideoToAnalyzeBlocked(item);
            setGuardrailModalVisible(true);
        } else {
            const { data } = supabase.storage.from('videos').getPublicUrl(item.storage_path);
            setVideoToAnalyze({ uri: data.publicUrl, id: item.id });
            setAnalysisModalVisible(true);
        }
    };

    const renderItem = ({ item }: { item: VideoItem }) => {
        return (
            <View style={[styles.itemContainer, { width: itemWidth }]}>
                <TouchableOpacity
                    style={{ flex: 1 }}
                    onPress={() => handlePlayVideo(item)}
                >
                    <View style={[styles.thumbnail, { height: itemWidth * 0.56 }]}>
                        <VideoThumbnailRenderer item={item} style={StyleSheet.absoluteFillObject} />
                        <View style={styles.playIconOverlay}>
                            <Ionicons name="play-circle" size={30} color="rgba(255,255,255,0.8)" />
                        </View>
                        {item.stroke && (
                            <View style={styles.strokeBadgeOverlay}>
                                <Text style={styles.strokeTextOverlay}>{getStrokeLabel(item.stroke)}</Text>
                            </View>
                        )}
                    </View>
                    <View style={styles.infoContainer}>
                        <Text style={styles.videoTitle} numberOfLines={1}>{item.title}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                            <Text style={styles.videoDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
                        </View>
                        {!!item.duration_secs && <Text style={styles.duration}>{formatDuration(item.duration_secs)}</Text>}
                    </View>
                </TouchableOpacity>

                <View style={[styles.actionsContainer, { paddingBottom: 10 }]}>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleAIAnalysisPress(item)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="sparkles" size={20} color="#FFD700" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleShare(item)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="share-social-outline" size={20} color={theme.text.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleEditVideo(item)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="create-outline" size={20} color={theme.status.warning} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => confirmDelete(item)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="trash-outline" size={20} color={theme.status.error} />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {loading && !refreshing ? (
                <ActivityIndicator size="large" color={theme.components.button.primary.bg} style={{ marginTop: 20 }} />
            ) : (
                <FlatList
                    data={videos}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ padding: 20, gap, alignItems: 'center' }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    ListEmptyComponent={<Text style={styles.emptyText}>No hay videos grabados aún.</Text>}
                />
            )}

            {/* Native Mobile App: Hidden persistent Video for native fullscreen playback */}
            {IS_NATIVE_MOBILE && nativeVideoSource && (
                <Video
                    ref={nativeVideoRef}
                    source={{ uri: nativeVideoSource }}
                    rate={1.0}
                    volume={1.0}
                    isMuted={false}
                    resizeMode={ResizeMode.CONTAIN}
                    shouldPlay={false}
                    useNativeControls
                    style={{ position: 'absolute', width: 0, height: 0, opacity: 0 }}
                    onLoad={handleNativeVideoLoad}
                    onFullscreenUpdate={handleNativeFullscreenUpdate}
                    onError={handleNativeVideoError}
                />
            )}

            {/* Web: Video Player Modal (desktop & mobile browser) */}
            {!IS_NATIVE_MOBILE && (
                <Modal
                    visible={modalVisible}
                    animationType="fade"
                    transparent={true}
                    onRequestClose={() => setModalVisible(false)}
                >
                    <View style={styles.modalOverlay}>
                        <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
                            <Ionicons name="close" size={30} color="white" />
                        </TouchableOpacity>

                        {videoUrl && (
                            <View style={styles.videoWrapper}>
                                <ProVideoPlayer
                                    videoUri={videoUrl}
                                    thumbnailUri={thumbnailUrl}
                                    shouldPlay={true}
                                    useNativeControls={true}
                                    style={styles.videoPlayer}
                                    onError={(error) => {
                                        console.error("Video Playback Error:", error);
                                        setModalVisible(false);
                                        setTimeout(() => {
                                            showError("Error de Reproducción", "El formato de video no es compatible o hubo un error de red.");
                                        }, 500);
                                    }}
                                />
                            </View>
                        )}
                    </View>
                </Modal>
            )}

            {/* Delete Confirmation Modal */}
            <Modal
                visible={deleteModalVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setDeleteModalVisible(false)}
            >
                <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                    <View style={styles.deleteModalContainer}>
                        <Text style={styles.deleteModalTitle}>Eliminar Video</Text>
                        <Text style={styles.deleteModalText}>
                            ¿Estás seguro de que deseas eliminar este video?
                        </Text>
                        <Text style={[styles.deleteModalText, { fontWeight: 'bold', color: '#EF4444', marginTop: 8 }]}>
                            ⚠️ Esta acción también eliminará permanentemente cualquier informe de Análisis asociado a este video.
                        </Text>
                        <View style={styles.deleteModalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setDeleteModalVisible(false)}
                            >
                                <Text style={styles.cancelButtonText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.confirmButton]}
                                onPress={performDelete}
                            >
                                <Text style={styles.confirmButtonText}>Eliminar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Edit Modal */}
            {videoToEdit && (
                <VideoEditModal
                    visible={editModalVisible}
                    onClose={() => setEditModalVisible(false)}
                    onSave={performEdit}
                    initialTitle={videoToEdit.title}
                    initialStroke={videoToEdit.stroke}
                    loading={loading}
                />
            )}
            {/* Guardrail para videos que no son Saque */}
            <StatusModal
                visible={guardrailModalVisible}
                type="warning"
                title="Atención"
                message={<View style={{ marginBottom: 15 }}><Text style={{ color: theme.text.secondary, textAlign: 'center', lineHeight: 22 }}>El motor biomecánico actual está especializado <Text style={{ fontWeight: 'bold' }}>exclusivamente en el análisis de Saques</Text>.</Text></View>}
                onClose={() => {
                    setGuardrailModalVisible(false);
                    setVideoToAnalyzeBlocked(null);
                }}
                showCancel={false}
                buttonText="Entendido"
            />

            {/* AI Analysis Master Flow */}
            <AnalysisModal
                visible={analysisModalVisible}
                videoUri={videoToAnalyze?.uri || null}
                videoId={videoToAnalyze?.id || null}
                playerId={playerId}
                coachId={user?.id || 'unknown'}
                onClose={() => setAnalysisModalVisible(false)}
                onSuccess={() => {
                    // Quizás mostrar un tilde verde o recargar si la card va a mostrar score histórico
                    fetchVideos();
                }}
            />

            {/* Beta AI Access Modal */}
            <BetaIAModal
                visible={betaIAModalVisible}
                onClose={() => setBetaIAModalVisible(false)}
                userEmail={user?.email || profile?.email}
                userName={profile?.full_name || user?.email?.split('@')[0]}
                userPhone={profile?.phone || undefined}
            />
        </View>
    );
}

const VideoThumbnailRenderer = ({ item, style }: { item: VideoItem, style: any }) => {
    const [thumbUrl, setThumbUrl] = useState<string | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        async function fetchUrls() {
            if (item.thumbnail_path) {
                const { data } = supabase.storage.from('videos').getPublicUrl(item.thumbnail_path);
                if (isMounted && data?.publicUrl) {
                    setThumbUrl(data.publicUrl);
                }
            } else if (item.storage_path) {
                const { data } = supabase.storage.from('videos').getPublicUrl(item.storage_path);
                if (isMounted && data?.publicUrl) {
                    setVideoUrl(data.publicUrl);
                }
            }
        }

        fetchUrls();

        return () => { isMounted = false; };
    }, [item.thumbnail_path, item.storage_path]);

    if (thumbUrl) {
        return <Image source={{ uri: thumbUrl }} style={style} resizeMode="cover" />;
    }

    if (videoUrl) {
        return (
            <View pointerEvents="none" style={style}>
                <Video
                    source={{ uri: videoUrl }}
                    resizeMode={ResizeMode.COVER}
                    shouldPlay={false}
                    isMuted={true}
                    style={StyleSheet.absoluteFillObject}
                />
            </View>
        );
    }

    return (
        <View style={[style, { backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' }]} />
    );
}

const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const getStrokeLabel = (stroke: string) => {
    if (!stroke) return '';
    const strokeMap: Record<string, string> = {
        'serve': 'Saque',
        'forehand': 'Drive',
        'backhand': 'Revés',
        'volley': 'Volea',
        'smash': 'Smash',
        'other': 'Otro'
    };
    return strokeMap[stroke.toLowerCase()] || stroke;
};

const createStyles = (theme: Theme) => StyleSheet.create({
    container: {
        flex: 1,
    },
    itemContainer: {
        marginBottom: 15,
        backgroundColor: theme.background.surface,
        borderRadius: 8,
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        position: 'relative',
    },
    thumbnail: {
        backgroundColor: theme.background.subtle,
        justifyContent: 'center',
        alignItems: 'center',
    },
    playIconOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    infoContainer: {
        padding: 8,
        paddingLeft: 12,
        paddingRight: 80,
        paddingBottom: 4, // Reduced from 16 to stick more to icons
    },
    videoTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.text.primary,
        marginBottom: 4,
    },
    videoDate: {
        fontSize: 12,
        color: theme.text.secondary,
        marginBottom: 4,
    },
    duration: {
        position: 'absolute',
        right: 8,
        bottom: 8,
        fontSize: 10,
        color: theme.text.secondary,
        backgroundColor: theme.background.surface,
        paddingHorizontal: 4,
        borderRadius: 4,
        overflow: 'hidden',
    },
    strokeBadgeOverlay: {
        position: 'absolute',
        top: 8,
        left: 12, // Added more left margin
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        zIndex: 2,
    },
    strokeTextOverlay: {
        fontSize: 12, // Increased from 10
        color: 'white',
        fontWeight: '600',
    },

    actionsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingBottom: 12, // Reduced from 25
        paddingTop: 4,     // Reduced from 10 to stick more to the video info
        borderBottomWidth: 1,
        borderBottomColor: theme.border.default,
        backgroundColor: theme.background.surface,
    },
    actionButton: {
        padding: 6,
        borderRadius: 20,
        backgroundColor: theme.background.surface,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 40,
        color: theme.text.secondary,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'black',
        ...StyleSheet.absoluteFillObject
    },
    videoWrapper: {
        flex: 1,
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'black',
        paddingVertical: '5%'
    },
    videoPlayer: {
        width: '100%',
        height: '100%',
        maxWidth: 1024,
        alignSelf: 'center',
    },
    closeButton: {
        position: 'absolute',
        top: 40,
        right: 20,
        zIndex: 10,
        padding: 10,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 20,
    },
    // New Modal Styles
    deleteModalContainer: {
        width: '85%',
        maxWidth: 400,
        backgroundColor: theme.background.surface,
        borderRadius: 12,
        padding: 24,
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    deleteModalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.text.primary,
        marginBottom: 12,
    },
    deleteModalText: {
        fontSize: 16,
        color: theme.text.secondary,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    deleteModalButtons: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    modalButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButton: {
        backgroundColor: theme.background.subtle,
    },
    confirmButton: {
        backgroundColor: theme.status.error,
    },
    cancelButtonText: {
        color: theme.text.primary,
        fontSize: 16,
        fontWeight: '600',
    },
    confirmButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
});
