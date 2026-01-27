-- =====================================================
-- 1. ACTUALIZAR VISTA PLAYER_BALANCES (Alumnos Individuales)
-- =====================================================
CREATE OR REPLACE VIEW player_balances 
WITH (security_invoker = true)
AS
SELECT 
    p.id as player_id,
    p.full_name,
    p.coach_id,
    p.academy_id,
    p.unified_payment_group_id,
    COALESCE(SUM(
        CASE 
            WHEN t.type IN ('payment', 'refund') THEN t.amount
            WHEN t.type IN ('charge', 'adjustment') THEN 
                CASE 
                    WHEN t.session_id IS NOT NULL THEN
                        -- DEVENGA SIEMPRE QUE LA CLASE SEA HOY O PASADO
                        CASE 
                            WHEN (SELECT scheduled_at::date FROM sessions WHERE id = t.session_id) <= CURRENT_DATE 
                            THEN -t.amount 
                            ELSE 0 
                        END
                    ELSE -t.amount -- Ajustes manuales cuentan siempre
                END
            ELSE 0
        END
    ), 0) as balance,
    COUNT(t.id) FILTER (WHERE t.type = 'payment') as total_payments,
    MAX(t.transaction_date) FILTER (WHERE t.type = 'payment') as last_payment_date
FROM players p
LEFT JOIN transactions t ON t.player_id = p.id
GROUP BY p.id, p.full_name, p.coach_id, p.academy_id, p.unified_payment_group_id;

-- =====================================================
-- 2. ACTUALIZAR VISTA UNIFIED_PAYMENT_GROUP_BALANCES (Grupos)
-- =====================================================
CREATE OR REPLACE VIEW unified_payment_group_balances AS
SELECT 
    upg.id as group_id,
    upg.name,
    upg.academy_id,
    upg.contact_name,
    upg.contact_email,
    upg.contact_phone,
    upg.is_active,
    
    COALESCE(
        (SELECT COUNT(*) FROM players WHERE unified_payment_group_id = upg.id AND NOT is_archived),
        0
    ) as member_count,
    
    COALESCE(
        (SELECT ARRAY_AGG(json_build_object('id', id, 'full_name', full_name)) 
         FROM players WHERE unified_payment_group_id = upg.id AND NOT is_archived),
        '{}'::json[]
    ) as members,
    
    (
        -- Pagos directos al grupo
        COALESCE(
            (SELECT SUM(CASE 
                WHEN t.type = 'payment' THEN t.amount
                WHEN t.type = 'refund' THEN t.amount
                ELSE 0 END)
            FROM transactions t 
            WHERE t.unified_payment_group_id = upg.id),
        0)
        +
        -- Movimientos individuales de miembros
        COALESCE(
            (SELECT SUM(CASE 
                WHEN t.type = 'payment' THEN t.amount
                WHEN t.type = 'refund' THEN t.amount
                WHEN t.type IN ('charge', 'adjustment') THEN 
                    CASE 
                        WHEN t.session_id IS NOT NULL THEN
                            -- SOLO CUENTA SI LA CLASE ES HOY O PASADO
                            CASE WHEN (SELECT scheduled_at::date FROM sessions WHERE id = t.session_id) <= CURRENT_DATE 
                            THEN -t.amount ELSE 0 END
                        ELSE -t.amount
                    END
                ELSE 0 END)
            FROM transactions t 
            WHERE t.player_id IN (SELECT id FROM players WHERE unified_payment_group_id = upg.id)
               AND t.unified_payment_group_id IS NULL),
        0)
    ) as total_balance

FROM unified_payment_groups upg;
