declare module 'react-native-compress' {
    export const Video: {
        compress(
            source: string,
            options: {
                compressionMethod?: 'auto' | 'manual';
                maxWidth?: number;
                maxHeight?: number;
                quality?: number;
            },
            onProgress?: (progress: number) => void
        ): Promise<string>;
    };
}
