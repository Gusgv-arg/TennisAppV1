-- Migration: Allow academy members to view profiles of other academy members
-- This is needed so collaborators can see the owner's profile data (name, avatar, etc.)

-- Policy: Users can view profiles of other members in the same academy
CREATE POLICY "Academy members can view each other's profiles" ON profiles 
FOR SELECT USING (
  -- User can view their own profile
  auth.uid() = id 
  OR 
  -- User can view profiles of other members in any academy they belong to
  EXISTS (
    SELECT 1 FROM academy_members my_membership
    JOIN academy_members other_membership ON my_membership.academy_id = other_membership.academy_id
    WHERE my_membership.user_id = auth.uid()
      AND my_membership.is_active = true
      AND other_membership.user_id = profiles.id
      AND other_membership.is_active = true
  )
);

-- Drop the old restrictive policy if it exists
DROP POLICY IF EXISTS "Users view own profile" ON profiles;
