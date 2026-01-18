-- =====================================================
-- Actualizar vista player_balances para incluir unified_payment_group_id
-- Esto permite que el modal de pagos sepa si un alumno pertenece a un grupo
-- =====================================================

-- Eliminar la vista existente
DROP VIEW IF EXISTS player_balances;

-- Recrear la vista con unified_payment_group_id
CREATE VIEW player_balances 
WITH (security_invoker = true)
AS
SELECT 
    p.id as player_id,
    p.full_name,
    p.coach_id,
    p.academy_id,
    p.unified_payment_group_id,  -- Nuevo campo para pago unificado
    COALESCE(SUM(
        CASE 
            WHEN t.type IN ('payment', 'refund') THEN t.amount
            WHEN t.type IN ('charge', 'adjustment') THEN -t.amount
            ELSE 0
        END
    ), 0) as balance,
    COUNT(t.id) FILTER (WHERE t.type = 'payment') as total_payments,
    MAX(t.transaction_date) FILTER (WHERE t.type = 'payment') as last_payment_date
FROM players p
LEFT JOIN transactions t ON t.player_id = p.id
GROUP BY p.id, p.full_name, p.coach_id, p.academy_id, p.unified_payment_group_id;

-- Conceder permisos a los roles de Supabase
GRANT SELECT ON player_balances TO authenticated;
GRANT SELECT ON player_balances TO service_role;
