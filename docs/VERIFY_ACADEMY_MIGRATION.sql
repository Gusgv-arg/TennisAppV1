-- ============================================
-- VERIFICATION SCRIPT: Academy System Migration
-- Run this in Supabase SQL Editor to verify
-- ============================================

-- 1. Check new tables exist
SELECT 
    'academies' as table_name,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'academies') as exists
UNION ALL
SELECT 
    'academy_members',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'academy_members')
UNION ALL
SELECT 
    'academy_invitations',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'academy_invitations');

-- 2. Check columns added to existing tables
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name IN ('players', 'sessions', 'locations', 'pricing_plans', 'transactions', 'profiles')
    AND column_name = 'academy_id'
ORDER BY table_name;

-- 3. Check current_academy_id in profiles
SELECT 
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'current_academy_id';

-- 4. Check helper functions exist
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_name IN ('get_current_academy_id', 'get_user_academy_role', 'has_permission', 'is_academy_member', 'generate_slug');

-- 5. Check RLS is enabled on new tables
SELECT 
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('academies', 'academy_members', 'academy_invitations');

-- 6. Count policies on new tables
SELECT 
    tablename,
    COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN ('academies', 'academy_members', 'academy_invitations')
GROUP BY tablename;

-- 7. List all policies on academy tables (for review)
SELECT 
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN ('academies', 'academy_members', 'academy_invitations')
ORDER BY tablename, policyname;

-- ============================================
-- EXPECTED RESULTS:
-- 1. All 3 tables should exist (true)
-- 2. academy_id should be in players, sessions, locations, pricing_plans, transactions
-- 3. current_academy_id should be in profiles
-- 4. All 5 functions should exist
-- 5. All 3 tables should have rowsecurity = true
-- 6. academies: 4 policies, academy_members: 4 policies, academy_invitations: 4 policies
-- ============================================
