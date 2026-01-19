-- =====================================================
-- Migración: Corregir Timezone en Reembolso Automático
-- Fecha: 2026-01-19
-- Objetivo: Asegurar que la hora mostrada en la descripción
-- del reembolso sea la hora local (Argentina) y no UTC.
-- =====================================================

CREATE OR REPLACE FUNCTION handle_session_delete_audit()
RETURNS TRIGGER AS $$
DECLARE
    charge_record RECORD;
    refund_description TEXT;
BEGIN
    -- Buscar transacciones de tipo 'charge' asociadas a esta sesión
    FOR charge_record IN 
        SELECT * FROM transactions 
        WHERE session_id = OLD.id 
        AND type = 'charge'
    LOOP
        
        -- Construir descripción para el reembolso con Timezone ARGENTINA
        -- Se asume que scheduled_at está almacenado en UTC (timestamptz estándar)
        refund_description := 'Reembolso por anulación de clase: ' || 
                              TO_CHAR(OLD.scheduled_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI');

        -- Insertar TRANSACCIÓN DE REEMBOLSO
        INSERT INTO transactions (
            player_id,
            unified_payment_group_id,
            type,
            amount,
            currency,
            description,
            transaction_date,
            billing_month,
            billing_year,
            created_at
        ) VALUES (
            charge_record.player_id,
            charge_record.unified_payment_group_id,
            'refund',               -- Tipo: Reembolso (suma al saldo)
            charge_record.amount,   -- Mismo monto que el cobro
            charge_record.currency,
            refund_description,
            now(),                  -- Fecha actual
            charge_record.billing_month,
            charge_record.billing_year,
            now()
        );

    END LOOP;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
