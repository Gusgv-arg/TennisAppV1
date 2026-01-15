import { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuthStore } from '../store/useAuthStore';

export const useGroupImageUpload = () => {
    const [isUploading, setIsUploading] = useState(false);
    const { user } = useAuthStore();

    const uploadGroupImage = async (uri: string, groupId: string): Promise<string | null> => {
        if (!user?.id) {
            console.error('User not authenticated');
            return null;
        }

        setIsUploading(true);
        try {
            // Fetch the image as a blob
            const response = await fetch(uri);
            const blob = await response.blob();

            // Determine extension from blob type (more robust for blob: URIs)
            const mimeType = blob.type; // e.g. "image/jpeg"
            const fileExt = mimeType.split('/')[1] || 'jpg';

            // Generate unique filename
            const fileName = `group_${groupId}_${Date.now()}.${fileExt}`;
            const filePath = `${user.id}/${fileName}`;

            // Upload to Supabase Storage (using avatars bucket as it is configured for user access)
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, blob, {
                    contentType: `image/${fileExt}`,
                    upsert: true,
                });

            if (uploadError) {
                console.error('Upload error:', uploadError);
                throw uploadError;
            }

            // Get public URL
            const { data } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            return data.publicUrl;
        } catch (error) {
            console.error('Error uploading group image:', error);
            return null;
        } finally {
            setIsUploading(false);
        }
    };

    return {
        uploadGroupImage,
        isUploading,
    };
};
