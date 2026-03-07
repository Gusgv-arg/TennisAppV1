import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
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
        if (Platform.OS === 'web') {
            console.log("Vision Engine: Running in WEB SIMULATION mode.");
            return;
        }

        if (!MediaPipeNativeModule) {
            console.warn("M4 (WebRTC/MediaCodec): MediaPipeNativeModule is not linked. A native implementation using Expo Config Plugins and C++ JSI or regular bridges will be needed.");
            return;
        }

        this.emitter = new NativeEventEmitter(MediaPipeNativeModule);
        await MediaPipeNativeModule.initializeLandmarker();
    }

    async processVideoStream(videoUri: string, onFrameProcessed: (landmarks: PoseLandmarks | null, timestampMs: number) => void): Promise<void> {
        if (Platform.OS === 'web') {
            return this.runWebSimulation(onFrameProcessed);
        }

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

    /**
     * Genera una secuencia de landmarks ficticios para permitir testing de la UI en Web.
     */
    private async runWebSimulation(onFrameProcessed: (l: PoseLandmarks, t: number) => void): Promise<void> {
        const TOTAL_FRAMES = 200; // ~7 seconds @ 30fps for slow-mo testing
        const INTERVAL_MS = 33;

        for (let i = 0; i < TOTAL_FRAMES; i++) {
            const frame: PoseLandmarks = Array(33).fill({ x: 0.5, y: 0.5, z: 0, visibility: 0, presence: 0 }) as PoseLandmarks;

            // Simular un poco de movimiento (caída suave o balanceo)
            const yOffset = Math.sin(i / 30) * 0.04;

            const landmarksToMock = [
                { idx: 0, x: 0.5, y: 0.2 + yOffset },
                { idx: 11, x: 0.4, y: 0.3 + yOffset },
                { idx: 12, x: 0.6, y: 0.3 + yOffset },
                { idx: 13, x: 0.35, y: 0.45 + yOffset },
                { idx: 14, x: 0.65, y: 0.45 + yOffset },
                { idx: 15, x: 0.3, y: 0.55 + yOffset },
                { idx: 16, x: 0.7, y: 0.55 + yOffset },
                { idx: 23, x: 0.45, y: 0.6 + yOffset },
                { idx: 24, x: 0.55, y: 0.6 + yOffset },
                { idx: 25, x: 0.45, y: 0.8 + yOffset },
                { idx: 26, x: 0.55, y: 0.8 + yOffset },
                { idx: 27, x: 0.45, y: 0.95 + yOffset },
                { idx: 28, x: 0.55, y: 0.95 + yOffset },
            ];

            landmarksToMock.forEach(m => {
                frame[m.idx] = { x: m.x, y: m.y, z: 0, visibility: 0.95, presence: 0.95 };
            });

            // Frame 80 fingimos contacto
            if (i > 75 && i < 85) {
                frame[15] = { x: 0.5, y: 0.05 + yOffset, z: 0, visibility: 0.95 };
                frame[16] = { x: 0.5, y: 0.05 + yOffset, z: 0, visibility: 0.95 };
            }

            const timestampMs = i * INTERVAL_MS;
            onFrameProcessed(frame, timestampMs);
            await new Promise(r => setTimeout(r, 5)); // Processing speed bypass for demo
        }
    }
}
