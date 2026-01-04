import { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuthStore } from '../store/useAuthStore';

export const useAvatarUpload = () => {
    const [isUploading, setIsUploading] = useState(false);
    const { user } = useAuthStore();

    const uploadAvatar = async (uri: string, playerId: string): Promise<string | null> => {
        if (!user?.id) {
            console.error('User not authenticated');
            return null;
        }

        setIsUploading(true);
        try {
            // Fetch the image as a blob
            const response = await fetch(uri);
            const blob = await response.blob();

            // Generate unique filename with user ID folder (required by RLS policy)
            const fileExt = uri.split('.').pop()?.split('?')[0] || 'jpg';
            const fileName = `${playerId}_${Date.now()}.${fileExt}`;
            const filePath = `${user.id}/${fileName}`;

            // Upload to Supabase Storage
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
            console.error('Error uploading avatar:', error);
            return null;
        } finally {
            setIsUploading(false);
        }
    };

    return {
        uploadAvatar,
        isUploading,
    };
};
