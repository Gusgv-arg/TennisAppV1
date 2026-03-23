import { Ionicons } from '@expo/vector-icons';
import { AVPlaybackStatusSuccess } from 'expo-av';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { FLAG_DICTIONARY } from '../../services/PoseAnalysis/flags';
import { STROKE_METRICS_CONFIG } from '../../services/PoseAnalysis/strokeConfigs';
import { DominantHand, Landmark, PoseLandmarks, RuleFlag, ServeAnalysisReport, ServePhase } from '../../services/PoseAnalysis/types';
import { showError, showSuccess } from '../../utils/toast';
import { ProVideoPlayer, ProVideoPlayerRef } from '../ProVideoPlayer';
import { AnalysisReport } from './AnalysisReport';
import { PoseOverlay } from './PoseOverlay';
import { useShare } from '../../hooks/useShare';
import ShareModal from '../ShareModal';

interface AnalysisResultScreenProps {
    videoUri: string;
    report: ServeAnalysisReport;
    onApprove: (coachFeedback: string, updatedMetrics: ServeAnalysisReport['categoryScores'] & {
        finalScore: number,
        flags: RuleFlag[],
        flagMetadata: Record<string, { title: string, subtitle: string }>,
        detailedMetrics: ServeAnalysisReport['detailedMetrics']
    }) => void;
    onCancel: () => void;
    isExisting?: boolean;
    fullRawFrames?: { timestampMs: number, landmarks: PoseLandmarks, metrics?: any, phase?: string }[];
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
    const {
        isModalVisible: shareModalVisible,
        setIsModalVisible: setShareModalVisible,
        handleSharePress,
        performWhatsAppShare,
        performCopyLink,
        performNativeShare
    } = useShare();

    const PHASE_NAMES_ES: Record<string, string> = {
        'IDLE': 'Preparación',
        'SETUP': 'Preparación',
        'TROPHY': 'Armado',
        'ACCELERATION': 'Armado',
        'CONTACT': 'Impacto',
        'FOLLOW_THROUGH': 'Terminación'
    };

    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const isDesktop = windowWidth > 800;

    const videoWidth = isDesktop ? 380 : windowWidth;
    const totalContentWidth = isDesktop ? Math.min(windowWidth * 0.95, 1000) : windowWidth;

    const [status, setStatus] = useState<AVPlaybackStatusSuccess | null>(null);
    const [videoAspectRatio, setVideoAspectRatio] = useState<number>(16 / 9); // Por defecto vertical 16:9 formato smartphone
    const [videoNaturalSize, setVideoNaturalSize] = useState<{ width: number, height: number } | null>(null);
    const [coachNotes, setCoachNotes] = useState(report.coach_feedback || '');
    const [currentLandmarks, setCurrentLandmarks] = useState<PoseLandmarks | null>(null);
    const [currentMetrics, setCurrentMetrics] = useState<any | null>(null);
    const [currentPhaseName, setCurrentPhaseName] = useState<string | null>(null);
    const [showSkeleton, setShowSkeleton] = useState(true);
    const [pinnedMetric, setPinnedMetric] = useState<{ label: string, value: string | number, jointIndex: number } | null>(null);
    const videoRef = useRef<ProVideoPlayerRef>(null);

    const calculatedHeight = videoWidth * videoAspectRatio;
    const maxDesktopVideoHeight = windowHeight - 120;
    const VIDEO_HEIGHT = isDesktop ? Math.min(calculatedHeight, maxDesktopVideoHeight) : calculatedHeight;

    // Métricas editables (4 fases v2)
    const [finalScore, setFinalScore] = useState(Math.round(report.finalScore).toString());
    const [preparacionScore, setPreparacionScore] = useState(Math.round(report.categoryScores?.preparacion ?? 0).toString());
    const [armadoScore, setArmadoScore] = useState(Math.round(report.categoryScores?.armado ?? 0).toString());
    const [impactoScore, setImpactoScore] = useState(Math.round(report.categoryScores?.impacto ?? 0).toString());
    const [terminacionScore, setTerminacionScore] = useState(Math.round(report.categoryScores?.terminacion ?? 0).toString());

    // Generic Indicators
    const [detailedMetricScores, setDetailedMetricScores] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        if (report.detailedMetrics) {
            Object.entries(report.detailedMetrics).forEach(([k, v]) => {
                initial[k] = Math.round(v).toString();
            });
        }
        return initial;
    });

    const [activeFlags, setActiveFlags] = useState<RuleFlag[]>(report.flags || []);
    const [flagMetadata, setFlagMetadata] = useState<Record<string, { title: string, subtitle: string }>>(report.flagMetadata || {});
    const [isSaving, setIsSaving] = useState(false);
    const [selectedPhase, setSelectedPhase] = useState<ServePhase | null>(null);
    const [playbackRate, setPlaybackRate] = useState(1.0); // Added for slow motion control

    // Reporte "virtual" para visualización en tiempo real
    const displayReport = useMemo(() => ({
        ...report,
        finalScore: Math.round(parseFloat(finalScore)) || 0,
        categoryScores: {
            preparacion: Math.round(parseFloat(preparacionScore)) || 0,
            armado: Math.round(parseFloat(armadoScore)) || 0,
            impacto: Math.round(parseFloat(impactoScore)) || 0,
            terminacion: Math.round(parseFloat(terminacionScore)) || 0,
        },
        detailedMetrics: Object.fromEntries(
            Object.entries(detailedMetricScores).map(([k, v]) => [k, Math.round(parseFloat(v)) || 0])
        ),
        flags: activeFlags,
        flagMetadata: flagMetadata
    }), [report, finalScore, preparacionScore, armadoScore, impactoScore, terminacionScore, detailedMetricScores, activeFlags, flagMetadata]);

    // Comparación robusta de timestamps para snapshots (tolerancia de 100ms para saltos de frame)
    const matches = (t1: number | undefined, t2: number) => t1 !== undefined && Math.abs(t1 - t2) < 100;

    // Optimización: Memoizar frames válidos para evitar filtrar en cada renderizado (60fps)
    const validRawFrames = useMemo(() =>
        fullRawFrames?.filter(f => f.landmarks && f.landmarks.length > 0) || []
        , [fullRawFrames]);

    // Calcular flag de cruce persistente: una vez que cruza en el video, queda en true (hasta el loop)
    const stickyFrames = useMemo(() => {
        let hasCrossed = false;
        return validRawFrames.map(f => {
            // Re-evaluamos el cruce con la misma lógica refinada de metrics.ts
            // para asegurar consistencia incluso si los frames vienen de un análisis viejo en DB.
            const m = f.metrics;
            const l = f.landmarks;
            if (m && l) {
                const domWristIdx = playerHand === 'right' ? Landmark.RIGHT_WRIST : Landmark.LEFT_WRIST;
                const frontKneeIdx = playerHand === 'right' ? Landmark.LEFT_KNEE : Landmark.RIGHT_KNEE;
                const wrist = l[domWristIdx];
                const knee = l[frontKneeIdx];
                if (wrist && knee) {
                    const dist = Math.sqrt(Math.pow(wrist.x - knee.x, 2) + Math.pow(wrist.y - knee.y, 2));
                    // Aumentamos los umbrales (0.20 margen vertical, 0.35 distancia total)
                    // para ser mucho más permisivos con diferentes ángulos de cámara y asegurar el "Sí".
                    if (wrist.y > (knee.y - 0.20) || dist < 0.35) {
                        hasCrossed = true;
                    }
                }
            }
            return { ...f, stickyWristCrossed: hasCrossed };
        });
    }, [validRawFrames, playerHand]);

    // Función de búsqueda binaria para encontrar el frame más cercano en O(log N)
    const findClosestFrame = (targetMs: number) => {
        if (!stickyFrames.length) return null;
        let low = 0;
        let high = stickyFrames.length - 1;
        while (low <= high) {
            if (high - low <= 1) {
                const d1 = Math.abs(stickyFrames[low].timestampMs - targetMs);
                const d2 = Math.abs(stickyFrames[high].timestampMs - targetMs);
                return d1 < d2 ? stickyFrames[low] : stickyFrames[high];
            }
            const mid = Math.floor((low + high) / 2);
            if (stickyFrames[mid].timestampMs === targetMs) return stickyFrames[mid];
            if (stickyFrames[mid].timestampMs < targetMs) low = mid;
            else high = mid;
        }
        return stickyFrames[low];
    };

    const getMilestonePhase = (currentTime: number, internalPhase: string | null) => {
        if (!report?.keyframes) return internalPhase;
        const kf = report.keyframes;
        // Damos tiempos de "hold" (gracia) para que el cronómetro y los indicadores no flasheen y se vean bien
        if (kf.setup && currentTime <= kf.setup.timestamp + 1200) return 'SETUP';
        if (kf.trophy && currentTime <= kf.trophy.timestamp) return 'TROPHY';
        if (kf.contact && currentTime <= kf.contact.timestamp + 800) return 'CONTACT';
        if (kf.finish) return 'FOLLOW_THROUGH';
        return internalPhase;
    };

    useEffect(() => {
        const currentTime = status?.positionMillis || 0;

        // ESTRATEGIA DE RENDERIZADO DEL ESQUELETO Y TELEMETRÍA:

        // 1. Si está reproduciendo, buscamos telemetría dinámica
        if (status?.isPlaying) {
            if (selectedPhase !== null) setSelectedPhase(null);

            const closest = findClosestFrame(currentTime);
            if (closest && Math.abs(closest.timestampMs - currentTime) < 150) {
                // Actualizar esqueleto, métricas y fase en vivo
                setCurrentLandmarks(closest.landmarks);
                setCurrentMetrics(closest.metrics ? { ...closest.metrics, wristCrossedKnee: closest.stickyWristCrossed } : null);
                setCurrentPhaseName(getMilestonePhase(currentTime, closest.phase || null));

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
                setCurrentMetrics(null);
                setCurrentPhaseName(null);
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
                // Si el reporte ya confirmó el cruce, forzamos true
                const isCrossed = (kf.metrics?.wristCrossedKnee === true) || (report.keyframes?.finish?.metrics as any)?.wristCrossedKnee === true;
                setCurrentMetrics(kf.metrics ? { ...kf.metrics, wristCrossedKnee: isCrossed } : null);
                setCurrentPhaseName(getMilestonePhase(currentTime, kf.phase || null));
                return;
            }
        }

        // 3. Fallback: Búsqueda estática cuando el video está pausado fuera de un keyframe
        const closest = findClosestFrame(currentTime);
        if (closest && Math.abs(closest.timestampMs - currentTime) < 150) {
            setCurrentLandmarks(closest.landmarks);
            // Usamos el valor sticky para que no pierda el "Sí" al pausar o terminar
            const isCrossed = (closest.metrics?.wristCrossedKnee === true) || closest.stickyWristCrossed || (report.keyframes?.finish?.metrics as any)?.wristCrossedKnee === true;
            setCurrentMetrics(closest.metrics ? { ...closest.metrics, wristCrossedKnee: isCrossed } : null);
            setCurrentPhaseName(getMilestonePhase(currentTime, closest.phase || null));
        }
        else {
            setCurrentLandmarks(null);
            setCurrentMetrics(null);
            setCurrentPhaseName(null);
        }
    }, [status?.positionMillis, validRawFrames, selectedPhase, report.keyframes, playerHand]);

    const handleMetricChange = (key: string, value: string) => {
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

    const handleIndicatorChange = (key: string, value: string) => {
        const numericValue = parseInt(value, 10);
        if (value !== '' && (isNaN(numericValue) || numericValue > 102)) {
            return;
        }

        setDetailedMetricScores(prev => {
            const newScores = { ...prev, [key]: value };

            const config = STROKE_METRICS_CONFIG[report.strokeType] || STROKE_METRICS_CONFIG.SERVE;
            let finalScoreSum = 0;

            (['preparacion', 'armado', 'impacto', 'terminacion'] as const).forEach(phaseKey => {
                const phaseConfig = config[phaseKey] || [];
                let sum = 0;
                let validCount = 0;

                phaseConfig.forEach(metric => {
                    const strVal = newScores[metric.key];
                    if (strVal !== undefined && strVal !== '') {
                        sum += parseInt(strVal, 10) || 0;
                        validCount++;
                    }
                });

                const average = validCount > 0 ? Math.round(sum / validCount) : 0;

                if (phaseKey === 'preparacion') setPreparacionScore(average.toString());
                if (phaseKey === 'armado') setArmadoScore(average.toString());
                if (phaseKey === 'impacto') setImpactoScore(average.toString());
                if (phaseKey === 'terminacion') setTerminacionScore(average.toString());

                finalScoreSum += (average * 0.25);
            });

            setFinalScore(Math.round(finalScoreSum).toString());

            return newScores;
        });
    };

    const handleFlagChange = (newFlags: RuleFlag[]) => {
        setActiveFlags(newFlags);
    };

    const handleFlagMetadataChange = (key: string, title: string, subtitle: string) => {
        setFlagMetadata(prev => ({
            ...prev,
            [key]: { title, subtitle }
        }));
    };

    const handleApprove = async () => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            const prep = Math.round(parseFloat(preparacionScore)) || 0;
            const arm = Math.round(parseFloat(armadoScore)) || 0;
            const imp = Math.round(parseFloat(impactoScore)) || 0;
            const term = Math.round(parseFloat(terminacionScore)) || 0;
            const final = Math.round((prep * 0.25) + (arm * 0.25) + (imp * 0.25) + (term * 0.25));

            await onApprove(coachNotes, {
                preparacion: prep,
                armado: arm,
                impacto: imp,
                terminacion: term,
                finalScore: final,
                flags: activeFlags,
                flagMetadata: flagMetadata,
                detailedMetrics: Object.fromEntries(
                    Object.entries(detailedMetricScores).map(([k, v]) => [k, Math.round(parseFloat(v)) || 0])
                )
            });
        } catch (error: any) {
            console.error("[AnalysisResultScreen] Error in handleApprove:", error);
            showError("Error al guardar", error.message || "No se pudo procesar la solicitud.");
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

                if (report.strokeType === 'SERVE') {
                    switch (phase) {
                        case ServePhase.SETUP:
                            setPinnedMetric({
                                label: 'Orientación',
                                value: `${Math.round(report.detailedMetrics.footOrientationScore ?? 0)}%`,
                                jointIndex: Landmark.LEFT_ANKLE
                            });
                            break;
                        case ServePhase.TROPHY:
                        case ServePhase.ACCELERATION:
                            setPinnedMetric({
                                label: 'Flexión/Trofeo',
                                value: `${Math.round(((report.detailedMetrics.kneeFlexionScore ?? 0) + (report.detailedMetrics.trophyPositionScore ?? 0)) / 2)}%`,
                                jointIndex: playerHand === 'right' ? Landmark.RIGHT_KNEE : Landmark.LEFT_KNEE
                            });
                            break;
                        case ServePhase.CONTACT:
                            setPinnedMetric({
                                label: 'Salto/Impacto',
                                value: `${Math.round(report.detailedMetrics.heelLiftScore ?? 0)}%`,
                                jointIndex: playerHand === 'right' ? Landmark.RIGHT_HEEL : Landmark.LEFT_HEEL
                            });
                            break;
                        case ServePhase.FOLLOW_THROUGH:
                            setPinnedMetric({
                                label: 'Terminación',
                                value: `${Math.round(report.detailedMetrics.followThroughScore ?? 0)}%`,
                                jointIndex: playerHand === 'right' ? Landmark.RIGHT_WRIST : Landmark.LEFT_WRIST
                            });
                            break;
                    }
                } else {
                    setPinnedMetric(null);
                }
            }
        }
    };

    const handleShare = () => {
        handleSharePress('analysis', report);
    };

    const togglePlaybackRate = () => {
        setPlaybackRate(prev => {
            if (prev === 1.0) return 0.5;
            if (prev === 0.5) return 0.25;
            return 1.0;
        });
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
                                        rate={playbackRate}
                                        showFullscreenButton={false}
                                        onPlaybackStatusUpdate={(s) => setStatus(s as AVPlaybackStatusSuccess)}
                                        onReadyForDisplay={(size) => {
                                            if (size.width > 0 && size.height > 0) {
                                                setVideoNaturalSize(size);
                                                setVideoAspectRatio(size.height / size.width);
                                            }
                                            if (onReady) onReady();
                                        }}
                                        overlayContent={(layout) => {
                                            const phaseKey = selectedPhase === ServePhase.FOLLOW_THROUGH ? 'finish' :
                                                (selectedPhase === ServePhase.ACCELERATION ? 'trophy' :
                                                    (selectedPhase?.toLowerCase() || ''));
                                            const snapUrl = selectedPhase && report.keyframes ? (report.keyframes as any)[phaseKey]?.snapshotUrl : null;

                                            return (
                                                <View style={StyleSheet.absoluteFill}>
                                                    {snapUrl && (
                                                        <Image
                                                            source={{ uri: snapUrl }}
                                                            style={StyleSheet.absoluteFill}
                                                            resizeMode="contain"
                                                        />
                                                    )}
                                                    {showSkeleton && currentLandmarks && (
                                                        <PoseOverlay
                                                            landmarks={currentLandmarks}
                                                            width={layout.width}
                                                            height={layout.height}
                                                            color="#00FFFF"
                                                        />
                                                    )}
                                                    {showSkeleton && currentMetrics && (
                                                        <View style={styles.hudOverlay}>
                                                            <Text style={styles.hudTitle}>
                                                                {(PHASE_NAMES_ES[currentPhaseName || ''] || currentPhaseName || '---').toUpperCase()}
                                                            </Text>
                                                            {/* Indicadores dinámicos según fase */}
                                                            {(currentPhaseName === 'IDLE' || currentPhaseName === 'SETUP') && (
                                                                <Text style={styles.hudIndicator}>
                                                                    {`Perfil: ${currentMetrics.footOrientationAngle.toFixed(1)}°`}
                                                                </Text>
                                                            )}
                                                            {(currentPhaseName === 'TROPHY' || currentPhaseName === 'ACCELERATION') && (
                                                                <>
                                                                    <Text style={styles.hudIndicator}>{`Codo: ${currentMetrics.dominantElbowAngle.toFixed(1)}°`}</Text>
                                                                    <Text style={styles.hudIndicator}>{`Flexión: ${currentMetrics.frontKneeFlexionAngle.toFixed(1)}°`}</Text>
                                                                    <Text style={styles.hudIndicator}>{`Pos. Trofeo: ${currentMetrics.trophyAlignmentAngle.toFixed(1)}°`}</Text>
                                                                </>
                                                            )}
                                                            {currentPhaseName === 'CONTACT' && (
                                                                <>
                                                                    <Text style={styles.hudIndicator}>{`Codo: ${currentMetrics.dominantElbowAngle.toFixed(1)}°`}</Text>
                                                                    <Text style={styles.hudIndicator}>
                                                                        {`Despegue: ${Math.max(0, ((report.heelBaselineY || currentMetrics.heelLiftDelta) - currentMetrics.heelLiftDelta) * 100).toFixed(1)} cm`}
                                                                    </Text>
                                                                </>
                                                            )}
                                                            {currentPhaseName === 'FOLLOW_THROUGH' && (
                                                                <Text style={styles.hudIndicator}>
                                                                    {`Cruce del brazo: ${(report.detailedMetrics?.followThroughScore === 100 || report.keyframes?.finish?.metrics?.wristCrossedKnee || currentMetrics.wristCrossedKnee) ? 'Sí' : 'No'}`}
                                                                </Text>
                                                            )}
                                                            <TouchableOpacity
                                                                onPress={togglePlaybackRate}
                                                                style={styles.speedButton}
                                                                activeOpacity={0.7}
                                                            >
                                                                <Text style={styles.speedButtonText}>{playbackRate}x</Text>
                                                            </TouchableOpacity>
                                                        </View>
                                                    )}
                                                </View>
                                            );
                                        }}
                                    />
                                </View>
                            </View>

                            {/* RIGHT SIDE: Report & Coach Notes */}
                            <ScrollView
                                style={[styles.reportSide, { flex: 1, height: VIDEO_HEIGHT + 140 }]}
                                contentContainerStyle={{ paddingBottom: 40 }}
                                showsVerticalScrollIndicator={Platform.OS === 'web'}
                                keyboardShouldPersistTaps="handled"
                            >
                                <View style={styles.reportHeaderRow}>
                                    <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end', width: '100%' }}>
                                        {validRawFrames.length > 0 && (
                                            <TouchableOpacity
                                                onPress={() => setShowSkeleton(!showSkeleton)}
                                                style={[styles.shareIconButton, { backgroundColor: showSkeleton ? 'rgba(204, 255, 0, 0.2)' : 'rgba(255, 255, 255, 0.1)' }]}
                                                activeOpacity={0.7}
                                            >
                                                <Ionicons name={showSkeleton ? "person" : "person-outline"} size={20} color={showSkeleton ? "#CCFF00" : "#999"} />
                                                <Text style={[styles.shareText, { color: showSkeleton ? "#CCFF00" : "#999" }]}>{showSkeleton ? "IA On" : "IA Off"}</Text>
                                            </TouchableOpacity>
                                        )}

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
                                    report={displayReport}
                                    editableValues={!readOnly ? {
                                        preparacion: preparacionScore,
                                        armado: armadoScore,
                                        impacto: impactoScore,
                                        terminacion: terminacionScore,
                                        finalScore: finalScore
                                    } : undefined}
                                    editableIndicators={!readOnly ? detailedMetricScores : undefined}
                                    onValueChange={!readOnly ? handleMetricChange : undefined}
                                    onIndicatorChange={!readOnly ? handleIndicatorChange : undefined}
                                    onFlagsChange={!readOnly ? handleFlagChange : undefined}
                                    onFlagMetadataChange={!readOnly ? handleFlagMetadataChange : undefined}
                                    onSelectPhase={validRawFrames.length > 0 ? handleSelectPhase : undefined}
                                />

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
                        <ScrollView
                            style={styles.reportSide}
                            contentContainerStyle={{ paddingBottom: 150 }}
                            keyboardShouldPersistTaps="handled"
                        >
                            <View style={[styles.reportHeaderRow, { paddingHorizontal: 20, marginTop: 10, justifyContent: 'flex-end' }]}>
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    {validRawFrames.length > 0 && (
                                        <TouchableOpacity
                                            onPress={() => setShowSkeleton(!showSkeleton)}
                                            style={[styles.shareIconButton, { backgroundColor: showSkeleton ? 'rgba(204, 255, 0, 0.2)' : 'rgba(255, 255, 255, 0.1)' }]}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons name={showSkeleton ? "person" : "person-outline"} size={20} color={showSkeleton ? "#CCFF00" : "#999"} />
                                            <Text style={[styles.shareText, { color: showSkeleton ? "#CCFF00" : "#999" }]}>{showSkeleton ? "IA On" : "IA Off"}</Text>
                                        </TouchableOpacity>
                                    )}

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

                            <AnalysisReport
                                report={displayReport}
                                editableValues={!readOnly ? {
                                    preparacion: preparacionScore,
                                    armado: armadoScore,
                                    impacto: impactoScore,
                                    terminacion: terminacionScore,
                                    finalScore: finalScore
                                } : undefined}
                                editableIndicators={!readOnly ? detailedMetricScores : undefined}
                                onValueChange={!readOnly ? handleMetricChange : undefined}
                                onIndicatorChange={!readOnly ? handleIndicatorChange : undefined}
                                onFlagsChange={!readOnly ? handleFlagChange : undefined}
                                onFlagMetadataChange={!readOnly ? handleFlagMetadataChange : undefined}
                                onSelectPhase={validRawFrames.length > 0 ? handleSelectPhase : undefined}
                            />

                            <View style={[styles.videoSide, { marginBottom: 20 }]}>
                                <View style={[styles.videoContainer, { width: videoWidth, height: VIDEO_HEIGHT, overflow: 'hidden' }]}>
                                    <ProVideoPlayer
                                        ref={videoRef}
                                        videoUri={videoUri}
                                        style={styles.video}
                                        useNativeControls={false}
                                        isLooping={true}
                                        shouldPlay={true}
                                        rate={playbackRate}
                                        showFullscreenButton={false}
                                        onPlaybackStatusUpdate={(s) => setStatus(s as AVPlaybackStatusSuccess)}
                                        onReadyForDisplay={(size) => {
                                            if (size.width > 0 && size.height > 0) {
                                                setVideoNaturalSize(size);
                                                setVideoAspectRatio(size.height / size.width);
                                            }
                                            if (onReady) onReady();
                                        }}
                                        overlayContent={(layout) => {
                                            const phaseKey = selectedPhase === ServePhase.FOLLOW_THROUGH ? 'finish' :
                                                (selectedPhase === ServePhase.ACCELERATION ? 'trophy' :
                                                    (selectedPhase?.toLowerCase() || ''));
                                            const snapUrl = selectedPhase && report.keyframes ? (report.keyframes as any)[phaseKey]?.snapshotUrl : null;

                                            return (
                                                <View style={StyleSheet.absoluteFill}>
                                                    {snapUrl && (
                                                        <Image
                                                            source={{ uri: snapUrl }}
                                                            style={StyleSheet.absoluteFill}
                                                            resizeMode="contain"
                                                        />
                                                    )}
                                                    {showSkeleton && currentLandmarks && (
                                                        <PoseOverlay
                                                            landmarks={currentLandmarks}
                                                            width={layout.width}
                                                            height={layout.height}
                                                            color="#00FFFF"
                                                        />
                                                    )}
                                                    {showSkeleton && currentMetrics && (
                                                        <View style={styles.hudOverlay}>
                                                            <Text style={styles.hudTitle}>
                                                                {(PHASE_NAMES_ES[currentPhaseName || ''] || currentPhaseName || '---').toUpperCase()}
                                                            </Text>
                                                            {/* Indicadores dinámicos según fase */}
                                                            {(currentPhaseName === 'IDLE' || currentPhaseName === 'SETUP') && (
                                                                <Text style={styles.hudIndicator}>
                                                                    {`Perfil: ${currentMetrics.footOrientationAngle.toFixed(1)}°`}
                                                                </Text>
                                                            )}
                                                            {(currentPhaseName === 'TROPHY' || currentPhaseName === 'ACCELERATION') && (
                                                                <>
                                                                    <Text style={styles.hudIndicator}>{`Codo: ${currentMetrics.dominantElbowAngle.toFixed(1)}°`}</Text>
                                                                    <Text style={styles.hudIndicator}>{`Flexión: ${currentMetrics.frontKneeFlexionAngle.toFixed(1)}°`}</Text>
                                                                    <Text style={styles.hudIndicator}>{`Pos. Trofeo: ${currentMetrics.trophyAlignmentAngle.toFixed(1)}°`}</Text>
                                                                </>
                                                            )}
                                                            {currentPhaseName === 'CONTACT' && (
                                                                <>
                                                                    <Text style={styles.hudIndicator}>{`Codo: ${currentMetrics.dominantElbowAngle.toFixed(1)}°`}</Text>
                                                                    <Text style={styles.hudIndicator}>
                                                                        {`Despegue: ${Math.max(0, ((report.heelBaselineY || currentMetrics.heelLiftDelta) - currentMetrics.heelLiftDelta) * 100).toFixed(1)} cm`}
                                                                    </Text>
                                                                </>
                                                            )}
                                                            {currentPhaseName === 'FOLLOW_THROUGH' && (
                                                                <Text style={styles.hudIndicator}>
                                                                    {`Cruce del brazo: ${(report.detailedMetrics?.followThroughScore === 100 || report.keyframes?.finish?.metrics?.wristCrossedKnee || currentMetrics.wristCrossedKnee) ? 'Sí' : 'No'}`}
                                                                </Text>
                                                            )}
                                                            <TouchableOpacity
                                                                onPress={togglePlaybackRate}
                                                                style={styles.speedButton}
                                                                activeOpacity={0.7}
                                                            >
                                                                <Text style={styles.speedButtonText}>{playbackRate}x</Text>
                                                            </TouchableOpacity>
                                                        </View>
                                                    )}
                                                </View>
                                            );
                                        }}
                                    />
                                </View>
                            </View>

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

            <ShareModal
                visible={shareModalVisible}
                onClose={() => setShareModalVisible(false)}
                onWhatsApp={performWhatsAppShare}
                onCopy={performCopyLink}
                onOther={performNativeShare}
            />
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
    },
    hudOverlay: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(204, 255, 0, 0.3)',
        zIndex: 100,
        minWidth: 100,
    },
    hudTitle: {
        color: '#FFF',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 1,
        marginBottom: 2,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    hudIndicator: {
        color: '#CCFF00',
        fontSize: 13,
        fontWeight: 'bold',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    hudText: {
        color: '#CCFF00',
        fontSize: 13,
        fontWeight: 'bold',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    speedButton: {
        marginTop: 6,
        paddingVertical: 4,
        paddingHorizontal: 8,
        backgroundColor: 'rgba(204, 255, 0, 0.15)',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(204, 255, 0, 0.4)',
        alignItems: 'center',
        alignSelf: 'flex-start',
    },
    speedButtonText: {
        color: '#CCFF00',
        fontSize: 12,
        fontWeight: 'bold',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
});
