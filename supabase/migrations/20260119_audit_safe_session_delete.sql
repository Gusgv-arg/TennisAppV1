-- =====================================================
-- Migración: Auditoría y Reembolso Automático al Eliminar Clases
-- Fecha: 2026-01-19
-- Objetivo: Al borrar una sesión, no borrar el cobro (audit), 
-- sino generar un reembolso automático que anule el saldo.
-- =====================================================

-- 1. Función Trigger
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
        
        -- Construir descripción para el reembolso
        refund_description := 'Reembolso por anulación de clase: ' || TO_CHAR(OLD.scheduled_at, 'DD/MM/YYYY HH24:MI');

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
            charge_record.billing_month, -- Mantener mes de facturación (o usar actual?) -> Mejor usar el del cobro para anular ese periodo? O actual?
                                         -- Si usamos el del cobro, anulamos contablemente ese mes. Si usamos actual, anulamos hoy.
                                         -- Para "Credit", da igual. Usaremos los del record original por consistencia.
            charge_record.billing_year,
            now()
        );

        -- NOTA: La transacción original (charge) NO se toca. 
        -- Al borrarse la sesión, su session_id pasará a NULL (por ON DELETE SET NULL existente),
        -- pero quedará en la historia como que existió.

    END LOOP;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Crear Trigger BEFORE DELETE
DROP TRIGGER IF EXISTS tr_audit_session_delete ON sessions;

CREATE TRIGGER tr_audit_session_delete
BEFORE DELETE ON sessions
FOR EACH ROW
EXECUTE FUNCTION handle_session_delete_audit();

-- 3. Comentario
COMMENT ON FUNCTION handle_session_delete_audit IS 'Generates refund transactions when a session with charges is deleted, preserving audit trail.';
