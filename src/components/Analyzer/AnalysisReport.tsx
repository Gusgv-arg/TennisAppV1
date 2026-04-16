import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CATEGORY_LABELS } from '../../services/PoseAnalysis/constants';
import { getFlagInfo, STROKE_FLAGS } from '../../services/PoseAnalysis/flags';
import { CATEGORY_WEIGHTS } from '../../services/PoseAnalysis/rules';
import { STROKE_METRICS_CONFIG } from '../../services/PoseAnalysis/strokeConfigs';
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
    editableIndicators?: Record<string, string>;
    onValueChange?: (key: string, value: string) => void;
    onIndicatorChange?: (key: string, value: string) => void;
    editableIndicatorMetadata?: Record<string, { label: string, reference: string }>;
    onIndicatorMetadataChange?: (key: string, label: string, reference: string) => void;
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
    editableIndicators,
    editableIndicatorMetadata,
    onIndicatorMetadataChange
}) => {
    const { t } = useTranslation();
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
        SERVE: t('common.serve'),
        DRIVE: t('common.drive'),
        BACKHAND: t('common.backhand'),
        VOLLEY: t('common.volley'),
        SMASH: t('common.smash')
    };

    const strokeTitle = strokeLabels[report.strokeType] || t('common.stroke');

    return (
        <View style={styles.container}>

            {/* Header / Global Score */}
            <View style={styles.header}>
                <Text style={styles.title}>{t('analysis.labels.analysisOf', { stroke: strokeTitle })}</Text>

                <View style={styles.scoreHeaderRow}>
                    <View style={[styles.scoreCircle, { borderColor: mainColor }]}>
                        <Text style={[styles.scoreText, { color: mainColor }]}>{report.finalScore}</Text>
                        <Text style={styles.scoreSub}>{t('analysis.labels.score')}</Text>
                    </View>
                </View>

                {/* Advertencias de fiabilidad eliminadas a pedido */}
            </View>

            {/* Areas of Improvement */}
            <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                    {report.flags.length > 0 && <Text style={styles.sectionTitle}>{t('analysis.labels.improvementAreas')}</Text>}
                    {onFlagsChange && (
                        <TouchableOpacity
                            onPress={handleAddNextFlag}
                            style={styles.addFlagBtn}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="add-circle-outline" size={18} color="#CCFF00" />
                            <Text style={styles.headerAddBtnText}>{t('analysis.labels.improvementAreas')}</Text>
                        </TouchableOpacity>
                    )}
                </View>
                {(() => {
                    const technicalFlags = report.flags.filter(f => f !== 'POOR_ORIENTATION' && f !== 'UNKNOWN_ERROR');

                    {/* Mensaje de felicitaciones eliminado a pedido */}

                    if (technicalFlags.length === 0) return null;

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
                                                    Platform.OS === 'web' && { outlineStyle: 'none' } as any
                                                ]}
                                                value={metadata.title}
                                                onChangeText={(txt) => onFlagMetadataChange(flag, txt, metadata.subtitle)}
                                                placeholder={t('analysis.labels.categoryPlaceholder')}
                                                placeholderTextColor="#999"
                                                editable={true}
                                                selectTextOnFocus={true}
                                            />
                                            <View style={{ height: 8 }} />
                                            <TextInput
                                                style={[
                                                    styles.issueDetailInput,
                                                    Platform.OS === 'web' && { cursor: 'text', outlineStyle: 'none' } as any,
                                                    { backgroundColor: 'rgba(0,0,0,0.3)', padding: 10, borderRadius: 6 }
                                                ]}
                                                value={metadata.subtitle}
                                                onChangeText={(txt) => onFlagMetadataChange(flag, metadata.title, txt)}
                                                placeholder={t('analysis.labels.improvementPlaceholder')}
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
                <Text style={styles.sectionTitle}>{t('analysis.labels.technicalBreakdown')}</Text>

                {(() => {
                    const config = STROKE_METRICS_CONFIG[report.strokeType] || STROKE_METRICS_CONFIG.SERVE;

                    const phaseMapping: Record<keyof typeof CATEGORY_LABELS, ServePhase> = {
                        preparacion: ServePhase.SETUP,
                        armado: ServePhase.TROPHY,
                        impacto: ServePhase.CONTACT,
                        terminacion: ServePhase.FOLLOW_THROUGH
                    };

                    return (Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>).map(categoryKey => {
                        const phaseMetrics = config[categoryKey] || [];
                        const categoryLabel = t(`analysis.phases.${categoryKey === 'preparacion' ? 'setup' : categoryKey === 'armado' ? 'trophy' : categoryKey === 'impacto' ? 'contact' : 'followThrough'}`);
                        const phaseEnum = phaseMapping[categoryKey];
                        const categoryScore = report.categoryScores?.[categoryKey] ?? 0;
                        const weight = CATEGORY_WEIGHTS[categoryKey] * 100;

                        return (
                            <MetricSection
                                key={categoryKey}
                                label={categoryLabel}
                                value={categoryScore}
                                weight={weight}
                                weightLabel={t('analysis.labels.weight')}
                                phase={phaseEnum}
                                onPress={!report.poorQuality ? onSelectPhase : undefined}
                            >
                                {phaseMetrics.map(metric => (
                                    <SubMetricRow
                                        key={metric.key}
                                        label={metric.label}
                                        reference={metric.ref}
                                        value={report.detailedMetrics?.[metric.key] ?? 0}
                                        editableValue={editableIndicators?.[metric.key]}
                                        onValueChange={(v) => onIndicatorChange?.(metric.key, v)}
                                        editableMetadata={editableIndicatorMetadata?.[metric.key]}
                                        onMetadataChange={onIndicatorMetadataChange ? (l, r) => onIndicatorMetadataChange(metric.key, l, r) : undefined}
                                    />
                                ))}
                            </MetricSection>
                        );
                    });
                })()}
            </View>

        </View>
    );
};

const MetricSection = ({ label, value, weight, weightLabel, phase, onPress, children }: { label: string, value: number, weight: number, weightLabel: string, phase: ServePhase, onPress?: (p: ServePhase) => void, children: React.ReactNode }) => (
    <View style={styles.metricSectionCard}>
        <View style={styles.metricHeader}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                <Text style={styles.metricLabel}>{label}</Text>
                <Text style={styles.inlineWeightLabel}>- {weightLabel} {weight}%</Text>
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
    onValueChange,
    onMetadataChange,
    editableMetadata
}: {
    label: string,
    value: number,
    reference?: string,
    editableValue?: string,
    onValueChange?: (v: string) => void,
    onMetadataChange?: (label: string, reference: string) => void,
    editableMetadata?: { label: string, reference: string }
}) => {
    const { t } = useTranslation();
    const displayLabel = editableMetadata?.label ?? label;
    const displayReference = editableMetadata?.reference ?? reference;

    return (
        <View style={styles.subMetricRow}>
            <View style={{ flex: 1 }}>
                {onMetadataChange ? (
                    <View style={{ gap: 4, marginBottom: 4 }}>
                        <TextInput
                            style={[
                                styles.subMetricLabelInput,
                                Platform.OS === 'web' && { outlineStyle: 'none' } as any
                            ]}
                            value={displayLabel}
                            onChangeText={(txt) => onMetadataChange(txt, displayReference || '')}
                            placeholder={t('analysis.labels.indicatorPlaceholder')}
                            placeholderTextColor="#666"
                        />
                        <TextInput
                            style={[
                                styles.subMetricReferenceInput,
                                Platform.OS === 'web' && { outlineStyle: 'none' } as any
                            ]}
                            value={displayReference}
                            onChangeText={(txt) => onMetadataChange(displayLabel, txt)}
                            placeholder={t('analysis.labels.referencePlaceholder')}
                            placeholderTextColor="#444"
                            multiline
                        />
                    </View>
                ) : (
                    <>
                        <Text style={styles.subMetricLabel}>{displayLabel}</Text>
                        {displayReference ? <Text style={styles.subMetricReference}>{displayReference}</Text> : null}
                    </>
                )}
            </View>
            <View style={styles.subMetricValueContainer}>
                {onValueChange && editableValue !== undefined ? (
                    <View style={styles.metricEditContainer}>
                        <TextInput
                            style={[
                                styles.metricInput,
                                Platform.OS === 'web' && { outlineStyle: 'none' } as any
                            ]}
                            value={editableValue}
                            onChangeText={onValueChange}
                            keyboardType="numeric"
                            maxLength={3}
                            placeholder="0"
                            placeholderTextColor="#666"
                            selectTextOnFocus={true}
                        />
                    </View>
                ) : (
                    <Text style={[
                        styles.subMetricValueText, 
                        { color: value > 80 ? '#CCFF00' : value > 50 ? '#FFD700' : '#FF4444' }
                    ]}>
                        {Math.round(value)}%
                    </Text>
                )}
            </View>
        </View>
    );
};

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
        color: '#FFFFFF',
        fontSize: 14,
        lineHeight: 20,
    },
    congratulationsCard: {
        backgroundColor: 'rgba(204, 255, 0, 0.1)',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#CCFF00',
        alignItems: 'center',
        marginVertical: 10,
    },
    congratulationsText: {
        color: '#CCFF00',
        fontSize: 15,
        fontWeight: 'bold',
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
        color: '#FFFFFF',
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
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '500',
    },
    subMetricReference: {
        color: '#FFFFFF',
        fontSize: 11,
        marginTop: 2,
    },
    subMetricValueContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        minWidth: 40,
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
        fontSize: 16,
        fontWeight: 'bold',
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderRadius: 4,
        width: 55,
        textAlign: 'center',
        borderWidth: 1,
        borderColor: '#333'
    },
    metricEditContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metricInput: {
        backgroundColor: '#000',
        color: '#CCFF00',
        fontSize: 16,
        fontWeight: 'bold',
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderRadius: 4,
        width: 55,
        textAlign: 'center',
        borderWidth: 1,
        borderColor: '#333'
    },
    metricValueInput: {
        backgroundColor: '#000',
        color: '#CCFF00',
        fontSize: 18,
        fontWeight: 'bold',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 4,
        width: 60,
        textAlign: 'center',
        borderWidth: 1,
        borderColor: '#444'
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
        color: '#FFFFFF',
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
    subMetricLabelInput: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: 'bold',
        backgroundColor: 'rgba(0,0,0,0.3)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#333',
    },
    subMetricReferenceInput: {
        color: '#FFFFFF',
        fontSize: 11,
        backgroundColor: 'rgba(0,0,0,0.2)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#222',
        minHeight: 30,
    },
});
