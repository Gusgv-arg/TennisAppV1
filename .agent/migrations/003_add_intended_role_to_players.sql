-- ============================================
-- Migration: Add intended_role to Players
-- ============================================
-- This field stores the role the user will have when they register
-- Values: 'coach', 'collaborator', 'player' (default: 'player')

ALTER TABLE players 
ADD COLUMN IF NOT EXISTS intended_role TEXT DEFAULT 'player' 
CHECK (intended_role IN ('coach', 'collaborator', 'player'));

-- Update existing records to have a default role
UPDATE players 
SET intended_role = 'player' 
WHERE intended_role IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN players.intended_role IS 'Role this user will have when they create an account (coach/collaborator/player)';

-- Verify the column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'players' AND column_name = 'intended_role';
