import { AVPlaybackStatusSuccess, ResizeMode, Video } from 'expo-av';
import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { PoseLandmarks, ServeAnalysisReport } from '../../services/PoseAnalysis/types';
import { AnalysisReport } from './AnalysisReport';
import { PoseOverlay } from './PoseOverlay';

interface AnalysisResultScreenProps {
    videoUri: string;
    report: ServeAnalysisReport;
    onApprove: (coachFeedback: string, updatedMetrics: ServeAnalysisReport['categoryScores'] & { finalScore: number }) => void;
    onCancel: () => void;
    isExisting?: boolean;
    fullRawFrames?: { timestampMs: number, landmarks: PoseLandmarks }[];
    readOnly?: boolean;
}

export const AnalysisResultScreen: React.FC<AnalysisResultScreenProps> = ({
    videoUri,
    report,
    onApprove,
    onCancel,
    fullRawFrames,
    isExisting = false,
    readOnly = false
}) => {
    const { width: windowWidth } = useWindowDimensions();
    const isDesktop = windowWidth > 800;

    const videoWidth = isDesktop ? 380 : windowWidth;
    const VIDEO_HEIGHT = videoWidth * 1.33;
    const totalContentWidth = isDesktop ? Math.min(windowWidth * 0.95, 1000) : windowWidth;

    const videoRef = useRef<Video>(null);
    const [status, setStatus] = useState<AVPlaybackStatusSuccess | null>(null);
    const [coachNotes, setCoachNotes] = useState(report.coach_feedback || '');
    const [currentLandmarks, setCurrentLandmarks] = useState<PoseLandmarks | null>(null);

    // Métricas editables
    const [finalScore, setFinalScore] = useState(report.finalScore.toString());
    const [preparationScore, setPreparationScore] = useState((report.categoryScores?.preparation ?? 0).toString());
    const [trophyScore, setTrophyScore] = useState((report.categoryScores?.trophy ?? 0).toString());
    const [contactScore, setContactScore] = useState((report.categoryScores?.contact ?? 0).toString());
    const [energyTransferScore, setEnergyTransferScore] = useState((report.categoryScores?.energyTransfer ?? 0).toString());
    const [followThroughScore, setFollowThroughScore] = useState((report.categoryScores?.followThrough ?? 0).toString());

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

    const handleMetricChange = (key: string, value: string) => {
        // Validación: solo números y máximo 100
        const numericValue = parseInt(value, 10);
        if (value !== '' && (isNaN(numericValue) || numericValue > 100)) {
            return;
        }

        switch (key) {
            case 'finalScore': setFinalScore(value); break;
            case 'preparation': setPreparationScore(value); break;
            case 'trophy': setTrophyScore(value); break;
            case 'contact': setContactScore(value); break;
            case 'energyTransfer': setEnergyTransferScore(value); break;
            case 'followThrough': setFollowThroughScore(value); break;
        }
    };

    const handleApprove = () => {
        onApprove(coachNotes, {
            finalScore: parseInt(finalScore, 10) || report.finalScore,
            preparation: parseFloat(preparationScore) || report.categoryScores.preparation,
            trophy: parseFloat(trophyScore) || report.categoryScores.trophy,
            contact: parseFloat(contactScore) || report.categoryScores.contact,
            energyTransfer: parseFloat(energyTransferScore) || report.categoryScores.energyTransfer,
            followThrough: parseFloat(followThroughScore) || report.categoryScores.followThrough,
        });
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
                                resizeMode={ResizeMode.COVER}
                                isLooping
                                onPlaybackStatusUpdate={(s) => setStatus(s as AVPlaybackStatusSuccess)}
                            />

                            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                                <PoseOverlay
                                    landmarks={currentLandmarks}
                                    width={videoWidth}
                                    height={VIDEO_HEIGHT}
                                    color="#00FFFF"
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
                        {/* 2. Informe con Edición Integrada (Power Mode) */}
                        <AnalysisReport
                            report={report}
                            editableValues={!readOnly ? {
                                preparation: preparationScore,
                                trophy: trophyScore,
                                contact: contactScore,
                                energyTransfer: energyTransferScore,
                                followThrough: followThroughScore,
                                finalScore: finalScore
                            } : undefined}
                            onValueChange={!readOnly ? handleMetricChange : undefined}
                        />

                        {/* 4. Sección del Entrenador (Review humano) */}
                        <View style={styles.coachSection}>
                            <Text style={styles.sectionTitle}>Conclusión del Coach</Text>
                            <TextInput
                                style={styles.textArea}
                                placeholder="Escribe tus indicaciones tácticas o palabras de aliento para el alumno..."
                                placeholderTextColor="#666"
                                multiline
                                numberOfLines={4}
                                editable={!readOnly}
                                value={coachNotes}
                                onChangeText={setCoachNotes}
                            />
                        </View>

                        {isDesktop && (
                            <View style={styles.desktopActionRow}>
                                {readOnly ? (
                                    <TouchableOpacity style={[styles.btn, styles.btnApprove]} onPress={onCancel}>
                                        <Text style={styles.btnTextApprove}>Cerrar</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <>
                                        <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={onCancel}>
                                            <Text style={styles.btnTextCancel}>Cancelar</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.btn, styles.btnApprove]} onPress={handleApprove}>
                                            <Text style={styles.btnTextApprove}>{isExisting ? 'Actualizar' : 'Guardar'}</Text>
                                        </TouchableOpacity>
                                    </>
                                )}
                            </View>
                        )}
                    </ScrollView>
                </View>

                {!isDesktop && (
                    <View style={[styles.footer, { width: totalContentWidth }]}>
                        {readOnly ? (
                            <TouchableOpacity style={[styles.btn, styles.btnApprove]} onPress={onCancel}>
                                <Text style={styles.btnTextApprove}>Cerrar</Text>
                            </TouchableOpacity>
                        ) : (
                            <>
                                <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={onCancel}>
                                    <Text style={styles.btnTextCancel}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.btn, styles.btnApprove]} onPress={handleApprove}>
                                    <Text style={styles.btnTextApprove}>{isExisting ? 'Actualizar' : 'Guardar'}</Text>
                                </TouchableOpacity>
                            </>
                        )}
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
        gap: 30,
        alignItems: 'center',
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
    },
    hintText: {
        color: '#666',
        fontSize: 12,
        marginTop: 8,
        fontStyle: 'italic'
    }
});
