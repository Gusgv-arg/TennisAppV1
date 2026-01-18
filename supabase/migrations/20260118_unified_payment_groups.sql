-- Migration: Unified Billing Accounts
-- Description: Groups students under a single payment responsible
-- Date: 2026-01-18

-- ============================================
-- 1. CREATE BILLING_ACCOUNTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS unified_payment_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id uuid NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
    
    -- Group information
    name text NOT NULL,                    -- "Familia Pérez"
    
    -- Payment responsible contact info
    contact_name text,                     -- "Juan Pérez"
    contact_email text,
    contact_phone text,
    
    -- Metadata
    notes text,
    is_active boolean DEFAULT true,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_unified_payment_groups_academy ON unified_payment_groups(academy_id);
CREATE INDEX IF NOT EXISTS idx_unified_payment_groups_active ON unified_payment_groups(academy_id, is_active);

-- Trigger for updated_at
CREATE TRIGGER tr_unified_payment_groups_updated_at
    BEFORE UPDATE ON unified_payment_groups
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================
-- 2. ADD FK TO PLAYERS
-- ============================================

ALTER TABLE players 
ADD COLUMN IF NOT EXISTS unified_payment_group_id uuid REFERENCES unified_payment_groups(id) ON DELETE SET NULL;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_players_unified_payment_group ON players(unified_payment_group_id);

-- ============================================
-- 3. ADD FK TO TRANSACTIONS
-- ============================================

ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS unified_payment_group_id uuid REFERENCES unified_payment_groups(id) ON DELETE SET NULL;

-- Index for performance  
CREATE INDEX IF NOT EXISTS idx_transactions_unified_payment_group ON transactions(unified_payment_group_id);

-- ============================================
-- 4. ENABLE RLS
-- ============================================

ALTER TABLE unified_payment_groups ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. RLS POLICIES
-- ============================================

-- View unified payment groups in academy
CREATE POLICY "View unified payment groups in academy" ON unified_payment_groups FOR SELECT
    USING (
        academy_id = get_current_academy_id() 
        AND has_permission('payments.view')
    );

-- Create unified payment groups (owner only)
CREATE POLICY "Create unified payment groups" ON unified_payment_groups FOR INSERT
    WITH CHECK (
        academy_id = get_current_academy_id() 
        AND get_user_academy_role() = 'owner'
    );

-- Update unified payment groups (owner only)
CREATE POLICY "Update unified payment groups" ON unified_payment_groups FOR UPDATE
    USING (
        academy_id = get_current_academy_id() 
        AND get_user_academy_role() = 'owner'
    );

-- Delete unified payment groups (owner only)
CREATE POLICY "Delete unified payment groups" ON unified_payment_groups FOR DELETE
    USING (
        academy_id = get_current_academy_id() 
        AND get_user_academy_role() = 'owner'
    );

-- ============================================
-- 6. VIEW FOR UNIFIED BALANCE
-- ============================================

CREATE OR REPLACE VIEW unified_payment_group_balances AS
SELECT 
    upg.id as group_id,
    upg.name,
    upg.academy_id,
    upg.contact_name,
    upg.contact_email,
    upg.contact_phone,
    upg.is_active,
    
    -- Member information
    COALESCE(
        (SELECT COUNT(*) FROM players WHERE unified_payment_group_id = upg.id AND NOT is_archived),
        0
    ) as member_count,
    
    COALESCE(
        (SELECT ARRAY_AGG(json_build_object('id', id, 'full_name', full_name)) 
         FROM players WHERE unified_payment_group_id = upg.id AND NOT is_archived),
        '{}'::json[]
    ) as members,
    
    -- Total balance calculation
    -- Balance = payments to group + individual payments from members - all charges from members
    (
        -- Payments made directly to the group
        COALESCE(
            (SELECT SUM(CASE 
                WHEN t.type = 'payment' THEN t.amount
                WHEN t.type = 'refund' THEN t.amount
                ELSE 0 END)
            FROM transactions t 
            WHERE t.unified_payment_group_id = upg.id),
        0)
        +
        -- Individual payments and charges from members (when not part of group payment)
        COALESCE(
            (SELECT SUM(CASE 
                WHEN t.type = 'payment' THEN t.amount
                WHEN t.type = 'refund' THEN t.amount
                WHEN t.type IN ('charge', 'adjustment') THEN -t.amount
                ELSE 0 END)
            FROM transactions t 
            WHERE t.player_id IN (SELECT id FROM players WHERE unified_payment_group_id = upg.id)
               AND t.unified_payment_group_id IS NULL),
        0)
    ) as total_balance

FROM unified_payment_groups upg;

-- ============================================
-- 7. COMMENTS
-- ============================================

COMMENT ON TABLE unified_payment_groups IS 'Groups of students that share a single payment responsible (e.g., family accounts)';
COMMENT ON COLUMN unified_payment_groups.name IS 'Display name for the group, e.g., "Familia Pérez"';
COMMENT ON COLUMN unified_payment_groups.contact_name IS 'Name of the payment responsible person';
COMMENT ON COLUMN players.unified_payment_group_id IS 'Optional reference to unified payment group this player belongs to';
COMMENT ON COLUMN transactions.unified_payment_group_id IS 'If set, this transaction applies to the entire group rather than individual player';
