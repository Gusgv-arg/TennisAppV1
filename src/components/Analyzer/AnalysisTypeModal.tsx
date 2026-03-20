import { useTheme } from '@/src/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

export type AnalysisMode = 'ai' | 'manual';

interface AnalysisTypeModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (mode: AnalysisMode) => void;
}

export const AnalysisTypeModal: React.FC<AnalysisTypeModalProps> = ({
    visible,
    onClose,
    onSelect
}) => {
    const { theme } = useTheme();

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
            <Animated.View
                entering={Platform.OS === 'web' ? undefined : FadeIn}
                exiting={Platform.OS === 'web' ? undefined : FadeOut}
                style={[styles.overlay, { backgroundColor: theme.background.backdrop }]}
            >
                <Animated.View
                    entering={Platform.OS === 'web' ? undefined : ZoomIn}
                    style={[
                        styles.container,
                        {
                            backgroundColor: theme.background.surface,
                            shadowColor: '#000',
                        }
                    ]}
                >
                    <TouchableOpacity
                        style={styles.closeIcon}
                        onPress={onClose}
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    >
                        <Ionicons name="close" size={24} color={theme.text.secondary} />
                    </TouchableOpacity>

                    <Text style={[styles.title, { color: theme.text.primary }]}>Tipo de Análisis</Text>
                    <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
                        Elige cómo deseas evaluar este video.
                    </Text>

                    <TouchableOpacity
                        style={[styles.optionCard, { borderColor: theme.border.default, backgroundColor: theme.background.subtle }]}
                        onPress={() => onSelect('ai')}
                        activeOpacity={0.8}
                    >
                        <View style={styles.optionIconContainer}>
                            <Ionicons name="sparkles" size={28} color="#FFD700" />
                        </View>
                        <View style={styles.optionTexts}>
                            <Text style={[styles.optionTitle, { color: theme.text.primary }]}>Análisis con IA</Text>
                            <Text style={[styles.optionDescription, { color: theme.text.secondary }]}>
                                Para ayudarte la IA analizará el movimiento biomecánico. Al terminar podrás editar los resultados y agregar notas.
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={theme.text.secondary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.optionCard, { borderColor: theme.border.default, backgroundColor: theme.background.subtle, marginTop: 12 }]}
                        onPress={() => onSelect('manual')}
                        activeOpacity={0.8}
                    >
                        <View style={[styles.optionIconContainer, { backgroundColor: 'rgba(150, 150, 150, 0.1)' }]}>
                            <Ionicons name="create-outline" size={28} color={theme.text.primary} />
                        </View>
                        <View style={styles.optionTexts}>
                            <Text style={[styles.optionTitle, { color: theme.text.primary }]}>Análisis Manual</Text>
                            <Text style={[styles.optionDescription, { color: theme.text.secondary }]}>
                                Abre la plantilla en blanco para que evalúes el movimiento y agregues notas bajo tu propio criterio.
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={theme.text.secondary} />
                    </TouchableOpacity>

                </Animated.View>
            </Animated.View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    container: {
        borderRadius: 20,
        padding: 24,
        paddingTop: 32,
        width: '100%',
        maxWidth: 400,
        alignItems: 'center',
        elevation: 5,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    closeIcon: {
        position: 'absolute',
        top: 15,
        right: 15,
        zIndex: 10,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 15,
        textAlign: 'center',
        marginBottom: 24,
    },
    optionCard: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
    },
    optionIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 215, 0, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    optionTexts: {
        flex: 1,
        paddingRight: 8,
    },
    optionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    optionDescription: {
        fontSize: 13,
        lineHeight: 18,
    }
});
