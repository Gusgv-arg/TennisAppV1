-- Function to securely get invitation details bypassing RLS
-- This is necessary because unauthenticated users cannot view academies/profiles by default
CREATE OR REPLACE FUNCTION get_invitation_by_token(lookup_token text)
RETURNS TABLE (
  id uuid,
  email text,
  role text,
  academy_id uuid,
  academy_name text,
  academy_logo_url text,
  inviter_id uuid,
  inviter_name text,
  inviter_email text,
  expires_at timestamptz,
  accepted_at timestamptz
) 
SECURITY DEFINER -- Runs with elevated privileges
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ai.id,
    ai.email,
    ai.role,
    ai.academy_id,
    a.name as academy_name,
    a.logo_url as academy_logo_url,
    ai.invited_by as inviter_id,
    p.full_name as inviter_name,
    p.email as inviter_email,
    ai.expires_at,
    ai.accepted_at
  FROM academy_invitations ai
  JOIN academies a ON a.id = ai.academy_id
  LEFT JOIN profiles p ON p.id = ai.invited_by
  WHERE ai.token = lookup_token;
END;
$$ LANGUAGE plpgsql;

-- Grant access to public (anon) and authenticated users
GRANT EXECUTE ON FUNCTION get_invitation_by_token(text) TO anon, authenticated, service_role;
