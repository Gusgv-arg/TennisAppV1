import React, { useState } from 'react';
import { Alert, Modal, StyleSheet, View } from 'react-native';
import { NativeVisionProvider } from '../../services/PoseAnalysis/NativeVisionProvider';
import { VisionPipeline } from '../../services/PoseAnalysis/VisionPipeline';
import { PoseLandmarks, ServeAnalysisReport } from '../../services/PoseAnalysis/types';
import { saveServeAnalysis } from '../../services/api/analysisApi';
import { AnalysisResultScreen } from './AnalysisResultScreen';
import { ProcessingModal } from './ProcessingModal';

interface AnalysisModalProps {
    visible: boolean;
    videoUri: string | null;
    videoId: string | null; // DB ID of the video 
    playerId: string | null;
    coachId: string;
    onClose: () => void;
    onSuccess: () => void;
}

export const AnalysisModal: React.FC<AnalysisModalProps> = ({
    visible,
    videoUri,
    videoId,
    playerId,
    coachId,
    onClose,
    onSuccess
}) => {

    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState('Inicializando motor de IA...');

    // Results
    const [report, setReport] = useState<ServeAnalysisReport | null>(null);
    const [rawFrames, setRawFrames] = useState<{ timestampMs: number, landmarks: PoseLandmarks }[]>([]);

    const pipelineRef = React.useRef<VisionPipeline | null>(null);

    // Arranca automático cuando se abre el modal y hay video curado
    React.useEffect(() => {
        if (visible && videoUri && !report && !isProcessing) {
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
            Alert.alert("Error BioMecánico", error.message || "La IA no pudo procesar este video.");
            onClose();
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSaveCoachReview = async (coachNotes: string) => {
        if (!report || !videoId || !playerId) {
            Alert.alert("Error", "Faltan datos para guardar el análisis.");
            return;
        }

        try {
            // 3. PERSIST IN SUPABASE
            setStatusText('Guardando reporte en la nube...');
            setIsProcessing(true); // Re-use modal for loading state

            await saveServeAnalysis({
                videoId,
                playerId,
                coachId,
                report: {
                    ...report,
                    // Si tuviéramos un campo en la interfaz de report para notas, o lo manejamos después en DB
                }
            });

            Alert.alert("¡Éxito!", "Análisis IA guardado y aprobado.");
            onSuccess();
            onClose();

        } catch (e: any) {
            Alert.alert("Error al Guardar", e.message);
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
                        onApprove={handleSaveCoachReview}
                        onCancel={() => {
                            setReport(null);
                            onClose();
                        }}
                    />
                ) : null}
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
