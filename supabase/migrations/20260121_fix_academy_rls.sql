-- Migration: Fix academies RLS policies for creation flow
-- Date: 2026-01-21
-- Description: Allow INSERT and proper SELECT during academy creation

-- ============================================
-- 1. FIX INSERT POLICY
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can create academies" ON academies;

CREATE POLICY "Authenticated users can create academies" 
  ON academies 
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- ============================================
-- 2. FIX SELECT POLICY
-- The SELECT needs to work right after INSERT, before the user is added as member
-- ============================================

DROP POLICY IF EXISTS "Members can view their academies" ON academies;
DROP POLICY IF EXISTS "Users can view their academies" ON academies;

CREATE POLICY "Users can view their academies" 
  ON academies 
  FOR SELECT
  TO authenticated
  USING (
    -- User is a member of the academy
    EXISTS (
      SELECT 1 FROM academy_members 
      WHERE academy_members.academy_id = academies.id 
        AND academy_members.user_id = auth.uid() 
        AND academy_members.is_active = true
    )
    OR
    -- User is the creator (for SELECT immediately after INSERT)
    created_by = auth.uid()
  );

-- ============================================
-- 3. ENSURE UPDATE POLICY EXISTS
-- ============================================

DROP POLICY IF EXISTS "Owners can update their academy" ON academies;

CREATE POLICY "Owners can update their academy" 
  ON academies 
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM academy_members 
      WHERE academy_members.academy_id = academies.id 
        AND academy_members.user_id = auth.uid() 
        AND academy_members.role = 'owner'
        AND academy_members.is_active = true
    )
  );

-- ============================================
-- 4. FIX ACADEMY_MEMBERS INSERT POLICY
-- Creator of an academy can add themselves as the first member (owner)
-- ============================================

DROP POLICY IF EXISTS "Academy creator can add themselves" ON academy_members;
DROP POLICY IF EXISTS "Owners can manage members" ON academy_members;

-- Allow the creator of an academy to add themselves as owner
CREATE POLICY "Academy creator can add themselves" 
  ON academy_members 
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User is adding themselves
    user_id = auth.uid()
    AND
    -- To an academy they created
    EXISTS (
      SELECT 1 FROM academies 
      WHERE academies.id = academy_id 
        AND academies.created_by = auth.uid()
    )
  );

-- Owners can manage all members of their academy
CREATE POLICY "Owners can manage members" 
  ON academy_members 
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM academy_members am
      WHERE am.academy_id = academy_members.academy_id 
        AND am.user_id = auth.uid() 
        AND am.role = 'owner'
        AND am.is_active = true
    )
  );
