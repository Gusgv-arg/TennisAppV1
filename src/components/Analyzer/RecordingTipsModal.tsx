import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface RecordingTipsModalProps {
    visible: boolean;
    onClose: () => void;
}

export const RecordingTipsModal: React.FC<RecordingTipsModalProps> = ({ visible, onClose }) => {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Ionicons name="videocam" size={24} color="#CCFF00" />
                        <Text style={styles.title}>Tips para un Análisis Perfecto</Text>
                    </View>

                    <ScrollView style={styles.body}>
                        <TipItem
                            icon="resize"
                            title="Distancia Ideal"
                            description="Debes ver al alumno de pies a cabeza."
                        />
                        <TipItem
                            icon="git-commit"
                            title="Altura de Cámara"
                            description="Graba desde una altura normal. No grabes desde el suelo."
                        />
                        <TipItem
                            icon="swap-horizontal"
                            title="Lado del Jugador"
                            description="Graba desde el perfil derecho si es Diestro, o el perfil izquierdo si es Zurdo."
                        />
                        <TipItem
                            icon="sunny"
                            title="Buena Iluminación"
                            description="Evita sombras fuertes o contraluz que oculten las articulaciones."
                        />
                    </ScrollView>

                    <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                        <Text style={styles.closeBtnText}>Entendido</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const TipItem = ({ icon, title, description }: { icon: any, title: string, description: string }) => (
    <View style={styles.tipItem}>
        <View style={styles.iconWrapper}>
            <Ionicons name={icon} size={22} color="#CCFF00" />
        </View>
        <View style={styles.tipTexts}>
            <Text style={styles.tipTitle}>{title}</Text>
            <Text style={styles.tipDescription}>{description}</Text>
        </View>
    </View>
);

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    content: {
        backgroundColor: '#1E1E1E',
        borderRadius: 20,
        width: '100%',
        maxWidth: 400,
        padding: 24,
        borderWidth: 1,
        borderColor: '#333',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
        gap: 12,
    },
    title: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
    },
    body: {
        marginBottom: 24,
    },
    tipItem: {
        flexDirection: 'row',
        marginBottom: 20,
        gap: 16,
    },
    iconWrapper: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(204, 255, 0, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    tipTexts: {
        flex: 1,
    },
    tipTitle: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    tipDescription: {
        color: '#AAA',
        fontSize: 14,
        lineHeight: 20,
    },
    closeBtn: {
        backgroundColor: '#CCFF00',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    closeBtnText: {
        color: '#000',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
