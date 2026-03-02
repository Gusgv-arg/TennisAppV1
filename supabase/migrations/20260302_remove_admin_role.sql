-- Migration: Remove Admin Role
-- Description: Drop all admin bypass RLS policies and change gusgvillafane role to coach

-- 1. Change user role back to coach
UPDATE profiles 
SET role = 'coach' 
WHERE email = 'gusgvillafane@gmail.com' AND role = 'admin';

-- 2. Drop Admin RLS Policies
DROP POLICY IF EXISTS "Admins view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins manage all players" ON players;
DROP POLICY IF EXISTS "Admins can view all players" ON players;
DROP POLICY IF EXISTS "Admins manage all sessions" ON sessions;
DROP POLICY IF EXISTS "Admins can view all sessions" ON sessions;
DROP POLICY IF EXISTS "Admins manage all locations" ON locations;
DROP POLICY IF EXISTS "Admins can view all locations" ON locations;
DROP POLICY IF EXISTS "Admins manage all videos" ON videos;
DROP POLICY IF EXISTS "Admins manage all analyses" ON analyses;
DROP POLICY IF EXISTS "Admins manage all annotations" ON coach_annotations;
DROP POLICY IF EXISTS "Admins manage all share links" ON share_links;
DROP POLICY IF EXISTS "Admins manage feedback" ON feedback;
DROP POLICY IF EXISTS "Admins manage all transactions" ON transactions;

-- 3. Update profiles role constraint
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('coach', 'collaborator', 'player'));
