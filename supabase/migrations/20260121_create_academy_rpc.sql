-- Migration: Create RPC function for academy creation (Fix Ambiguity)
-- Date: 2026-01-21
-- Description: Creates a secure function to handle academy creation transactionally (Fixing ambiguous column references)

-- Drop the old function if it exists to clean up
DROP FUNCTION IF EXISTS create_academy_with_owner(text, text, text);

-- Create the function with security definer to bypass RLS during creation
-- Using p_ prefix to avoid ambiguity with table column names
CREATE OR REPLACE FUNCTION create_academy_with_owner(
  p_name text,
  p_slug text,
  p_logo_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Run with privileges of the creator of the function
AS $$
DECLARE
  new_academy_id uuid;
  new_academy_record record;
  current_user_id uuid;
BEGIN
  -- Get current user
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Create Academy
  INSERT INTO academies (name, slug, logo_url, created_by)
  VALUES (p_name, p_slug, p_logo_url, current_user_id)
  RETURNING id, name, slug, logo_url, settings, created_by, created_at, updated_at, is_archived
  INTO new_academy_record;

  new_academy_id := new_academy_record.id;

  -- 2. Add Creator as Owner Member
  INSERT INTO academy_members (academy_id, user_id, role, accepted_at, is_active)
  VALUES (new_academy_id, current_user_id, 'owner', now(), true);

  -- 3. Update Profile Current Academy
  UPDATE profiles
  SET current_academy_id = new_academy_id
  WHERE id = current_user_id;

  -- Return the created academy as JSON
  RETURN to_jsonb(new_academy_record);
END;
$$;
