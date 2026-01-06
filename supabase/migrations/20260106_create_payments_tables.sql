-- =====================================================
-- SISTEMA DE PAGOS - Fase 1
-- =====================================================

-- Tabla: pricing_plans (Planes de precio del coach)
CREATE TABLE IF NOT EXISTS pricing_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name text NOT NULL,
    type text NOT NULL CHECK (type IN ('monthly', 'per_class', 'package', 'custom')),
    amount numeric NOT NULL DEFAULT 0,
    currency text NOT NULL DEFAULT 'ARS',
    package_classes integer, -- Solo para tipo 'package'
    description text,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Tabla: player_subscriptions (Asignación de planes a alumnos)
CREATE TABLE IF NOT EXISTS player_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    plan_id uuid REFERENCES pricing_plans(id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
    start_date date NOT NULL DEFAULT CURRENT_DATE,
    end_date date,
    remaining_classes integer, -- Para paquetes
    custom_amount numeric, -- Override del precio del plan
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Tabla: transactions (Pagos, cargos, ajustes)
CREATE TABLE IF NOT EXISTS transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    subscription_id uuid REFERENCES player_subscriptions(id) ON DELETE SET NULL,
    type text NOT NULL CHECK (type IN ('payment', 'charge', 'adjustment', 'refund')),
    amount numeric NOT NULL,
    currency text NOT NULL DEFAULT 'ARS',
    payment_method text CHECK (payment_method IN ('cash', 'transfer', 'mercadopago', 'card', 'other')),
    description text,
    reference text, -- Número de comprobante, etc
    transaction_date date NOT NULL DEFAULT CURRENT_DATE,
    created_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES profiles(id)
);

-- Vista: player_balances (Balance calculado por alumno)
CREATE OR REPLACE VIEW player_balances AS
SELECT 
    p.id as player_id,
    p.full_name,
    p.coach_id,
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
GROUP BY p.id, p.full_name, p.coach_id;

-- Índices
CREATE INDEX IF NOT EXISTS idx_transactions_player_id ON transactions(player_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_pricing_plans_coach ON pricing_plans(coach_id);
CREATE INDEX IF NOT EXISTS idx_player_subscriptions_player ON player_subscriptions(player_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_pricing_plans_modtime ON pricing_plans;
CREATE TRIGGER update_pricing_plans_modtime
    BEFORE UPDATE ON pricing_plans
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_player_subscriptions_modtime ON player_subscriptions;
CREATE TRIGGER update_player_subscriptions_modtime
    BEFORE UPDATE ON player_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE pricing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Pricing Plans: Coach puede ver/editar sus propios planes
CREATE POLICY "Coach manages own plans" ON pricing_plans
    FOR ALL USING (coach_id = auth.uid());

-- Player Subscriptions: Coach puede gestionar suscripciones de sus alumnos
CREATE POLICY "Coach manages player subscriptions" ON player_subscriptions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM players 
            WHERE players.id = player_subscriptions.player_id 
            AND players.coach_id = auth.uid()
        )
    );

-- Transactions: Coach puede gestionar transacciones de sus alumnos
CREATE POLICY "Coach manages player transactions" ON transactions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM players 
            WHERE players.id = transactions.player_id 
            AND players.coach_id = auth.uid()
        )
    );

-- =====================================================
-- NOTA: Ejecutar en Supabase SQL Editor
-- =====================================================
