-- Migration: Add get_payment_stats_skill RPC
-- Description: Server-side aggregation of payment statistics to eliminate N+1 queries
-- Date: 2026-01-24
-- Best Practices: 
-- 1. Eliminates N+1 queries (Rule 6.2)
-- 2. Uses SECURITY DEFINER with explicit filtering (Rule 3.1)
-- 3. Uses lowercase identifiers (Rule 4.5)

CREATE OR REPLACE FUNCTION get_payment_stats_skill(
    p_coach_id UUID,
    p_start_date TIMESTAMP WITH TIME ZONE,
    p_academy_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_total_collected NUMERIC;
    v_individual_pending NUMERIC;
    v_group_pending NUMERIC;
    v_individual_debtors INT;
    v_group_debtors INT;
    v_total_individual_players INT;
    v_total_groups INT;
    v_result JSONB;
BEGIN
    -- 1. Total Collected (This Month)
    SELECT COALESCE(SUM(t.amount), 0)
    INTO v_total_collected
    FROM transactions t
    JOIN players p ON t.player_id = p.id
    WHERE p.coach_id = p_coach_id
    AND t.type = 'payment'
    AND t.transaction_date >= p_start_date::date
    AND (p_academy_id IS NULL OR p.academy_id = p_academy_id);

    -- 2. Individual Balances (Players NOT in a group)
    SELECT 
        COALESCE(SUM(CASE WHEN balance < 0 THEN ABS(balance) ELSE 0 END), 0),
        COUNT(*) FILTER (WHERE balance < 0),
        COUNT(*)
    INTO v_individual_pending, v_individual_debtors, v_total_individual_players
    FROM player_balances
    WHERE coach_id = p_coach_id
    AND unified_payment_group_id IS NULL
    AND (p_academy_id IS NULL OR academy_id = p_academy_id);

    -- 3. Group Balances
    SELECT 
        COALESCE(SUM(CASE WHEN total_balance < 0 THEN ABS(total_balance) ELSE 0 END), 0),
        COUNT(*) FILTER (WHERE total_balance < 0),
        COUNT(*)
    INTO v_group_pending, v_group_debtors, v_total_groups
    FROM unified_payment_group_balances upgb
    JOIN academy_members am ON upgb.academy_id = am.academy_id
    WHERE am.user_id = p_coach_id
    AND upgb.is_active = true
    AND (p_academy_id IS NULL OR upgb.academy_id = p_academy_id);

    -- 4. Construct Result
    v_result := jsonb_build_object(
        'totalCollected', v_total_collected,
        'totalPending', v_individual_pending + v_group_pending,
        'debtorsCount', v_individual_debtors + v_group_debtors,
        'totalPlayers', v_total_individual_players + v_total_groups
    );

    RETURN v_result;
END;
$$;
