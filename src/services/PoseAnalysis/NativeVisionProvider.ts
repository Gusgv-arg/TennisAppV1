import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { VisionProvider } from './VisionPipeline';
import { PoseLandmarks } from './types';

const { MediaPipeNativeModule } = NativeModules;

/**
 * Proveedor de MediaPipe que asume conexión con nativo (Swift/Kotlin).
 * Cuando corre en plataforma Web, utiliza la librería oficial @mediapipe/tasks-vision localmente
 */
export class NativeVisionProvider implements VisionProvider {

    private emitter: NativeEventEmitter | null = null;

    async initialize(): Promise<void> {
        if (Platform.OS === 'web') {
            console.log("Vision Engine: Running pure WEB implementation with local WASM.");
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
            return this.runWebEngine(videoUri, onFrameProcessed);
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
     * Motor web real que carga MediaPipe WASM e infiere en un video DOM desconectado.
     * Implementa decimation (frame skipping) para rendimiento y cierre de memoria.
     */
    private async runWebEngine(videoUri: string, onFrameProcessed: (l: PoseLandmarks, t: number) => void): Promise<void> {
        let poseLandmarker: PoseLandmarker | null = null;

        try {
            // Resolviendo wasm desde la carpeta public/wasm
            const vision = await FilesetResolver.forVisionTasks('/wasm');

            poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: '/models/pose_landmarker_lite.task', // Modelo en public/models
                    delegate: 'GPU'
                },
                runningMode: 'VIDEO',
                numPoses: 1
            });

            return new Promise((resolve, reject) => {
                const videoEl = document.createElement('video');
                videoEl.src = videoUri;
                videoEl.crossOrigin = 'anonymous'; // Importante para Blob URLs o Supabase
                videoEl.muted = true;
                videoEl.playsInline = true;

                videoEl.onloadeddata = async () => {
                    const duration = videoEl.duration;
                    const FPS = 12; // Procesamos 12 frames reales por segundo (ahorro extremo CPU/RAM)
                    const step = 1 / FPS;

                    for (let t = 0; t <= duration; t += step) {
                        videoEl.currentTime = t;

                        // Esperar a que el video salte físicamente a ese frame
                        await new Promise(r => {
                            videoEl.onseeked = r;
                        });

                        const timestampMs = Math.round(t * 1000);
                        const result = poseLandmarker!.detectForVideo(videoEl, timestampMs);

                        if (result && result.landmarks && result.landmarks.length > 0) {
                            const rawLandmarks = result.landmarks[0];
                            // Convertir tipos
                            const converted: PoseLandmarks = rawLandmarks.map((lm) => ({
                                x: lm.x,
                                y: lm.y,
                                z: lm.z,
                                visibility: lm.visibility ?? 1.0,
                                presence: (lm as any).presence ?? 1.0,
                            })) as unknown as PoseLandmarks;

                            onFrameProcessed(converted, timestampMs);
                        } else {
                            // Enviar fotograma vacío como null
                            onFrameProcessed(null as any, timestampMs);
                        }
                    }
                    resolve();
                };

                videoEl.onerror = () => {
                    reject(new Error("Error al intentar procesar el video web en el canvas"));
                };

                // Desatar la carga
                videoEl.load();
            });

        } catch (e) {
            console.error("Motor Web VisionProvider falló:", e);
            throw e;
        } finally {
            // Memory Management: Destruir el modulo y purgar WebAssembly RAM
            if (poseLandmarker) {
                poseLandmarker.close();
                console.log("🧹 MediaPipe WebAssembly Memory Purgada");
            }
        }
    }
}
