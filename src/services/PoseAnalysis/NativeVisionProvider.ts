import { NativeEventEmitter, NativeModules } from 'react-native';
import { VisionProvider } from './VisionPipeline';
import { PoseLandmarks } from './types';

const { MediaPipeNativeModule } = NativeModules;

/**
 * Proveedor de MediaPipe que asume conexión con nativo (Swift/Kotlin).
 * Este módulo decodificará video usando AVAssetReader/MediaCodec para no
 * extraer ni tocar fotogramas físicos en disco, enviando cada Landmark al hilo JS en streaning.
 */
export class NativeVisionProvider implements VisionProvider {

    private emitter: NativeEventEmitter | null = null;

    async initialize(): Promise<void> {
        if (!MediaPipeNativeModule) {
            console.warn("M4 (WebRTC/MediaCodec): MediaPipeNativeModule is not linked. A native implementation using Expo Config Plugins and C++ JSI or regular bridges will be needed.");
            return;
        }

        this.emitter = new NativeEventEmitter(MediaPipeNativeModule);
        await MediaPipeNativeModule.initializeLandmarker();
    }

    async processVideoStream(videoUri: string, onFrameProcessed: (landmarks: PoseLandmarks | null, timestampMs: number) => void): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.emitter || !MediaPipeNativeModule) {
                // Simulacro temporal (mock) para evitar crashes si el módulo nativo aún no está escrito
                setTimeout(() => resolve(), 100);
                return;
            }

            const subscription = this.emitter.addListener('FRAME_ANALYZED', (event) => {
                if (event.status === 'DONE') {
                    subscription.remove();
                    resolve();
                } else if (event.status === 'ERROR') {
                    subscription.remove();
                    reject(new Error(event.message));
                } else {
                    onFrameProcessed(event.landmarks, event.timestampMs);
                }
            });

            // Ordenarle al nativo que empiece a decodificar y a procesar in-memory a 30 FPS.
            MediaPipeNativeModule.detectForVideo(videoUri).catch((e: Error) => {
                subscription.remove();
                reject(e);
            });
        });
    }

    dispose(): void {
        if (MediaPipeNativeModule) {
            MediaPipeNativeModule.disposeLandmarker();
        }
        if (this.emitter) {
            this.emitter.removeAllListeners('FRAME_ANALYZED');
        }
    }
}
