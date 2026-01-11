-- Function to securely accept an invitation (Transaction)
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

  -- 2. Insert into academy_members
  -- (Using ON CONFLICT to act as "Success" if already exists, matching user expectation)
  INSERT INTO academy_members (academy_id, user_id, role, invited_by, accepted_at)
  VALUES (invite_record.academy_id, target_user_id, invite_record.role, invite_record.invited_by, now())
  ON CONFLICT (academy_id, user_id) 
  DO UPDATE SET role = EXCLUDED.role; -- Update role if re-accepting/upgrading

  -- 3. Mark invitation as accepted
  UPDATE academy_invitations
  SET accepted_at = now()
  WHERE id = invite_record.id;

  -- 4. Set as current academy if user has none
  UPDATE profiles
  SET current_academy_id = invite_record.academy_id
  WHERE id = target_user_id
  AND current_academy_id IS NULL;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Grant access
GRANT EXECUTE ON FUNCTION accept_invitation(text, uuid) TO authenticated;
