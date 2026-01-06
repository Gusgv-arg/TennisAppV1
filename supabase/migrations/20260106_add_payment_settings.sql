-- Migración: Agregar campos de configuración de pagos a profiles
-- Fecha: 2026-01-06

-- Agregar campos para módulo de pagos opcional
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS payments_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS payments_simplified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS payments_enabled_at TIMESTAMPTZ;

-- Comentarios descriptivos
COMMENT ON COLUMN profiles.payments_enabled IS 'Si el coach ha activado el módulo de pagos';
COMMENT ON COLUMN profiles.payments_simplified IS 'Si el coach usa modo simplificado (sin montos exactos)';
COMMENT ON COLUMN profiles.payments_enabled_at IS 'Fecha en que activó el módulo';
