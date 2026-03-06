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
     * Inicia el análisis iterativo de un video en memoria usando el pipeline activo.
     * En MediaPipe Tasks Vision esto mapea a `detectForVideo(frame, timestamp)`
     * 
     * @param videoSource Origen del video (URL local, Asset o elemento HTMLVideoElement en caso de webview)
     * @param onFrameProcessed Callback emitido con cada frame analizado
     */
    processVideoStream(videoSource: any, onFrameProcessed: (landmarks: PoseLandmarks | null, timestampMs: number) => void): Promise<void>;

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
     * Pipeline principal de análisis In-Memory.
     * En lugar de leer de archivos basuras locales, delega al Provider la tarea de
     * iterar sobre los frames del video (usando requestAnimationFrame o FrameProcessors),
     * pasándoselo a MediaPipe Tasks via `detectForVideo()`.
     * 
     * @param videoSource URL local del video grabado
     * @param onProgress Callback para actualizar la UI
     */
    public async analyzeVideoStream(
        videoSource: any,
        onProgress?: (event: PipelineProgressEvent) => void
    ): Promise<{ report: ServeAnalysisReport; trackingFrames: { timestampMs: number, landmarks: PoseLandmarks }[] }> {
        if (this.isAnalyzing) {
            throw new Error("Pipeline is already processing a video.");
        }

        this.isAnalyzing = true;
        this.shouldCancel = false;
        this.analyzer.reset();
        const trackingFrames: { timestampMs: number, landmarks: PoseLandmarks }[] = [];

        try {
            await this.provider.initialize();

            // Delegamos la extracción in-memory al provider nativo/webview.
            // Nos llamará de vuelta por cada frame que logre decodificar de forma secuencial.
            await this.provider.processVideoStream(videoSource, (rawLandmarks, timestampMs) => {
                if (this.shouldCancel) {
                    throw new Error("Analysis cancelled by user.");
                }

                const fallbackLandmarks = rawLandmarks || [];

                if (fallbackLandmarks.length > 0) {
                    trackingFrames.push({ timestampMs, landmarks: fallbackLandmarks as PoseLandmarks });
                }

                const frameAnalysis = this.analyzer.processFrame(fallbackLandmarks as PoseLandmarks, timestampMs);

                if (onProgress) {
                    onProgress({
                        // El cálculo de porcentaje dependerá del tiempo actual vs duración total (si la tenemos)
                        // Por simplicidad en MVP enviamos un indicador de avance con el tiempo
                        percentCompleted: -1,
                        currentFrameMs: timestampMs,
                        analysisResult: frameAnalysis
                    });
                }
            });

            const finalReport = this.analyzer.generateFinalReport();
            return { report: finalReport, trackingFrames };

        } finally {
            this.isAnalyzing = false;
            this.shouldCancel = false;
        }
    }
}
