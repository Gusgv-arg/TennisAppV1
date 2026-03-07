import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { deleteAnalysis, getPlayerAnalyses } from '../../services/api/analysisApi';
import { supabase } from '../../services/supabaseClient';
import { useAuthStore } from '../../store/useAuthStore';
import { showError, showSuccess } from '../../utils/toast';
import StatusModal from '../StatusModal';
import { AnalysisModal } from './AnalysisModal';

interface AnalysisHistoryProps {
    playerId: string;
}

export const AnalysisHistory: React.FC<AnalysisHistoryProps> = ({ playerId }) => {
    const { theme } = useTheme();
    const { profile } = useAuthStore();
    const [analyses, setAnalyses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAnalysis, setSelectedAnalysis] = useState<any | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    const [isActionLoading, setIsActionLoading] = useState(false);
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [analysisToDelete, setAnalysisToDelete] = useState<string | null>(null);

    const canManageAnalyses = (profile?.role as any) === 'coach' ||
        (profile?.role as any) === 'academy_admin' ||
        (profile?.role as any) === 'super_admin';

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

    const handleDelete = (id: string) => {
        setAnalysisToDelete(id);
        setDeleteConfirmVisible(true);
    };

    const confirmDelete = async () => {
        if (!analysisToDelete) return;

        try {
            setIsActionLoading(true);
            setDeleteConfirmVisible(false);
            await deleteAnalysis(analysisToDelete);
            showSuccess("Eliminado", "El análisis ha sido eliminado correctamente.");
            loadAnalyses();
        } catch (e: any) {
            showError("Error al eliminar", e.message);
        } finally {
            setIsActionLoading(false);
            setAnalysisToDelete(null);
        }
    };

    const handleEdit = (item: any) => {
        setIsEditing(true);
        setSelectedAnalysis(item);
        setModalVisible(true);
    };

    const handleView = (item: any) => {
        setIsEditing(false);
        setSelectedAnalysis(item);
        setModalVisible(true);
    };

    useEffect(() => {
        loadAnalyses();
    }, [playerId]);

    const renderItem = ({ item }: { item: any }) => {
        const date = new Date(item.created_at);
        const score = item.metrics?.finalScore || 0;

        return (
            <View style={[styles.card, { backgroundColor: theme.background.surface, borderColor: theme.border.default }]}>
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

                <View style={styles.footer}>
                    <TouchableOpacity
                        onPress={() => handleView(item)}
                        style={styles.iconBtn}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="eye-outline" size={22} color={theme.text.primary} />
                    </TouchableOpacity>

                    {canManageAnalyses && (
                        <>
                            <TouchableOpacity
                                onPress={() => handleEdit(item)}
                                style={styles.iconBtn}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="create-outline" size={22} color={theme.status.warning} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => handleDelete(item.id)}
                                style={styles.iconBtn}
                                disabled={isActionLoading}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="trash-outline" size={22} color={theme.status.error} />
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>
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
        <View style={{ flex: 1 }}>
            <FlatList
                data={analyses}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                onRefresh={loadAnalyses}
                refreshing={loading}
            />

            {selectedAnalysis && (
                <AnalysisModal
                    visible={modalVisible}
                    videoUri={selectedAnalysis.video?.storage_path ?
                        supabase.storage.from('videos').getPublicUrl(selectedAnalysis.video.storage_path).data.publicUrl :
                        null
                    }
                    videoId={selectedAnalysis.video_id}
                    playerId={playerId}
                    coachId={selectedAnalysis.coach_id}
                    reportId={selectedAnalysis.id}
                    readOnly={!isEditing}
                    initialReport={selectedAnalysis.metrics ? {
                        finalScore: selectedAnalysis.metrics.finalScore,
                        confidence: selectedAnalysis.metrics.confidence,
                        categoryScores: selectedAnalysis.metrics.categoryScores || {
                            preparation: selectedAnalysis.metrics.preparation || 0,
                            trophy: selectedAnalysis.metrics.trophy || 0,
                            contact: selectedAnalysis.metrics.contact || 0,
                            energyTransfer: selectedAnalysis.metrics.energyTransfer || 0,
                            followThrough: selectedAnalysis.metrics.followThrough || 0,
                        },
                        flags: selectedAnalysis.ai_feedback?.flags || [],
                        keyframes: selectedAnalysis.ai_feedback?.keyframes || {},
                        coach_feedback: selectedAnalysis.coach_feedback
                    } : null}
                    onClose={() => {
                        setModalVisible(false);
                        setSelectedAnalysis(null);
                    }}
                    onSuccess={() => {
                        loadAnalyses(); // Reload to show updated notes/scores
                    }}
                />
            )}

            <StatusModal
                visible={deleteConfirmVisible}
                type="danger"
                title="Eliminar Análisis"
                message="¿Estás seguro de que deseas eliminar este informe biomecánico? Esta acción no se puede deshacer."
                showCancel
                cancelText="Cancelar"
                buttonText="Eliminar"
                onClose={() => setDeleteConfirmVisible(false)}
                onConfirm={confirmDelete}
            />
        </View>
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
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    actionIcons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    iconBtn: {
        padding: 4,
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
        paddingBottom: 4, // Reducir espacio abajo
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
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: 12,
        paddingTop: 8,
        paddingBottom: 8,
        gap: 20, // Espacio generoso entre iconos
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
