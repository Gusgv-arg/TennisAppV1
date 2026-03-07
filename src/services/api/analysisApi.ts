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
        categoryScores: params.report.categoryScores
    };

    const aiFeedbackPayload = {
        flags: params.report.flags,
        keyframes: params.report.keyframes // Tiempos exactos donde ocurrió cada fase
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

    if (error) {
        console.error("Error fetching analyses:", error);
        throw error;
    }

    return data;
}
