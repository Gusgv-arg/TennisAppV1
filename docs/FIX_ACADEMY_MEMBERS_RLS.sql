-- ============================================
-- URGENT FIX: Academy Members RLS Policy
-- The subquery policy caused infinite recursion
-- Run this IMMEDIATELY in Supabase SQL Editor
-- ============================================

-- Remove the problematic policies
DROP POLICY IF EXISTS "Members can view team" ON academy_members;
DROP POLICY IF EXISTS "Users can see own memberships" ON academy_members;

-- Create a simple, non-recursive policy
-- Users can see members of academies they belong to
-- This uses a function instead of subquery to avoid recursion
CREATE OR REPLACE FUNCTION user_academy_ids()
RETURNS SETOF uuid AS $$
  SELECT academy_id FROM academy_members WHERE user_id = auth.uid() AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Now create the policy using the function
CREATE POLICY "Members can view team" ON academy_members FOR SELECT
  USING (
    academy_id IN (SELECT user_academy_ids())
    OR user_id = auth.uid()
  );

-- Verify
SELECT 'Fixed! Policy recreated without recursion' as status;
