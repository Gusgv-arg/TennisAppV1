-- Migration: Force academy switch when accepting invitation
-- Date: 2026-01-22
-- Description: Updates accept_invitation to ALWAYS switch the user to the new academy

CREATE OR REPLACE FUNCTION accept_invitation(
  token_str text,
  target_user_id uuid
)
RETURNS boolean
SECURITY DEFINER -- Bypass RLS to update invitations table
SET search_path = public
AS $$
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
  -- Changed from "WHERE current_academy_id IS NULL" to unconditional update
  UPDATE profiles
  SET current_academy_id = invite_record.academy_id
  WHERE id = target_user_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Grant access
GRANT EXECUTE ON FUNCTION accept_invitation(text, uuid) TO authenticated;
