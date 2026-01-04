-- Quick Fix V2: Run this in Supabase SQL Editor to fix 500 errors

-- Step 1: Drop problematic policies
DROP POLICY IF EXISTS "Admins view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins manage all players" ON players;
DROP POLICY IF EXISTS "Admins manage all sessions" ON sessions;
DROP POLICY IF EXISTS "Admins manage all locations" ON locations;
DROP POLICY IF EXISTS "Admins manage all videos" ON videos;
DROP POLICY IF EXISTS "Admins manage all analyses" ON analyses;
DROP POLICY IF EXISTS "Admins manage all annotations" ON coach_annotations;
DROP POLICY IF EXISTS "Admins manage all share links" ON share_links;

-- Step 2: Create helper function in PUBLIC schema
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Step 3: Recreate policies with helper function
CREATE POLICY "Admins view all profiles" ON profiles FOR SELECT 
  USING (public.get_user_role() = 'admin');

CREATE POLICY "Admins manage all players" ON players FOR ALL 
  USING (public.get_user_role() = 'admin');

CREATE POLICY "Admins manage all sessions" ON sessions FOR ALL
  USING (public.get_user_role() = 'admin');

CREATE POLICY "Admins manage all locations" ON locations FOR ALL
  USING (public.get_user_role() = 'admin');

CREATE POLICY "Admins manage all videos" ON videos FOR ALL
  USING (public.get_user_role() = 'admin');

CREATE POLICY "Admins manage all analyses" ON analyses FOR ALL
  USING (public.get_user_role() = 'admin');

CREATE POLICY "Admins manage all annotations" ON coach_annotations FOR ALL
  USING (public.get_user_role() = 'admin');

CREATE POLICY "Admins manage all share links" ON share_links FOR ALL
  USING (public.get_user_role() = 'admin');

-- Step 4: Verify your role (should return 'admin')
SELECT id, email, role FROM profiles WHERE email = 'gusgvillafane@gmail.com';
