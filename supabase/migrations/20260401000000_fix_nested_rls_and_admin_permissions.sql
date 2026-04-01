-- Migration: Fix Nested RLS and Admin Permissions
-- Description: Unifies views for owners, admins, and coaches by updating RLS on session_players and session_attendance. Also updates has_permission for the 'admin' role.
-- Date: 2026-04-01

-- 1. UPDATE HAS_PERMISSION TO SUPPORT 'ADMIN' ROLE
-- We grant 'admin' the same permissions as 'owner' (which is TRUE for all checks).
-- Note: Sensitive operations like project deletion or ownership transfer are handled by other functions like check_is_academy_owner.

CREATE OR REPLACE FUNCTION public.has_permission(perm text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 STABLE
AS $function$
DECLARE
  v_user_role text;
  v_custom_perms jsonb;
BEGIN
  SELECT role, custom_permissions INTO v_user_role, v_custom_perms
  FROM academy_members 
  WHERE user_id = auth.uid() 
    AND academy_id = get_current_academy_id()
    AND is_active = true;
  
  -- No membership = no permission
  IF v_user_role IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check custom permissions override first
  IF v_custom_perms ? perm THEN
    RETURN (v_custom_perms->>perm)::boolean;
  END IF;
  
  -- Default permissions by role
  RETURN CASE v_user_role
    WHEN 'owner' THEN true
    WHEN 'admin' THEN true -- NEW: Admin has same broad permissions as owner
    WHEN 'coach' THEN perm IN (
      'players.view', 'players.create', 'players.edit', 'players.archive',
      'sessions.view', 'sessions.create', 'sessions.edit', 'sessions.delete',
      'locations.view', 
      'payments.view_own', 'payments.record',
      'team.view',
      'plans.view'
    )
    WHEN 'assistant' THEN perm IN (
      'players.view',
      'sessions.view', 'sessions.create', 'sessions.edit',
      'locations.view',
      'team.view',
      'plans.view'
    )
    WHEN 'viewer' THEN perm IN (
      'players.view',
      'sessions.view',
      'locations.view'
    )
    ELSE false
  END;
END;
$function$;

-- 2. UPDATE SESSION_PLAYERS RLS POLICIES
-- We replace the old creator-based policy with an academy-based one.

DROP POLICY IF EXISTS "Coaches manage session players" ON session_players;

CREATE POLICY "View session players in academy" ON session_players
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sessions 
      WHERE sessions.id = session_players.session_id 
      AND sessions.academy_id = get_current_academy_id()
      AND has_permission('sessions.view')
    )
  );

CREATE POLICY "Manage session players in academy" ON session_players
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM sessions 
      WHERE sessions.id = session_players.session_id 
      AND sessions.academy_id = get_current_academy_id()
      AND has_permission('sessions.edit')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions 
      WHERE sessions.id = session_players.session_id 
      AND sessions.academy_id = get_current_academy_id()
      AND has_permission('sessions.edit')
    )
  );

-- 3. UPDATE SESSION_ATTENDANCE RLS POLICIES
-- We replace the old creator-based policy with an academy-based one.

DROP POLICY IF EXISTS "Coaches manage attendance" ON session_attendance;

CREATE POLICY "View session attendance in academy" ON session_attendance
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sessions 
      WHERE sessions.id = session_attendance.session_id 
      AND sessions.academy_id = get_current_academy_id()
      AND has_permission('sessions.view')
    )
  );

CREATE POLICY "Manage session attendance in academy" ON session_attendance
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM sessions 
      WHERE sessions.id = session_attendance.session_id 
      AND sessions.academy_id = get_current_academy_id()
      AND has_permission('sessions.edit')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions 
      WHERE sessions.id = session_attendance.session_id 
      AND sessions.academy_id = get_current_academy_id()
      AND has_permission('sessions.edit')
    )
  );

-- 4. UPDATE TRANSACTIONS RLS POLICIES
-- Ensure 'admin' role is correctly handled in transaction management.

DROP POLICY IF EXISTS "View own transactions in academy" ON transactions;
CREATE POLICY "View transactions in academy" ON transactions
  FOR SELECT
  USING (
    academy_id = get_current_academy_id() 
    AND (
      get_user_academy_role() IN ('owner', 'admin') -- UPDATED: Added admin
      OR recorded_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owner manages transactions" ON transactions;
CREATE POLICY "Managers can manage transactions" ON transactions
  FOR ALL
  USING (
    academy_id = get_current_academy_id() 
    AND get_user_academy_role() IN ('owner', 'admin') -- UPDATED: Added admin
  );
