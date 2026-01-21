-- EMERGENCY FIX: Recursion Loop in academy_members
-- Date: 2026-01-21
-- Description: Use SECURITY DEFINER functions to avoid RLS recursion

-- 1. Disable RLS immediately to stop the loop
ALTER TABLE academy_members DISABLE ROW LEVEL SECURITY;

-- 2. Drop potentially problematic policies
DROP POLICY IF EXISTS "Members can view academy members" ON academy_members;
DROP POLICY IF EXISTS "Users can insert themselves as members" ON academy_members;
DROP POLICY IF EXISTS "Owners can update members" ON academy_members;
DROP POLICY IF EXISTS "Owners can remove members" ON academy_members;
DROP POLICY IF EXISTS "Owners can manage members" ON academy_members;
DROP POLICY IF EXISTS "Academy creator can add themselves" ON academy_members;
DROP POLICY IF EXISTS "Members can view their academy members" ON academy_members;

-- 3. Create/Ensure SECURITY DEFINER functions exist
-- These functions bypass RLS when executed

CREATE OR REPLACE FUNCTION is_academy_member_secure(acad_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM academy_members 
    WHERE academy_id = acad_id 
      AND user_id = auth.uid() 
      AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_academy_owner_secure(acad_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM academy_members 
    WHERE academy_id = acad_id 
      AND user_id = auth.uid() 
      AND role = 'owner'
      AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 4. Re-enable RLS
ALTER TABLE academy_members ENABLE ROW LEVEL SECURITY;

-- 5. Create Safe Policies using the functions

-- SELECT: View if you are a member OR if you are the user being viewed
CREATE POLICY "Safe view academy members" ON academy_members
  FOR SELECT
  TO authenticated
  USING (
    -- Can view if you are a member of the academy (using secure function)
    is_academy_member_secure(academy_id)
    OR
    -- Can always view your own membership
    user_id = auth.uid()
  );

-- INSERT: User acting on themselves, AND for a valid academy
-- (Either creator via academies table check, or invite acceptance)
CREATE POLICY "Safe insert academy members" ON academy_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() 
    AND (
       -- You are the creator of the academy (checked against academies table, safe)
       EXISTS (SELECT 1 FROM academies WHERE id = academy_id AND created_by = auth.uid())
       -- OR other logic for invites could go here
    )
  );

-- UPDATE: Owners only (using secure function)
CREATE POLICY "Safe update academy members" ON academy_members
  FOR UPDATE
  TO authenticated
  USING (
    is_academy_owner_secure(academy_id)
  );

-- DELETE: Owners only (using secure function)
CREATE POLICY "Safe delete academy members" ON academy_members
  FOR DELETE
  TO authenticated
  USING (
    is_academy_owner_secure(academy_id)
  );
