import { ServeAnalysisReport } from '../PoseAnalysis/types';
import { supabase } from '../supabaseClient';

export interface SaveAnalysisParams {
    videoId: string;
    playerId: string;
    coachId: string;
    academyId?: string;
    sessionId?: string;
    report: ServeAnalysisReport;
    coachFeedback?: string;
    fullRawFrames?: any[]; // Tracking data for skeleton replay
}

/**
 * Persiste los resultados del motor biomecánico en Supabase para que el entrenador
 * y el alumno puedan revisar el reporte histórico.
 */
export async function saveServeAnalysis(params: SaveAnalysisParams): Promise<string> {

    // Convertimos las clases y enums limpios a un JSON amigable para Postgres
    const metricsPayload = {
        finalScore: params.report.finalScore,
        confidence: params.report.confidence,
        categoryScores: params.report.categoryScores,
        detailedMetrics: params.report.detailedMetrics
    };

    const aiFeedbackPayload = {
        flags: params.report.flags,
        flagMetadata: params.report.flagMetadata,
        keyframes: params.report.keyframes, // Tiempos exactos donde ocurrió cada fase
        fullRawFrames: params.fullRawFrames || [] // Skeletons for replay
    };

    const { data, error } = await supabase
        .from('analyses')
        .insert({
            video_id: params.videoId,
            player_id: params.playerId,
            coach_id: params.coachId,
            academy_id: params.academyId || null,
            stroke_type: 'serve',
            metrics: metricsPayload,
            ai_feedback: aiFeedbackPayload,
            coach_approved: true,
            coach_feedback: params.coachFeedback || null
        })
        .select('id')
        .single();

    if (error) {
        console.error("Supabase Error saving analysis:", error);
        const msg = error.message || error.details || JSON.stringify(error);
        throw new Error(`Error al persistir el análisis: ${msg}`);
    }

    return data.id;
}

/**
 * Obtiene el historial de análisis de un alumno.
 */
export async function getPlayerAnalyses(playerId: string) {
    const { data, error } = await supabase
        .from('analyses')
        .select(`
            *,
            video:video_id (
                storage_path,
                thumbnail_path,
                created_at
            )
        `)
        .eq('player_id', playerId)
        .order('created_at', { ascending: false });

    return data;
}

/**
 * Actualiza un análisis existente. 
 * El coach tiene "poder total": puede corregir métricas, score y feedback.
 */
export async function updateAnalysis(id: string, updates: {
    metrics?: any;
    ai_feedback?: any;
    coach_feedback?: string;
    coach_approved?: boolean;
}) {
    const { data, error } = await supabase
        .from('analyses')
        .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error("Error updating analysis:", error);
        throw new Error(`No se pudo actualizar el análisis: ${error.message}`);
    }

    return data;
}

/**
 * Elimina físicamente un registro de análisis.
 */
export async function deleteAnalysis(id: string) {
    const { data, error } = await supabase
        .from('analyses')
        .delete()
        .eq('id', id)
        .select();

    if (error) {
        console.error("Error deleting analysis:", error);
        throw new Error(`Error de base de datos: ${error.message}`);
    }

    if (!data || data.length === 0) {
        // Esto sucede si el ID no existe o si RLS bloquea el borrado
        console.warn("Delete affected 0 rows for ID:", id);
        throw new Error("No se pudo eliminar el informe. Es posible que no tengas permisos suficientes o el reporte ya no exista.");
    }

    return true;
}
