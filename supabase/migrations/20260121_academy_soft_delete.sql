-- Migration: Academy Soft Delete and Transfer Ownership
-- Date: 2026-01-21
-- Description: Add is_archived column to academies and transfer ownership function

-- ============================================
-- 1. ADD is_archived COLUMN TO ACADEMIES
-- ============================================

ALTER TABLE academies 
  ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_academies_archived ON academies(is_archived);

-- ============================================
-- 2. FUNCTION: TRANSFER ACADEMY OWNERSHIP
-- ============================================

-- This function transfers ownership of an academy to another member
-- It changes the current owner to 'coach' role and the new owner to 'owner' role
CREATE OR REPLACE FUNCTION transfer_academy_ownership(
  p_academy_id uuid,
  p_new_owner_id uuid,  -- This is the user_id of the new owner
  p_current_owner_id uuid  -- This is the user_id of the current owner (for verification)
)
RETURNS boolean AS $$
DECLARE
  v_current_owner_role text;
  v_new_owner_member_id uuid;
BEGIN
  -- Verify current owner is actually an owner
  SELECT role INTO v_current_owner_role
  FROM academy_members
  WHERE academy_id = p_academy_id
    AND user_id = p_current_owner_id
    AND is_active = true;
  
  IF v_current_owner_role != 'owner' THEN
    RAISE EXCEPTION 'Current user is not an owner of this academy';
  END IF;
  
  -- Verify new owner is a member of the academy
  SELECT id INTO v_new_owner_member_id
  FROM academy_members
  WHERE academy_id = p_academy_id
    AND user_id = p_new_owner_id
    AND is_active = true;
  
  IF v_new_owner_member_id IS NULL THEN
    RAISE EXCEPTION 'New owner must be an active member of the academy';
  END IF;
  
  -- Demote current owner to coach
  UPDATE academy_members
  SET role = 'coach'
  WHERE academy_id = p_academy_id
    AND user_id = p_current_owner_id;
  
  -- Promote new owner
  UPDATE academy_members
  SET role = 'owner'
  WHERE academy_id = p_academy_id
    AND user_id = p_new_owner_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. UPDATE RLS POLICIES FOR ARCHIVED ACADEMIES
-- ============================================

-- Users should still be able to see archived academies they belong to
-- (The existing policy already handles this via is_academy_member function)

-- ============================================
-- 4. FUNCTION: CHECK IF USER CAN CREATE ACADEMY
-- ============================================

-- A user can create an academy if they are owner of at least one academy
-- OR if they have no academies yet (first-time users)
CREATE OR REPLACE FUNCTION can_create_academy()
RETURNS boolean AS $$
DECLARE
  v_academy_count integer;
  v_is_owner boolean;
BEGIN
  -- Count user's academies
  SELECT COUNT(*) INTO v_academy_count
  FROM academy_members
  WHERE user_id = auth.uid()
    AND is_active = true;
  
  -- If no academies, allow creation (first academy)
  IF v_academy_count = 0 THEN
    RETURN true;
  END IF;
  
  -- If has academies, check if owner of any
  SELECT EXISTS (
    SELECT 1 FROM academy_members
    WHERE user_id = auth.uid()
      AND role = 'owner'
      AND is_active = true
  ) INTO v_is_owner;
  
  RETURN v_is_owner;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
