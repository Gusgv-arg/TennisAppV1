import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';



interface ProcessingModalProps {
    visible: boolean;
    // Opcional: Puede venir en porcentaje (0-100) si se lo sabemos, sino gira infinito
    percentCompleted?: number;
    title?: string;
    statusText?: string;
    isWarning?: boolean;
    onCancel?: () => void;
}

export const ProcessingModal: React.FC<ProcessingModalProps> = ({
    visible,
    percentCompleted = -1,
    title = "Evaluando Biomecánica",
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
                        <Text style={styles.title}>{title}</Text>
                        <View style={styles.progressBarContainer}>
                            <View style={[styles.progressBarFill, { width: `${Math.floor(percentCompleted)}%` }]} />
                        </View>
                        <Text style={styles.percentageText}>{Math.floor(percentCompleted)}% Completado</Text>
                    </>
                ) : (
                    <>
                        <ActivityIndicator size="large" color="#4CAF50" />
                        <Text style={styles.title}>Analizando Video...</Text>
                    </>
                )}

                {/* Contenedor de estado con altura estable para evitar parpadeos de layout */}
                <View style={styles.statusContainer}>
                    <View style={[isWarning && styles.warningContainer, { width: '100%', justifyContent: 'center' }]}>
                        <Text style={[styles.subText, isWarning && styles.warningText]}>
                            {isWarning ? `⚠️ ${statusText}` : statusText}
                        </Text>
                    </View>
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
        backgroundColor: '#000', // Telón opaco para transición premium
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    card: {
        width: 350, // Fixed width for standard loading card appearance
        minHeight: 240, // Altura mínima fija para evitar "parpadeos" de layout (Root cause)
        maxWidth: '85%',
        backgroundColor: '#1E1E1E', // Dark Mode native
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center', // Centrado interno estable
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
        lineHeight: 20,
        textAlign: 'center',
        marginTop: 12,
    },
    percentageText: {
        color: '#4CAF50',
        fontSize: 24,
        fontWeight: '900',
        marginTop: 10,
        minWidth: 60, // Ancho estable para el número
        textAlign: 'center',
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
        marginTop: 0, // Reset margin when inside warningContainer to keep it centered
    },
    warningContainer: {
        backgroundColor: 'rgba(255, 179, 0, 0.15)',
        padding: 12,
        borderRadius: 8,
        marginTop: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 179, 0, 0.3)',
        justifyContent: 'center', // Justificación vertical
        minHeight: 60, // Altura mínima para asegurar presencia visual
    },
    statusContainer: {
        minHeight: 60, // Espacio reservado para 2-3 líneas de texto sin saltos
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        marginTop: 8,
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
