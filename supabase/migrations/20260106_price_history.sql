-- Migración: Historial de Precios Dinámico
-- Fecha: 2026-01-06

-- 1. Crear tabla de historial de precios
CREATE TABLE IF NOT EXISTS pricing_plan_prices (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    plan_id uuid REFERENCES pricing_plans(id) ON DELETE CASCADE,
    amount numeric NOT NULL CHECK (amount >= 0),
    valid_from timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id)
);

-- 2. Migrar precios actuales a la tabla de historial
-- Usamos la fecha de creación del plan como fecha de inicio
INSERT INTO pricing_plan_prices (plan_id, amount, valid_from, created_at)
SELECT id, amount, created_at, created_at
FROM pricing_plans
ON CONFLICT DO NOTHING;

-- 3. Habilitar RLS
ALTER TABLE pricing_plan_prices ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de RLS
-- Los usuarios pueden leer precios de sus propios planes
CREATE POLICY "Coaches can view prices of their plans" 
ON pricing_plan_prices FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM pricing_plans 
        WHERE pricing_plans.id = pricing_plan_prices.plan_id 
        AND pricing_plans.coach_id = auth.uid()
    )
);

-- Los usuarios pueden insertar precios en sus propios planes
CREATE POLICY "Coaches can insert prices into their plans" 
ON pricing_plan_prices FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM pricing_plans 
        WHERE pricing_plans.id = pricing_plan_prices.plan_id 
        AND pricing_plans.coach_id = auth.uid()
    )
);

-- Los usuarios pueden eliminar sus propios registros de precio
CREATE POLICY "Coaches can delete their own plan prices" 
ON pricing_plan_prices FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM pricing_plans 
        WHERE pricing_plans.id = pricing_plan_prices.plan_id 
        AND pricing_plans.coach_id = auth.uid()
    )
);

-- 5. Comentarios
COMMENT ON TABLE pricing_plan_prices IS 'Historial de precios para cada plan de entrenamiento';
COMMENT ON COLUMN pricing_plan_prices.valid_from IS 'Fecha a partir de la cual este precio entra en vigencia';
