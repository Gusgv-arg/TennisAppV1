-- Migration: Fix infinite recursion in academy_members RLS policies
-- Date: 2026-01-22
-- Description: Uses a SECURITY DEFINER function to check ownership without triggering recursive RLS policies

-- 1. Create a secure function to check ownership
-- SECURITY DEFINER means this function runs with the privileges of the creator (postgres/admin),
-- bypassing RLS on the table it queries.
CREATE OR REPLACE FUNCTION public.check_is_academy_owner(_academy_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public -- Secure search path
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM academy_members 
    WHERE academy_id = _academy_id
      AND user_id = auth.uid()
      AND role = 'owner'
      AND is_active = true
  );
END;
$$;

-- 2. Update the recursive policy to use the function

-- Drop the old policy
DROP POLICY IF EXISTS "Owners can manage members" ON academy_members;

-- Create new policy avoiding recursion
CREATE POLICY "Owners can manage members" 
  ON academy_members 
  FOR ALL
  TO authenticated
  USING (
    check_is_academy_owner(academy_id)
  );

-- 3. Also fix the "Members can view their academies" policy on ACADEMIES if necessary
-- The report was strictly about "academy_members" recursion, so this might be enough.
-- But let's verify if there are other policies on academy_members that might recurse.

-- Let's enable RLS on academy_members just to be safe (it should be already)
ALTER TABLE academy_members ENABLE ROW LEVEL SECURITY;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.check_is_academy_owner(uuid) TO authenticated;
