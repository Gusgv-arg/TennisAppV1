-- Migration: Upgrade user global role on invitation acceptance
-- Date: 2026-03-31
-- Description: Ensures that if a user joins an academy as staff, their global role is upgraded to 'coach'

CREATE OR REPLACE FUNCTION public.accept_invitation(
  token_str text,
  target_user_id uuid
)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  invite_record academy_invitations%ROWTYPE;
BEGIN
  -- 1. Verify invitation exists and is valid
  SELECT * INTO invite_record
  FROM academy_invitations
  WHERE token = token_str
  AND accepted_at IS NULL
  AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation invalid or expired';
  END IF;

  -- 2. Handle linked member (promotion from registered) vs new member
  IF invite_record.linked_member_id IS NOT NULL THEN
    -- PROMOTION: Update existing member instead of creating new one
    UPDATE academy_members
    SET 
      user_id = target_user_id,
      is_active = true,
      has_app_access = true,
      accepted_at = now()
    WHERE id = invite_record.linked_member_id;
  ELSE
    -- NEW MEMBER: Insert as before
    INSERT INTO academy_members (academy_id, user_id, role, invited_by, accepted_at, has_app_access)
    VALUES (invite_record.academy_id, target_user_id, invite_record.role, invite_record.invited_by, now(), true)
    ON CONFLICT (academy_id, user_id) 
    DO UPDATE SET role = EXCLUDED.role, is_active = true, has_app_access = true;
  END IF;

  -- 3. Mark invitation as accepted
  UPDATE academy_invitations
  SET accepted_at = now()
  WHERE id = invite_record.id;

  -- 4. ALWAYS Set as current academy
  UPDATE profiles
  SET current_academy_id = invite_record.academy_id
  WHERE id = target_user_id;

  -- 5. UPGRADE Global Role if needed
  -- If invited as staff, ensure global profile role is 'coach' 
  -- to unlock academy dashboard and bypass player-only restrictions
  IF invite_record.role IN ('owner', 'admin', 'coach', 'assistant', 'viewer') THEN
    UPDATE profiles
    SET role = 'coach'
    WHERE id = target_user_id
    AND role = 'player'; -- Only upgrade from player to avoid overwriting more granular roles if any exist in future
  END IF;

  RETURN true;
END;
$function$;
