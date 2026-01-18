-- Migration: Add is_deleted column for soft delete level 2
-- This allows "permanently deleting" records from the UI while preserving data

-- Add is_deleted column to players table
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;

-- Add is_deleted column to class_groups table  
ALTER TABLE class_groups ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;

-- Create indexes for faster queries filtering deleted records
CREATE INDEX IF NOT EXISTS idx_players_is_deleted ON players(is_deleted);
CREATE INDEX IF NOT EXISTS idx_class_groups_is_deleted ON class_groups(is_deleted);

-- Comment explaining the feature
COMMENT ON COLUMN players.is_deleted IS 'Soft delete level 2: when true, record is hidden from UI but data is preserved';
COMMENT ON COLUMN class_groups.is_deleted IS 'Soft delete level 2: when true, record is hidden from UI but data is preserved';
