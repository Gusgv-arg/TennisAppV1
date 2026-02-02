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
    target_academy_id UUID;
    academy_timezone TEXT;
BEGIN
    -- Determinar el ID de la sesión y la fecha programada
    IF TG_TABLE_NAME = 'sessions' THEN
        target_session_id := OLD.id;
        session_scheduled_at := OLD.scheduled_at;
        target_academy_id := OLD.academy_id;
    ELSE
        target_session_id := OLD.session_id;
        -- Buscar la fecha de la sesión y academy_id
        SELECT scheduled_at, academy_id INTO session_scheduled_at, target_academy_id 
        FROM sessions WHERE id = target_session_id;
    END IF;

    -- Obtener TIMEZONE de la Academia (o default Buenos Aires / UTC)
    SELECT settings->>'timezone' INTO academy_timezone 
    FROM academies WHERE id = target_academy_id;
    
    -- Fallback seguro
    academy_timezone := COALESCE(academy_timezone, 'America/Argentina/Buenos_Aires');

    -- Obtener email del usuario activo (o fallback a 'sistema')
    SELECT email INTO performer_email FROM profiles WHERE id = auth.uid();
    performer_email := COALESCE(performer_email, auth.jwt() ->> 'email', 'sistema');

    -- Buscar transacciones de tipo 'charge' asociadas
    FOR charge_record IN 
        SELECT * FROM transactions 
        WHERE session_id = target_session_id 
        AND (TG_TABLE_NAME = 'sessions' OR player_id = OLD.player_id)
        AND type = 'charge'
    LOOP
        -- BUG FIX: Verificar si ya existe un REEMBOLSO para este cargo específico
        IF EXISTS (
            SELECT 1 FROM transactions 
            WHERE session_id = target_session_id 
            AND player_id = charge_record.player_id 
            AND type = 'refund'
        ) THEN
            CONTINUE; -- Saltar si ya fue reembolsado
        END IF;
        
        -- Descripción concisa: Referencia de clase (Hora Local de Academia) + auditoría
        refund_description := 'Anulación clase: ' || 
                              TO_CHAR(session_scheduled_at AT TIME ZONE academy_timezone, 'DD/MM/YYYY HH24:MI') ||
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
            (now() AT TIME ZONE academy_timezone)::date, -- Fecha del reembolso en hora local
            charge_record.billing_month,
            charge_record.billing_year,
            now(),
            auth.uid()
        );

    END LOOP;

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
