import { FrameAnalysisResult, ServeAnalyzer } from './ServeAnalyzer';
import { DominantHand, PoseLandmarks, ServeAnalysisReport } from './types';

// ==========================================
// ABSTRACCIÓN DEL PROVEEDOR VISUAL
// ==========================================
/**
 * Interfaz que define un "Motor de Visión" genérico.
 * Permite inyectar MediaPipe (Web/JSI/Native) sin acoplar el código de React Native.
 */
export interface VisionProvider {
    /** 
     * Inicializa el modelo en memoria (descarga de weights, alloc de tensors) 
     */
    initialize(): Promise<void>;

    /** 
     * Procesa un frame individual (en base64, URI o buffer nativo) y devuelve los 33 puntos 3D.
     */
    detectPose(imageSource: string | any, timestampMs: number): Promise<PoseLandmarks | null>;

    /** 
     * Libera la RAM y destruye la instancia 
     */
    dispose(): void;
}

// ==========================================
// ORQUESTADOR DEL PIPELINE
// ==========================================
export interface PipelineProgressEvent {
    percentCompleted: number;
    currentFrameMs: number;
    analysisResult: FrameAnalysisResult;
}

/**
 * Mueve los frames extraídos hacia la red neuronal (VisionProvider) y 
 * luego transfiere los landmarks matemáticos resultantes al ServeAnalyzer.
 */
export class VisionPipeline {
    private provider: VisionProvider;
    private analyzer: ServeAnalyzer;

    private isAnalyzing: boolean = false;
    private shouldCancel: boolean = false;

    constructor(visionProvider: VisionProvider, dominantHand: DominantHand = 'right', fpsTarget: number = 30) {
        this.provider = visionProvider;
        this.analyzer = new ServeAnalyzer(dominantHand, fpsTarget);
    }

    /**
     * Devuelve true si hay un análisis corriendo.
     */
    public isActive(): boolean {
        return this.isAnalyzing;
    }

    /**
     * Interrumpe el ciclo asincrónico amablemente.
     */
    public cancel() {
        if (this.isAnalyzing) {
            this.shouldCancel = true;
        }
    }

    /**
     * Pipeline principal de análisis Batch asíncrono.
     * Toma una lista de URLs de imágenes locales (extraídas de ffmpeg previamente),
     * extrae la pose una por una sin bloquear la UI, actualiza la máquina de estados 
     * y rinde el reporte de técnica.
     * 
     * @param imageUris Array de 'file://...' ordenados cronológicamente
     * @param fps a los que el video fue extraído originalmente
     * @param onProgress Callback para actualizar la UI capa por capa
     */
    public async analyzeFrames(
        imageUris: string[],
        originalFps: number,
        onProgress?: (event: PipelineProgressEvent) => void
    ): Promise<ServeAnalysisReport> {
        if (this.isAnalyzing) {
            throw new Error("Pipeline is already processing a video.");
        }

        this.isAnalyzing = true;
        this.shouldCancel = false;
        this.analyzer.reset();

        const msPerFrame = 1000 / originalFps;

        try {
            await this.provider.initialize();

            for (let i = 0; i < imageUris.length; i++) {
                if (this.shouldCancel) {
                    throw new Error("Analysis cancelled by user.");
                }

                const timestampMs = i * msPerFrame;

                // 1. Extraer esqueleto con redes neuronales
                const rawLandmarks = await this.provider.detectPose(imageUris[i], timestampMs);

                // 2. Si no hay landmarks (borroso/ruido), pasarle un array vacío/null
                // Nuestro preprocess.ts es robusto y sabrá qué hacer.
                const fallbackLandmarks = rawLandmarks || [];

                // 3. Empujar la física a la máquina de estados
                const frameAnalysis = this.analyzer.processFrame(fallbackLandmarks as PoseLandmarks, timestampMs);

                // 4. Emitir evento para la App (Actualizar Barra de Progreso y Esqueleto 3D dibujado)
                if (onProgress) {
                    onProgress({
                        percentCompleted: Math.round(((i + 1) / imageUris.length) * 100),
                        currentFrameMs: timestampMs,
                        analysisResult: frameAnalysis
                    });
                }

                // 5. Yielding: Darle respiro al hilo principal de JS para que la UI no se congele 
                // en dispositivos móviles viejos simulando un thread defer.
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            // 6. Análisis finalizado, extraer veredicto de técnica
            const finalReport = this.analyzer.generateFinalReport();
            return finalReport;

        } finally {
            this.isAnalyzing = false;
            this.shouldCancel = false;
            // Opcional: provider.dispose() si sabemos que no se usará inmeditamente de nuevo.
        }
    }
}
