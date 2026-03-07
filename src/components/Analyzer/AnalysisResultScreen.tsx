import { AVPlaybackStatusSuccess, ResizeMode, Video } from 'expo-av';
import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { PoseLandmarks, ServeAnalysisReport } from '../../services/PoseAnalysis/types';
import { AnalysisReport } from './AnalysisReport';
import { PoseOverlay } from './PoseOverlay';



interface AnalysisResultScreenProps {
    videoUri: string;
    report: ServeAnalysisReport;
    onApprove: (coachFeedback: string) => void;
    onCancel: () => void;

    // Opcional para pruebas o si tuviéramos RAM infinita para guardar cada coordenada de cada 1/30s
    // Para MVP usaremos los keyframes que están incrustados en el `report`
    fullRawFrames?: { timestampMs: number, landmarks: PoseLandmarks }[];
}

export const AnalysisResultScreen: React.FC<AnalysisResultScreenProps> = ({
    videoUri,
    report,
    onApprove,
    onCancel,
    fullRawFrames
}) => {
    const { width: windowWidth } = useWindowDimensions();
    const isDesktop = windowWidth > 800; // Lower threshold to qualify as desktop

    // Constrain width for a more compact desktop look
    const videoWidth = isDesktop ? 380 : windowWidth;
    const VIDEO_HEIGHT = videoWidth * 1.33;
    const totalContentWidth = isDesktop ? Math.min(windowWidth * 0.95, 1000) : windowWidth;


    const videoRef = useRef<Video>(null);
    const [status, setStatus] = useState<AVPlaybackStatusSuccess | null>(null);
    const [coachNotes, setCoachNotes] = useState('');
    const [currentLandmarks, setCurrentLandmarks] = useState<PoseLandmarks | null>(null);

    // Syncing el SVG de los Huesos con el Video Playback Time
    useEffect(() => {
        if (!status || !status.isPlaying || !status.positionMillis) return;

        const currentTime = status.positionMillis;

        if (fullRawFrames && fullRawFrames.length > 0) {
            const closest = fullRawFrames.reduce((prev, curr) =>
                Math.abs(curr.timestampMs - currentTime) < Math.abs(prev.timestampMs - currentTime) ? curr : prev
            );
            if (Math.abs(closest.timestampMs - currentTime) < 100) {
                setCurrentLandmarks(closest.landmarks);
            } else {
                setCurrentLandmarks(null);
            }
        } else {
            setCurrentLandmarks(null);
        }

    }, [status?.positionMillis]);


    const handleApprove = () => {
        onApprove(coachNotes);
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={styles.webCenteringContainer}>
                <View style={[styles.mainLayout, isDesktop && styles.rowLayout, { width: totalContentWidth }]}>

                    {/* LEFT SIDE: Video */}
                    <View style={[styles.videoSide, isDesktop && { width: videoWidth }]}>
                        <View style={[styles.videoContainer, { width: videoWidth, height: VIDEO_HEIGHT }]}>
                            <Video
                                ref={videoRef}
                                style={styles.video}
                                source={{ uri: videoUri }}
                                useNativeControls
                                resizeMode={ResizeMode.COVER} // Better for skeleton alignment if container matches aspect
                                isLooping
                                onPlaybackStatusUpdate={(s) => setStatus(s as AVPlaybackStatusSuccess)}
                            />

                            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                                <PoseOverlay
                                    landmarks={currentLandmarks}
                                    width={videoWidth}
                                    height={VIDEO_HEIGHT}
                                    color="#00FFFF" // Neon Cyan para contraste
                                />
                            </View>
                        </View>
                    </View>

                    {/* RIGHT SIDE: Report & Coach Notes */}
                    <ScrollView
                        style={[styles.reportSide, isDesktop && { flex: 1, height: VIDEO_HEIGHT + 140 }]}
                        contentContainerStyle={{ paddingBottom: isDesktop ? 40 : 180 }}
                        showsVerticalScrollIndicator={Platform.OS === 'web'}
                    >
                        {/* 2. Componente Numérico y Banderas de la IA */}
                        <AnalysisReport report={report} />

                        {/* 3. Sección del Entrenador (Review humano) */}
                        <View style={styles.coachSection}>
                            <Text style={styles.sectionTitle}>Conclusión del Coach</Text>
                            <TextInput
                                style={styles.textArea}
                                placeholder="Escribe tus indicaciones tácticas o palabras de aliento para el alumno... (Ej: 'Buen impacto, pero flexiona más')"
                                placeholderTextColor="#666"
                                multiline
                                numberOfLines={4}
                                value={coachNotes}
                                onChangeText={setCoachNotes}
                            />
                        </View>

                        {/* Desktop-only internal buttons to avoid footer overlap */}
                        {isDesktop && (
                            <View style={styles.desktopActionRow}>
                                <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={onCancel}>
                                    <Text style={styles.btnTextCancel}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.btn, styles.btnApprove]} onPress={handleApprove}>
                                    <Text style={styles.btnTextApprove}>Guardar</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </ScrollView>
                </View>

                {/* Mobile absolute footer */}
                {!isDesktop && (
                    <View style={[styles.footer, { width: totalContentWidth }]}>
                        <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={onCancel}>
                            <Text style={styles.btnTextCancel}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.btn, styles.btnApprove]} onPress={handleApprove}>
                            <Text style={styles.btnTextApprove}>Guardar</Text>
                        </TouchableOpacity>
                    </View>
                )}

            </View>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    webCenteringContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        paddingVertical: 20,
    },
    mainLayout: {
        flexDirection: 'column',
        flex: 1,
    },
    rowLayout: {
        flexDirection: 'row',
        gap: 30, // Increased gap for more air
        alignItems: 'center', // Centra el video verticalmente respecto al reporte
    },
    videoSide: {
        alignItems: 'center',
    },
    reportSide: {
        flex: 1,
        maxHeight: '100%',
    },
    desktopActionRow: {
        flexDirection: 'row',
        paddingHorizontal: 15,
        marginTop: 20,
        gap: 15,
        paddingBottom: 20,
    },
    videoContainer: {
        backgroundColor: '#000',
        position: 'relative'
    },
    video: {
        width: '100%',
        height: '100%',
    },
    coachSection: {
        padding: 20,
        backgroundColor: '#1E1E1E',
        marginTop: 10,
        marginHorizontal: 15,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333'
    },
    sectionTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    textArea: {
        backgroundColor: '#000',
        color: '#FFF',
        borderRadius: 12,
        padding: 16,
        minHeight: 100,
        textAlignVertical: 'top',
        borderWidth: 1,
        borderColor: '#333'
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        flexDirection: 'row',
        padding: 20,
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
        backgroundColor: 'rgba(18, 18, 18, 0.98)',
        borderTopWidth: 1,
        borderTopColor: '#222'
    },
    btn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnCancel: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#666',
        marginRight: 10,
    },
    btnApprove: {
        backgroundColor: '#CCFF00',
    },
    btnTextCancel: {
        color: '#FFF',
        fontWeight: '600',
    },
    btnTextApprove: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: 15
    }
});
