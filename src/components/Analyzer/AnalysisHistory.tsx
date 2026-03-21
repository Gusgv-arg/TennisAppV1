import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Platform,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ScrollView,
    useWindowDimensions
} from 'react-native';
import { useMemo } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { deleteAnalysis, getPlayerAnalyses } from '../../services/api/analysisApi';
import { FLAG_DICTIONARY } from '../../services/PoseAnalysis/flags';
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

    const { width } = useWindowDimensions();
    const gap = 16;
    const padding = 32;
    const minItemWidth = 320;
    const availableWidth = width - padding;
    const calculatedColumns = Math.max(1, Math.floor((availableWidth + gap) / (minItemWidth + gap)));
    const numColumns = Math.min(calculatedColumns, 3);
    const itemWidth = numColumns > 1 ? (availableWidth - (gap * (numColumns - 1))) / numColumns : (width - padding);

    const [selectedFilter, setSelectedFilter] = useState('Todos');

    const filteredAnalyses = useMemo(() => {
        if (selectedFilter === 'Todos') return analyses;
        const strokeNameMap: Record<string, string> = {
            'serve': 'Saque',
            'drive': 'Drive',
            'backhand': 'Revés',
            'volley': 'Volea',
            'smash': 'Smash'
        };
        return analyses.filter(a => {
            const dbStroke = (a.stroke_type || 'serve').toLowerCase();
            const label = strokeNameMap[dbStroke] || dbStroke;
            return label.toLowerCase() === selectedFilter.toLowerCase();
        });
    }, [analyses, selectedFilter]);

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

    const handleShare = async (item: any) => {
        try {
            const date = new Date(item.created_at);
            const initialScoreValue = item.metrics?.finalScore || 0;
            const categoryScores = item.metrics?.categoryScores || {};

            // Build summary
            const dateStr = new Date(item.created_at).toLocaleDateString();
            const strokeNameMap: Record<string, string> = {
                'serve': 'Saque',
                'drive': 'Drive',
                'backhand': 'Revés',
                'volley': 'Volea',
                'smash': 'Smash'
            };
            const strokeTypeDb = (item.stroke_type || 'serve').toLowerCase();
            const strokeString = strokeNameMap[strokeTypeDb] || strokeTypeDb;
            let summary = `🎾 *Análisis de ${strokeString} - ${dateStr}*\n\n`;

            const score = Math.round(initialScoreValue);
            summary += `📊 *Puntuación Global: ${score}%*\n\n`;

            summary += `*Desglose:* \n`;
            if (categoryScores.preparacion !== undefined) summary += `• Preparación: ${Math.round(categoryScores.preparacion)}%\n`;
            if (categoryScores.armado !== undefined) summary += `• Armado: ${Math.round(categoryScores.armado)}%\n`;
            if (categoryScores.impacto !== undefined) summary += `• Impacto: ${Math.round(categoryScores.impacto)}%\n`;
            if (categoryScores.terminacion !== undefined) summary += `• Terminación: ${Math.round(categoryScores.terminacion)}%\n`;
            // Retrocompatibilidad: si el registro tiene el formato viejo, mostrar esos
            if (categoryScores.preparation !== undefined && categoryScores.preparacion === undefined) {
                summary += `• Preparación: ${Math.round(categoryScores.preparation)}%\n`;
                if (categoryScores.trophy !== undefined) summary += `• Trophy: ${Math.round(categoryScores.trophy)}%\n`;
                if (categoryScores.contact !== undefined) summary += `• Contacto: ${Math.round(categoryScores.contact)}%\n`;
                if (categoryScores.followThrough !== undefined) summary += `• Terminación: ${Math.round(categoryScores.followThrough)}%\n`;
            }

            // Agregar áreas de mejora (flags)
            const flags = (item.ai_feedback?.flags || item.flags || []) as any[];
            if (flags.length > 0) {
                summary += `\n🎯 *Áreas de Mejora:*\n`;
                flags.forEach(flag => {
                    const translation = FLAG_DICTIONARY[flag as keyof typeof FLAG_DICTIONARY];
                    if (translation) {
                        summary += `• ${translation.title}\n`;
                    }
                });
            }

            if (item.coach_feedback) {
                summary += `\n💬 *Feedback del Coach:* ${item.coach_feedback}\n`;
            }

            const url = `https://app.tenis-lab.com/v/${item.video_id}`;
            const appUrl = `https://app.tenis-lab.com/login`;
            summary += `\n🔗 *Ver este análisis:* ${url}\n📲 *O accedé a la App para ver tu historial completo:* ${appUrl}\n\n¡A seguir mejorando! 💪`;

            if (Platform.OS === 'web') {
                const isMobileWeb = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

                if (navigator.share && isMobileWeb) {
                    await navigator.share({
                        title: `Análisis de ${strokeString} - ${dateStr}`,
                        text: summary
                    });
                } else {
                    // Fallback para Desktop o si navigator.share falla
                    await navigator.clipboard.writeText(summary);
                    showSuccess("Copiado", "Resumen copiado para compartir.");

                    // Abrir WhatsApp Web directamente (Desktop version)
                    const waUrl = `https://web.whatsapp.com/send?text=${encodeURIComponent(summary)}`;
                    window.open(waUrl, '_blank');
                }
            } else {
                await Share.share({
                    message: summary,
                    title: `Análisis de ${strokeString} - ${dateStr}`
                });
            }
        } catch (error: any) {
            console.error("Error sharing analysis:", error);
            showError("Error", "No se pudo compartir el informe.");
        }
    };

    useEffect(() => {
        loadAnalyses();
    }, [playerId]);

    const renderItem = ({ item }: { item: any }) => {
        const date = new Date(item.created_at);
        const score = item.metrics?.finalScore || 0;

        const strokeNameMap: Record<string, string> = {
            'serve': 'SAQUE',
            'drive': 'DRIVE',
            'backhand': 'REVÉS',
            'volley': 'VOLEA',
            'smash': 'SMASH'
        };
        const strokeTypeDb = (item.stroke_type || 'serve').toLowerCase();
        const strokeLabel = strokeNameMap[strokeTypeDb] || strokeTypeDb.toUpperCase();

        return (
            <View style={[styles.card, { width: itemWidth, backgroundColor: theme.background.surface, borderColor: theme.border.default, marginBottom: numColumns > 1 ? 0 : 16 }]}>
                <View style={styles.cardHeader}>
                    <View style={styles.typeBadge}>
                        <Text style={styles.typeText}>{strokeLabel}</Text>
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

                    <TouchableOpacity
                        onPress={() => handleShare(item)}
                        style={styles.iconBtn}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="share-social-outline" size={22} color={theme.status.warning} />
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



    const strokeFilters = ['Todos', 'Saque', 'Drive', 'Revés', 'Volea', 'Smash'];

    return (
        <View style={{ flex: 1 }}>
            <View style={{ paddingTop: 16, paddingBottom: 8 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
                    {strokeFilters.map(filter => (
                        <TouchableOpacity
                            key={filter}
                            onPress={() => setSelectedFilter(filter)}
                            style={{
                                paddingHorizontal: 16,
                                paddingVertical: 8,
                                borderRadius: 20,
                                backgroundColor: selectedFilter === filter ? theme.components.button.primary.bg : theme.background.surface,
                                borderWidth: 1,
                                borderColor: selectedFilter === filter ? theme.components.button.primary.bg : theme.border.default
                            }}
                        >
                            <Text style={{
                                color: selectedFilter === filter ? '#FFF' : theme.text.primary,
                                fontWeight: '600',
                                fontSize: 13
                            }}>{filter}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <FlatList
                key={numColumns}
                data={filteredAnalyses}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                numColumns={numColumns}
                columnWrapperStyle={numColumns > 1 ? { gap } : undefined}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                onRefresh={loadAnalyses}
                refreshing={loading}
                ListEmptyComponent={
                    <View style={{ alignItems: 'center', marginTop: 80, marginHorizontal: 20 }}>
                        <Ionicons name="analytics-outline" size={64} color={theme.text.tertiary} />
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text.secondary, marginTop: 16, textTransform: 'none' }}>
                            {selectedFilter === 'Todos' ? 'Aún no hay análisis' : `Sin análisis de ${selectedFilter}`}
                        </Text>
                        <Text style={{ fontSize: 14, color: theme.text.tertiary, marginTop: 8, textAlign: 'center', maxWidth: 300, lineHeight: 20 }}>
                            {selectedFilter === 'Todos' ? 'Los informes biomecánicos que guardes aparecerán aquí automáticamente.' : `No encontramos informes biomecánicos tuyos de ${selectedFilter}.`}
                        </Text>
                    </View>
                }
            />

            {selectedAnalysis && (
                <AnalysisModal
                    key={selectedAnalysis.id}
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
                        strokeType: (selectedAnalysis.stroke_type?.toUpperCase() || 'SERVE') as any,
                        finalScore: selectedAnalysis.metrics.finalScore,
                        confidence: selectedAnalysis.metrics.confidence,
                        categoryScores: selectedAnalysis.metrics.categoryScores || {
                            preparacion: selectedAnalysis.metrics.preparacion || 0,
                            armado: selectedAnalysis.metrics.armado || 0,
                            impacto: selectedAnalysis.metrics.impacto || 0,
                            terminacion: selectedAnalysis.metrics.terminacion || 0,
                        },
                        detailedMetrics: selectedAnalysis.metrics.detailedMetrics || {
                            footOrientationScore: 0,
                            kneeFlexionScore: 0,
                            trophyPositionScore: 0,
                            heelLiftScore: 0,
                            followThroughScore: 0
                        },
                        flags: selectedAnalysis.ai_feedback?.flags || [],
                        flagMetadata: selectedAnalysis.ai_feedback?.flagMetadata || {},
                        keyframes: selectedAnalysis.ai_feedback?.keyframes || {},
                        ai_feedback: selectedAnalysis.ai_feedback, // Pass the whole thing
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
        gap: 16,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
        width: '100%',
        paddingBottom: 40, // Pull up the content slightly to counteract the tall header
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
        marginTop: 12,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: 14,
        textAlign: 'center',
        marginTop: 4,
        lineHeight: 20,
        opacity: 0.8,
    },
});
