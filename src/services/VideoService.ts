import { supabase, supabaseAnonKey } from '@/src/services/supabaseClient';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Platform } from 'react-native';
import { Video, getVideoMetaData } from 'react-native-compressor';

export interface VideoMetadata {
    uri: string;
    duration?: number; // in seconds
    size?: number; // in bytes
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

export const VideoService = {
    /**
     * Compresses a video file to a target quality suitable for upload.
     * Forces normalization to 720p H.264 for maximum compatibility (CFR).
     */
    compressVideo: async (sourceUri: string): Promise<string> => {
        if (Platform.OS === 'web') return sourceUri; 
        try {
            console.log('[VideoService] Normalizing video to 720p/H.264...');
            
            // Get original metadata for audit
            const before = await getVideoMetaData(sourceUri);
            console.log(`[VideoService] Original: ${before.width}x${before.height}, ${before.duration}s, size: ${before.size} bytes`);

            const result = await Video.compress(sourceUri, {
                compressionMethod: 'manual',
                maxSize: 1280, // Force 720p for perfect balance of quality and streaming
                bitrate: 4000000, // 4 Mbps for high quality coverage
                // Note: manual mode with explicit bitrate forces a re-encode on most platforms
            }, (progress) => {
                console.log(`Compression progress: ${Math.round(progress * 100)}%`);
            });

            // Audit the result to ensure normalization was successful
            const after = await getVideoMetaData(result);
            console.log(`[VideoService] Normalized: ${after.width}x${after.height}, ${after.duration}s, size: ${after.size} bytes`);
            
            // Safety check: if duration changed significantly, something might be wrong with VFR/CFR conversion
            if (before.duration && after.duration && Math.abs(before.duration - after.duration) > 2) {
                console.warn(`[VideoService] Significant duration drift detected during normalization: ${before.duration}s -> ${after.duration}s`);
            }

            return result;
        } catch (error) {
            console.error('Video normalization failed:', error);
            throw error;
        }
    },

    /**
     * Generates a thumbnail image for a video.
     */
    generateThumbnail: async (sourceUri: string): Promise<string | null> => {
        if (Platform.OS === 'web') {
            return new Promise((resolve) => {
                try {
                    const video = document.createElement('video');
                    video.src = sourceUri;
                    video.crossOrigin = 'anonymous';
                    video.muted = true;
                    video.playsInline = true;

                    const handleSeeked = () => {
                        try {
                            const canvas = document.createElement('canvas');
                            canvas.width = video.videoWidth || 640;
                            canvas.height = video.videoHeight || 480;
                            const ctx = canvas.getContext('2d');
                            if (ctx) {
                                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                                resolve(dataUrl);
                            } else {
                                resolve(null);
                            }
                        } catch (e) {
                            console.error('Error generating web thumbnail:', e);
                            resolve(null);
                        }
                    };

                    const handleLoadedData = () => {
                        video.currentTime = Math.min(1, video.duration || 0);
                    };

                    video.addEventListener('loadeddata', handleLoadedData);
                    video.addEventListener('seeked', handleSeeked);
                    video.addEventListener('error', () => {
                        console.error('Error loading video for thumbnail generation');
                        resolve(null);
                    });

                    video.load();
                } catch (e) {
                    console.error('Exception in web thumbnail generation:', e);
                    resolve(null);
                }
            });
        }

        try {
            const { uri } = await VideoThumbnails.getThumbnailAsync(
                sourceUri,
                {
                    time: 0,
                }
            );
            return uri;
        } catch (error) {
            console.error('Thumbnail generation failed:', error);
            return null; 
        }
    },

    /**
     * Creates a database record for the video with 'uploading' status.
     */
    createVideoRecord: async (
        coachId: string,
        academyId: string | null,
        playerId: string | null,
        title: string,
        stroke: string | null,
        metadata: { duration_secs?: number; file_size?: number; folder?: string; hasThumbnail?: boolean }
    ) => {
        const payload = {
            uploaded_by: coachId,
            academy_id: academyId,
            player_id: playerId,
            title: title,
            stroke: stroke,
            description: '',
            folder: metadata.folder || 'general',
            duration_secs: metadata.duration_secs,
            file_size: metadata.file_size,
            upload_status: 'uploading',
            storage_path: 'placeholder',
        };

        const { data, error } = await supabase
            .from('videos')
            .insert(payload)
            .select()
            .single();

        if (error) {
            console.error('Supabase Insert Error:', error);
            throw error;
        }

        const videoId = data.id;
        const folderPart = playerId ? playerId : 'general';
        const storagePath = `${coachId}/${folderPart}/${videoId}.mp4`; // Strictly .mp4 for compatibility

        const thumbnailStoragePath = metadata.hasThumbnail
            ? `${coachId}/${folderPart}/${videoId}_thumb.jpg`
            : null;

        const updatePayload: any = { storage_path: storagePath };
        if (thumbnailStoragePath) {
            updatePayload.thumbnail_path = thumbnailStoragePath;
        }

        const { error: updateError } = await supabase
            .from('videos')
            .update(updatePayload)
            .eq('id', videoId);

        if (updateError) throw updateError;

        return { ...data, storage_path: storagePath, thumbnail_path: thumbnailStoragePath };
    },

    /**
     * Uploads the video file and thumbnail to Supabase Storage with Progress and Retry.
     */
    uploadFiles: async (
        videoUri: string,
        thumbnailUri: string | null,
        storagePath: string,
        thumbnailStoragePath: string | null,
        onProgress?: (progress: number) => void
    ) => {
        const uploadFileNative = async (uri: string, path: string, contentType: string, isVideo: boolean) => {
            let attempts = 0;
            const url = `${supabase.storage.from('videos').getPublicUrl(path).data.publicUrl.split('/public/')[0]}/object/videos/${path}`;
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;

            const headers: Record<string, string> = {
                'x-upsert': 'true',
                'Content-Type': contentType,
                'apikey': supabaseAnonKey,
            };

            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            while (attempts < MAX_RETRIES) {
                try {
                    const uploadTask = FileSystem.createUploadTask(
                        url,
                        uri,
                        {
                            httpMethod: 'POST',
                            uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
                            headers
                        },
                        (data) => {
                            if (isVideo && onProgress && data.totalBytesExpectedToSend > 0) {
                                onProgress(data.totalBytesSent / data.totalBytesExpectedToSend);
                            }
                        }
                    );

                    const result = await uploadTask.uploadAsync();
                    if (result && (result.status === 200 || result.status === 201)) {
                        return result;
                    } else {
                        throw new Error(`Upload failed with status ${result?.status}: ${result?.body}`);
                    }
                } catch (e) {
                    attempts++;
                    console.warn(`Upload attempt ${attempts} failed for ${path}:`, e);
                    if (attempts >= MAX_RETRIES) throw e;
                    await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempts));
                }
            }
        };

        const uploadFileWeb = async (uri: string, path: string, contentType: string) => {
            const response = await fetch(uri);
            const blob = await response.blob();
            const { error } = await supabase.storage
                .from('videos')
                .upload(path, blob, {
                    contentType: contentType,
                    upsert: true,
                });
            if (error) throw error;
        };

        const uploadFile = async (uri: string, path: string, contentType: string, isVideo: boolean) => {
            if (Platform.OS === 'web') {
                return uploadFileWeb(uri, path, contentType);
            } else {
                return uploadFileNative(uri, path, contentType, isVideo);
            }
        };

        // Upload Video
        await uploadFile(videoUri, storagePath, 'video/mp4', true);

        // Upload Thumbnail
        if (thumbnailStoragePath && thumbnailUri) {
            await uploadFile(thumbnailUri, thumbnailStoragePath, 'image/jpeg', false);
        }
    },

    /**
     * Updates the video status to 'ready' after successful upload.
     */
    markAsReady: async (videoId: string) => {
        const { error } = await supabase
            .from('videos')
            .update({ upload_status: 'ready' })
            .eq('id', videoId);
        if (error) throw error;
    },

    /**
     * Updates video metadata (title, stroke).
     */
    updateVideo: async (videoId: string, updates: { title?: string; stroke?: string | null }) => {
        const { error, count } = await supabase
            .from('videos')
            .update(updates, { count: 'exact' })
            .eq('id', videoId);

        if (error) throw error;
        if (count === 0) throw new Error("No se pudo actualizar el registro (posible error de permisos).");
    }
};
