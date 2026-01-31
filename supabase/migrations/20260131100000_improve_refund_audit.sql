-- =====================================================
-- Migración: Auditoría de Reembolsos Mejorada (Mail y Fecha Local) V2
-- Fecha: 2026-01-31
-- Objetivo: 
-- 1. Incluir el mail del usuario que realiza la anulación (buscando en profiles).
-- 2. Asegurar que la fecha del reembolso sea la fecha actual en Argentina.
-- 3. Activar reembolsos automáticos al quitar alumnos individuales.
-- =====================================================

CREATE OR REPLACE FUNCTION handle_session_delete_audit()
RETURNS TRIGGER AS $$
DECLARE
    charge_record RECORD;
    refund_description TEXT;
    performer_email TEXT;
    target_session_id UUID;
    session_scheduled_at TIMESTAMPTZ;
BEGIN
    -- Determinar el ID de la sesión y la fecha programada
    IF TG_TABLE_NAME = 'sessions' THEN
        target_session_id := OLD.id;
        session_scheduled_at := OLD.scheduled_at;
    ELSE
        target_session_id := OLD.session_id;
        -- Buscar la fecha de la sesión para la descripción del reembolso
        SELECT scheduled_at INTO session_scheduled_at FROM sessions WHERE id = target_session_id;
    END IF;

    -- Obtener email del usuario activo (o fallback a 'sistema')
    -- Buscamos primero en profiles por si el JWT no lo tiene expuesto
    SELECT email INTO performer_email FROM profiles WHERE id = auth.uid();
    performer_email := COALESCE(performer_email, auth.jwt() ->> 'email', 'sistema');

    -- Buscar transacciones de tipo 'charge' asociadas
    -- Si el trigger es de session_players, filtramos por ESE alumno específico (OLD.player_id)
    FOR charge_record IN 
        SELECT * FROM transactions 
        WHERE session_id = target_session_id 
        AND (TG_TABLE_NAME = 'sessions' OR player_id = OLD.player_id)
        AND type = 'charge'
    LOOP
        -- BUG FIX: Verificar si ya existe un REEMBOLSO para este cargo específico
        -- Esto evita duplicados si una sesión se cancela primero y se borra después.
        IF EXISTS (
            SELECT 1 FROM transactions 
            WHERE session_id = target_session_id 
            AND player_id = charge_record.player_id 
            AND type = 'refund'
            -- Opcional: Podríamos verificar el monto si quisiéramos ser ultra precisos
        ) THEN
            CONTINUE; -- Saltar si ya fue reembolsado
        END IF;
        
        -- Descripción concisa: Referencia de clase + auditoría (Mail)
        refund_description := 'Anulación clase: ' || 
                              TO_CHAR(session_scheduled_at AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI') ||
                              ' - por ' || performer_email;

        -- Insertar TRANSACCIÓN DE REEMBOLSO
        INSERT INTO transactions (
            player_id,
            unified_payment_group_id,
            type,
            amount,
            currency,
            academy_id,
            description,
            transaction_date,
            billing_month,
            billing_year,
            created_at,
            created_by
        ) VALUES (
            charge_record.player_id,
            charge_record.unified_payment_group_id,
            'refund',
            charge_record.amount,
            charge_record.currency,
            charge_record.academy_id,
            refund_description,
            (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date, -- Fecha actual en Argentina
            charge_record.billing_month,
            charge_record.billing_year,
            now(),
            auth.uid() -- Registrar quién lo creó en la columna nativa
        );

    END LOOP;

    -- Los triggers de DELETE retornan OLD
    -- Los triggers de UPDATE retornan NEW
    IF TG_OP = 'UPDATE' THEN
        RETURN NEW;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Trigger para quitar alumnos (Individual o Masivo)
DROP TRIGGER IF EXISTS tr_audit_player_removal ON session_players;
CREATE TRIGGER tr_audit_player_removal
    BEFORE DELETE ON session_players
    FOR EACH ROW
    EXECUTE FUNCTION handle_session_delete_audit();
