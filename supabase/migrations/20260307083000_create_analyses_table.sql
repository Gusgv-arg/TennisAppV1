-- Migration: Create analyses table
-- Date: 2026-03-07
-- Description: Table for biomechanical analysis reports

CREATE TABLE IF NOT EXISTS public.analyses (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
    player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
    coach_id UUID REFERENCES auth.users(id),
    academy_id UUID REFERENCES public.academies(id),
    session_id UUID, -- Optional grouping
    
    stroke_type TEXT NOT NULL DEFAULT 'serve',
    metrics JSONB NOT NULL DEFAULT '{}',
    ai_feedback JSONB NOT NULL DEFAULT '{}',
    pose_data JSONB, -- Optional raw frames
    
    coach_approved BOOLEAN DEFAULT false,
    coach_feedback TEXT,
    
    metadata JSONB DEFAULT '{}'
);

-- Enable RLS
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;

-- Basic policies
CREATE POLICY "Analyses are viewable by everyone in the academy" ON public.analyses
    FOR SELECT USING (true);

CREATE POLICY "Coaches can insert analyses" ON public.analyses
    FOR INSERT WITH CHECK (true);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_analyses_player_id ON public.analyses(player_id);
CREATE INDEX IF NOT EXISTS idx_analyses_video_id ON public.analyses(video_id);
