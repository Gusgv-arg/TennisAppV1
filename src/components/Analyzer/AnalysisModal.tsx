import React, { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { NativeVisionProvider } from '../../services/PoseAnalysis/NativeVisionProvider';
import { MislabeledVideoError } from '../../services/PoseAnalysis/ServeAnalyzer';
import { VisionPipeline } from '../../services/PoseAnalysis/VisionPipeline';
import { PoseLandmarks, ServeAnalysisReport } from '../../services/PoseAnalysis/types';
import { saveServeAnalysis, updateAnalysis } from '../../services/api/analysisApi';
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
    readOnly = false
}) => {

    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState('Inicializando motor de IA...');
    const { profile } = useAuthStore();

    // Results
    const [report, setReport] = useState<ServeAnalysisReport | null>(initialReport);
    const [rawFrames, setRawFrames] = useState<{ timestampMs: number, landmarks: PoseLandmarks }[]>([]);

    const pipelineRef = React.useRef<VisionPipeline | null>(null);

    // Arranca automático cuando se abre el modal y hay video curado Y no hay un reporte inicial
    React.useEffect(() => {
        if (visible && videoUri && !report && !isProcessing && !initialReport) {
            startAnalysis();
        }

        // Cleanup al cerrar bruscamente
        return () => {
            if (pipelineRef.current) {
                pipelineRef.current.cancel();
            }
        };
    }, [visible, videoUri]);

    const startAnalysis = async () => {
        if (!videoUri) return;

        setIsProcessing(true);
        setReport(null);
        setRawFrames([]);

        // Usamos el NativeVisionProvider como la implementación in-memory del pipeline
        const pipeline = new VisionPipeline(new NativeVisionProvider());
        pipelineRef.current = pipeline;

        try {
            // 1. RUN ENGINE
            const result = await pipeline.analyzeVideoStream(videoUri, (event) => {
                setProgress(Math.max(0, event.percentCompleted));
                // MVP: podríamos actualizar statusText basado en event.analysisResult.phase
                setStatusText(`Analizando... Fase: ${event.analysisResult?.phase || 'Buscando'}`);
            });

            // 2. SET UI
            setReport(result.report);
            setRawFrames(result.trackingFrames || []);

        } catch (error: any) {
            console.error("Pipeline failed:", error);
            onClose(); // Cerrar Modal Inmediatamente para que desaparezca la pantalla negra

            // Esperar medio segundo para que el componente Toast Global reciba el evento,
            // evitando publicarlo en el Toast del Modal que se está destruyendo.
            setTimeout(() => {
                if (error instanceof MislabeledVideoError || error.name === 'MislabeledVideoError') {
                    showError("Video No Válido", "El movimiento analizado no presenta características de un Saque (ej. nunca levanta la raqueta). Verifica la etiqueta del video.");
                } else {
                    showError("Error BioMecánico", error.message || "La IA no pudo procesar este video.");
                }
            }, 500);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSaveCoachReview = async (coachFeedback: string, updatedMetrics: ServeAnalysisReport['categoryScores'] & { finalScore: number }) => {
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
                            preparation: updatedMetrics.preparation,
                            trophy: updatedMetrics.trophy,
                            contact: updatedMetrics.contact,
                            energyTransfer: updatedMetrics.energyTransfer,
                            followThrough: updatedMetrics.followThrough,
                        }
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
                            preparation: updatedMetrics.preparation,
                            trophy: updatedMetrics.trophy,
                            contact: updatedMetrics.contact,
                            energyTransfer: updatedMetrics.energyTransfer,
                            followThrough: updatedMetrics.followThrough,
                        },
                        finalScore: updatedMetrics.finalScore
                    }
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
                {isProcessing && !report ? (
                    // PANTALLA DE CARGA (AI THINKING)
                    <ProcessingModal
                        visible={true}
                        percentCompleted={progress}
                        statusText={statusText}
                    />
                ) : report ? (
                    // PANTALLA FIN DE ANÁLISIS (COACH REVIEW)
                    <AnalysisResultScreen
                        videoUri={videoUri}
                        report={report}
                        fullRawFrames={rawFrames}
                        isExisting={!!initialReport}
                        readOnly={readOnly}
                        onApprove={handleSaveCoachReview}
                        onCancel={onClose}
                    />
                ) : null}

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
