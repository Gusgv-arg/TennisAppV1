import { FrameAnalysisResult, ServeAnalyzer } from './ServeAnalyzer';
import { DominantHand, PoseLandmarks, ServeAnalysisReport, ServeMetrics } from './types';

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
     * @param onFrameProcessed Callback emitido con cada frame analizado, el tercer arg es el porcentaje (0 a 100).
     */
    processVideoStream(videoSource: any, onFrameProcessed: (landmarks: PoseLandmarks | null, timestampMs: number, percentCompleted?: number, snapshotUrl?: string) => void): Promise<void>;

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
    poorOrientation: boolean;
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
            // Intentar purgar inmediatamente si el provider lo soporta
            this.provider.dispose();
        }
    }

    /**
     * Permite saltarse el guardrail de orientación si el usuario ya confirmó.
     */
    public setSkipOrientationCheck(skip: boolean) {
        this.analyzer.skipOrientationCheck = skip;
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
    ): Promise<{ report: ServeAnalysisReport; trackingFrames: { timestampMs: number, landmarks: PoseLandmarks, metrics: ServeMetrics | null, phase?: string }[] }> {
        if (this.isAnalyzing) {
            throw new Error("Pipeline is already processing a video.");
        }

        this.isAnalyzing = true;
        this.shouldCancel = false;
        this.analyzer.reset();
        const trackingFrames: { timestampMs: number, landmarks: PoseLandmarks, metrics: ServeMetrics | null, phase?: string }[] = [];
        let lastFrameAnalysis: any = null;

        try {
            await this.provider.initialize();

            // Delegamos la extracción in-memory al provider nativo/webview.
            await this.provider.processVideoStream(videoSource, (rawLandmarks, timestampMs, percentCompleted, snapshotUrl) => {
                if (this.shouldCancel) {
                    throw new Error("Analysis cancelled by user.");
                }

                const fallbackLandmarks = rawLandmarks || [];
                
                // Procesamos el frame primero para obtener landmarks normalizados y suavizados (copia profunda)
                lastFrameAnalysis = this.analyzer.processFrame(fallbackLandmarks as PoseLandmarks, timestampMs, snapshotUrl);

                if (lastFrameAnalysis.landmarks) {
                    trackingFrames.push({ 
                        timestampMs, 
                        landmarks: lastFrameAnalysis.landmarks,
                        metrics: lastFrameAnalysis.metrics,
                        phase: lastFrameAnalysis.phase
                    });
                }

                if (onProgress) {
                    // Progreso: Priorizar real (web) o estimar asintóticamente (nativo)
                    // La curva asegura movimiento constante sin clavarse en el 99%
                    const percent = percentCompleted !== undefined
                        ? percentCompleted
                        : (1 - Math.exp(-trackingFrames.length / 60)) * 96;

                    onProgress({
                        percentCompleted: Math.round(percent),
                        currentFrameMs: timestampMs,
                        analysisResult: lastFrameAnalysis,
                        poorOrientation: !!lastFrameAnalysis.poorOrientation
                    });
                }
            });

            // Forzar evento final de éxito rotundo de cara a la UI
            if (onProgress) {
                const finalRes = lastFrameAnalysis || this.analyzer.processFrame([] as any, 0);
                onProgress({
                    percentCompleted: 100,
                    currentFrameMs: trackingFrames.length > 0 ? trackingFrames[trackingFrames.length - 1].timestampMs : 0,
                    analysisResult: finalRes,
                    poorOrientation: !!finalRes.poorOrientation
                });
            }

            const finalReport = this.analyzer.generateFinalReport();
            return { report: finalReport, trackingFrames };

        } finally {
            this.isAnalyzing = false;
            this.shouldCancel = false;
        }
    }
}
