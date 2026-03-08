import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CATEGORY_WEIGHTS } from '../../services/PoseAnalysis/rules';
import { RuleFlag, ServeAnalysisReport } from '../../services/PoseAnalysis/types';

// Diccionario de humanos: Traduce las constantes técnicas a Feedback comprensible y sugerencias prácticas.
const FLAG_DICTIONARY: Partial<Record<RuleFlag, { title: string, subtitle: string, type: 'error' | 'warning' }>> = {
    'INSUFFICIENT_KNEE_BEND': {
        title: 'Poca Flexión de Rodillas',
        subtitle: 'Baja más el centro de gravedad en la fase de armado (Trophy) para generar mayor energía elástica.',
        type: 'error'
    },
    'POOR_TROPHY_POSITION': {
        title: 'Rotación de Hombros Incompleta',
        subtitle: 'Dale la espalda a la red un poco más. Tu rotación coxa-hombro es menor al rango profesional (40°).',
        type: 'error'
    },
    'T_REX_ARM_CONTACT': {
        title: 'Impacto Bajo (T-Rex Arm)',
        subtitle: 'Estás pegando con el codo demasiado doblado. Intenta impactar la bola en el punto más alto posible, extendiendo el brazo 180°.',
        type: 'error'
    },
    'POOR_FOLLOW_THROUGH': {
        title: 'Terminación Corta',
        subtitle: 'El brazo de golpeo no está cruzando completamente hacia tu lado contrario después del impacto. Frena tu raqueta muy pronto.',
        type: 'warning'
    },
    'EARLY_ARM_DROP': {
        title: 'Caída de Brazo Prematura',
        subtitle: 'El brazo de la raqueta bajó o perdió tensión antes de iniciar la fase explosiva hacia la bola. Intenta mantener la estructura de "Trophy" un instante más.',
        type: 'error'
    },
    'POOR_FOOT_ORIENTATION': {
        title: 'Pies muy Frontales',
        subtitle: 'Tus pies están mirando hacia la red. Gira el pie trasero para quedar más de perfil y facilitar la rotación de cadera.',
        type: 'warning'
    },
    'POOR_SHOULDER_ALIGNMENT': {
        title: 'Hombros de Frente',
        subtitle: 'Estás iniciando el saque con el pecho mirando a la red. Gira los hombros (~70°) para generar mayor palanca en el giro.',
        type: 'error'
    },

    'UNKNOWN_ERROR': {
        title: 'Análisis Parcial',
        subtitle: 'La IA no pudo ver algunas fases críticas. El score final puede ser inexacto. Reintenta grabar de cuerpo entero de lado.',
        type: 'warning'
    }
};

interface AnalysisReportProps {
    report: ServeAnalysisReport;
    onClose?: () => void;
    editableValues?: {
        preparation: string;
        trophy: string;
        contact: string;
        energyTransfer: string;
        followThrough: string;
        finalScore: string;
    };
    onValueChange?: (key: string, value: string) => void;
    onFlagsChange?: (newFlags: RuleFlag[]) => void;
}

export const AnalysisReport: React.FC<AnalysisReportProps> = ({
    report,
    editableValues,
    onValueChange,
    onFlagsChange
}) => {

    // Generar el color de calificación
    const getScoreColor = (score: number) => {
        if (score >= 80) return '#CCFF00'; // Neon Lime (Top)
        if (score >= 60) return '#FFD700'; // Gold/Yellow (Average)
        return '#FF4444'; // Red (Needs work)
    };

    const mainColor = getScoreColor(report.finalScore);

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>

            {/* Header / Global Score */}
            <View style={styles.header}>
                <Text style={styles.title}>Biomecánica del Saque</Text>

                <View style={styles.scoreHeaderRow}>
                    <View style={[styles.scoreCircle, { borderColor: mainColor }]}>
                        <Text style={[styles.scoreText, { color: mainColor }]}>{report.finalScore}</Text>
                        <Text style={styles.scoreSub}>SCORE</Text>
                    </View>

                    {editableValues && onValueChange && (
                        <View style={styles.totalAdjustWrapper}>
                            <Text style={styles.adjustLabel}>Ajuste Total</Text>
                            <View style={styles.inputWithPercent}>
                                <TextInput
                                    style={[styles.integratedInput, { color: mainColor, fontSize: 24, width: 80 }]}
                                    value={editableValues.finalScore}
                                    onChangeText={(v) => onValueChange('finalScore', v)}
                                    keyboardType="number-pad"
                                    maxLength={3}
                                />
                                <Text style={styles.integratedPercent}>%</Text>
                            </View>
                        </View>
                    )}
                </View>

                {report.confidence < 0.8 && (
                    <Text style={styles.confidenceWarning}>⚠️ Video de baja claridad ({Math.round(report.confidence * 100)}% fiabilidad)</Text>
                )}

                {report.flags.includes('POOR_ORIENTATION') && (
                    <Text style={styles.orientationWarning}>⚠️ Video filmado del lado opuesto que afecta análisis</Text>
                )}
            </View>

            {/* Findings / Issues */}
            <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>Áreas de Mejora</Text>
                    {onFlagsChange && (
                        <TouchableOpacity
                            style={styles.addFlagBtn}
                            onPress={() => {
                                // Simple add: find first flag not in active list
                                const allPossible: RuleFlag[] = [
                                    'POOR_FOOT_ORIENTATION', 'POOR_SHOULDER_ALIGNMENT',
                                    'INSUFFICIENT_KNEE_BEND', 'POOR_TROPHY_POSITION',
                                    'T_REX_ARM_CONTACT', 'EARLY_ARM_DROP',
                                    'POOR_FOLLOW_THROUGH'
                                ];
                                const next = allPossible.find(f => !report.flags.includes(f));
                                if (next) onFlagsChange([...report.flags, next]);
                            }}
                        >
                            <Ionicons name="add-circle-outline" size={20} color="#CCFF00" />
                            <Text style={styles.addFlagText}>Agregar</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {report.flags.length > 0 ? (
                    report.flags.map((flag, index) => {
                        const translation = FLAG_DICTIONARY[flag];
                        if (!translation) return null;

                        return (
                            <View key={index} style={styles.issueCard}>
                                <View style={[styles.issueIcon, { backgroundColor: translation.type === 'error' ? '#FF4444' : '#FFD700' }]} />
                                <View style={styles.issueTexts}>
                                    <Text style={styles.issueTitle}>{translation.title}</Text>
                                    <Text style={styles.issueDetail}>{translation.subtitle}</Text>
                                </View>
                                {onFlagsChange && (
                                    <TouchableOpacity
                                        style={styles.removeFlagBtn}
                                        onPress={() => onFlagsChange(report.flags.filter((_, i) => i !== index))}
                                    >
                                        <Ionicons name="trash-outline" size={20} color="#666" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        );
                    })
                ) : (
                    <View style={styles.perfectCard}>
                        <Text style={styles.perfectText}>🌟 ¡Técnica Ejecutada Puramente! 🌟</Text>
                        <Text style={styles.perfectSub}>No se han detectado errores biomecánicos graves en el saque.</Text>
                    </View>
                )}
            </View>

            {/* Sub Metrics Breakdown */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Desglose de Técnica</Text>

                <MetricSection
                    label="Preparación"
                    value={report.categoryScores?.preparation ?? 0}
                    weight={CATEGORY_WEIGHTS.preparation * 100}
                >
                    <SubMetricRow
                        label="Orientación de Hombros"
                        value={report.detailedMetrics?.shoulderOrientationScore ?? 0}
                    />
                    <SubMetricRow
                        label="Posición de Pies"
                        value={report.detailedMetrics?.footOrientationScore ?? 0}
                    />
                </MetricSection>

                <MetricSection
                    label="Fase de Armado (Trophy)"
                    value={report.categoryScores?.trophy ?? 0}
                    weight={CATEGORY_WEIGHTS.trophy * 100}
                >
                    <SubMetricRow
                        label="Flexión de Rodilla"
                        value={report.detailedMetrics?.kneeFlexionScore ?? 0}
                    />
                    <SubMetricRow
                        label="Torsión de Hombros"
                        value={report.detailedMetrics?.shoulderRotationScore ?? 0}
                    />
                </MetricSection>

                <MetricSection
                    label="Punto de Impacto"
                    value={report.categoryScores?.contact ?? 0}
                    weight={CATEGORY_WEIGHTS.contact * 100}
                >
                    <SubMetricRow
                        label="Extensión del Brazo"
                        value={report.detailedMetrics?.elbowExtensionScore ?? 0}
                    />
                </MetricSection>

                <MetricSection
                    label="Transferencia de Energía"
                    value={report.categoryScores?.energyTransfer ?? 0}
                    weight={CATEGORY_WEIGHTS.energyTransfer * 100}
                >
                    <SubMetricRow
                        label="Explosividad (Impulso)"
                        value={report.detailedMetrics?.energyTransferScore ?? 0}
                    />
                </MetricSection>

                <MetricSection
                    label="Terminación"
                    value={report.categoryScores?.followThrough ?? 0}
                    weight={CATEGORY_WEIGHTS.followThrough * 100}
                >
                    <SubMetricRow label="Recorrido Completo" value={report.categoryScores?.followThrough ?? 0} />
                </MetricSection>
            </View>

        </ScrollView>
    );
};

const MetricSection = ({ label, value, weight, children }: { label: string, value: number, weight: number, children: React.ReactNode }) => (
    <View style={styles.metricSectionCard}>
        <View style={styles.metricHeader}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                <Text style={styles.metricLabel}>{label}</Text>
                <Text style={styles.inlineWeightLabel}>- Peso {weight}%</Text>
            </View>
            <Text style={styles.metricValue}>{Math.round(value)}%</Text>
        </View>
        <View style={styles.subMetricsContainer}>
            {children}
        </View>
    </View>
);

const SubMetricRow = ({ label, value, reference }: { label: string, value: number, reference?: string }) => (
    <View style={styles.subMetricRow}>
        <View style={{ flex: 1 }}>
            <Text style={styles.subMetricLabel}>{label}</Text>
            {reference && <Text style={styles.subMetricReference}>{reference}</Text>}
        </View>
        <View style={styles.subMetricValueContainer}>
            <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${value}%`, backgroundColor: value > 80 ? '#CCFF00' : value > 50 ? '#FFD700' : '#FF4444' }]} />
            </View>
            <Text style={styles.subMetricValueText}>{Math.round(value)}%</Text>
        </View>
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212', // Dark background for premium feel
    },
    content: {
        padding: 20,
        paddingBottom: 60,
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
    sectionTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
        letterSpacing: 0.5,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
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
});
