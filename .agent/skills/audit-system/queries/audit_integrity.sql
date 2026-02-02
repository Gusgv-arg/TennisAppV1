-- =====================================================
-- Tennis App System Integrity Audit
-- Run this script in Supabase SQL Editor to check for data anomalies.
-- =====================================================

-- 1. ORPHANED RECORDS
-- Check for session players pointing to non-existent sessions
SELECT 'Orphaned Session Players' as check_name, count(*) as count 
FROM session_players sp 
LEFT JOIN sessions s ON sp.session_id = s.id 
WHERE s.id IS NULL;

-- Check for transactions pointing to non-existent players
SELECT 'Orphaned Transactions' as check_name, count(*) as count 
FROM transactions t 
LEFT JOIN players p ON t.player_id = p.id 
WHERE p.id IS NULL;

-- 2. SUBSCRIPTION INTEGRITY
-- Check for multiple active subscriptions per player
-- (Warning: Valid in rare cases, but usually an error in logic)
SELECT p.full_name, count(*) as active_subs_count
FROM player_subscriptions ps
JOIN players p ON ps.player_id = p.id
WHERE ps.status = 'active'
GROUP BY p.full_name, ps.player_id
HAVING count(*) > 1;

-- Check for negative remaining classes
SELECT p.full_name, ps.remaining_classes
FROM player_subscriptions ps
JOIN players p ON ps.player_id = p.id
WHERE ps.remaining_classes < 0;

-- 3. FINANCIAL INTEGRITY
-- Check for Mismatch between 'player_balances' view and raw transaction sum
-- This is a sampling check (checking top 10 discrepancies)
WITH calculated_balance AS (
    SELECT 
        player_id,
        SUM(CASE 
            WHEN type IN ('payment', 'refund') THEN amount
            WHEN type IN ('charge', 'adjustment') THEN -amount
            ELSE 0
        END) as raw_balance
    FROM transactions
    GROUP BY player_id
)
SELECT 
    pb.full_name,
    pb.balance as view_balance,
    cb.raw_balance,
    (pb.balance - cb.raw_balance) as diff
FROM player_balances pb
JOIN calculated_balance cb ON pb.player_id = cb.player_id
WHERE (pb.balance - cb.raw_balance) <> 0
ORDER BY ABS(diff) DESC
LIMIT 10;

-- 4. SESSION AUDIT
-- Check for hard-deleted sessions that might have left lingering charges
-- (Note: If session is gone, we can't easily link charges unless transaction has session_id)
-- We check for transactions with session_id that doesn't exist anymore
SELECT count(*) as orphaned_session_charges
FROM transactions t
LEFT JOIN sessions s ON t.session_id = s.id
WHERE t.session_id IS NOT NULL 
AND t.type = 'charge'
AND s.id IS NULL;
-- Note: If this count > 0, it means we have charges for classes that no longer exist (Hard Delete without Refund/Cleanup).

-- 5. REFUND AUDIT (Last 24h)
-- Check recent refunds to ensure they have email in description
SELECT 
    created_at, 
    description, 
    amount 
FROM transactions 
WHERE type = 'refund' 
AND created_at > (now() - interval '24 hours')
ORDER BY created_at DESC;
