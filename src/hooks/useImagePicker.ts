import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Platform } from 'react-native';

export const useImagePicker = () => {
    const [isLoading, setIsLoading] = useState(false);

    const requestCameraPermission = async () => {
        if (Platform.OS !== 'web') {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(
                    'Permiso requerido',
                    'Se necesita acceso a la cámara para tomar fotos.'
                );
                return false;
            }
        }
        return true;
    };

    const pickImageFromCamera = async (): Promise<string | null> => {
        setIsLoading(true);
        try {
            const hasPermission = await requestCameraPermission();
            if (!hasPermission) return null;

            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.7,
            });

            if (!result.canceled && result.assets[0]) {
                return result.assets[0].uri;
            }
            return null;
        } catch (error) {
            console.error('Error picking image from camera:', error);
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    const pickImageFromGallery = async (): Promise<string | null> => {
        setIsLoading(true);
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.7,
            });

            if (!result.canceled && result.assets[0]) {
                return result.assets[0].uri;
            }
            return null;
        } catch (error) {
            console.error('Error picking image from gallery:', error);
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        pickImageFromCamera,
        pickImageFromGallery,
        isLoading,
    };
};
