-- 20260116_session_attendance.sql
-- Create session_attendance table for tracking student attendance at classes

CREATE TABLE IF NOT EXISTS session_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'absent' CHECK (status IN ('present', 'absent', 'excused')),
    notes TEXT,
    marked_at TIMESTAMPTZ DEFAULT NOW(),
    marked_by UUID REFERENCES profiles(id),
    UNIQUE(session_id, player_id)
);

-- Enable RLS
ALTER TABLE session_attendance ENABLE ROW LEVEL SECURITY;

-- Policy: Coaches manage attendance for their own sessions
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'session_attendance' AND policyname = 'Coaches manage attendance'
  ) THEN
    CREATE POLICY "Coaches manage attendance" ON session_attendance
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM sessions 
          WHERE sessions.id = session_attendance.session_id 
          AND sessions.coach_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Create index for faster lookups by session
CREATE INDEX IF NOT EXISTS idx_session_attendance_session_id ON session_attendance(session_id);
