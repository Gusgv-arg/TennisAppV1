import { supabase } from '@/src/services/supabaseClient';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Platform } from 'react-native';
import { Video } from 'react-native-compressor';
// Force deploy trigger

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
            // Compress using react-native-compressor
            const result = await Video.compress(sourceUri, {
                compressionMethod: 'auto',
            });
            // react-native-compressor returns the path, sometimes with file://, sometimes not?
            // Usually returns a path.
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
                    time: 0, // Generate thumbnail at 0s (start) to ensure frame exists
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
        stroke: string | null,
        metadata: { duration_secs?: number; file_size?: number; folder?: string; hasThumbnail?: boolean }
    ) => {
        const payload = {
            uploaded_by: coachId,
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

        console.log('Creating video record with payload:', JSON.stringify(payload, null, 2));

        const { data, error } = await supabase
            .from('videos')
            .insert(payload)
            .select()
            .single();

        if (error) {
            console.error('Supabase Insert Error:', error);
            throw error;
        }

        // Generate storage path now that we have the ID
        const videoId = data.id;
        const folderPart = playerId ? playerId : 'general';
        const storagePath = `${coachId}/${folderPart}/${videoId}.mp4`;

        // Only set thumbnail path if it exists
        const thumbnailStoragePath = metadata.hasThumbnail
            ? `${coachId}/${folderPart}/${videoId}_thumb.jpg`
            : null;

        // Update with storage path
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
