import { Ionicons } from '@expo/vector-icons';
import { AVPlaybackStatusSuccess, ResizeMode, Video } from 'expo-av';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View, Pressable } from 'react-native';
import { FLAG_DICTIONARY } from '../../services/PoseAnalysis/flags';
import { PoseLandmarks, RuleFlag, ServeAnalysisReport, DominantHand, Landmark, ServePhase } from '../../services/PoseAnalysis/types';
import { showError, showSuccess } from '../../utils/toast';
import { AnalysisReport } from './AnalysisReport';
import { PoseOverlay } from './PoseOverlay';
import { ProVideoPlayer, ProVideoPlayerRef } from '../ProVideoPlayer';

interface AnalysisResultScreenProps {
    videoUri: string;
    report: ServeAnalysisReport;
    onApprove: (coachFeedback: string, updatedMetrics: ServeAnalysisReport['categoryScores'] & { finalScore: number, flags: RuleFlag[], detailedMetrics: ServeAnalysisReport['detailedMetrics'] }) => void;
    onCancel: () => void;
    isExisting?: boolean;
    fullRawFrames?: { timestampMs: number, landmarks: PoseLandmarks }[];
    readOnly?: boolean;
    onReady?: () => void;
    videoId: string;
    playerHand?: DominantHand;
}

export const AnalysisResultScreen: React.FC<AnalysisResultScreenProps> = ({
    videoUri,
    report,
    onApprove,
    onCancel,
    fullRawFrames,
    isExisting = false,
    readOnly = false,
    onReady,
    videoId,
    playerHand = 'right'
}) => {
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const isDesktop = windowWidth > 800;

    const videoWidth = isDesktop ? 380 : windowWidth;
    const totalContentWidth = isDesktop ? Math.min(windowWidth * 0.95, 1000) : windowWidth;
    
    const [status, setStatus] = useState<AVPlaybackStatusSuccess | null>(null);
    const [videoAspectRatio, setVideoAspectRatio] = useState<number>(16 / 9); // Por defecto vertical 16:9 formato smartphone
    const [videoNaturalSize, setVideoNaturalSize] = useState<{ width: number, height: number } | null>(null);
    const [coachNotes, setCoachNotes] = useState(report.coach_feedback || '');
    const [currentLandmarks, setCurrentLandmarks] = useState<PoseLandmarks | null>(null);
    const [showSkeleton, setShowSkeleton] = useState(true);
    const [pinnedMetric, setPinnedMetric] = useState<{ label: string, value: string | number, jointIndex: number } | null>(null);
    const videoRef = useRef<ProVideoPlayerRef>(null);

    const calculatedHeight = videoWidth * videoAspectRatio;
    const maxDesktopVideoHeight = windowHeight - 120;
    const VIDEO_HEIGHT = isDesktop ? Math.min(calculatedHeight, maxDesktopVideoHeight) : calculatedHeight;

    // Métricas editables (4 fases v2)
    const [finalScore, setFinalScore] = useState(report.finalScore.toString());
    const [preparacionScore, setPreparacionScore] = useState((report.categoryScores?.preparacion ?? 0).toString());
    const [armadoScore, setArmadoScore] = useState((report.categoryScores?.armado ?? 0).toString());
    const [impactoScore, setImpactoScore] = useState((report.categoryScores?.impacto ?? 0).toString());
    const [terminacionScore, setTerminacionScore] = useState((report.categoryScores?.terminacion ?? 0).toString());
    const [activeFlags, setActiveFlags] = useState<RuleFlag[]>(report.flags || []);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedPhase, setSelectedPhase] = useState<ServePhase | null>(null);

    const matches = (t1: number | undefined, t2: number) => t1 !== undefined && Math.abs(t1 - t2) < 50; // 50ms margin for extreme precision
    
    // Optimización: Memoizar frames válidos para evitar filtrar en cada renderizado (60fps)
    const validRawFrames = useMemo(() => 
        fullRawFrames?.filter(f => f.landmarks && f.landmarks.length > 0) || []
    , [fullRawFrames]);

    // Función de búsqueda binaria para encontrar el frame más cercano en O(log N)
    const findClosestFrame = (targetMs: number) => {
        if (!validRawFrames.length) return null;
        let low = 0;
        let high = validRawFrames.length - 1;
        while (low <= high) {
            if (high - low <= 1) {
                const d1 = Math.abs(validRawFrames[low].timestampMs - targetMs);
                const d2 = Math.abs(validRawFrames[high].timestampMs - targetMs);
                return d1 < d2 ? validRawFrames[low] : validRawFrames[high];
            }
            const mid = Math.floor((low + high) / 2);
            if (validRawFrames[mid].timestampMs === targetMs) return validRawFrames[mid];
            if (validRawFrames[mid].timestampMs < targetMs) low = mid;
            else high = mid;
        }
        return validRawFrames[low];
    };

    useEffect(() => {
        const currentTime = status?.positionMillis || 0;

        // ESTRATEGIA DE RENDERIZADO DEL ESQUELETO Y TELEMETRÍA:
        
        // 1. Si está reproduciendo, buscamos telemetría dinámica
        if (status?.isPlaying) {
            if (selectedPhase !== null) setSelectedPhase(null);
            
            const closest = findClosestFrame(currentTime);
            if (closest && Math.abs(closest.timestampMs - currentTime) < 150) {
                // Actualizar esqueleto en vivo
                setCurrentLandmarks(closest.landmarks);

                // Telemetría de impacto en vivo
                const domWrist = playerHand === 'right' ? Landmark.RIGHT_WRIST : Landmark.LEFT_WRIST;
                const frontAnkle = playerHand === 'right' ? Landmark.LEFT_ANKLE : Landmark.RIGHT_ANKLE;
                const wrist = closest.landmarks[domWrist];
                const ankle = closest.landmarks[frontAnkle];

                if (wrist && ankle && wrist.visibility! > 0.3 && ankle.visibility! > 0.3) {
                    const dist = Math.sqrt(Math.pow(wrist.x - ankle.x, 2) + Math.pow(wrist.y - ankle.y, 2));
                    if (dist > 0.4) {
                        const val = dist.toFixed(3);
                        if (pinnedMetric?.value !== val) {
                            setPinnedMetric({ label: 'Extensión', value: val, jointIndex: domWrist });
                        }
                    } else if (pinnedMetric) {
                        setPinnedMetric(null);
                    }
                }
            } else {
                setCurrentLandmarks(null);
            }
            return;
        }

        // 2. Si hay una fase seleccionada (video pausado en keyframe), buscamos esqueleto congelado
        if (selectedPhase && report?.keyframes) {
            let phaseKey: keyof typeof report.keyframes;
            if (selectedPhase === ServePhase.ACCELERATION) phaseKey = 'trophy';
            else if (selectedPhase === ServePhase.FOLLOW_THROUGH) phaseKey = 'finish';
            else phaseKey = selectedPhase.toLowerCase() as keyof typeof report.keyframes;
            
            const kf = report.keyframes[phaseKey];
            if (kf && kf.landmarks && matches(kf.timestamp, currentTime)) {
                setCurrentLandmarks(kf.landmarks);
                return;
            }
        }

        // 3. Fallback: Búsqueda estática cuando el video está pausado fuera de un keyframe
        const closest = findClosestFrame(currentTime);
        if (closest && Math.abs(closest.timestampMs - currentTime) < 150) {
            setCurrentLandmarks(closest.landmarks);
        } else {
            setCurrentLandmarks(null);
        }
    }, [status?.positionMillis, validRawFrames, selectedPhase, report.keyframes, playerHand]);

    const handleMetricChange = (key: string, value: string) => {
        // Validación: solo números y máximo 100
        const numericValue = parseInt(value, 10);
        if (value !== '' && (isNaN(numericValue) || numericValue > 100)) {
            return;
        }

        switch (key) {
            case 'finalScore': setFinalScore(value); break;
            case 'preparacion': setPreparacionScore(value); break;
            case 'armado': setArmadoScore(value); break;
            case 'impacto': setImpactoScore(value); break;
            case 'terminacion': setTerminacionScore(value); break;
        }
    };

    const handleFlagChange = (newFlags: RuleFlag[]) => {
        setActiveFlags(newFlags);
    };

    const handleApprove = async () => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            await onApprove(coachNotes, {
                finalScore: parseInt(finalScore, 10) || report.finalScore,
                preparacion: parseFloat(preparacionScore) || report.categoryScores.preparacion,
                armado: parseFloat(armadoScore) || report.categoryScores.armado,
                impacto: parseFloat(impactoScore) || report.categoryScores.impacto,
                terminacion: parseFloat(terminacionScore) || report.categoryScores.terminacion,
                flags: activeFlags,
                detailedMetrics: report.detailedMetrics
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSelectPhase = async (phase: ServePhase) => {
        setSelectedPhase(phase);
        if (videoRef.current && report) {
            let phaseKey: keyof typeof report.keyframes;
            if (phase === ServePhase.ACCELERATION) phaseKey = 'trophy';
            else if (phase === ServePhase.FOLLOW_THROUGH) phaseKey = 'finish';
            else phaseKey = phase.toLowerCase() as keyof typeof report.keyframes;
            
            const targetKeyframe = report.keyframes[phaseKey];

            if (targetKeyframe) {
                await videoRef.current.pauseAsync();
                await videoRef.current.setPositionAsync(targetKeyframe.timestamp);

                // Pin the correct metric
                switch (phase) {
                    case ServePhase.SETUP:
                        setPinnedMetric({
                            label: 'Orientación',
                            value: `${Math.round(report.detailedMetrics.footOrientationScore)}%`,
                            jointIndex: Landmark.LEFT_ANKLE
                        });
                        break;
                    case ServePhase.TROPHY:
                    case ServePhase.ACCELERATION:
                        setPinnedMetric({
                            label: 'Flexión/Trofeo',
                            value: `${Math.round((report.detailedMetrics.kneeFlexionScore + report.detailedMetrics.trophyPositionScore) / 2)}%`,
                            jointIndex: playerHand === 'right' ? Landmark.RIGHT_KNEE : Landmark.LEFT_KNEE
                        });
                        break;
                    case ServePhase.CONTACT:
                        setPinnedMetric({
                            label: 'Salto/Impacto',
                            value: `${Math.round(report.detailedMetrics.heelLiftScore)}%`,
                            jointIndex: playerHand === 'right' ? Landmark.RIGHT_HEEL : Landmark.LEFT_HEEL
                        });
                        break;
                    case ServePhase.FOLLOW_THROUGH:
                        setPinnedMetric({
                            label: 'Terminación',
                            value: `${Math.round(report.detailedMetrics.followThroughScore)}%`,
                            jointIndex: playerHand === 'right' ? Landmark.RIGHT_WRIST : Landmark.LEFT_WRIST
                        });
                        break;
                }
            }
        }
    };

    const handleShare = async () => {
        try {
            const dateStr = new Date().toLocaleDateString();
            const score = finalScore || report.finalScore.toString();
            let summary = `🎾 *Análisis de Saque - ${dateStr}*\n\n`;

            summary += `📊 *Puntuación Global: ${Math.round(Number(score))}%*\n\n`;

            summary += `*Desglose:* \n`;
            summary += `• Preparación: ${Math.round(Number(preparacionScore))}%\n`;
            summary += `• Armado: ${Math.round(Number(armadoScore))}%\n`;
            summary += `• Impacto: ${Math.round(Number(impactoScore))}%\n`;
            summary += `• Terminación: ${Math.round(Number(terminacionScore))}%\n`;

            // Agregar áreas de mejora (activeFlags)
            if (activeFlags.length > 0) {
                summary += `\n🎯 *Áreas de Mejora:*\n`;
                activeFlags.forEach(flag => {
                    const translation = FLAG_DICTIONARY[flag];
                    if (translation) {
                        summary += `• ${translation.title}\n`;
                    }
                });
            }

            if (coachNotes) {
                summary += `\n💬 *Feedback del Coach:* ${coachNotes}\n`;
            }

            const url = `https://app.tenis-lab.com/v/${videoId}`;
            summary += `\n🔗 *Link al video:* ${url}\n\n¡A seguir mejorando! 💪`;

            if (Platform.OS === 'web') {
                const isMobileWeb = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

                if (navigator.share && isMobileWeb) {
                    await navigator.share({
                        title: `Análisis de Saque - ${dateStr}`,
                        text: summary
                    });
                } else {
                    // Fallback para Desktop o si navigator.share falla
                    await navigator.clipboard.writeText(summary);
                    showSuccess("Copiado", "Resumen copiado.");

                    // Abrir WhatsApp Web (Desktop version)
                    const waUrl = `https://web.whatsapp.com/send?text=${encodeURIComponent(summary)}`;
                    window.open(waUrl, '_blank');
                }
            } else {
                await Share.share({
                    message: summary,
                    title: `Análisis de Saque - ${dateStr}`
                });
            }
        } catch (error: any) {
            console.error("Error sharing analysis:", error);
            showError("Error", "No se pudo compartir el informe.");
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={[styles.webCenteringContainer, {
                justifyContent: isDesktop ? 'center' : 'flex-start',
                paddingVertical: isDesktop ? 20 : 0
            }]}>
                <View style={[styles.mainLayout, isDesktop && styles.rowLayout, { width: totalContentWidth }]}>
                    {isDesktop ? (
                        <>
                            {/* LEFT SIDE: Video */}
                            <View style={[styles.videoSide, { width: videoWidth }]}>
                                    <View style={[styles.videoContainer, { width: videoWidth, height: VIDEO_HEIGHT, overflow: 'hidden' }]}>
                                        <ProVideoPlayer
                                            ref={videoRef}
                                            videoUri={videoUri}
                                            style={styles.video}
                                            useNativeControls={false}
                                            isLooping={true}
                                            shouldPlay={true}
                                            showFullscreenButton={false}
                                            onPlaybackStatusUpdate={(s) => setStatus(s as AVPlaybackStatusSuccess)}
                                            onReadyForDisplay={(size) => {
                                                if (size.width > 0 && size.height > 0) {
                                                    setVideoNaturalSize(size);
                                                    setVideoAspectRatio(size.height / size.width);
                                                }
                                                if (onReady) onReady();
                                            }}
                                            overlayContent={(layout) => (
                                                <>
                                                    {showSkeleton && (
                                                        <PoseOverlay
                                                            landmarks={currentLandmarks}
                                                            width={layout.width}
                                                            height={layout.height}
                                                            color="#00FFFF"
                                                            pinnedMetric={pinnedMetric}
                                                        />
                                                    )}
                                                </>
                                            )}
                                        />
                                    </View>
                            </View>

                            {/* RIGHT SIDE: Report & Coach Notes */}
                            <ScrollView
                                style={[styles.reportSide, { flex: 1, height: VIDEO_HEIGHT + 140 }]}
                                contentContainerStyle={{ paddingBottom: 40 }}
                                showsVerticalScrollIndicator={Platform.OS === 'web'}
                            >
                                {/* 2. Informe con Edición Integrada (Power Mode) */}
                                <View style={styles.reportHeaderRow}>
                                    <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end', width: '100%' }}>
                                        <TouchableOpacity
                                            onPress={() => setShowSkeleton(!showSkeleton)}
                                            style={[styles.shareIconButton, { backgroundColor: showSkeleton ? 'rgba(204, 255, 0, 0.2)' : 'rgba(255, 255, 255, 0.1)' }]}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons name={showSkeleton ? "person" : "person-outline"} size={20} color={showSkeleton ? "#CCFF00" : "#999"} />
                                            <Text style={[styles.shareText, { color: showSkeleton ? "#CCFF00" : "#999" }]}>{showSkeleton ? "IA On" : "IA Off"}</Text>
                                        </TouchableOpacity>

                                        {isExisting && (
                                            <TouchableOpacity
                                                onPress={handleShare}
                                                style={styles.shareIconButton}
                                                activeOpacity={0.7}
                                            >
                                                <Ionicons name="share-social-outline" size={24} color="#CCFF00" />
                                                <Text style={styles.shareText}>Compartir</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>

                                <AnalysisReport
                                    report={{ ...report, flags: activeFlags }}
                                    editableValues={!readOnly ? {
                                        preparacion: preparacionScore,
                                        armado: armadoScore,
                                        impacto: impactoScore,
                                        terminacion: terminacionScore,
                                        finalScore: finalScore
                                    } : undefined}
                                    onValueChange={!readOnly ? handleMetricChange : undefined}
                                    onFlagsChange={!readOnly ? handleFlagChange : undefined}
                                    onSelectPhase={handleSelectPhase}
                                />

                                {/* 4. Sección del Entrenador (Review humano) */}
                                <View style={styles.coachSection}>
                                    <Text style={styles.sectionTitle}>Conclusión del Coach</Text>
                                    <TextInput
                                        style={styles.textArea}
                                        placeholder="Escribe tus indicaciones técnicas o palabras de aliento para el alumno..."
                                        placeholderTextColor="#666"
                                        multiline
                                        numberOfLines={4}
                                        editable={!readOnly}
                                        value={coachNotes}
                                        onChangeText={setCoachNotes}
                                    />
                                </View>

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
                                            <TouchableOpacity style={[styles.btn, styles.btnApprove, isSaving && { opacity: 0.7 }]} onPress={handleApprove} disabled={isSaving}>
                                                <Text style={styles.btnTextApprove}>{isSaving ? 'Guardando...' : (isExisting ? 'Actualizar' : 'Guardar')}</Text>
                                            </TouchableOpacity>
                                        </>
                                    )}
                                </View>
                            </ScrollView>
                        </>
                    ) : (
                        /* MOBILE: Single Scroll with specific order (Scores -> Video -> Notes) */
                        <ScrollView
                            style={styles.reportSide}
                            contentContainerStyle={{ paddingBottom: 150 }} // Space for footer
                        >
                            <View style={[styles.reportHeaderRow, { paddingHorizontal: 20, marginTop: 10, justifyContent: 'flex-end' }]}>
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <TouchableOpacity
                                        onPress={() => setShowSkeleton(!showSkeleton)}
                                        style={[styles.shareIconButton, { backgroundColor: showSkeleton ? 'rgba(204, 255, 0, 0.2)' : 'rgba(255, 255, 255, 0.1)' }]}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name={showSkeleton ? "person" : "person-outline"} size={20} color={showSkeleton ? "#CCFF00" : "#999"} />
                                        <Text style={[styles.shareText, { color: showSkeleton ? "#CCFF00" : "#999" }]}>{showSkeleton ? "IA On" : "IA Off"}</Text>
                                    </TouchableOpacity>

                                    {isExisting && (
                                        <TouchableOpacity
                                            onPress={handleShare}
                                            style={styles.shareIconButton}
                                        >
                                            <Ionicons name="share-social-outline" size={22} color="#CCFF00" />
                                            <Text style={styles.shareText}>Compartir</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>

                            {/* 1. Report Scores at the top */}
                            <AnalysisReport
                                report={{ ...report, flags: activeFlags }}
                                editableValues={!readOnly ? {
                                    preparacion: preparacionScore,
                                    armado: armadoScore,
                                    impacto: impactoScore,
                                    terminacion: terminacionScore,
                                    finalScore: finalScore
                                } : undefined}
                                onValueChange={!readOnly ? handleMetricChange : undefined}
                                onFlagsChange={!readOnly ? handleFlagChange : undefined}
                                onSelectPhase={handleSelectPhase}
                            />

                            {/* 2. Video in the middle */}
                            <View style={[styles.videoSide, { marginBottom: 20 }]}>
                                <View style={[styles.videoContainer, { width: videoWidth, height: VIDEO_HEIGHT, overflow: 'hidden' }]}>
                                    <ProVideoPlayer
                                        ref={videoRef}
                                        videoUri={videoUri}
                                        style={styles.video}
                                        useNativeControls={false}
                                        isLooping={true}
                                        shouldPlay={true}
                                        showFullscreenButton={false}
                                        onPlaybackStatusUpdate={(s) => setStatus(s as AVPlaybackStatusSuccess)}
                                        onReadyForDisplay={(size) => {
                                            if (size.width > 0 && size.height > 0) {
                                                setVideoNaturalSize(size);
                                                setVideoAspectRatio(size.height / size.width);
                                            }
                                            if (onReady) onReady();
                                        }}
                                        overlayContent={(layout) => (
                                            <PoseOverlay
                                                landmarks={currentLandmarks}
                                                width={layout.width}
                                                height={layout.height}
                                                color="#00FFFF"
                                                pinnedMetric={pinnedMetric}
                                            />
                                        )}
                                    />
                                </View>
                            </View>

                            {/* 3. Coach Notes at the bottom */}
                            <View style={styles.coachSection}>
                                <Text style={styles.sectionTitle}>Conclusión del Coach</Text>
                                <TextInput
                                    style={styles.textArea}
                                    placeholder="Escribe tus indicaciones técnicas o palabras de aliento para el alumno..."
                                    placeholderTextColor="#666"
                                    multiline
                                    numberOfLines={4}
                                    editable={!readOnly}
                                    value={coachNotes}
                                    onChangeText={setCoachNotes}
                                />
                            </View>
                        </ScrollView>
                    )}
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
                                <TouchableOpacity style={[styles.btn, styles.btnApprove, isSaving && { opacity: 0.7 }]} onPress={handleApprove} disabled={isSaving}>
                                    <Text style={styles.btnTextApprove}>{isSaving ? 'Guardando...' : (isExisting ? 'Actualizar' : 'Guardar')}</Text>
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
        backgroundColor: '#000',
    },
    webCenteringContainer: {
        flex: 1,
        alignItems: 'center',
        width: '100%',
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
    },
    reportHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        marginBottom: 10,
    },
    shareIconButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(204, 255, 0, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    shareText: {
        color: '#CCFF00',
        fontSize: 14,
        fontWeight: '600',
    }
});
