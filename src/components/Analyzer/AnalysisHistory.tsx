import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { getPlayerAnalyses } from '../../services/api/analysisApi';
import { showError } from '../../utils/toast';

interface AnalysisHistoryProps {
    playerId: string;
}

export const AnalysisHistory: React.FC<AnalysisHistoryProps> = ({ playerId }) => {
    const { theme } = useTheme();
    const [analyses, setAnalyses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadAnalyses = async () => {
        try {
            setLoading(true);
            const data = await getPlayerAnalyses(playerId);
            setAnalyses(data || []);
        } catch (error: any) {
            console.error("Failed to load analyses:", error);
            const msg = error.message || error.details || "No se pudieron obtener los informes.";

            if (msg.includes('400') || msg.includes('analyses') || msg.includes('relation')) {
                showError("Error de Base de Datos", "La tabla de análisis no existe o no es accesible. ¿Corriste el SQL?");
            } else {
                showError("Error al cargar", msg);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAnalyses();
    }, [playerId]);

    const renderItem = ({ item }: { item: any }) => {
        const date = new Date(item.created_at);
        const score = item.metrics?.finalScore || 0;

        return (
            <TouchableOpacity
                style={[styles.card, { backgroundColor: theme.background.surface, borderColor: theme.border.default }]}
                onPress={() => Alert.alert("Próximamente", "La visualización detallada de informes guardados estará disponible en el siguiente paso.")}
            >
                <View style={styles.cardHeader}>
                    <View style={styles.typeBadge}>
                        <Text style={styles.typeText}>SAQUE</Text>
                    </View>
                    <Text style={[styles.dateText, { color: theme.text.tertiary }]}>
                        {new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)}
                    </Text>
                </View>

                <View style={styles.cardBody}>
                    <View style={styles.scoreContainer}>
                        <Text style={[styles.scoreLabel, { color: theme.text.secondary }]}>Puntaje</Text>
                        <Text style={[styles.scoreValue, { color: score > 70 ? theme.status.success : theme.status.warning }]}>
                            {score}%
                        </Text>
                    </View>

                    <View style={styles.infoContainer}>
                        <Text style={[styles.feedbackTitle, { color: theme.text.primary }]}>Feedback del Coach</Text>
                        <Text
                            style={[styles.feedbackText, { color: theme.text.secondary }]}
                            numberOfLines={2}
                        >
                            {item.coach_feedback || "Sin comentarios adicionales."}
                        </Text>
                    </View>
                </View>

                <View style={[styles.footer, { borderTopColor: theme.border.subtle }]}>
                    <Text style={{ color: theme.components.button.primary.bg, fontWeight: '600' }}>Ver Informe Completo</Text>
                    <Ionicons name="chevron-forward" size={16} color={theme.components.button.primary.bg} />
                </View>
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={theme.components.button.primary.bg} />
                <Text style={{ color: theme.text.secondary, marginTop: 12 }}>Buscando informes...</Text>
            </View>
        );
    }

    if (analyses.length === 0) {
        return (
            <View style={styles.center}>
                <Ionicons name="analytics-outline" size={64} color={theme.text.tertiary} />
                <Text style={[styles.emptyTitle, { color: theme.text.secondary }]}>Aún no hay análisis</Text>
                <Text style={[styles.emptySubtitle, { color: theme.text.tertiary }]}>
                    Los informes biomecánicos que guardes aparecerán aquí automáticamente.
                    {"\n\n"}Si ves errores en la consola, recuerda aplicar la migración de base de datos.
                </Text>
            </View>
        );
    }

    return (
        <FlatList
            data={analyses}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
        />
    );
};

const styles = StyleSheet.create({
    listContent: {
        padding: 16,
        paddingBottom: 40,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    card: {
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        paddingBottom: 8,
    },
    typeBadge: {
        backgroundColor: 'rgba(204, 255, 0, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    typeText: {
        color: '#CCFF00',
        fontSize: 10,
        fontWeight: 'bold',
    },
    dateText: {
        fontSize: 12,
    },
    cardBody: {
        flexDirection: 'row',
        padding: 12,
        paddingTop: 4,
        gap: 16,
    },
    scoreContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingRight: 16,
        borderRightWidth: 1,
        borderRightColor: 'rgba(255,255,255,0.05)',
    },
    scoreLabel: {
        fontSize: 10,
        textTransform: 'uppercase',
    },
    scoreValue: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    infoContainer: {
        flex: 1,
    },
    feedbackTitle: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 4,
    },
    feedbackText: {
        fontSize: 13,
        lineHeight: 18,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderTopWidth: 1,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 14,
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 20,
    },
});
