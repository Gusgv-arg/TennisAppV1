-- RBAC Verification SQL
-- Run these queries in Supabase SQL Editor to verify RBAC setup

-- 1. Check if your user has admin role
SELECT id, email, role, full_name 
FROM profiles 
WHERE email = 'gusgvillafane@gmail.com';
-- Expected: role = 'admin'

-- 2. View all users and their roles
SELECT id, email, role, full_name, created_at
FROM profiles
ORDER BY created_at DESC;

-- 3. Check existing RLS policies on players table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'players';

-- 4. Check existing RLS policies on locations table  
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'locations';

-- 5. Test if admin can see players from other coaches
SELECT p.id, p.full_name, p.coach_id, prof.email as coach_email
FROM players p
LEFT JOIN profiles prof ON p.coach_id = prof.id
ORDER BY p.created_at DESC
LIMIT 10;
-- As admin, you should see ALL players regardless of coach_id

-- 6. Test if admin can see all locations
SELECT l.id, l.name, l.coach_id, prof.email as coach_email
FROM locations l
LEFT JOIN profiles prof ON l.coach_id = prof.id
ORDER BY l.created_at DESC
LIMIT 10;
-- As admin, you should see ALL locations regardless of coach_id

-- 7. If step 1 shows role != 'admin', run this:
-- UPDATE profiles SET role = 'admin' WHERE email = 'gusgvillafane@gmail.com';
