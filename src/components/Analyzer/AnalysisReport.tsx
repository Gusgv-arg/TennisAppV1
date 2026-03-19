import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CATEGORY_LABELS } from '../../services/PoseAnalysis/constants';
import { getFlagInfo, STROKE_FLAGS } from '../../services/PoseAnalysis/flags';
import { CATEGORY_WEIGHTS } from '../../services/PoseAnalysis/rules';
import { RuleFlag, ServeAnalysisReport, ServePhase, StrokeType } from '../../services/PoseAnalysis/types';


interface AnalysisReportProps {
    report: ServeAnalysisReport;
    onClose?: () => void;
    editableValues?: {
        preparacion: string;
        armado: string;
        impacto: string;
        terminacion: string;
        finalScore: string;
    };
    editableIndicators?: {
        footOrientationScore: string;
        kneeFlexionScore: string;
        trophyPositionScore: string;
        heelLiftScore: string;
        followThroughScore: string;
    };
    onValueChange?: (key: string, value: string) => void;
    onIndicatorChange?: (key: string, value: string) => void;
    onFlagsChange?: (flags: RuleFlag[]) => void;
    onFlagMetadataChange?: (key: string, title: string, subtitle: string) => void;
    onSelectPhase?: (phase: ServePhase) => void;
}

export const AnalysisReport: React.FC<AnalysisReportProps> = ({
    report,
    onValueChange,
    onIndicatorChange,
    onFlagsChange,
    onFlagMetadataChange,
    onSelectPhase,
    editableValues,
    editableIndicators
}) => {
    const handleAddNextFlag = () => {
        if (!onFlagsChange) return;

        const available = STROKE_FLAGS[report.strokeType] || STROKE_FLAGS.SERVE;
        const availableFlags = Object.keys(available) as RuleFlag[];

        const nextFlag = availableFlags.find(f =>
            !report.flags.includes(f) &&
            f !== 'POOR_ORIENTATION' &&
            f !== 'UNKNOWN_ERROR'
        );

        if (nextFlag) {
            const info = available[nextFlag];
            if (info && onFlagMetadataChange) {
                onFlagMetadataChange(nextFlag, info.title, info.subtitle);
            }
            onFlagsChange([...report.flags, nextFlag]);
        }
    };

    const toggleFlag = (flag: RuleFlag) => {
        if (!onFlagsChange) return;
        if (report.flags.includes(flag)) {
            onFlagsChange(report.flags.filter(f => f !== flag));
        } else {
            onFlagsChange([...report.flags, flag]);
        }
    };

    // Generar el color de calificación
    const getScoreColor = (score: number) => {
        if (score >= 80) return '#CCFF00'; // Neon Lime (Top)
        if (score >= 60) return '#FFD700'; // Gold/Yellow (Average)
        return '#FF4444'; // Red (Needs work)
    };

    const mainColor = getScoreColor(report.finalScore);

    const strokeLabels: Record<StrokeType, string> = {
        SERVE: 'Saque',
        DRIVE: 'Drive',
        BACKHAND: 'Revés',
        VOLLEY: 'Volea',
        SMASH: 'Smash'
    };

    const strokeTitle = strokeLabels[report.strokeType] || 'Golpe';

    return (
        <View style={styles.container}>

            {/* Header / Global Score */}
            <View style={styles.header}>
                <Text style={styles.title}>Biomecánica del {strokeTitle}</Text>

                <View style={styles.scoreHeaderRow}>
                    <View style={[styles.scoreCircle, { borderColor: mainColor }]}>
                        <Text style={[styles.scoreText, { color: mainColor }]}>{report.finalScore}</Text>
                        <Text style={styles.scoreSub}>SCORE</Text>
                    </View>
                </View>

                {!report.poorQuality && (report.confidence < 0.8 || report.flags.includes('UNKNOWN_ERROR')) && (
                    <View style={styles.alertRow}>
                        <Text style={styles.confidenceWarning}>
                            ⚠️ Análisis Parcial {report.confidence < 0.8 ? `(${Math.round(report.confidence * 100)}% fiabilidad)` : ''}
                        </Text>
                    </View>
                )}
            </View>

            {/* Areas of Improvement */}
            <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                    {report.flags.length > 0 && <Text style={styles.sectionTitle}>Áreas de Mejora</Text>}
                    {onFlagsChange && (
                        <TouchableOpacity
                            onPress={handleAddNextFlag}
                            style={styles.addFlagBtn}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="add-circle-outline" size={18} color="#CCFF00" />
                            <Text style={styles.headerAddBtnText}>Áreas de Mejora</Text>
                        </TouchableOpacity>
                    )}
                </View>
                {(() => {
                    const technicalFlags = report.flags.filter(f => f !== 'POOR_ORIENTATION' && f !== 'UNKNOWN_ERROR');

                    if (technicalFlags.length === 0) {
                        if (!onFlagsChange && !report.poorQuality) {
                            return (
                                <View style={styles.perfectCard}>
                                    <Text style={styles.perfectText}>🌟 ¡Técnica Ejecutada Puramente! 🌟</Text>
                                    <Text style={styles.perfectSub}>No se han detectado errores biomecánicos graves en el saque.</Text>
                                </View>
                            );
                        }
                        return null;
                    }

                    return technicalFlags.map((flag) => {
                        const info = getFlagInfo(flag, report.strokeType) || getFlagInfo(flag, 'SERVE');
                        if (!info) return null;

                        const metadata = report.flagMetadata?.[flag] || { title: info.title, subtitle: info.subtitle };

                        return (
                            <View key={flag} style={styles.issueCard}>
                                <View style={styles.issueTexts}>
                                    {onFlagMetadataChange ? (
                                        <View style={{ flex: 1, zIndex: 100 }} pointerEvents="auto">
                                            <TextInput
                                                style={[
                                                    styles.issueTitleInput,
                                                    Platform.OS === 'web' && { cursor: 'text', outline: 'none' } as any,
                                                    { backgroundColor: 'rgba(0,0,0,0.3)', padding: 6, borderRadius: 6, minHeight: 40 }
                                                ]}
                                                value={metadata.title}
                                                onChangeText={(txt) => onFlagMetadataChange(flag, txt, metadata.subtitle)}
                                                placeholder="Categoría..."
                                                placeholderTextColor="#666"
                                                editable={true}
                                                selectTextOnFocus={true}
                                            />
                                            <View style={{ height: 8 }} />
                                            <TextInput
                                                style={[
                                                    styles.issueDetailInput,
                                                    Platform.OS === 'web' && { cursor: 'text', outline: 'none' } as any,
                                                    { backgroundColor: 'rgba(0,0,0,0.3)', padding: 10, borderRadius: 6 }
                                                ]}
                                                value={metadata.subtitle}
                                                onChangeText={(txt) => onFlagMetadataChange(flag, metadata.title, txt)}
                                                placeholder="Describe la mejora técnica..."
                                                placeholderTextColor="#555"
                                                multiline={true}
                                                numberOfLines={3}
                                                editable={true}
                                                selectTextOnFocus={true}
                                            />
                                        </View>
                                    ) : (
                                        <>
                                            <Text style={styles.issueTitle}>{metadata.title}</Text>
                                            <Text style={styles.issueDetail}>{metadata.subtitle}</Text>
                                        </>
                                    )}
                                </View>
                                {onFlagsChange && (
                                    <TouchableOpacity
                                        onPress={() => toggleFlag(flag)}
                                        style={styles.deleteIssueBtn}
                                    >
                                        <Ionicons name="trash-outline" size={22} color="#666" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        );
                    });
                })()}
            </View>

            {/* Sub Metrics Breakdown */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Desglose de Técnica</Text>

                <MetricSection
                    label={CATEGORY_LABELS.preparacion}
                    value={report.categoryScores?.preparacion ?? 0}
                    weight={CATEGORY_WEIGHTS.preparacion * 100}
                    phase={ServePhase.SETUP}
                    onPress={!report.poorQuality ? onSelectPhase : undefined}
                >
                    <SubMetricRow
                        label="Orientación de Pies"
                        value={report.detailedMetrics?.footOrientationScore ?? 0}
                        editableValue={editableIndicators?.footOrientationScore}
                        onValueChange={(v) => onIndicatorChange?.('footOrientationScore', v)}
                        reference="Perfil mínimo de 70° respecto a la línea de fondo."
                    />
                </MetricSection>

                <MetricSection
                    label={CATEGORY_LABELS.armado}
                    value={report.categoryScores?.armado ?? 0}
                    weight={CATEGORY_WEIGHTS.armado * 100}
                    phase={ServePhase.TROPHY}
                    onPress={!report.poorQuality ? onSelectPhase : undefined}
                >
                    <SubMetricRow
                        label="Flexión de Rodilla"
                        value={report.detailedMetrics?.kneeFlexionScore ?? 0}
                        editableValue={editableIndicators?.kneeFlexionScore}
                        onValueChange={(v) => onIndicatorChange?.('kneeFlexionScore', v)}
                        reference="Angulo menor a 150°."
                    />
                    <SubMetricRow
                        label="Posición de Trofeo"
                        value={report.detailedMetrics?.trophyPositionScore ?? 0}
                        editableValue={editableIndicators?.trophyPositionScore}
                        onValueChange={(v) => onIndicatorChange?.('trophyPositionScore', v)}
                        reference="Angulo brazo no dominante y codo dominante menor a 150°."
                    />
                </MetricSection>

                <MetricSection
                    label={CATEGORY_LABELS.impacto}
                    value={report.categoryScores?.impacto ?? 0}
                    weight={CATEGORY_WEIGHTS.impacto * 100}
                    phase={ServePhase.CONTACT}
                    onPress={!report.poorQuality ? onSelectPhase : undefined}
                >
                    <SubMetricRow
                        label="Despegue del piso"
                        value={report.detailedMetrics?.heelLiftScore ?? 0}
                        editableValue={editableIndicators?.heelLiftScore}
                        onValueChange={(v) => onIndicatorChange?.('heelLiftScore', v)}
                        reference="Salto mínimo 10 cm."
                    />
                </MetricSection>

                <MetricSection
                    label={CATEGORY_LABELS.terminacion}
                    value={report.categoryScores?.terminacion ?? 0}
                    weight={CATEGORY_WEIGHTS.terminacion * 100}
                    phase={ServePhase.FOLLOW_THROUGH}
                    onPress={!report.poorQuality ? onSelectPhase : undefined}
                >
                    <SubMetricRow
                        label="Terminación Cruzada"
                        value={report.detailedMetrics?.followThroughScore ?? 0}
                        editableValue={editableIndicators?.followThroughScore}
                        onValueChange={(v) => onIndicatorChange?.('followThroughScore', v)}
                        reference="Mano dominante cruza la pierna contraria."
                    />
                </MetricSection>
            </View>

        </View>
    );
};

const MetricSection = ({ label, value, weight, phase, onPress, children }: { label: string, value: number, weight: number, phase: ServePhase, onPress?: (p: ServePhase) => void, children: React.ReactNode }) => (
    <View style={styles.metricSectionCard}>
        <View style={styles.metricHeader}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                <Text style={styles.metricLabel}>{label}</Text>
                <Text style={styles.inlineWeightLabel}>- Peso {weight}%</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {onPress && (
                    <TouchableOpacity
                        onPress={() => onPress(phase)}
                        style={styles.navButton}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="eye-outline" size={20} color="#CCFF00" />
                    </TouchableOpacity>
                )}
                <Text style={styles.metricValue}>{Math.round(value)}%</Text>
            </View>
        </View>
        <View style={styles.subMetricsContainer}>
            {children}
        </View>
    </View>
);

const SubMetricRow = ({
    label,
    value,
    reference,
    editableValue,
    onValueChange
}: {
    label: string,
    value: number,
    reference?: string,
    editableValue?: string,
    onValueChange?: (v: string) => void
}) => (
    <View style={styles.subMetricRow}>
        <View style={{ flex: 1 }}>
            <Text style={styles.subMetricLabel}>{label}</Text>
            {reference && <Text style={styles.subMetricReference}>{reference}</Text>}
        </View>
        <View style={styles.subMetricValueContainer}>
            {onValueChange && editableValue !== undefined ? (
                <View style={styles.indicatorInputWrapper}>
                    <TextInput
                        style={styles.indicatorInput}
                        value={editableValue}
                        onChangeText={onValueChange}
                        keyboardType="number-pad"
                        maxLength={3}
                    />
                    <Text style={styles.indicatorPercent}>%</Text>
                </View>
            ) : (
                <>
                    <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${value}%`, backgroundColor: value > 80 ? '#CCFF00' : value > 50 ? '#FFD700' : '#FF4444' }]} />
                    </View>
                    <Text style={styles.subMetricValueText}>{Math.round(value)}%</Text>
                </>
            )}
        </View>
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
        padding: 20,
        paddingBottom: 60,
    },
    content: {
        // Obsoleto, ya que no usamos ScrollView interno
    },
    header: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    scoreCircle: {
        width: 140,
        height: 140,
        borderRadius: 70,
        borderWidth: 6,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1E1E1E',
        shadowColor: "#CCFF00",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 8,
    },
    scoreText: {
        fontSize: 48,
        fontWeight: '900',
    },
    scoreSub: {
        fontSize: 14,
        color: '#888',
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    confidenceWarning: {
        color: '#FFD700',
        marginTop: 15,
        fontSize: 14,
        fontWeight: '600'
    },
    orientationWarning: {
        color: '#FFD700', // Gold/Warning color
        marginTop: 8,
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
        paddingHorizontal: 20
    },
    section: {
        marginTop: 20,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        color: '#CCFF00',
        fontSize: 14,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12,
    },
    addFlagBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 4,
        paddingHorizontal: 10,
        backgroundColor: '#252525',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#333',
    },
    addFlagText: {
        color: '#CCFF00',
        fontSize: 12,
        fontWeight: '600',
    },
    issueCard: {
        flexDirection: 'row',
        backgroundColor: '#1E1E1E',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        borderLeftWidth: 4,
        borderLeftColor: '#FF4444',
        alignItems: 'center',
    },

    issueIcon: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginTop: 4,
        marginRight: 12
    },
    issueTexts: {
        flex: 1,
    },
    removeFlagBtn: {
        padding: 8,
    },
    issueTitle: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    issueDetail: {
        color: '#A0A0A0',
        fontSize: 14,
        lineHeight: 20,
    },
    perfectCard: {
        backgroundColor: 'rgba(204, 255, 0, 0.1)',
        padding: 20,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#CCFF00',
        alignItems: 'center',
        marginTop: 20,
    },
    perfectText: {
        color: '#CCFF00',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    perfectSub: {
        color: '#E0E0E0',
        textAlign: 'center',
    },
    metricSectionCard: {
        backgroundColor: '#1E1E1E',
        borderRadius: 12,
        marginBottom: 10,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#333',
    },
    metricHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: '#252525',
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    metricLabel: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    metricValue: {
        color: '#CCFF00',
        fontSize: 18,
        fontWeight: '900',
    },
    inlineWeightLabel: {
        color: '#666',
        fontSize: 11,
        fontWeight: '500',
    },
    navButton: {
        padding: 4,
    },
    navButtonText: {
        color: '#CCFF00',
        fontSize: 12,
        fontWeight: 'bold',
    },
    subMetricsContainer: {
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    subMetricRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        paddingHorizontal: 4,
    },
    subMetricLabel: {
        color: '#E0E0E0',
        fontSize: 14,
        fontWeight: '500',
    },
    subMetricReference: {
        color: '#666',
        fontSize: 11,
        marginTop: 2,
    },
    subMetricValueContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        width: 140,
    },
    subMetricValueText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: 'bold',
        width: 35,
        textAlign: 'right',
    },
    progressBarBg: {
        flex: 1,
        height: 4,
        backgroundColor: '#333',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 2,
    },
    scoreHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 30,
        marginTop: 10,
    },
    totalAdjustWrapper: {
        alignItems: 'center',
        gap: 8,
    },
    adjustLabel: {
        color: '#888',
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    inputWithPercent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    integratedInput: {
        backgroundColor: '#000',
        color: '#CCFF00',
        fontSize: 16,
        fontWeight: 'bold',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 4,
        width: 50,
        textAlign: 'center',
        borderWidth: 1,
        borderColor: '#333'
    },
    integratedPercent: {
        color: '#666',
        fontSize: 12,
    },
    indicatorInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        justifyContent: 'flex-end',
        flex: 1,
    },
    indicatorInput: {
        backgroundColor: '#000',
        color: '#CCFF00',
        fontSize: 14,
        fontWeight: 'bold',
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 4,
        width: 45,
        textAlign: 'center',
        borderWidth: 1,
        borderColor: '#333'
    },
    indicatorPercent: {
        color: '#666',
        fontSize: 11,
        width: 12,
    },
    flagSelectorContainer: {
        marginBottom: 15,
        backgroundColor: '#1A1A1A',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333',
    },
    flagSelectorTitle: {
        color: '#888',
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 10,
        textTransform: 'uppercase',
    },
    chipsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        backgroundColor: '#252525',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#333',
    },
    chipActive: {
        backgroundColor: 'rgba(204, 255, 0, 0.2)',
        borderColor: '#CCFF00',
    },
    chipText: {
        color: '#AAA',
        fontSize: 12,
        fontWeight: '500',
    },
    chipTextActive: {
        color: '#CCFF00',
        fontWeight: 'bold',
    },
    alertRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        justifyContent: 'center',
        marginTop: 12,
        backgroundColor: 'rgba(255, 68, 68, 0.05)',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
    },
    removeAlertBtn: {
        padding: 2,
    },
    deleteIssueBtn: {
        padding: 8,
    },
    issueTitleInput: {
        color: '#CCFF00',
        fontSize: 13,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 6,
        letterSpacing: 0.5,
    },
    issueDetailInput: {
        color: '#FFF',
        fontSize: 15,
        paddingVertical: 12,
        lineHeight: 22,
        backgroundColor: '#000',
        borderRadius: 8,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#333',
        minHeight: 60,
        textAlignVertical: 'top',
    },
    headerAddBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingLeft: 12,
        paddingVertical: 4,
    },
    headerAddBtnText: {
        color: '#CCFF00',
        fontSize: 14,
        fontWeight: 'bold',
    },
    pickerContainer: {
        backgroundColor: '#111',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
        marginTop: 4,
        borderWidth: 1,
        borderColor: '#333',
    },
    pickerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
        paddingBottom: 8,
    },
    pickerTitle: {
        color: '#888',
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    pickerScrollVertical: {
        maxHeight: 250,
    },
    pickerListItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
    },
    pickerListItemText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '500',
    },
    poorQualityBanner: {
        backgroundColor: 'rgba(255, 68, 68, 0.15)',
        borderWidth: 1,
        borderColor: '#FF4444',
        borderRadius: 12,
        padding: 16,
        marginTop: 12,
        alignItems: 'center' as const,
    },
    poorQualityTitle: {
        color: '#FF6B6B',
        fontSize: 16,
        fontWeight: 'bold' as const,
        marginBottom: 10,
        textAlign: 'center' as const,
    },
    poorQualityTip: {
        color: '#AAA',
        fontSize: 13,
        lineHeight: 20,
        textAlign: 'left' as const,
        alignSelf: 'stretch' as const,
    },
});
