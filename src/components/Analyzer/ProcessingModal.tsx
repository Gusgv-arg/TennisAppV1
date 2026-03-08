import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';



interface ProcessingModalProps {
    visible: boolean;
    // Opcional: Puede venir en porcentaje (0-100) si se lo sabemos, sino gira infinito
    percentCompleted?: number;
    statusText?: string;
    isWarning?: boolean;
    onCancel?: () => void;
}

export const ProcessingModal: React.FC<ProcessingModalProps> = ({
    visible,
    percentCompleted = -1,
    statusText = "Analizando tu saque con IA...",
    isWarning = false,
    onCancel
}) => {
    if (!visible) return null;

    // Si la tubería envía -1, significa "Cargando, no sé cuanto falta"
    const showsPercentage = percentCompleted >= 0;

    return (
        <View style={styles.overlay}>
            <View style={styles.card}>

                {showsPercentage ? (
                    <>
                        <Text style={styles.title}>Evaluando Biomecánica</Text>
                        <View style={styles.progressBarContainer}>
                            <View style={[styles.progressBarFill, { width: `${percentCompleted}%` }]} />
                        </View>
                        <Text style={styles.percentageText}>{percentCompleted}% Completado</Text>
                    </>
                ) : (
                    <>
                        <ActivityIndicator size="large" color="#4CAF50" />
                        <Text style={styles.title}>Analizando Video...</Text>
                    </>
                )}

                <View style={[isWarning && styles.warningContainer]}>
                    <Text style={[styles.subText, isWarning && styles.warningText]}>
                        {isWarning ? `⚠️ ${statusText}` : statusText}
                    </Text>
                </View>

                {onCancel && (
                    <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={onCancel}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.cancelButtonText}>Cancelar Análisis</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    card: {
        width: 350, // Fixed width for standard loading card appearance
        maxWidth: '85%',
        backgroundColor: '#1E1E1E', // Dark Mode native
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#333',
    },
    title: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 12,
        marginBottom: 4,
    },
    subText: {
        color: '#A0A0A0',
        fontSize: 14,
        textAlign: 'center',
        marginTop: 12,
    },
    percentageText: {
        color: '#4CAF50',
        fontSize: 24,
        fontWeight: '900',
        marginTop: 10,
    },
    progressBarContainer: {
        width: '100%',
        height: 8,
        backgroundColor: '#333',
        borderRadius: 4,
        overflow: 'hidden',
        marginTop: 16,
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#4CAF50',
    },
    warningText: {
        color: '#FFD54F',
        fontWeight: 'bold',
    },
    warningContainer: {
        backgroundColor: 'rgba(255, 179, 0, 0.15)',
        padding: 10,
        borderRadius: 8,
        marginTop: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 179, 0, 0.3)',
    },
    cancelButton: {
        marginTop: 24,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 68, 68, 0.1)',
        borderWidth: 1,
        borderColor: '#FF4444',
    },
    cancelButtonText: {
        color: '#FF4444',
        fontSize: 14,
        fontWeight: '600',
    }
});
