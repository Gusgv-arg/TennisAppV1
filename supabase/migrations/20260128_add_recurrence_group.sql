-- Add recurrence_group_id to sessions table
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS recurrence_group_id uuid;

-- Add index for performance (Critical for "Delete Series" operations)
CREATE INDEX IF NOT EXISTS idx_sessions_recurrence_group_id ON sessions(recurrence_group_id);
