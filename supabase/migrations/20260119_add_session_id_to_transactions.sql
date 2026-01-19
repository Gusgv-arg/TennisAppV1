-- =====================================================
-- Migración: Agregar session_id a transactions
-- Permite trackear qué clases ya fueron cobradas (para plans per_class)
-- Fecha: 2026-01-19
-- =====================================================

-- 1. Agregar columna session_id a transactions
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES sessions(id) ON DELETE SET NULL;

-- 2. Crear índice para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_transactions_session_id ON transactions(session_id);

-- 3. Comentario explicativo
COMMENT ON COLUMN transactions.session_id IS 'Reference to session for per-class billing. NULL for monthly charges.';
