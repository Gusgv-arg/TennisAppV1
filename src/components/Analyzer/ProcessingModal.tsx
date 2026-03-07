import React from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, useWindowDimensions, View } from 'react-native';



interface ProcessingModalProps {
    visible: boolean;
    // Opcional: Puede venir en porcentaje (0-100) si se lo sabemos, sino gira infinito
    percentCompleted?: number;
    statusText?: string;
}

export const ProcessingModal: React.FC<ProcessingModalProps> = ({
    visible,
    percentCompleted = -1,
    statusText = "Analizando tu saque con IA..."
}) => {
    const { width } = useWindowDimensions();


    // Si la tubería envía -1, significa "Cargando, no sé cuanto falta"
    const showsPercentage = percentCompleted >= 0;

    return (
        <Modal
            transparent
            animationType="fade"
            visible={visible}
            onRequestClose={() => { }} // Prevenir cerrar al apretar Atrás (Hard back) durante IA
        >
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

                    <Text style={styles.subText}>{statusText}</Text>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
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
    }
});
