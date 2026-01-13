-- Migration: Add Registered Staff Support
-- Description: Allow creating team members without app access
-- Date: 2026-01-13

-- ============================================
-- 1. ADD NEW COLUMNS TO ACADEMY_MEMBERS
-- ============================================

-- member_name: For registered members without user accounts
ALTER TABLE academy_members 
  ADD COLUMN IF NOT EXISTS member_name text;

-- member_email: Optional contact email for registered members
ALTER TABLE academy_members 
  ADD COLUMN IF NOT EXISTS member_email text;

-- has_app_access: Distinguishes between invited (true) and registered-only (false)
ALTER TABLE academy_members 
  ADD COLUMN IF NOT EXISTS has_app_access boolean DEFAULT true;

-- ============================================
-- 2. ALLOW NULL USER_ID FOR REGISTERED MEMBERS
-- ============================================

-- Remove NOT NULL constraint from user_id to allow registered-only members
ALTER TABLE academy_members 
  ALTER COLUMN user_id DROP NOT NULL;

-- ============================================
-- 2. CREATE INDEX FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_academy_members_access 
  ON academy_members(academy_id, has_app_access);

-- ============================================
-- 3. ADD CONSTRAINT FOR DATA INTEGRITY
-- ============================================

-- Ensure registered members have a name
ALTER TABLE academy_members
  ADD CONSTRAINT chk_registered_has_name 
  CHECK (
    has_app_access = true 
    OR (has_app_access = false AND member_name IS NOT NULL)
  );

-- ============================================
-- NOTE: Run this migration in Supabase SQL Editor
-- ============================================

-- ============================================
-- 4. ADD LINKED_MEMBER_ID TO INVITATIONS
-- ============================================

-- For promotions: links invitation to existing member record
ALTER TABLE academy_invitations 
  ADD COLUMN IF NOT EXISTS linked_member_id uuid REFERENCES academy_members(id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_invitations_linked_member 
  ON academy_invitations(linked_member_id) WHERE linked_member_id IS NOT NULL;
