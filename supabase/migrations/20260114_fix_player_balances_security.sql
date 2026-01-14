-- =====================================================
-- FIX: Corregir SECURITY DEFINER en vista player_balances
-- Supabase Security Alert: security_definer_view
-- =====================================================
-- 
-- PROBLEMA: La vista player_balances estaba definida con SECURITY DEFINER,
-- lo cual significa que las políticas RLS se evalúan con los permisos del
-- creador de la vista, no del usuario que consulta.
--
-- SOLUCIÓN: Usar SECURITY INVOKER para que las políticas RLS de las tablas
-- subyacentes (players, transactions) se apliquen correctamente según el
-- usuario autenticado. Esto funcionará con el sistema de academias porque:
--   - La política "View players in academy" filtra por academy_id y has_permission('players.view')
--   - La política "View own transactions in academy" filtra por academy_id y role/recorded_by
--
-- Incluimos academy_id en la vista para permitir filtrado adicional si es necesario.
-- =====================================================

-- Eliminar la vista existente
DROP VIEW IF EXISTS player_balances;

-- Recrear la vista con SECURITY INVOKER
-- Las políticas RLS de players y transactions se aplicarán automáticamente
CREATE VIEW player_balances 
WITH (security_invoker = true)
AS
SELECT 
    p.id as player_id,
    p.full_name,
    p.coach_id,
    p.academy_id,  -- Incluido para compatibilidad con el sistema de academias
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
GROUP BY p.id, p.full_name, p.coach_id, p.academy_id;

-- Conceder permisos a los roles de Supabase
GRANT SELECT ON player_balances TO authenticated;
GRANT SELECT ON player_balances TO service_role;

-- =====================================================
-- POLÍTICA ADICIONAL: Admin bypass para transactions
-- =====================================================
-- La tabla players ya tiene "Admins manage all players", pero
-- transactions no tenía una política equivalente. Sin esto,
-- el superadmin no podría ver transacciones a través de la vista.

CREATE POLICY "Admins manage all transactions" ON transactions FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- =====================================================
-- VERIFICACIÓN: Después de aplicar:
-- - Usuarios con role='admin' en profiles → ven TODOS los balances
-- - Usuarios normales → solo ven balances de su academia actual
-- =====================================================
