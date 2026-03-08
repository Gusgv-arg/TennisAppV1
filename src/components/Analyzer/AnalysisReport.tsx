import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { RuleFlag, ServeAnalysisReport } from '../../services/PoseAnalysis/types';

// Diccionario de humanos: Traduce las constantes técnicas a Feedback comprensible y sugerencias prácticas.
const FLAG_DICTIONARY: Record<RuleFlag, { title: string, subtitle: string, type: 'error' | 'warning' }> = {
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
    'POOR_ORIENTATION': {
        title: 'Ángulo de Cámara No Óptimo',
        subtitle: 'Filmado desde el perfil opuesto. Los puntajes pueden ser menos precisos debido a la perspectiva.',
        type: 'warning'
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
}

export const AnalysisReport: React.FC<AnalysisReportProps> = ({
    report,
    editableValues,
    onValueChange
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
            </View>

            {/* Findings / Issues */}
            {report.flags.length > 0 ? (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Áreas de Mejora</Text>
                    {report.flags.map((flag, index) => {
                        const translation = FLAG_DICTIONARY[flag];
                        if (!translation) return null;

                        return (
                            <View key={index} style={styles.issueCard}>
                                <View style={[styles.issueIcon, { backgroundColor: translation.type === 'error' ? '#FF4444' : '#FFD700' }]} />
                                <View style={styles.issueTexts}>
                                    <Text style={styles.issueTitle}>{translation.title}</Text>
                                    <Text style={styles.issueDetail}>{translation.subtitle}</Text>
                                </View>
                            </View>
                        );
                    })}
                </View>
            ) : (
                <View style={styles.perfectCard}>
                    <Text style={styles.perfectText}>🌟 ¡Técnica Ejecutada Puramente! 🌟</Text>
                    <Text style={styles.perfectSub}>No se han detectado errores biomecánicos graves en el saque.</Text>
                </View>
            )}

            {/* Sub Metrics Breakdown */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Desglose Matemático</Text>
                <MetricRow
                    label="Preparación"
                    value={report.categoryScores?.preparation ?? 0}
                    editValue={editableValues?.preparation}
                    onChange={onValueChange ? (v) => onValueChange('preparation', v) : undefined}
                />
                <MetricRow
                    label="Fase de Armado"
                    value={report.categoryScores?.trophy ?? 0}
                    editValue={editableValues?.trophy}
                    onChange={onValueChange ? (v) => onValueChange('trophy', v) : undefined}
                />
                <MetricRow
                    label="Impacto"
                    value={report.categoryScores?.contact ?? 0}
                    editValue={editableValues?.contact}
                    onChange={onValueChange ? (v) => onValueChange('contact', v) : undefined}
                />
                <MetricRow
                    label="Energía"
                    value={report.categoryScores?.energyTransfer ?? 0}
                    editValue={editableValues?.energyTransfer}
                    onChange={onValueChange ? (v) => onValueChange('energyTransfer', v) : undefined}
                />
                <MetricRow
                    label="Terminación"
                    value={report.categoryScores?.followThrough ?? 0}
                    editValue={editableValues?.followThrough}
                    onChange={onValueChange ? (v) => onValueChange('followThrough', v) : undefined}
                />
            </View>

        </ScrollView>
    );
};

const MetricRow = ({ label, value, editValue, onChange }: { label: string, value: number, editValue?: string, onChange?: (v: string) => void }) => (
    <View style={styles.metricRow}>
        <Text style={styles.metricLabel}>{label}</Text>
        <View style={styles.valueGroup}>
            <Text style={[styles.metricValue, editValue !== undefined && styles.metricValueSmall]}>{Math.round(value)}%</Text>
            {editValue !== undefined && onChange && (
                <View style={styles.inputWithPercent}>
                    <Ionicons name="arrow-forward" size={12} color="#666" style={{ marginHorizontal: 4 }} />
                    <TextInput
                        style={styles.integratedInput}
                        value={editValue}
                        onChangeText={onChange}
                        keyboardType="number-pad"
                        maxLength={3}
                    />
                    <Text style={styles.integratedPercent}>%</Text>
                </View>
            )}
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
    section: {
        marginTop: 30,
    },
    sectionTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        letterSpacing: 0.5,
    },
    issueCard: {
        flexDirection: 'row',
        backgroundColor: '#1E1E1E',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#FF4444'
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
    metricRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#1E1E1E',
        padding: 16,
        borderRadius: 8,
        marginBottom: 8,
    },
    metricLabel: {
        color: '#E0E0E0',
        fontSize: 15,
    },
    metricValue: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    metricValueSmall: {
        fontSize: 14,
        color: '#888',
        fontWeight: 'normal',
    },
    valueGroup: {
        flexDirection: 'row',
        alignItems: 'center',
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
    }
});
