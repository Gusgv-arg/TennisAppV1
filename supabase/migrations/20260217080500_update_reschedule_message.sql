-- Migration: Update Session Reschedule Audit Message
-- Date: 2026-02-17
-- Objective: Update the audit message to include the old date and time.

CREATE OR REPLACE FUNCTION handle_session_reschedule_audit()
RETURNS TRIGGER AS $$
DECLARE
    charge_record RECORD;
    local_now DATE;
    academy_tz TEXT;
BEGIN
    -- Only run if scheduled_at changed
    IF OLD.scheduled_at IS NOT DISTINCT FROM NEW.scheduled_at THEN
        RETURN NEW;
    END IF;

    -- Fetch Academy Timezone
    SELECT settings->>'timezone' INTO academy_tz
    FROM academies
    WHERE id = OLD.academy_id;

    -- Default to UTC if not set
    IF academy_tz IS NULL THEN
        academy_tz := 'UTC';
    END IF;

    -- Calculate local date using Academy Timezone
    BEGIN
        local_now := (now() AT TIME ZONE 'UTC' AT TIME ZONE academy_tz)::date;
    EXCEPTION WHEN OTHERS THEN
        local_now := (now() AT TIME ZONE 'UTC')::date;
    END;

    -- Find existing ACCRUAL (Devengamiento)
    FOR charge_record IN 
        SELECT * FROM transactions 
        WHERE session_id = OLD.id 
        AND type = 'charge'
    LOOP
        -- 1. Create Reversal (Anulación de Devengamiento)
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
            created_at,
            created_by
        ) VALUES (
            charge_record.player_id,
            charge_record.unified_payment_group_id,
            'refund', -- Credit
            charge_record.amount,
            charge_record.currency,
            'Reversión por cambio de fecha clase del ' || TO_CHAR(OLD.scheduled_at, 'DD/MM/YYYY HH24:MI') || 'hs al ' || TO_CHAR(NEW.scheduled_at, 'DD/MM/YYYY HH24:MI') || 'hs',
            local_now, -- Use valid local date
            charge_record.billing_month,
            charge_record.billing_year,
            now(),
            auth.uid() 
        );

        -- 2. Unlink the old charge
        UPDATE transactions 
        SET session_id = NULL
        WHERE id = charge_record.id;

    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
