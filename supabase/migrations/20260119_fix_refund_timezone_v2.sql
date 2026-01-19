-- =====================================================
-- Migración: Corregir Timezone en Reembolso (V2)
-- Fecha: 2026-01-19
-- Objetivo: corregir la sintaxis de conversión de zona horaria
-- para asegurar que scheduled_at (UTC) se pase a 'America/Argentina/Buenos_Aires'.
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
        -- La sintaxis correcta es: timestampUTC AT TIME ZONE 'TargetZone'
        -- Esto retorna un TIMESTAMP (sin zona) con la hora local correcta.
        refund_description := 'Reembolso por anulación de clase: ' || 
                              TO_CHAR(OLD.scheduled_at AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI');

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
