-- 20260103_add_session_players.sql
-- Create a join table to support many-to-many relationship between sessions and players.

CREATE TABLE IF NOT EXISTS session_players (
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  PRIMARY KEY (session_id, player_id)
);

-- Enable RLS
ALTER TABLE session_players ENABLE ROW LEVEL SECURITY;

-- Policy: Coaches manage players for their own sessions
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'session_players' AND policyname = 'Coaches manage session players'
  ) THEN
    CREATE POLICY "Coaches manage session players" ON session_players
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM sessions 
          WHERE sessions.id = session_players.session_id 
          AND sessions.coach_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Data Migration: Move existing player_id to session_players
INSERT INTO session_players (session_id, player_id)
SELECT id, player_id FROM sessions 
WHERE player_id IS NOT NULL
ON CONFLICT (session_id, player_id) DO NOTHING;
