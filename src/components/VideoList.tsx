import { Theme } from '@/src/design/theme';
import { useTheme } from '@/src/hooks/useTheme';
import { supabase } from '@/src/services/supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, RefreshControl, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
// The plan said expo-av, but user said "Video Library". 
// expo-av is standard. expo-video is the new one (beta?). 
// Let's stick to expo-av for stability or check if user has preferences. Plan said expo-av.
// Actually, let's use expo-av's Video.
import { ResizeMode, Video } from 'expo-av';

interface VideoListProps {
    playerId: string | null; // null means 'general' videos or filter by coach only? 
    // For PlayerModal, playerId is set.
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
}

export default function VideoList({ playerId }: VideoListProps) {
    const { theme } = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const { width } = useWindowDimensions();

    // Grid calc
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
                // If checking general videos library (future feature possibly)
                // For now, if no playerId, maybe we shouldn't show anything or show 'general'
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

    const handlePlayVideo = async (video: VideoItem) => {
        // Get signed URL for the video file
        try {
            const { data, error } = await supabase.storage
                .from('videos')
                .createSignedUrl(video.storage_path, 3600); // 1 hour valid

            if (error) throw error;
            if (data?.signedUrl) {
                setVideoUrl(data.signedUrl);
                setSelectedVideo(video);
                setModalVisible(true);
            }
        } catch (e) {
            console.error("Error getting video url", e);
        }
    };

    // Get Thumbnail Signed URL (or public URL if buckets are public? they are private RLS)
    // We need to fetch signed URLs for thumbnails too... this is expensive doing it one by one in render?
    // Better strategy: 
    // 1. Make thumbnails bucket public? Or 
    // 2. Compute signed URLs in the fetchVideos useEffect.
    // Let's assume for now we use createSignedUrl in a batch or the list is small. 
    // For "Professional" app, we should probably just download the thumb or use signed url. 
    // Let's try to get a public URL logic if possible, otherwise map it.
    // If bucket is private, we MUST use signed URL. 

    // Optimization: transform data adding signedUrl props.

    // Let's update videos state to include signedThumbnailUrl

    // ... Refactoring fetchVideos to include thumbnail logic ...

    // actually, let's keep it simple. Components can fetch their own image source? No, too many requests.
    // Let's fetching logic handle it.

    const renderItem = ({ item }: { item: VideoItem }) => {
        // Note: Image source needs a valid URL. 
        // We will assume for MVP we fetch a signed URL for the thumbnail here or use a placeholder if loading.
        // A better way is a custom Image component that handles Supabase Storage paths.

        return (
            <TouchableOpacity
                style={[styles.itemContainer, { width: itemWidth }]}
                onPress={() => handlePlayVideo(item)}
            >
                <View style={[styles.thumbnail, { height: itemWidth * 0.56 }]}>
                    <SupabaseImage path={item.thumbnail_path} style={StyleSheet.absoluteFillObject} />
                    <View style={styles.playIconOverlay}>
                        <Ionicons name="play-circle" size={30} color="rgba(255,255,255,0.8)" />
                    </View>
                </View>
                <View style={styles.infoContainer}>
                    <Text style={styles.videoTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.videoDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
                    {item.duration_secs && <Text style={styles.duration}>{formatDuration(item.duration_secs)}</Text>}
                </View>
            </TouchableOpacity>
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
                        <Video
                            source={{ uri: videoUrl }}
                            rate={1.0}
                            volume={1.0}
                            isMuted={false}
                            resizeMode={ResizeMode.CONTAIN}
                            shouldPlay
                            useNativeControls
                            style={{ width: '100%', height: '80%' }}
                        />
                    )}
                </View>
            </Modal>
        </View>
    );
}

// Helper component for Authenticated Image
const SupabaseImage = ({ path, style }: { path: string, style: any }) => {
    const [url, setUrl] = useState<string | null>(null);
    useEffect(() => {
        if (!path) return;
        supabase.storage.from('videos').createSignedUrl(path, 3600)
            .then(({ data }) => {
                if (data?.signedUrl) setUrl(data.signedUrl);
            });
    }, [path]);

    if (!url) return <View style={[style, { backgroundColor: '#eee' }]} />;
    return <Image source={{ uri: url }} style={style} resizeMode="cover" />;
}

const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
        backgroundColor: 'rgba(0,0,0,0.1)',
    },
    infoContainer: {
        padding: 8,
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
    closeButton: {
        position: 'absolute',
        top: 40,
        right: 20,
        zIndex: 10,
        padding: 10,
    },
});
