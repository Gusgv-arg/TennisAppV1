import { Theme } from '@/src/design/theme';
import { typography } from '@/src/design/tokens/typography';
import { useTheme } from '@/src/hooks/useTheme';
import { supabase } from '@/src/services/supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

interface PublicVideoDetails {
    id: string;
    title: string;
    description: string;
    storage_path: string;
    thumbnail_path: string;
    created_at: string;
    duration_secs: number;
    stroke: string | null;
    player_id: string;
    player_name: string;
}

export default function PublicVideoPage() {
    const { id } = useLocalSearchParams();
    const { theme } = useTheme();
    const { width, height } = useWindowDimensions();
    const styles = createStyles(theme);

    const [loading, setLoading] = useState(true);
    const [videoDetails, setVideoDetails] = useState<PublicVideoDetails | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchPublicVideo() {
            const videoId = Array.isArray(id) ? id[0] : id;
            if (!videoId || videoId === '[id]') {
                setError('El enlace del video es inválido.');
                setLoading(false);
                return;
            }

            try {
                // 1. Fetch video details via secure RPC that bypasses RLS for single item
                const { data, error: rpcError } = await supabase.rpc('get_public_video_details', { p_video_id: videoId });

                if (rpcError) {
                    console.error("RPC Error:", rpcError);
                    throw rpcError;
                }

                if (!data || data.length === 0) {
                    setError('Video no encontrado o no disponible.');
                    return;
                }

                const details = data[0] as PublicVideoDetails;
                setVideoDetails(details);

                // 2. We still need a signed URL because the bucket is private.
                // We can create a short-lived signed URL for playback.
                const { data: urlData, error: urlError } = await supabase.storage
                    .from('videos')
                    .createSignedUrl(details.storage_path, 3600); // 1 hour access

                if (urlError) throw urlError;
                if (urlData?.signedUrl) {
                    setVideoUrl(urlData.signedUrl);
                }

            } catch (err: any) {
                console.error("Error fetching public video:", err);
                setError(`Ocurrió un error al cargar el video: ${err?.message || 'Error desconocido'}`);
            } finally {
                setLoading(false);
            }
        }

        fetchPublicVideo();
    }, [id]);

    const isDesktop = width > 768;

    if (loading) {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color={theme.components.button.primary.bg} />
            </View>
        );
    }

    if (error || !videoDetails) {
        return (
            <View style={[styles.container, styles.centered]}>
                <Ionicons name="alert-circle-outline" size={60} color={theme.text.secondary} />
                <Text style={styles.errorText}>{error || 'Video no encontrado.'}</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header / Branding */}
            <View style={styles.header}>
                <Ionicons name="tennisball" size={24} color={theme.components.button.primary.bg} />
                <Text style={styles.headerBrand}>Tennis Lab</Text>
            </View>

            {/* Video Player & Info */}
            <View style={[styles.contentWrapper, isDesktop && styles.contentWrapperDesktop]}>
                {videoUrl ? (
                    <View style={styles.videoContainer}>
                        <Video
                            source={{ uri: videoUrl }}
                            style={styles.videoPlayer}
                            useNativeControls={true}
                            resizeMode={ResizeMode.CONTAIN}
                            shouldPlay={true}
                        />
                    </View>
                ) : (
                    <View style={[styles.videoContainer, styles.centered, { backgroundColor: '#111' }]}>
                        <Text style={{ color: 'white' }}>Error al cargar fuente de video</Text>
                    </View>
                )}

                <View style={styles.infoContainer}>
                    <Text style={styles.title}>{videoDetails.title}</Text>
                    <View style={styles.metaRow}>
                        <View style={styles.badge}>
                            <Ionicons name="person-outline" size={14} color={theme.text.secondary} />
                            <Text style={styles.metaText}>{videoDetails.player_name || 'Alumno'}</Text>
                        </View>
                        <View style={styles.badge}>
                            <Ionicons name="calendar-outline" size={14} color={theme.text.secondary} />
                            <Text style={styles.metaText}>{new Date(videoDetails.created_at).toLocaleDateString()}</Text>
                        </View>
                        {videoDetails.stroke && (
                            <View style={[styles.badge, { backgroundColor: theme.components.badge.primary }]}>
                                <Text style={[styles.metaText, { color: theme.text.primary }]}>{videoDetails.stroke}</Text>
                            </View>
                        )}
                    </View>
                    {!!videoDetails.description && (
                        <Text style={styles.description}>{videoDetails.description}</Text>
                    )}
                </View>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
                <Text style={styles.footerText}>Desarrollado con ♥ por Tennis Lab</Text>
            </View>
        </View>
    );
}

const createStyles = (theme: Theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background.default,
    },
    centered: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    header: {
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: theme.border.subtle,
        gap: 10,
    },
    headerBrand: {
        ...typography.variants.h3,
        color: theme.text.primary,
        letterSpacing: 0.5,
    },
    contentWrapper: {
        flex: 1,
        width: '100%',
        alignSelf: 'center',
    },
    contentWrapperDesktop: {
        maxWidth: 1000,
        padding: 40,
    },
    videoContainer: {
        width: '100%',
        aspectRatio: 16 / 9,
        backgroundColor: 'black',
        borderRadius: 8,
        overflow: 'hidden',
    },
    videoPlayer: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    infoContainer: {
        padding: 20,
    },
    title: {
        ...typography.variants.h2,
        color: theme.text.primary,
        marginBottom: 12,
    },
    metaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 16,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.background.surface,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
        borderWidth: 1,
        borderColor: theme.border.subtle,
    },
    metaText: {
        ...typography.variants.bodySmall,
        color: theme.text.secondary,
        fontWeight: '500',
    },
    description: {
        ...typography.variants.bodyMedium,
        color: theme.text.secondary,
        marginTop: 10,
        lineHeight: 22,
    },
    errorText: {
        ...typography.variants.h3,
        color: theme.text.secondary,
        marginTop: 16,
    },
    footer: {
        padding: 20,
        alignItems: 'center',
    },
    footerText: {
        ...typography.variants.bodySmall,
        color: theme.text.secondary,
    }
});
