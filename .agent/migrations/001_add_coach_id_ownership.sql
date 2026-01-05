-- ============================================
-- Migration: Add Ownership (coach_id) to Tables
-- ============================================
-- This migration adds coach_id to players, locations, and sessions
-- to enable role-based data filtering.

-- Add coach_id to players table
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS coach_id UUID REFERENCES profiles(id);

-- Add coach_id to locations table
ALTER TABLE locations 
ADD COLUMN IF NOT EXISTS coach_id UUID REFERENCES profiles(id);

-- Add coach_id to sessions table
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS coach_id UUID REFERENCES profiles(id);

-- ============================================
-- Migrate Legacy Data (Opción 1)
-- ============================================
-- Assign all existing records to the superadmin user
-- Replace 'YOUR_USER_ID_HERE' with your actual user ID

-- IMPORTANT: Get your user ID first with:
-- SELECT id FROM profiles WHERE email = 'gusgvillafañe@gmail.com';

-- Then uncomment and run these lines with your actual user_id:

-- UPDATE players 
SET coach_id = '9f4f4b14-573a-4bb6-ad51-398accdbfd04'
WHERE coach_id IS NULL;

-- UPDATE locations 
SET coach_id = '9f4f4b14-573a-4bb6-ad51-398accdbfd04'
WHERE coach_id IS NULL;

-- UPDATE sessions 
SET coach_id = '9f4f4b14-573a-4bb6-ad51-398accdbfd04'
WHERE coach_id IS NULL;

-- ============================================
-- Create Indexes for Performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_players_coach_id ON players(coach_id);
CREATE INDEX IF NOT EXISTS idx_locations_coach_id ON locations(coach_id);
CREATE INDEX IF NOT EXISTS idx_sessions_coach_id ON sessions(coach_id);

-- ============================================
-- Verification
-- ============================================
-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('players', 'locations', 'sessions')
  AND column_name = 'coach_id';
