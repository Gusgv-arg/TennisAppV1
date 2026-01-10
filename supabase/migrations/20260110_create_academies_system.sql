-- Migration: Create Academies System
-- Description: Multi-tenant academy system with roles and permissions
-- Date: 2026-01-10

-- ============================================
-- 1. NEW TABLES
-- ============================================

-- ACADEMIES (main tenant table)
CREATE TABLE IF NOT EXISTS academies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo_url text,
  
  -- Configuration
  settings jsonb DEFAULT '{
    "currency": "ARS",
    "timezone": "America/Argentina/Buenos_Aires",
    "payments_enabled": true
  }',
  
  -- Metadata
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_academies_slug ON academies(slug);
CREATE INDEX IF NOT EXISTS idx_academies_created_by ON academies(created_by);

-- ACADEMY MEMBERS (users belonging to academies with roles)
CREATE TABLE IF NOT EXISTS academy_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id uuid NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Role and permissions
  role text NOT NULL CHECK (role IN ('owner', 'coach', 'assistant', 'viewer')),
  custom_permissions jsonb DEFAULT '{}',
  
  -- Tracking
  invited_by uuid REFERENCES auth.users(id),
  invited_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  
  -- Status
  is_active boolean DEFAULT true,
  
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(academy_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_academy_members_user ON academy_members(user_id);
CREATE INDEX IF NOT EXISTS idx_academy_members_academy ON academy_members(academy_id);
CREATE INDEX IF NOT EXISTS idx_academy_members_role ON academy_members(role);

-- ACADEMY INVITATIONS (pending invitations)
CREATE TABLE IF NOT EXISTS academy_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id uuid NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  
  -- Invited person
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('coach', 'assistant', 'viewer')),
  
  -- Invitation token
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  
  -- Tracking
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_academy_invitations_token ON academy_invitations(token);
CREATE INDEX IF NOT EXISTS idx_academy_invitations_email ON academy_invitations(email);

-- ============================================
-- 2. MODIFY EXISTING TABLES
-- ============================================

-- Add current_academy_id to profiles
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS current_academy_id uuid REFERENCES academies(id);

-- Add academy_id to players
ALTER TABLE players 
  ADD COLUMN IF NOT EXISTS academy_id uuid REFERENCES academies(id),
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Add academy_id to sessions
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS academy_id uuid REFERENCES academies(id);

-- Add academy_id to locations
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS academy_id uuid REFERENCES academies(id);

-- Add academy_id to pricing_plans
ALTER TABLE pricing_plans
  ADD COLUMN IF NOT EXISTS academy_id uuid REFERENCES academies(id);

-- Add academy_id and recorded_by to transactions
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS academy_id uuid REFERENCES academies(id),
  ADD COLUMN IF NOT EXISTS recorded_by uuid REFERENCES auth.users(id);

-- Add academy_id to videos
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS academy_id uuid REFERENCES academies(id);

-- Add academy_id to analyses
ALTER TABLE analyses
  ADD COLUMN IF NOT EXISTS academy_id uuid REFERENCES academies(id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_players_academy ON players(academy_id);
CREATE INDEX IF NOT EXISTS idx_sessions_academy ON sessions(academy_id);
CREATE INDEX IF NOT EXISTS idx_locations_academy ON locations(academy_id);
CREATE INDEX IF NOT EXISTS idx_pricing_plans_academy ON pricing_plans(academy_id);
CREATE INDEX IF NOT EXISTS idx_transactions_academy ON transactions(academy_id);

-- ============================================
-- 3. HELPER FUNCTIONS
-- ============================================

-- Get current academy ID for the authenticated user
CREATE OR REPLACE FUNCTION get_current_academy_id()
RETURNS uuid AS $$
  SELECT current_academy_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get user's role in current academy
CREATE OR REPLACE FUNCTION get_user_academy_role()
RETURNS text AS $$
  SELECT role FROM academy_members 
  WHERE user_id = auth.uid() 
    AND academy_id = get_current_academy_id()
    AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user is a member of a specific academy
CREATE OR REPLACE FUNCTION is_academy_member(acad_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM academy_members 
    WHERE user_id = auth.uid() 
      AND academy_id = acad_id 
      AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user has a specific permission
CREATE OR REPLACE FUNCTION has_permission(perm text)
RETURNS boolean AS $$
DECLARE
  user_role text;
  custom_perms jsonb;
BEGIN
  SELECT role, custom_permissions INTO user_role, custom_perms
  FROM academy_members 
  WHERE user_id = auth.uid() 
    AND academy_id = get_current_academy_id()
    AND is_active = true;
  
  -- No membership = no permission
  IF user_role IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check custom permissions override first
  IF custom_perms ? perm THEN
    RETURN (custom_perms->>perm)::boolean;
  END IF;
  
  -- Default permissions by role
  RETURN CASE user_role
    WHEN 'owner' THEN true
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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Generate URL-friendly slug from text
CREATE OR REPLACE FUNCTION generate_slug(input_text text)
RETURNS text AS $$
  SELECT LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        TRIM(input_text),
        '[^a-zA-Z0-9\s-]', '', 'g'
      ),
      '\s+', '-', 'g'
    )
  );
$$ LANGUAGE sql IMMUTABLE;

-- ============================================
-- 4. TRIGGERS
-- ============================================

-- Trigger for academies updated_at
CREATE TRIGGER tr_academies_updated_at 
  BEFORE UPDATE ON academies 
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================
-- 5. ENABLE RLS ON NEW TABLES
-- ============================================

ALTER TABLE academies ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_invitations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. RLS POLICIES FOR NEW TABLES
-- ============================================

-- ACADEMIES
CREATE POLICY "Members can view their academies" ON academies FOR SELECT
  USING (is_academy_member(id));

CREATE POLICY "Authenticated users can create academies" ON academies FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owners can update their academy" ON academies FOR UPDATE
  USING (
    id = get_current_academy_id() 
    AND get_user_academy_role() = 'owner'
  );

CREATE POLICY "Owners can delete their academy" ON academies FOR DELETE
  USING (
    id = get_current_academy_id() 
    AND get_user_academy_role() = 'owner'
  );

-- ACADEMY_MEMBERS
CREATE POLICY "Members can view team" ON academy_members FOR SELECT
  USING (
    academy_id = get_current_academy_id() 
    AND has_permission('team.view')
  );

CREATE POLICY "Owners can manage members" ON academy_members FOR INSERT
  WITH CHECK (
    academy_id = get_current_academy_id() 
    AND get_user_academy_role() = 'owner'
  );

CREATE POLICY "Owners can update members" ON academy_members FOR UPDATE
  USING (
    academy_id = get_current_academy_id() 
    AND get_user_academy_role() = 'owner'
  );

CREATE POLICY "Owners can remove members" ON academy_members FOR DELETE
  USING (
    academy_id = get_current_academy_id() 
    AND get_user_academy_role() = 'owner'
    AND role != 'owner' -- Can't delete owner
  );

-- ACADEMY_INVITATIONS
CREATE POLICY "Owners can view invitations" ON academy_invitations FOR SELECT
  USING (
    academy_id = get_current_academy_id() 
    AND get_user_academy_role() = 'owner'
  );

CREATE POLICY "Owners can create invitations" ON academy_invitations FOR INSERT
  WITH CHECK (
    academy_id = get_current_academy_id() 
    AND get_user_academy_role() = 'owner'
  );

CREATE POLICY "Owners can delete invitations" ON academy_invitations FOR DELETE
  USING (
    academy_id = get_current_academy_id() 
    AND get_user_academy_role() = 'owner'
  );

-- Public can view invitation by token (for accepting)
CREATE POLICY "Anyone can view invitation by token" ON academy_invitations FOR SELECT
  USING (true); -- Token validation happens in application logic

-- ============================================
-- 7. UPDATE EXISTING RLS POLICIES
-- ============================================

-- PLAYERS: Update to use academy-based access
DROP POLICY IF EXISTS "Coaches manage own players" ON players;

CREATE POLICY "View players in academy" ON players FOR SELECT
  USING (
    academy_id = get_current_academy_id() 
    AND has_permission('players.view')
  );

CREATE POLICY "Create players in academy" ON players FOR INSERT
  WITH CHECK (
    academy_id = get_current_academy_id() 
    AND has_permission('players.create')
  );

CREATE POLICY "Edit players in academy" ON players FOR UPDATE
  USING (
    academy_id = get_current_academy_id() 
    AND has_permission('players.edit')
  );

CREATE POLICY "Delete players in academy" ON players FOR DELETE
  USING (
    academy_id = get_current_academy_id() 
    AND has_permission('players.archive')
  );

-- SESSIONS: Update to use academy-based access
DROP POLICY IF EXISTS "Coaches manage own sessions" ON sessions;

CREATE POLICY "View sessions in academy" ON sessions FOR SELECT
  USING (
    academy_id = get_current_academy_id() 
    AND has_permission('sessions.view')
  );

CREATE POLICY "Create sessions in academy" ON sessions FOR INSERT
  WITH CHECK (
    academy_id = get_current_academy_id() 
    AND has_permission('sessions.create')
  );

CREATE POLICY "Edit sessions in academy" ON sessions FOR UPDATE
  USING (
    academy_id = get_current_academy_id() 
    AND has_permission('sessions.edit')
  );

CREATE POLICY "Delete sessions in academy" ON sessions FOR DELETE
  USING (
    academy_id = get_current_academy_id() 
    AND has_permission('sessions.delete')
  );

-- LOCATIONS: Update to use academy-based access
DROP POLICY IF EXISTS "Coaches manage own locations" ON locations;

CREATE POLICY "View locations in academy" ON locations FOR SELECT
  USING (
    academy_id = get_current_academy_id() 
    AND has_permission('locations.view')
  );

CREATE POLICY "Manage locations in academy" ON locations FOR ALL
  USING (
    academy_id = get_current_academy_id() 
    AND get_user_academy_role() = 'owner'
  );

-- PRICING_PLANS: Update to use academy-based access
DROP POLICY IF EXISTS "Coaches manage own pricing plans" ON pricing_plans;

CREATE POLICY "View pricing plans in academy" ON pricing_plans FOR SELECT
  USING (
    academy_id = get_current_academy_id()
    AND has_permission('plans.view')
  );

CREATE POLICY "Manage pricing plans in academy" ON pricing_plans FOR ALL
  USING (
    academy_id = get_current_academy_id() 
    AND get_user_academy_role() = 'owner'
  );

-- TRANSACTIONS: Update to use academy-based access
DROP POLICY IF EXISTS "Coaches manage own transactions" ON transactions;

CREATE POLICY "View own transactions in academy" ON transactions FOR SELECT
  USING (
    academy_id = get_current_academy_id() 
    AND (
      get_user_academy_role() = 'owner' 
      OR recorded_by = auth.uid()
    )
  );

CREATE POLICY "Record transactions in academy" ON transactions FOR INSERT
  WITH CHECK (
    academy_id = get_current_academy_id() 
    AND has_permission('payments.record')
  );

CREATE POLICY "Owner manages transactions" ON transactions FOR ALL
  USING (
    academy_id = get_current_academy_id() 
    AND get_user_academy_role() = 'owner'
  );

-- ============================================
-- 8. STAFF_MEMBERS: Keep for backwards compatibility
-- ============================================
-- The staff_members table will be deprecated but kept for now
-- New code should use academy_members instead
