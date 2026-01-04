-- Migration: Add admin (superadmin) RLS bypass policies
-- Description: Allow admin role to access all data across all coaches

-- Profiles: Admins can view all profiles
CREATE POLICY "Admins view all profiles" ON profiles FOR SELECT 
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Players: Admins manage all players
CREATE POLICY "Admins manage all players" ON players FOR ALL 
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Sessions: Admins manage all sessions
CREATE POLICY "Admins manage all sessions" ON sessions FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Locations: Admins manage all locations
CREATE POLICY "Admins manage all locations" ON locations FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Videos: Admins manage all videos
CREATE POLICY "Admins manage all videos" ON videos FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Analyses: Admins manage all analyses
CREATE POLICY "Admins manage all analyses" ON analyses FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Coach Annotations: Admins manage all annotations
CREATE POLICY "Admins manage all annotations" ON coach_annotations FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Share Links: Admins manage all share links
CREATE POLICY "Admins manage all share links" ON share_links FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Assign first admin: Gustavo Gómez Villafañe
-- Note: This should be run manually after verifying the email exists in profiles table
-- UPDATE profiles SET role = 'admin' WHERE email = 'gusgvillafane@gmail.com';
