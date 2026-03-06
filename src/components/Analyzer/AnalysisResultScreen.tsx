import { AVPlaybackStatusSuccess, ResizeMode, Video } from 'expo-av';
import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { PoseLandmarks, ServeAnalysisReport } from '../../services/PoseAnalysis/types';
import { AnalysisReport } from './AnalysisReport';
import { PoseOverlay } from './PoseOverlay';

const { width } = Dimensions.get('window');
const VIDEO_HEIGHT = width * 1.33; // 4:3 Aspect ratio typical for phones

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

    const videoRef = useRef<Video>(null);
    const [status, setStatus] = useState<AVPlaybackStatusSuccess | null>(null);
    const [coachNotes, setCoachNotes] = useState('');
    const [currentLandmarks, setCurrentLandmarks] = useState<PoseLandmarks | null>(null);

    // Syncing el SVG de los Huesos con el Video Playback Time
    useEffect(() => {
        if (!status || !status.isPlaying || !status.positionMillis) return;

        const currentTime = status.positionMillis;

        // 1. Intento mostrar frames completos en crudo si existen en RAM (Demostración MVP)
        if (fullRawFrames && fullRawFrames.length > 0) {
            // Buscamos el frame más cercano a este timestamp
            const closest = fullRawFrames.reduce((prev, curr) =>
                Math.abs(curr.timestampMs - currentTime) < Math.abs(prev.timestampMs - currentTime) ? curr : prev
            );
            if (Math.abs(closest.timestampMs - currentTime) < 100) { // Tolerancia 100ms sync
                setCurrentLandmarks(closest.landmarks);
            }
            return;
        }

        // 2. Si solo tenemos Keyframes (Producción Ligera), mostramos el skeleton congelado 
        // cuando el video pasa por ese momento clave (Trophy, Contact, etc).
        const keyframeMatch = report.keyframes.find(k => Math.abs(k.timestampMs - currentTime) < 150);
        if (keyframeMatch) {
            setCurrentLandmarks(keyframeMatch.landmarks);
        } else {
            setCurrentLandmarks(null); // Ocultar esqueleto entre fases si no hay data fluida
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
            <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>

                {/* 1. Reproductor de Video + Esqueleto */}
                <View style={styles.videoContainer}>
                    <Video
                        ref={videoRef}
                        style={styles.video}
                        source={{ uri: videoUri }}
                        useNativeControls
                        resizeMode={ResizeMode.COVER}
                        isLooping
                        onPlaybackStatusUpdate={(s) => setStatus(s as AVPlaybackStatusSuccess)}
                    />

                    {/* SVG Superpuesto: Solo se dibuja si el Playback Status encontró un Landmark en ese MS exacto */}
                    <View style={StyleSheet.absoluteFill} pointerEvents="none">
                        <PoseOverlay
                            landmarks={currentLandmarks}
                            width={width}
                            height={VIDEO_HEIGHT}
                            color="#00FFFF" // Neon Cyan para contraste
                        />
                    </View>
                </View>

                {/* 2. Componente Numérico y Banderas de la IA (Ya lo teniamos hecho) */}
                <AnalysisReport report={report} />

                {/* 3. Sección del Entrenador (Review humano) */}
                <View style={styles.coachSection}>
                    <Text style={styles.sectionTitle}>Conclusión del Coach</Text>
                    <TextInput
                        style={styles.textArea}
                        placeholder="Escribe tus indicaciones tácticas o palabras de aliento para el alumno... (Ej: 'Fíjate como clavas el codo en el Trophy, corrigelo este martes')"
                        placeholderTextColor="#666"
                        multiline
                        numberOfLines={4}
                        value={coachNotes}
                        onChangeText={setCoachNotes}
                    />
                </View>

            </ScrollView>

            {/* Float Footer Buttons */}
            <View style={styles.footer}>
                <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={onCancel}>
                    <Text style={styles.btnTextCancel}>Re-Analizar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.btnApprove]} onPress={handleApprove}>
                    <Text style={styles.btnTextApprove}>Aprobar y Enviar (Save)</Text>
                </TouchableOpacity>
            </View>

        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    videoContainer: {
        width: width,
        height: VIDEO_HEIGHT,
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
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    textArea: {
        backgroundColor: '#121212',
        color: '#FFF',
        borderRadius: 8,
        padding: 15,
        minHeight: 120,
        textAlignVertical: 'top',
        borderWidth: 1,
        borderColor: '#444'
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        padding: 15,
        paddingBottom: Platform.OS === 'ios' ? 30 : 15,
        backgroundColor: 'rgba(18, 18, 18, 0.95)',
        borderTopWidth: 1,
        borderTopColor: '#333'
    },
    btn: {
        flex: 1,
        paddingVertical: 15,
        borderRadius: 8,
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
        fontSize: 16
    }
});
