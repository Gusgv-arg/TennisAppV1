import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Platform,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { deleteAnalysis, getPlayerAnalyses } from '../../services/api/analysisApi';
import { FLAG_DICTIONARY } from '../../services/PoseAnalysis/flags';
import { supabase } from '../../services/supabaseClient';
import { useAuthStore } from '../../store/useAuthStore';
import { showError, showSuccess } from '../../utils/toast';
import StatusModal from '../StatusModal';
import { AnalysisModal } from './AnalysisModal';
import { useShare } from '../../hooks/useShare';
import ShareModal from '../ShareModal';

interface AnalysisHistoryProps {
    playerId: string;
    isStudentView?: boolean;
}

export const AnalysisHistory: React.FC<AnalysisHistoryProps> = ({ playerId, isStudentView = false }) => {
    const { theme } = useTheme();
    const { profile } = useAuthStore();
    const [analyses, setAnalyses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAnalysis, setSelectedAnalysis] = useState<any | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    const { width: windowWidth } = useWindowDimensions();
    const [containerWidth, setContainerWidth] = useState(0);

    const onLayout = (event: any) => {
        const { width } = event.nativeEvent.layout;
        if (width > 0 && Math.abs(width - containerWidth) > 10) {
            setContainerWidth(width);
        }
    };

    const gap = 16; // Sinconizado a 16px
    const padding = 32; // 16px on each side to match the pills row exactly
    const isModalContext = isStudentView ? (containerWidth < 800) : true;
    const minItemWidth = 200;
    
    // Fallback: On desktop, the coach modal content is almost exactly 500px wide
    const defaultWidth = isStudentView ? windowWidth : (windowWidth > 800 ? 550 : windowWidth);
    const currentWidth = containerWidth > 0 ? containerWidth : defaultWidth;
    
    const availableWidth = Math.max(0, currentWidth - padding - 8); // Added 8px safety buffer
    const calculatedColumns = Math.max(1, Math.floor((availableWidth + gap) / (minItemWidth + gap)));
    const numColumns = isStudentView ? Math.min(calculatedColumns, 4) : Math.min(calculatedColumns, 2); 
    // Manual itemWidth calculation removed in favor of flex: 1

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

    const {
        isModalVisible: shareModalVisible,
        setIsModalVisible: setShareModalVisible,
        handleSharePress,
        performWhatsAppShare,
        performCopyLink,
        performNativeShare
    } = useShare();

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

    const handleShare = (item: any) => {
        handleSharePress('analysis', item);
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
            <View style={[
                styles.card, 
                { 
                    flex: 1,
                    maxWidth: `${(100 / numColumns) - (numColumns > 1 ? 1 : 0)}%`, // Dynamic maxWidth based on columns
                    backgroundColor: theme.background.surface, 
                    borderColor: theme.border.default, 
                    marginBottom: numColumns > 1 ? 0 : 16 
                }
            ]}>
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
                        <Ionicons name="eye-outline" size={18} color={theme.text.primary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => handleShare(item)}
                        style={styles.iconBtn}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="share-social-outline" size={18} color={theme.status.warning} />
                    </TouchableOpacity>

                    {canManageAnalyses && (
                        <>
                            <TouchableOpacity
                                onPress={() => handleEdit(item)}
                                style={styles.iconBtn}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="create-outline" size={18} color={theme.status.warning} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => handleDelete(item.id)}
                                style={styles.iconBtn}
                                disabled={isActionLoading}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="trash-outline" size={18} color={theme.status.error} />
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
        <View style={{ flex: 1 }} onLayout={onLayout}>
            <View style={{ height: 48, marginTop: isModalContext ? 16 : 12, marginBottom: isModalContext ? 12 : 8 }}>
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ 
                        paddingHorizontal: 16,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12
                    }}
                >
                    {strokeFilters.map(filter => (
                        <TouchableOpacity
                            key={filter}
                            onPress={() => setSelectedFilter(filter)}
                            style={{
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                borderRadius: 20,
                                backgroundColor: selectedFilter === filter ? theme.components.button.primary.bg : theme.background.surface,
                                borderWidth: 1,
                                borderColor: selectedFilter === filter ? theme.components.button.primary.bg : theme.border.default,
                                minWidth: 55,
                                alignItems: 'center'
                            }}
                        >
                            <Text style={{
                                color: selectedFilter === filter ? '#FFF' : theme.text.primary,
                                fontWeight: '600',
                                fontSize: 12
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
                columnWrapperStyle={numColumns > 1 ? { gap, justifyContent: 'space-between' } : undefined}
                contentContainerStyle={[
                    styles.listContent,
                    filteredAnalyses.length === 0 && { flexGrow: 1, justifyContent: 'center' }
                ]}
                showsVerticalScrollIndicator={false}
                onRefresh={loadAnalyses}
                refreshing={loading}
                ListEmptyComponent={
                    <View style={{ alignItems: 'center', marginHorizontal: 20 }}>
                        <Ionicons name="bar-chart-outline" size={64} color={theme.text.tertiary} />
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
                        indicatorMetadata: selectedAnalysis.metrics.indicatorMetadata || {},
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

            <ShareModal
                visible={shareModalVisible}
                onClose={() => setShareModalVisible(false)}
                onWhatsApp={performWhatsAppShare}
                onCopy={performCopyLink}
                onOther={performNativeShare}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 40,
        gap: 16, 
        paddingTop: 8, // Added small top padding to replace the pills bottom padding
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
        gap: 12, // More compact icons
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
