-- =====================================================
-- Migración: Agregar subscription_id a session_players
-- Permite vincular cada clase con el plan de pago correspondiente
-- Esto es necesario para facturación correcta cuando un alumno tiene múltiples planes
-- Fecha: 2026-01-19
-- =====================================================

-- 1. Agregar columna subscription_id a session_players
ALTER TABLE session_players 
ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES player_subscriptions(id) ON DELETE SET NULL;

-- 2. Crear índice para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_session_players_subscription_id ON session_players(subscription_id);

-- 3. Comentario explicativo
COMMENT ON COLUMN session_players.subscription_id IS 'Reference to the subscription/plan this class session is billed under. Required for correct billing when a player has multiple plans.';
