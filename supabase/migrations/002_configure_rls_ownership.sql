-- ============================================
-- Migration: Row Level Security for Ownership
-- ============================================
-- This migration configures RLS policies so that:
-- - Superadmins see all data
-- - Coaches only see their own data (where coach_id = their user_id)

-- ============================================
-- Enable RLS on Tables
-- ============================================
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PLAYERS TABLE - RLS Policies
-- ============================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admins can view all players" ON players;
DROP POLICY IF EXISTS "Coaches can view their players" ON players;
DROP POLICY IF EXISTS "Coaches can create their players" ON players;
DROP POLICY IF EXISTS "Coaches can update their players" ON players;
DROP POLICY IF EXISTS "Coaches can delete their players" ON players;

-- SELECT: Admins see all, Coaches see their own
CREATE POLICY "Admins can view all players"
ON players FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
  OR coach_id = auth.uid()
);

-- INSERT: Auto-assign coach_id
CREATE POLICY "Coaches can create their players"
ON players FOR INSERT
TO authenticated
WITH CHECK (
  coach_id = auth.uid()
);

-- UPDATE: Only update own players
CREATE POLICY "Coaches can update their players"
ON players FOR UPDATE
TO authenticated
USING (coach_id = auth.uid())
WITH CHECK (coach_id = auth.uid());

-- DELETE: Only delete own players
CREATE POLICY "Coaches can delete their players"
ON players FOR DELETE
TO authenticated
USING (coach_id = auth.uid());

-- ============================================
-- LOCATIONS TABLE - RLS Policies
-- ============================================

DROP POLICY IF EXISTS "Admins can view all locations" ON locations;
DROP POLICY IF EXISTS "Coaches can view their locations" ON locations;
DROP POLICY IF EXISTS "Coaches can manage their locations" ON locations;

CREATE POLICY "Admins can view all locations"
ON locations FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  OR coach_id = auth.uid()
);

CREATE POLICY "Coaches can create their locations"
ON locations FOR INSERT
TO authenticated
WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coaches can update their locations"
ON locations FOR UPDATE
TO authenticated
USING (coach_id = auth.uid())
WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coaches can delete their locations"
ON locations FOR DELETE
TO authenticated
USING (coach_id = auth.uid());

-- ============================================
-- SESSIONS TABLE - RLS Policies
-- ============================================

DROP POLICY IF EXISTS "Admins can view all sessions" ON sessions;
DROP POLICY IF EXISTS "Coaches can view their sessions" ON sessions;
DROP POLICY IF EXISTS "Coaches can manage their sessions" ON sessions;

CREATE POLICY "Admins can view all sessions"
ON sessions FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  OR coach_id = auth.uid()
);

CREATE POLICY "Coaches can create their sessions"
ON sessions FOR INSERT
TO authenticated
WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coaches can update their sessions"
ON sessions FOR UPDATE
TO authenticated
USING (coach_id = auth.uid())
WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coaches can delete their sessions"
ON sessions FOR DELETE
TO authenticated
USING (coach_id = auth.uid());

-- ============================================
-- Verification
-- ============================================
-- Check that RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('players', 'locations', 'sessions');

-- Check policies created
SELECT tablename, policyname, cmd, qual
FROM pg_policies 
WHERE tablename IN ('players', 'locations', 'sessions')
ORDER BY tablename, policyname;
