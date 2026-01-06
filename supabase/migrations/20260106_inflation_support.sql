-- Migración: Soporte para Inflación y Variaciones de Precio
-- Fecha: 2026-01-06

-- 1. Agregar campos de periodo a transactions
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS billing_month integer,
ADD COLUMN IF NOT EXISTS billing_year integer;

-- 2. Agregar fecha de última actualización de precio a pricing_plans
ALTER TABLE pricing_plans 
ADD COLUMN IF NOT EXISTS price_updated_at timestamptz DEFAULT now();

-- 3. Comentarios descriptivos
COMMENT ON COLUMN transactions.billing_month IS 'Mes al que corresponde el cargo (1-12)';
COMMENT ON COLUMN transactions.billing_year IS 'Año al que corresponde el cargo';
COMMENT ON COLUMN pricing_plans.price_updated_at IS 'Fecha del último cambio de precio del plan';

-- 4. Actualizar cargos automáticos existentes (opcional, para consistencia)
UPDATE transactions 
SET 
    billing_month = EXTRACT(MONTH FROM transaction_date),
    billing_year = EXTRACT(YEAR FROM transaction_date)
WHERE type = 'charge' AND billing_month IS NULL;
