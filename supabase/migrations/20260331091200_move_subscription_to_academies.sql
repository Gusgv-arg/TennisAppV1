-- Migration: Move Subscription to Academies, Update Roles and Payments Security (vFinal)
-- Date: 2026-03-31
-- Description: Switches from user-based SaaS to B2B Academy-based subscriptions.
-- Adds protection so admins cannot invite admins, and missing subscriptions block operations.

BEGIN;

-- ============================================
-- 1. ADD SUBSCRIPTION COLUMNS TO ACADEMIES
-- ============================================

ALTER TABLE academies 
  ADD COLUMN IF NOT EXISTS subscription_tier subscription_tier DEFAULT 'beta_free',
  ADD COLUMN IF NOT EXISTS subscription_status subscription_status DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS subscription_started_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS subscription_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- Backfill existing academies to be active in beta_free
UPDATE academies 
SET 
  subscription_tier = 'beta_free',
  subscription_status = 'active',
  subscription_started_at = COALESCE(subscription_started_at, created_at)
WHERE subscription_tier IS NULL OR subscription_status IS NULL;

-- Index for querying academies based on subscription
CREATE INDEX IF NOT EXISTS idx_academies_subscription 
  ON academies(subscription_tier, subscription_status);

-- ============================================
-- 2. REMOVE SUBSCRIPTION COLUMNS FROM PROFILES
-- ============================================

ALTER TABLE profiles 
  DROP COLUMN IF EXISTS subscription_tier,
  DROP COLUMN IF EXISTS subscription_status,
  DROP COLUMN IF EXISTS subscription_started_at,
  DROP COLUMN IF EXISTS subscription_ends_at,
  DROP COLUMN IF EXISTS stripe_customer_id,
  DROP COLUMN IF EXISTS stripe_subscription_id;

-- ============================================
-- 3. HELPER FUNCTIONS FOR SUBSCRIPTION CHECK
-- ============================================

CREATE OR REPLACE FUNCTION public.check_academy_is_active(acad_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM academies 
    WHERE id = acad_id 
      AND subscription_status IN ('active', 'trialing')
  );
$$;

-- Helper to explicitly get the user's role because the session role might be 'authenticated'
CREATE OR REPLACE FUNCTION public.get_user_role_in_academy(acad_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM academy_members 
  WHERE user_id = auth.uid() 
    AND academy_id = acad_id
    AND is_active = true;
$$;

-- ============================================
-- 4. UPDATE ACADEMY_INVITATIONS RLS (Role Security)
-- ============================================

ALTER TABLE academy_invitations DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "policy_invitations_insert" ON academy_invitations;
DROP POLICY IF EXISTS "policy_invitations_update" ON academy_invitations;

-- Create INSERT POLICY
CREATE POLICY "policy_invitations_insert" ON academy_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User must be at least an admin/owner to even try inserting
    check_is_academy_owner(academy_id) 
    AND (
      -- If the user is an owner, they can invite anyone
      get_user_role_in_academy(academy_id) = 'owner'
      -- If the user is just an admin, they CANNOT invite owners or admins
      OR role NOT IN ('owner', 'admin')
    )
  );

-- Create UPDATE POLICY (In case future UI allows changing an invitation role)
CREATE POLICY "policy_invitations_update" ON academy_invitations
  FOR UPDATE
  TO authenticated
  USING (
    get_user_role_in_academy(academy_id) = 'owner'
  )
  WITH CHECK (
    get_user_role_in_academy(academy_id) = 'owner'
  );

ALTER TABLE academy_invitations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. APPLY PAYMENT LOCKDOWN TO SESSIONS, PLAYERS, LOCATIONS
-- ============================================

-- PLAYERS
DROP POLICY IF EXISTS "Create players in academy" ON players;
CREATE POLICY "Create players in academy" ON players FOR INSERT
  WITH CHECK (
    academy_id = get_current_academy_id() 
    AND has_permission('players.create')
    AND check_academy_is_active(academy_id)
  );

-- SESSIONS
DROP POLICY IF EXISTS "Create sessions in academy" ON sessions;
CREATE POLICY "Create sessions in academy" ON sessions FOR INSERT
  WITH CHECK (
    academy_id = get_current_academy_id() 
    AND has_permission('sessions.create')
    AND check_academy_is_active(academy_id)
  );

-- LOCATIONS (Splitting the FOR ALL to handle INSERT separately if needed, 
-- but since it was FOR ALL USING(...) WITH CHECK(...), we can just update WITH CHECK)
DROP POLICY IF EXISTS "Manage locations in academy" ON locations;
CREATE POLICY "Manage locations in academy" ON locations FOR ALL
  USING (
    academy_id = get_current_academy_id() 
    AND get_user_academy_role() = 'owner'
  )
  WITH CHECK (
    academy_id = get_current_academy_id() 
    AND get_user_academy_role() = 'owner'
    AND check_academy_is_active(academy_id)
  );

-- ============================================
-- 6. UPDATE ACADEMY CREATION RPC (Idempotent Trial)
-- ============================================

CREATE OR REPLACE FUNCTION public.create_academy_with_owner(
    p_name text, 
    p_slug text, 
    p_logo_url text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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

  -- 1. Create Academy with 30-day trial automatically
  INSERT INTO academies (
    name, slug, logo_url, created_by, 
    subscription_tier, subscription_status, subscription_started_at, subscription_ends_at
  )
  VALUES (
    p_name, p_slug, p_logo_url, current_user_id, 
    'beta_free', 'active', now(), now() + interval '30 days'
  )
  RETURNING id, name, slug, logo_url, settings, created_by, created_at, updated_at, is_archived, subscription_tier, subscription_status, subscription_ends_at
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
$function$;

COMMIT;
