import { Ionicons } from '@expo/vector-icons';
import { AVPlaybackStatus, AVPlaybackStatusSuccess, ResizeMode, Video } from 'expo-av';
import React, { forwardRef, useId, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ProVideoPlayerProps {
    videoUri: string;
    thumbnailUri?: string | null;
    style?: any; 
    onPlaybackStatusUpdate?: (status: AVPlaybackStatus) => void;
    onReadyForDisplay?: (naturalSize: { width: number, height: number }) => void;
    onError?: (error: string) => void;
    isLooping?: boolean;
    shouldPlay?: boolean;
    useNativeControls?: boolean;
    showFullscreenButton?: boolean;
    overlayContent?: (layout: { width: number, height: number, offsetX: number, offsetY: number, naturalWidth: number, naturalHeight: number }) => React.ReactNode;
}

export interface ProVideoPlayerRef {
    playAsync: () => Promise<void>;
    pauseAsync: () => Promise<void>;
    presentFullscreenPlayer: () => Promise<void>;
}

export const ProVideoPlayer = forwardRef<ProVideoPlayerRef, ProVideoPlayerProps>(({
    videoUri,
    thumbnailUri,
    style,
    onPlaybackStatusUpdate,
    onReadyForDisplay,
    isLooping = false,
    shouldPlay = false,
    useNativeControls = true,
    showFullscreenButton = true,
    onError,
    overlayContent
}, ref) => {
    const videoRef = useRef<Video>(null);
    const webVideoRef = useRef<HTMLVideoElement>(null);
    const [status, setStatus] = useState<AVPlaybackStatusSuccess | null>(null);
    const [naturalSize, setNaturalSize] = useState<{ width: number, height: number } | null>(null);
    const [containerSize, setContainerSize] = useState<{ width: number, height: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const playerId = useId();
    const domId = `pro-video-player-${playerId.replace(/:/g, '')}`;

    useImperativeHandle(ref, () => ({
        playAsync: async () => { 
            if (Platform.OS === 'web') webVideoRef.current?.play();
            else await videoRef.current?.playAsync(); 
        },
        pauseAsync: async () => { 
            if (Platform.OS === 'web') webVideoRef.current?.pause();
            else await videoRef.current?.pauseAsync(); 
        },
        presentFullscreenPlayer: async () => { 
            if (Platform.OS === 'web') handleFullscreenWeb();
            else await videoRef.current?.presentFullscreenPlayer(); 
        }
    }));

    const handleFullscreenWeb = () => {
        try {
            const wrapper = document.getElementById(domId);
            const videoEl = wrapper?.querySelector('video');
            if (videoEl) {
                if (videoEl.requestFullscreen) {
                    videoEl.requestFullscreen().catch(() => { });
                } else if ((videoEl as any).webkitEnterFullscreen) {
                    (videoEl as any).webkitEnterFullscreen();
                }
            }
        } catch (e) {
            console.warn('Fullscreen not supported:', e);
        }
    };

    let renderWidth = containerSize?.width || 0;
    let renderHeight = containerSize?.height || 0;
    let offsetX = 0;
    let offsetY = 0;

    if (naturalSize && containerSize && containerSize.width > 0 && containerSize.height > 0) {
        const containerRatio = containerSize.width / containerSize.height;
        const actualVideoRatio = naturalSize.width / naturalSize.height;

        if (actualVideoRatio > containerRatio) {
            renderWidth = containerSize.width;
            renderHeight = containerSize.width / actualVideoRatio;
            offsetY = (containerSize.height - renderHeight) / 2;
        } else {
            renderHeight = containerSize.height;
            renderWidth = containerSize.height * actualVideoRatio;
            offsetX = (containerSize.width - renderWidth) / 2;
        }
    }

    return (
        <View 
            style={[styles.container, style]}
            onLayout={(e) => setContainerSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
            // @ts-ignore
            nativeID={domId}
        >
            {loading && (
                <View style={styles.loaderOverlay}>
                    <ActivityIndicator size="large" color="#CCFF00" />
                </View>
            )}

            <Pressable 
                style={StyleSheet.absoluteFillObject}
                onPress={() => {
                    if (!useNativeControls) {
                        if (Platform.OS === 'web') {
                            const videoElement = webVideoRef.current;
                            if (videoElement) {
                                if (!videoElement.paused) videoElement.pause();
                                else videoElement.play();
                            }
                        } else {
                            if (status?.isPlaying) videoRef.current?.pauseAsync();
                            else videoRef.current?.playAsync();
                        }
                    }
                }}
            >
                {Platform.OS === 'web' ? (
                     <video
                        ref={webVideoRef as any}
                        src={videoUri}
                        style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: 'black' }}
                        controls={useNativeControls}
                        muted={false}
                        loop={isLooping}
                        autoPlay={shouldPlay}
                        poster={thumbnailUri || undefined}
                        onLoadStart={() => setLoading(true)}
                        onCanPlay={() => setLoading(false)}
                        onPlay={() => {
                            const target = webVideoRef.current;
                            const currentStatus = {
                                isLoaded: true,
                                isPlaying: true,
                                positionMillis: target ? target.currentTime * 1000 : 0,
                                durationMillis: target ? target.duration * 1000 : 0,
                            } as AVPlaybackStatusSuccess;
                            setStatus(currentStatus);
                            if (onPlaybackStatusUpdate) onPlaybackStatusUpdate(currentStatus);
                        }}
                        onPause={() => {
                            const target = webVideoRef.current;
                            const currentStatus = {
                                isLoaded: true,
                                isPlaying: false,
                                positionMillis: target ? target.currentTime * 1000 : 0,
                                durationMillis: target ? target.duration * 1000 : 0,
                            } as AVPlaybackStatusSuccess;
                            setStatus(currentStatus);
                            if (onPlaybackStatusUpdate) onPlaybackStatusUpdate(currentStatus);
                        }}
                        onTimeUpdate={(e) => {
                            const target = e.target as HTMLVideoElement;
                            const currentStatus = {
                                isLoaded: true,
                                isPlaying: !target.paused,
                                positionMillis: target.currentTime * 1000,
                                durationMillis: target.duration * 1000,
                            } as AVPlaybackStatusSuccess;
                            setStatus(currentStatus);
                            if (onPlaybackStatusUpdate) onPlaybackStatusUpdate(currentStatus);
                        }}
                        onLoadedMetadata={(e) => {
                            const target = e.target as HTMLVideoElement;
                            const size = { width: target.videoWidth, height: target.videoHeight };
                            setNaturalSize(size);
                            setLoading(false);
                            if (onReadyForDisplay) onReadyForDisplay(size);
                        }}
                        onError={(e) => {
                            console.error('Web Video Error:', e);
                            setLoading(false);
                            if (onError) onError('Error loading video on web');
                        }}
                     />
                ) : (
                    <Video
                        ref={videoRef}
                        style={styles.video}
                        source={{ uri: videoUri }}
                        useNativeControls={useNativeControls}
                        resizeMode={ResizeMode.CONTAIN}
                        isLooping={isLooping}
                        shouldPlay={shouldPlay}
                        usePoster={!!thumbnailUri}
                        posterSource={thumbnailUri ? { uri: thumbnailUri } : undefined}
                        posterStyle={{ resizeMode: 'contain' }}
                        onPlaybackStatusUpdate={(s) => {
                            if (s.isLoaded) setStatus(s as AVPlaybackStatusSuccess);
                            if (onPlaybackStatusUpdate) onPlaybackStatusUpdate(s);
                        }}
                        onLoadStart={() => setLoading(true)}
                        onLoad={() => setLoading(false)}
                        onReadyForDisplay={(event) => {
                            if (event.naturalSize) {
                                setNaturalSize(event.naturalSize);
                                if (onReadyForDisplay) onReadyForDisplay(event.naturalSize);
                            }
                        }}
                        onError={(e) => {
                            console.error('Video Error:', e);
                            setLoading(false);
                            if (onError) onError(e);
                        }}
                    />
                )}

                {overlayContent && naturalSize && containerSize && (
                    <View style={[StyleSheet.absoluteFillObject, { left: offsetX, top: offsetY, width: renderWidth, height: renderHeight }]} pointerEvents="none">
                        {overlayContent({ width: renderWidth, height: renderHeight, offsetX, offsetY, naturalWidth: naturalSize.width, naturalHeight: naturalSize.height })}
                    </View>
                )}

                {/* Play/Pause visual feedback if no native controls */}
                {!useNativeControls && status && !status.isPlaying && !loading && (
                    <View style={[StyleSheet.absoluteFillObject, styles.centerOverlay]} pointerEvents="none">
                        <Ionicons name="play" size={64} color="white" style={{ opacity: 0.8 }} />
                    </View>
                )}
            </Pressable>

            {!loading && Platform.OS === 'web' && showFullscreenButton && (
                <TouchableOpacity
                    style={styles.fullscreenButton}
                    onPress={handleFullscreenWeb}
                >
                    <Ionicons name="expand-outline" size={18} color="white" />
                    <Text style={styles.fullscreenButtonText}>Pantalla Completa</Text>
                </TouchableOpacity>
            )}
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#000',
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    video: {
        width: '100%',
        height: '100%',
        ...Platform.select({
            web: {
                // expo-av on web creates a wrapper div around the video element.
                // It's critical to clamp both to prevent the aspect ratio overflow seen on vertical/hi-res videos.
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                right: 0,
                objectFit: 'contain'
            } as any
        })
    },
    loaderOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 5,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    centerOverlay: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    fullscreenButton: {
        position: 'absolute',
        top: 20,
        left: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        zIndex: 10,
    },
    fullscreenButtonText: {
        color: 'white',
        fontSize: 13,
        fontWeight: '500',
    },
});
