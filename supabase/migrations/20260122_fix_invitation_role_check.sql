-- Migration: Allow 'owner' role in academy invitations
-- Date: 2026-01-22
-- Description: Updates the check constraint on academy_invitations to allow 'owner' role

-- drop the existing constraint
ALTER TABLE academy_invitations
DROP CONSTRAINT IF EXISTS academy_invitations_role_check;

-- add the new constraint including 'owner'
ALTER TABLE academy_invitations
ADD CONSTRAINT academy_invitations_role_check 
CHECK (role IN ('owner', 'coach', 'assistant', 'viewer'));
