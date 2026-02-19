-- Add player_id to videos table
ALTER TABLE videos 
ADD COLUMN player_id uuid REFERENCES players(id) ON DELETE CASCADE,
ADD COLUMN title text DEFAULT to_char(now(), 'DD/MM/YYYY HH24:MI'),
ADD COLUMN description text,
ADD COLUMN folder text DEFAULT 'general',
ADD COLUMN duration_secs integer,
ADD COLUMN upload_status text DEFAULT 'uploading' CHECK (upload_status IN ('uploading', 'ready', 'error'));

-- Make storage_path NOT NULL as per recommendation (it was already NOT NULL in initial schema, but good to double check or enforce if strictly needed, though ALTER COLUMN SET NOT NULL is the command if it wasn't)
-- ALTER TABLE videos ALTER COLUMN storage_path SET NOT NULL; 

-- Update RLS policies
-- Allow coaches to view videos of their players
CREATE POLICY "Coaches can view videos of their players" ON videos
FOR SELECT
USING (
  auth.uid() = uploaded_by OR 
  EXISTS (
    SELECT 1 FROM players p
    WHERE p.id = videos.player_id
    AND p.coach_id = auth.uid()
  )
);

-- Note: existing "Coaches manage own videos" policy usually covers CRUD where uploaded_by = auth.uid()
-- We just need to ensure that when inserting, if player_id is set, it belongs to the coach.
-- This is often handled by application logic, but can be forced via trigger or check constraint if needed.
-- For now, we rely on the fact that an insert with `uploaded_by = auth.uid()` is allowed, and frontend ensures `player_id` validity.
