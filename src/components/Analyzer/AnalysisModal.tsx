import React, { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { NativeVisionProvider } from '../../services/PoseAnalysis/NativeVisionProvider';
import { MislabeledVideoError } from '../../services/PoseAnalysis/ServeAnalyzer';
import { VisionPipeline } from '../../services/PoseAnalysis/VisionPipeline';
import { PHASE_LABELS } from '../../services/PoseAnalysis/constants';
import { DominantHand, PoseLandmarks, ServeAnalysisReport, ServePhase, StrokeType } from '../../services/PoseAnalysis/types';
import { saveServeAnalysis, updateAnalysis } from '../../services/api/analysisApi';
import { supabase } from '../../services/supabaseClient';
import { useAuthStore } from '../../store/useAuthStore';
import { showError, showSuccess } from '../../utils/toast';
import { toastConfig } from '../ToastConfig';
import { AnalysisResultScreen } from './AnalysisResultScreen';
import { ProcessingModal } from './ProcessingModal';

interface AnalysisModalProps {
    visible: boolean;
    reportId?: string; // Optional: if we are editing/viewing an existing one
    videoUri: string | null;
    videoId: string | null; // DB ID of the video 
    playerId: string | null;
    coachId: string;
    onClose: () => void;
    onSuccess: () => void;
    initialReport?: ServeAnalysisReport | null; // For viewing existing reports
    readOnly?: boolean;
    strokeType?: StrokeType; // New: optional stroke type (defaults to SERVE)
}

export const AnalysisModal: React.FC<AnalysisModalProps> = ({
    visible,
    videoUri,
    videoId,
    playerId,
    coachId,
    onClose,
    onSuccess,
    initialReport = null,
    reportId,
    readOnly = false,
    strokeType = 'SERVE'
}) => {

    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState('Iniciando...');
    const [isVideoReady, setIsVideoReady] = useState(!!initialReport);
    const [playerHand, setPlayerHand] = useState<DominantHand>('right');
    const [isPlayerLoaded, setIsPlayerLoaded] = useState(!!initialReport);
    const [isWarningActive, setIsWarningActive] = useState(false);
    const { profile } = useAuthStore();

    // Results
    // Results
    const [report, setReport] = useState<ServeAnalysisReport | null>(initialReport);

    // Sync report state with initialReport prop (Crucial for View/Edit mode)
    React.useEffect(() => {
        if (visible && initialReport) {
            setReport(initialReport);
            setIsVideoReady(true); // Prep results screen immediately
        }
    }, [visible, initialReport]);
    const [rawFrames, setRawFrames] = useState<{ timestampMs: number, landmarks: PoseLandmarks }[]>([]);

    const pipelineRef = React.useRef<VisionPipeline | null>(null);
    const skipOrientationRef = React.useRef<boolean>(false);
    const finishedRef = React.useRef<boolean>(false);
    const analysisStartedRef = React.useRef<boolean>(false);
    const videoReadyRef = React.useRef<boolean>(false);
    const isWarningRef = React.useRef<boolean>(false);

    // Cargar datos del jugador (Dominante)
    React.useEffect(() => {
        if (visible && playerId) {
            const fetchPlayer = async () => {
                try {
                    const { data, error } = await supabase
                        .from('players')
                        .select('dominant_hand')
                        .eq('id', playerId)
                        .single();

                    if (data?.dominant_hand && data.dominant_hand !== 'ambidextrous') {
                        setPlayerHand(data.dominant_hand as DominantHand);
                    }
                    setIsPlayerLoaded(true);
                } catch (err) {
                    console.warn("Could not fetch player dominant hand, defaulting to right", err);
                    setIsPlayerLoaded(true);
                }
            };
            fetchPlayer();
        } else if (visible && !playerId) {
            // Si no hay playerId (poco común), marcamos como cargado con default
            setIsPlayerLoaded(true);
        }
    }, [visible, playerId]);

    // Arranca automático cuando se abre el modal y hay video curado Y no hay un reporte inicial
    React.useEffect(() => {
        // Solo arrancamos si: el modal es visible, hay video, no ha empezado ya, NO hay reporte previo y el perfil está cargado
        if (visible && videoUri && !analysisStartedRef.current && !initialReport && isPlayerLoaded) {
            analysisStartedRef.current = true;
            startAnalysis();
        }

        // Cleanup al cerrar o desmontar
        return () => {
            if (pipelineRef.current) {
                pipelineRef.current.cancel();
            }
        };
    }, [visible, videoUri, isPlayerLoaded, initialReport]);

    // Reseteo de estados al cerrar el modal (para fresh start la próxima vez)
    React.useEffect(() => {
        if (!visible) {
            analysisStartedRef.current = false;
            videoReadyRef.current = false;
            setReport(null);
            setProgress(0);
            setIsProcessing(false);
            setIsWarningActive(false);
            setIsVideoReady(false);
            setStatusText('Iniciando...');
        }
    }, [visible]);

    const startAnalysis = async () => {
        if (!videoUri) return;

        console.log(`[AnalysisModal] Starting Analysis for Player: ${playerId} | Hand: ${playerHand}`);
        setIsProcessing(true);
        setProgress(0);
        setStatusText('Iniciando...');
        setReport(null);
        setIsWarningActive(false);
        setRawFrames([]);
        finishedRef.current = false;
        videoReadyRef.current = false;
        isWarningRef.current = false;

        // Usamos el NativeVisionProvider como la implementación in-memory del pipeline
        const pipeline = new VisionPipeline(new NativeVisionProvider(), playerHand);
        pipeline.setSkipOrientationCheck(skipOrientationRef.current);
        pipelineRef.current = pipeline;

        try {
            // 1. RUN ENGINE
            const result = await pipeline.analyzeVideoStream(videoUri, (event) => {
                if (finishedRef.current) return;

                const currentPercent = event.percentCompleted;
                if (!isNaN(currentPercent)) {
                    setProgress((prev) => {
                        const next = Math.max(prev, currentPercent);

                        // Congelamos visualmente en 99% para evitar el parpadeo de micro-actualizaciones al final (User request)
                        if (next >= 99) return 99;

                        // Throttling: solo actualizamos si cambia el entero
                        if (Math.floor(next) > Math.floor(prev)) {
                            return next;
                        }
                        return prev;
                    });
                }

                if (event.poorOrientation) {
                    isWarningRef.current = true;
                    setIsWarningActive(true);
                    setStatusText("Perfil opuesto detectado. Se recomienda cancelar y grabar del otro lado para mayor precisión.");
                } else if (!isWarningActive && !isWarningRef.current) {
                    // Update status text based on phase
                    const phase = event.analysisResult?.phase || ServePhase.IDLE;
                    const label = PHASE_LABELS[phase] || 'Analizando...';
                    setStatusText(`Analizando... ${label}`);
                }
            });

            // 2. Atomic Finalization
            finishedRef.current = true;
            setProgress(100);

            // 3. Montar resultados e imágenes de tracking
            setReport(result.report);
            setRawFrames(result.trackingFrames || []);

            // 4. Safe Handshake: Esperar a que el video del reporte esté listo con Timeout de 3s
            const startTime = Date.now();
            while (!videoReadyRef.current && (Date.now() - startTime < 3000)) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Fallback: Garantizar que el overlay se oculte incluso si onReady del video falla o demora
            setIsVideoReady(true);

        } catch (error: any) {
            console.error("Pipeline failed:", error);

            if (error.message?.includes("cancelled")) {
                setIsProcessing(false);
                onClose(); // Cerrar modal para volver a la pantalla anterior
                return;
            }

            onClose(); // Cerrar Modal Inmediatamente para que desaparezca la pantalla negra
            setIsProcessing(false);

            // Esperar medio segundo para que el componente Toast Global reciba el evento,
            // evitando publicarlo en el Toast del Modal que se está destruyendo.
            setTimeout(() => {
                if (error instanceof MislabeledVideoError || error.name === 'MislabeledVideoError') {
                    const strokeNames: Record<StrokeType, string> = {
                        SERVE: 'Saque',
                        DRIVE: 'Drive',
                        BACKHAND: 'Revés',
                        VOLLEY: 'Volea',
                        SMASH: 'Smash'
                    };
                    const strokeName = strokeNames[strokeType];
                    showError("Video No Válido", `El movimiento analizado no presenta características de un ${strokeName}. Verifica que el video coincida con el golpe seleccionado.`);
                } else {
                    showError("Error BioMecánico", error.message || "La IA no pudo procesar este video.");
                }
            }, 500);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSaveCoachReview = async (coachFeedback: string, updatedMetrics: ServeAnalysisReport['categoryScores'] & { finalScore: number, detailedMetrics: ServeAnalysisReport['detailedMetrics'] }) => {
        if (!report && !initialReport) { // Ensure there's a report to save/update
            showError("Faltan datos", "No se puede guardar el análisis sin un informe generado.");
            return;
        }
        if (!videoId || !playerId) {
            showError("Faltan datos", "No se puede guardar el análisis sin video o jugador identificado.");
            return;
        }

        try {
            setIsProcessing(true);
            setStatusText(initialReport ? 'Actualizando informe...' : 'Guardando informe...');

            // MODO ACTUALIZACIÓN: Si ya existe un reportId, sobreescribimos
            if (reportId) {
                await updateAnalysis(reportId, {
                    coach_feedback: coachFeedback,
                    metrics: {
                        finalScore: updatedMetrics.finalScore,
                        confidence: initialReport?.confidence || report?.confidence || 0.8,
                        categoryScores: {
                            preparacion: updatedMetrics.preparacion,
                            armado: updatedMetrics.armado,
                            impacto: updatedMetrics.impacto,
                            terminacion: updatedMetrics.terminacion,
                        },
                        detailedMetrics: updatedMetrics.detailedMetrics
                    },
                    ai_feedback: {
                        ...initialReport?.ai_feedback,
                        flags: report?.flags || initialReport?.flags || [],
                        keyframes: report?.keyframes || initialReport?.keyframes || {},
                        fullRawFrames: rawFrames.length > 0 ? rawFrames : initialReport?.ai_feedback?.fullRawFrames || []
                    }
                });
                showSuccess("Actualizado", "El informe ha sido actualizado con éxito.");
            } else if (report) {
                // MODO NUEVO: Solo si no hay reportId previo
                await saveServeAnalysis({
                    videoId,
                    playerId,
                    coachId,
                    academyId: profile?.current_academy_id || undefined,
                    coachFeedback,
                    report: {
                        ...report,
                        categoryScores: {
                            preparacion: updatedMetrics.preparacion,
                            armado: updatedMetrics.armado,
                            impacto: updatedMetrics.impacto,
                            terminacion: updatedMetrics.terminacion,
                        },
                        finalScore: updatedMetrics.finalScore,
                        detailedMetrics: updatedMetrics.detailedMetrics
                    },
                    fullRawFrames: rawFrames
                });
                showSuccess("Guardado", "El análisis biomecánico se ha guardado correctamente.");
            }

            onSuccess();
            onClose();
        } catch (error: any) {
            showError("Error al guardar", error.message);
            // Restaurar reporte para reintento
        } finally {
            setIsProcessing(false);
        }
    };


    if (!visible || !videoUri) return null;

    return (
        <Modal visible={visible} animationType="slide" transparent={false}>
            <View style={styles.container}>
                {/* 1. Capa de Resultados: Montada en cuanto el reporte está listo */}
                {report && (
                    <AnalysisResultScreen
                        videoUri={videoUri}
                        report={report}
                        videoId={videoId || ""}
                        fullRawFrames={rawFrames.length > 0 ? rawFrames : report.ai_feedback?.fullRawFrames}
                        isExisting={!!initialReport || reportId !== undefined}
                        readOnly={readOnly}
                        onApprove={handleSaveCoachReview}
                        onCancel={onClose}
                        playerHand={playerHand}
                        onReady={() => {
                            videoReadyRef.current = true;
                            setIsVideoReady(true);
                        }}
                    />
                )}

                {/* 2. Capa de Carga (Overlay): Telón 100% negro cubriendo todo */}
                {/* Corregimos la condición: solo desaparece cuando report Y video están listos */}
                {(!report || !isVideoReady || !isPlayerLoaded) && (() => {
                    const strokeNames: Record<StrokeType, string> = {
                        SERVE: 'saque',
                        DRIVE: 'drive',
                        BACKHAND: 'revés',
                        VOLLEY: 'volea',
                        SMASH: 'smash'
                    };
                    const strokeName = strokeNames[strokeType] || strokeType.toLowerCase();

                    return (
                        <ProcessingModal
                            visible={true}
                            percentCompleted={!isPlayerLoaded ? 0 : progress}
                            title={`Analizando biomecánica del ${strokeName}`}
                            statusText={!isPlayerLoaded ? 'Cargando perfil del alumno...' : statusText}
                            isWarning={isWarningActive}
                            onCancel={() => {
                                if (pipelineRef.current) {
                                    pipelineRef.current.cancel();
                                }
                            }}
                        />
                    );
                })()}

                {/* Local Toast to ensure it shows above the Modal */}
                <Toast config={toastConfig} topOffset={40} />
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000'
    }
});
