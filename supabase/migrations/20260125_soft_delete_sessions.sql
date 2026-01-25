-- =====================================================
-- Migración: Soft Delete para Sesiones
-- Fecha: 2026-01-25
-- Descripción:
-- 1. Agrega columna deleted_at a sessions.
-- 2. Crea índice parcial para optimizar queries de sesiones activas.
-- 3. Actualiza el trigger de auditoría financiera para responder a Soft Deletes.
-- =====================================================

-- 1. Schema Changes
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- 2. Indexing (Best Practice: Partial Index for active rows)
-- Mejora performance de queries que filtran deleted_at IS NULL
DROP INDEX IF EXISTS idx_sessions_active_schedule;
CREATE INDEX idx_sessions_active_schedule 
ON sessions (coach_id, scheduled_at) 
WHERE deleted_at IS NULL;

-- 3. Actualizar Función de Auditoría
-- Modificamos la función para que entienda que ahora el evento disparador es un UPDATE (Soft Delete)
-- y no solo un DELETE.
CREATE OR REPLACE FUNCTION handle_session_delete_audit()
RETURNS TRIGGER AS $$
DECLARE
    charge_record RECORD;
    refund_description TEXT;
    is_soft_delete BOOLEAN;
BEGIN
    -- Determinar si es un Soft Delete (UPDATE setting deleted_at) o Hard Delete (DELETE)
    is_soft_delete := (TG_OP = 'UPDATE' AND OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL);

    -- Si es UPDATE pero no es un soft delete (ej. cambio de hora), salir.
    IF TG_OP = 'UPDATE' AND NOT is_soft_delete THEN
        RETURN NEW;
    END IF;

    -- Buscar transacciones de tipo 'charge' asociadas a esta sesión
    -- Nota: Si es UPDATE, el ID no cambia, usamos NEW.id (o OLD.id, son iguales).
    -- Si es DELETE, usamos OLD.id.
    FOR charge_record IN 
        SELECT * FROM transactions 
        WHERE session_id = OLD.id 
        AND type = 'charge'
    LOOP
        
        -- Construir descripción para el reembolso
        refund_description := 'Reembolso por anulación de clase: ' || TO_CHAR(OLD.scheduled_at, 'DD/MM/YYYY HH24:MI');

        -- Insertar TRANSACCIÓN DE REEMBOLSO (Contra-asiento)
        INSERT INTO transactions (
            player_id,
            unified_payment_group_id,
            type,
            amount,
            currency,
            academy_id, -- Aseguramos mantener el academy_id
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
            charge_record.academy_id,
            refund_description,
            now(),                  -- Fecha actual de anulación
            charge_record.billing_month, -- Mismo mes de facturación para anular netamente ese periodo
            charge_record.billing_year,
            now()
        );

    END LOOP;

    -- Si es Soft Delete, retornamos NEW con el cambio.
    IF TG_OP = 'UPDATE' THEN
        RETURN NEW;
    END IF;

    -- Si es Hard Delete, retornamos OLD.
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Re-configurar Triggers

-- A. Trigger para SOFT DELETE (UPDATE)
DROP TRIGGER IF EXISTS tr_audit_session_soft_delete ON sessions;
CREATE TRIGGER tr_audit_session_soft_delete
AFTER UPDATE ON sessions
FOR EACH ROW
WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
EXECUTE FUNCTION handle_session_delete_audit();

-- B. Mantener Trigger para HARD DELETE (Safety net)
-- Si alguien borra físicamente una clase futura o por error, también queremos que se audite si tenía pagos.
DROP TRIGGER IF EXISTS tr_audit_session_delete ON sessions;
CREATE TRIGGER tr_audit_session_delete
BEFORE DELETE ON sessions
FOR EACH ROW
EXECUTE FUNCTION handle_session_delete_audit();
