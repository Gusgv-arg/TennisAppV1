-- Migration: Account Deletion Support
-- Adds soft delete with 30-day grace period for user accounts and academies
-- Date: 2026-02-05

-- ============================================================================
-- 1. ADD DELETION FIELDS TO PROFILES
-- ============================================================================

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deletion_scheduled_at TIMESTAMPTZ;

COMMENT ON COLUMN profiles.deletion_requested_at IS 'When the user requested account deletion';
COMMENT ON COLUMN profiles.deletion_scheduled_at IS 'When the account will be permanently deleted (30 days after request)';

-- ============================================================================
-- 2. ADD DELETION FIELDS TO ACADEMIES
-- ============================================================================

-- Note: is_archived already exists
ALTER TABLE academies 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deletion_scheduled_at TIMESTAMPTZ;

COMMENT ON COLUMN academies.archived_at IS 'When the academy was archived';
COMMENT ON COLUMN academies.deletion_scheduled_at IS 'When the academy will be permanently deleted';

-- ============================================================================
-- 3. REQUEST ACCOUNT DELETION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.request_account_deletion(
  p_archive_academies BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id UUID;
  v_owned_academies UUID[];
  v_deletion_date TIMESTAMPTZ;
  v_academy_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if already pending deletion
  IF EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = v_user_id 
    AND deletion_scheduled_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Account deletion already pending';
  END IF;

  -- Find academies where user is the ONLY owner
  SELECT ARRAY_AGG(am.academy_id) INTO v_owned_academies
  FROM academy_members am
  WHERE am.user_id = v_user_id
    AND am.role = 'owner'
    AND am.is_active = true
    AND NOT EXISTS (
      -- No other active owners in this academy
      SELECT 1 FROM academy_members am2
      WHERE am2.academy_id = am.academy_id
        AND am2.role = 'owner'
        AND am2.is_active = true
        AND am2.user_id != v_user_id
    );

  -- If user owns academies and didn't choose to archive them, block deletion
  IF v_owned_academies IS NOT NULL 
     AND array_length(v_owned_academies, 1) > 0 
     AND NOT p_archive_academies THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'OWNS_ACADEMIES',
      'owned_academy_ids', to_jsonb(v_owned_academies),
      'message', 'Debe transferir o archivar sus academias antes de eliminar la cuenta'
    );
  END IF;

  -- Calculate deletion date (30 days from now)
  v_deletion_date := now() + INTERVAL '30 days';

  -- Mark profile for deletion
  UPDATE profiles
  SET 
    deletion_requested_at = now(),
    deletion_scheduled_at = v_deletion_date,
    is_active = false
  WHERE id = v_user_id;

  -- Archive owned academies if requested
  IF p_archive_academies AND v_owned_academies IS NOT NULL THEN
    FOREACH v_academy_id IN ARRAY v_owned_academies
    LOOP
      UPDATE academies
      SET 
        is_archived = true,
        archived_at = now(),
        deletion_scheduled_at = v_deletion_date
      WHERE id = v_academy_id;
    END LOOP;
  END IF;

  -- Remove user from academies where they're just a member (not sole owner)
  UPDATE academy_members
  SET is_active = false
  WHERE user_id = v_user_id
    AND (v_owned_academies IS NULL OR NOT (academy_id = ANY(v_owned_academies)));

  RETURN jsonb_build_object(
    'success', true,
    'deletion_scheduled_at', v_deletion_date,
    'archived_academies', COALESCE(array_length(v_owned_academies, 1), 0)
  );
END;
$function$;

-- ============================================================================
-- 4. CANCEL ACCOUNT DELETION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cancel_account_deletion()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id UUID;
  v_was_pending BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if deletion is pending
  SELECT deletion_scheduled_at IS NOT NULL INTO v_was_pending
  FROM profiles
  WHERE id = v_user_id;

  IF NOT v_was_pending THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NO_PENDING_DELETION',
      'message', 'No hay eliminación pendiente'
    );
  END IF;

  -- Clear deletion from profile
  UPDATE profiles
  SET 
    deletion_requested_at = NULL,
    deletion_scheduled_at = NULL,
    is_active = true
  WHERE id = v_user_id;

  -- Re-activate owned academies
  UPDATE academies
  SET 
    is_archived = false,
    archived_at = NULL,
    deletion_scheduled_at = NULL
  WHERE created_by = v_user_id
    AND deletion_scheduled_at IS NOT NULL;

  -- Re-activate memberships
  UPDATE academy_members
  SET is_active = true
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Eliminación cancelada exitosamente'
  );
END;
$function$;

-- ============================================================================
-- 5. GET SOLE-OWNED ACADEMIES (for UI to show warning)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_sole_owned_academies()
RETURNS TABLE(id UUID, name TEXT, member_count BIGINT)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT 
    a.id,
    a.name,
    (SELECT COUNT(*) FROM academy_members am WHERE am.academy_id = a.id AND am.is_active = true) as member_count
  FROM academies a
  JOIN academy_members am ON am.academy_id = a.id
  WHERE am.user_id = auth.uid()
    AND am.role = 'owner'
    AND am.is_active = true
    AND a.is_archived = false
    AND NOT EXISTS (
      SELECT 1 FROM academy_members am2
      WHERE am2.academy_id = a.id
        AND am2.role = 'owner'
        AND am2.is_active = true
        AND am2.user_id != auth.uid()
    );
$function$;
