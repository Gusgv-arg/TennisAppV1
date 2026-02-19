import { supabase } from '@/src/services/supabaseClient';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Platform } from 'react-native';
import { Video } from 'react-native-compress';

export interface VideoMetadata {
    uri: string;
    duration?: number; // in seconds
    size?: number; // in bytes
}

export const VideoService = {
    /**
     * Compresses a video file to a target quality suitable for upload.
     * @param sourceUri File URI of the recorded video
     * @returns URI of the compressed video
     */
    compressVideo: async (sourceUri: string): Promise<string> => {
        if (Platform.OS === 'web') return sourceUri; // Skip compression on web
        try {
            // Compress to 720p with medium quality
            const result = await Video.compress(
                sourceUri,
                {
                    compressionMethod: 'auto',
                    maxWidth: 1280,
                    maxHeight: 720,
                    quality: 0.7, // 0.0 - 1.0
                },
                (progress: number) => {
                    // Optional: could allow subscribing to progress here
                    console.log('Compression progress:', progress);
                }
            );
            return result;
        } catch (error) {
            console.error('Video compression failed:', error);
            throw error;
        }
    },

    /**
     * Generates a thumbnail image for a video.
     * @param sourceUri File URI of the video
     * @returns URI of the generated thumbnail image
     */
    generateThumbnail: async (sourceUri: string): Promise<string | null> => {
        if (Platform.OS === 'web') return null; // Skip thumbnail on web for now
        try {
            const { uri } = await VideoThumbnails.getThumbnailAsync(
                sourceUri,
                {
                    time: 1000, // Generate thumbnail at 1s
                }
            );
            return uri;
        } catch (error) {
            console.error('Thumbnail generation failed:', error);
            return null; // Return null instead of throwing to allow flow to continue
        }
    },

    /**
     * Creates a database record for the video with 'uploading' status.
     */
    createVideoRecord: async (
        coachId: string,
        playerId: string | null,
        title: string,
        metadata: { duration_secs?: number; file_size?: number; folder?: string }
    ) => {
        const { data, error } = await supabase
            .from('videos')
            .insert({
                uploaded_by: coachId,
                player_id: playerId,
                title: title,
                description: '',
                folder: metadata.folder || 'general',
                duration_secs: metadata.duration_secs,
                file_size: metadata.file_size,
                upload_status: 'uploading',
                storage_path: 'placeholder', // Will update after upload path is determined by trigger or manually? 
                // Wait, we decided storage path: videos/{coach_id}/{player_id || 'general'}/{video_uuid}.mp4
                // We need the ID first to generate the path. 
                // Let's insert first and get ID.
            })
            .select()
            .single();

        if (error) throw error;

        // Generate storage path now that we have the ID (or we could have generated a UUID client side, but letting DB do it is safer for PKs)
        const videoId = data.id;
        const folderPart = playerId ? playerId : 'general';
        const storagePath = `${coachId}/${folderPart}/${videoId}.mp4`;
        const thumbnailStoragePath = `${coachId}/${folderPart}/${videoId}_thumb.jpg`;

        // Update with storage path
        const { error: updateError } = await supabase
            .from('videos')
            .update({ storage_path: storagePath, thumbnail_path: thumbnailStoragePath })
            .eq('id', videoId);

        if (updateError) throw updateError;

        return { ...data, storage_path: storagePath, thumbnail_path: thumbnailStoragePath };
    },

    /**
     * Uploads the video file and thumbnail to Supabase Storage.
     */
    uploadFiles: async (
        videoUri: string,
        thumbnailUri: string | null,
        storagePath: string,
        thumbnailStoragePath: string
    ) => {
        // Helper to read file as base64 and upload
        const uploadFile = async (uri: string, path: string, contentType: string) => {
            if (Platform.OS === 'web') {
                // On web we might be able to upload blob or file directly, 
                // but readAsStringAsync with base64 works on web in Expo too usually?
                // Actually FileSystem.readAsStringAsync supports web for local URIs? 
                // If it's a blob uri (mock), we might need fetch.
                // For now assuming existing logic works or we need a quick fetch polyfill.
                try {
                    const response = await fetch(uri);
                    const blob = await response.blob();
                    const { error } = await supabase.storage
                        .from('videos')
                        .upload(path, blob, {
                            contentType: contentType,
                            upsert: true,
                        });
                    if (error) throw error;
                } catch (e) {
                    console.error("Web upload failed trying fetch/blob", e);
                    throw e;
                }
                return;
            }

            const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
            const { error } = await supabase.storage
                .from('videos')
                .upload(path, decode(base64), {
                    contentType: contentType,
                    upsert: true,
                });
            if (error) throw error;
        };

        // Upload Video
        await uploadFile(videoUri, storagePath, 'video/mp4');

        // Upload Thumbnail
        // Check if we have a thumbnail path, sometimes we might skip it or it might be optional
        if (thumbnailStoragePath && thumbnailUri) {
            await uploadFile(thumbnailUri, thumbnailStoragePath, 'image/jpeg');
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
    }
};
