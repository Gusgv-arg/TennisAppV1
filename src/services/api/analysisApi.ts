import { ServeAnalysisReport } from '../PoseAnalysis/types';
import { supabase } from '../supabaseClient';

export interface SaveAnalysisParams {
    videoId: string;
    playerId: string;
    coachId: string;
    academyId?: string;
    sessionId?: string;
    report: ServeAnalysisReport;
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
            session_id: params.sessionId || null,

            stroke_type: 'serve', // Hardcodeamos por ahora, ya que el motor es específico

            metrics: metricsPayload,
            ai_feedback: aiFeedbackPayload,

            // Si estuviéramos guardando TODOS los frames (pesado), iría acá. 
            // Por ahora omitimos para no reventar la base de datos, solo guardamos resumenes.
            pose_data: null,

            coach_approved: false // Arranca pendiente de que el profesor le de OK
        })
        .select('id')
        .single();

    if (error) {
        console.error("Supabase Error saving analysis:", error);
        throw new Error(`Error al persistir el análisis: ${error.message}`);
    }

    return data.id;
}
