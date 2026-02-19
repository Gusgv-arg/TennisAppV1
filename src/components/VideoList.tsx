import { Theme } from '@/src/design/theme';
import { useTheme } from '@/src/hooks/useTheme';
import { supabase } from '@/src/services/supabaseClient';
import { showError, showSuccess } from '@/src/utils/toast';
import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Platform, RefreshControl, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { VideoService } from '../services/VideoService';
import VideoEditModal from './VideoEditModal';

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

    const numColumns = width > 500 ? 3 : 2;
    const gap = 10;
    const itemWidth = (width - 40 - (numColumns - 1) * gap) / numColumns;

    const [videos, setVideos] = useState<VideoItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Playback state
    const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
    const [videoLoading, setVideoLoading] = useState(false);

    // Delete Modal State
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [videoToDelete, setVideoToDelete] = useState<VideoItem | null>(null);

    // Edit Modal State
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [videoToEdit, setVideoToEdit] = useState<VideoItem | null>(null);

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

    useEffect(() => {
        fetchVideos();
    }, [playerId]);

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
            const { error: dbError } = await supabase
                .from('videos')
                .delete()
                .eq('id', videoToDelete.id);

            if (dbError) throw dbError;

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

    const handlePlayVideo = async (video: VideoItem) => {
        try {
            // Get Video URL
            const { data: videoData, error: videoError } = await supabase.storage
                .from('videos')
                .createSignedUrl(video.storage_path, 3600);

            if (videoError) throw videoError;

            // Get Thumbnail URL (if exists)
            let thumbUrl = null;
            if (video.thumbnail_path) {
                const { data: thumbData } = await supabase.storage
                    .from('videos')
                    .createSignedUrl(video.thumbnail_path, 3600);
                if (thumbData?.signedUrl) thumbUrl = thumbData.signedUrl;
            }

            if (videoData?.signedUrl) {
                setVideoUrl(videoData.signedUrl);
                setThumbnailUrl(thumbUrl);
                setSelectedVideo(video);
                setModalVisible(true);
            }
        } catch (e) {
            console.error("Error getting video url", e);
            showError("Error", "No se pudo reproducir el video.");
        }
    };

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
            showSuccess("Éxito", "Video actualizado correctamente.");
            fetchVideos();
        } catch (error) {
            console.error("Error updating video:", error);
            showError("Error", "No se pudo actualizar el video.");
            setLoading(false);
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
                        <SupabaseImage path={item.thumbnail_path} style={StyleSheet.absoluteFillObject} />
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

                <View style={styles.actionsContainer}>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleEditVideo(item)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="create-outline" size={20} color={theme.text.primary} />
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
                    numColumns={numColumns}
                    columnWrapperStyle={{ gap }}
                    contentContainerStyle={{ padding: 20 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    ListEmptyComponent={<Text style={styles.emptyText}>No hay videos grabados aún.</Text>}
                />
            )}

            {/* Video Player Modal */}
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
                            {videoLoading && (
                                <ActivityIndicator
                                    size="large"
                                    color={theme.components.button.primary.bg}
                                    style={styles.videoLoader}
                                />
                            )}
                            <Video
                                source={{ uri: videoUrl }}
                                rate={1.0}
                                volume={1.0}
                                isMuted={false}
                                resizeMode={ResizeMode.CONTAIN}
                                shouldPlay
                                useNativeControls
                                usePoster={!!thumbnailUrl}
                                posterSource={thumbnailUrl ? { uri: thumbnailUrl } : undefined}
                                posterStyle={{ resizeMode: 'contain' }}
                                style={styles.videoPlayer}
                                onLoadStart={() => setVideoLoading(true)}
                                onLoad={() => setVideoLoading(false)}
                            />
                        </View>
                    )}
                </View>
            </Modal>

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
                            ¿Estás seguro de que deseas eliminar este video? Esta acción no se puede deshacer.
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
        </View>
    );
}

const SupabaseImage = ({ path, style }: { path: string, style: any }) => {
    const [url, setUrl] = useState<string | null>(null);
    useEffect(() => {
        if (!path) return;
        supabase.storage.from('videos').createSignedUrl(path, 3600)
            .then(({ data }) => {
                if (data?.signedUrl) setUrl(data.signedUrl);
            });
    }, [path]);

    if (!url) return (
        <View style={[style, { backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name="videocam-outline" size={30} color="#444" />
        </View>
    );
    return <Image source={{ uri: url }} style={style} resizeMode="cover" />;
}

const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const getStrokeLabel = (stroke: string) => {
    const strokeMap: Record<string, string> = {
        'Serve': 'Saque',
        'Forehand': 'Drive',
        'Backhand': 'Revés',
        'Volley': 'Volea',
        'Smash': 'Smash',
        'Other': 'Otro'
    };
    return strokeMap[stroke] || stroke;
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
        paddingRight: 80, // Increased to accommodate Edit + Delete buttons
    },
    videoTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.text.primary,
        marginBottom: 2,
    },
    videoDate: {
        fontSize: 12,
        color: theme.text.secondary,
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
        left: 8,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        zIndex: 2,
    },
    strokeTextOverlay: {
        fontSize: 10,
        color: 'white',
        fontWeight: '600',
    },

    actionsContainer: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        flexDirection: 'row',
        gap: 8,
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
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoWrapper: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'black',
    },
    videoPlayer: {
        width: '100%',
        height: '100%',
        maxHeight: '90%',
        maxWidth: 1024,
        alignSelf: 'center', // Native centering
        ...Platform.select({
            web: {
                marginLeft: 'auto',
                marginRight: 'auto',
            }
        })
    },
    videoLoader: {
        position: 'absolute',
        zIndex: 5,
    },
    closeButton: {
        position: 'absolute',
        top: 40,
        right: 20,
        zIndex: 10,
        padding: 10,
        backgroundColor: 'rgba(0,0,0,0.5)', // Make it visible on video
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
