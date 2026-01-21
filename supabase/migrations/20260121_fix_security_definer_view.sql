-- Migration: Fix Security Definer View
-- Description: Change unified_payment_group_balances view to use SECURITY INVOKER
-- Date: 2026-01-21

-- Drop the existing view
DROP VIEW IF EXISTS unified_payment_group_balances;

-- Recreate with SECURITY INVOKER to respect RLS policies
CREATE OR REPLACE VIEW unified_payment_group_balances 
WITH (security_invoker = true)
AS
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

COMMENT ON VIEW unified_payment_group_balances IS 'View of unified payment groups with calculated balances. Uses SECURITY INVOKER to respect RLS policies.';
