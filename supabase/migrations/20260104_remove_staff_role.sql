-- Migration: Remove role field from staff_members (all are coaches)
-- Description: Simplify staff_members table by removing role classification

-- Drop role constraint and column
ALTER TABLE staff_members DROP CONSTRAINT IF EXISTS staff_members_role_check;
ALTER TABLE staff_members DROP COLUMN IF EXISTS role;
