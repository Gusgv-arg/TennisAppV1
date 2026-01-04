-- Migration: Fix admin RLS policies with helper function
-- Description: Replace inefficient subconsultas with a helper function

-- Drop all the problematic admin policies first
DROP POLICY IF EXISTS "Admins view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins manage all players" ON players;
DROP POLICY IF EXISTS "Admins manage all sessions" ON sessions;
DROP POLICY IF EXISTS "Admins manage all locations" ON locations;
DROP POLICY IF EXISTS "Admins manage all videos" ON videos;
DROP POLICY IF EXISTS "Admins manage all analyses" ON analyses;
DROP POLICY IF EXISTS "Admins manage all annotations" ON coach_annotations;
DROP POLICY IF EXISTS "Admins manage all share links" ON share_links;

-- Create a helper function to get the current user's role
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- Now create efficient admin bypass policies using the helper function

-- Profiles: Admins can view all profiles
CREATE POLICY "Admins view all profiles" ON profiles FOR SELECT 
  USING (auth.user_role() = 'admin');

-- Players: Admins manage all players
CREATE POLICY "Admins manage all players" ON players FOR ALL 
  USING (auth.user_role() = 'admin');

-- Sessions: Admins manage all sessions
CREATE POLICY "Admins manage all sessions" ON sessions FOR ALL
  USING (auth.user_role() = 'admin');

-- Locations: Admins manage all locations
CREATE POLICY "Admins manage all locations" ON locations FOR ALL
  USING (auth.user_role() = 'admin');

-- Videos: Admins manage all videos
CREATE POLICY "Admins manage all videos" ON videos FOR ALL
  USING (auth.user_role() = 'admin');

-- Analyses: Admins manage all analyses
CREATE POLICY "Admins manage all analyses" ON analyses FOR ALL
  USING (auth.user_role() = 'admin');

-- Coach Annotations: Admins manage all annotations
CREATE POLICY "Admins manage all annotations" ON coach_annotations FOR ALL
  USING (auth.user_role() = 'admin');

-- Share Links: Admins manage all share links
CREATE POLICY "Admins manage all share links" ON share_links FOR ALL
  USING (auth.user_role() = 'admin');
