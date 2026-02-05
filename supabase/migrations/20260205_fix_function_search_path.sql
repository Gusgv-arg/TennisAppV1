-- Migration: Fix search_path for all public functions
-- This is a SECURITY HARDENING migration that does NOT change function logic
-- It adds SET search_path = public to prevent path injection attacks
-- Date: 2026-02-05

-- ============================================================================
-- TRIGGER FUNCTIONS (no SECURITY DEFINER, but good practice)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_feedback_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_profile_last_active()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.last_active_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$function$;

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_slug(input_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $function$
  SELECT LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        TRIM(input_text),
        '[^a-zA-Z0-9\s-]', '', 'g'
      ),
      '\s+', '-', 'g'
    )
  );
$function$;

-- ============================================================================
-- SECURITY DEFINER FUNCTIONS (CRITICAL - these run with elevated privileges)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_current_academy_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT current_academy_id FROM profiles WHERE id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.get_user_academy_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT role FROM academy_members 
  WHERE user_id = auth.uid() 
    AND academy_id = get_current_academy_id()
    AND is_active = true;
$function$;

CREATE OR REPLACE FUNCTION public.is_academy_member(acad_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM academy_members 
    WHERE user_id = auth.uid() 
      AND academy_id = acad_id 
      AND is_active = true
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_academy_member_secure(acad_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM academy_members 
    WHERE academy_id = acad_id 
      AND user_id = auth.uid() 
      AND is_active = true
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_academy_owner_secure(acad_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM academy_members 
    WHERE academy_id = acad_id 
      AND user_id = auth.uid() 
      AND role = 'owner'
      AND is_active = true
  );
$function$;

CREATE OR REPLACE FUNCTION public.user_academy_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT academy_id FROM academy_members WHERE user_id = auth.uid() AND is_active = true;
$function$;

CREATE OR REPLACE FUNCTION public.has_permission(perm text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  user_role text;
  custom_perms jsonb;
BEGIN
  SELECT role, custom_permissions INTO user_role, custom_perms
  FROM academy_members 
  WHERE user_id = auth.uid() 
    AND academy_id = get_current_academy_id()
    AND is_active = true;
  
  -- No membership = no permission
  IF user_role IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check custom permissions override first
  IF custom_perms ? perm THEN
    RETURN (custom_perms->>perm)::boolean;
  END IF;
  
  -- Default permissions by role
  RETURN CASE user_role
    WHEN 'owner' THEN true
    WHEN 'coach' THEN perm IN (
      'players.view', 'players.create', 'players.edit', 'players.archive',
      'sessions.view', 'sessions.create', 'sessions.edit', 'sessions.delete',
      'locations.view', 
      'payments.view_own', 'payments.record',
      'team.view',
      'plans.view'
    )
    WHEN 'assistant' THEN perm IN (
      'players.view',
      'sessions.view', 'sessions.create', 'sessions.edit',
      'locations.view',
      'team.view',
      'plans.view'
    )
    WHEN 'viewer' THEN perm IN (
      'players.view',
      'sessions.view',
      'locations.view'
    )
    ELSE false
  END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_create_academy()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_academy_count integer;
  v_is_owner boolean;
BEGIN
  -- Count user's academies
  SELECT COUNT(*) INTO v_academy_count
  FROM academy_members
  WHERE user_id = auth.uid()
    AND is_active = true;
  
  -- If no academies, allow creation (first academy)
  IF v_academy_count = 0 THEN
    RETURN true;
  END IF;
  
  -- If has academies, check if owner of any
  SELECT EXISTS (
    SELECT 1 FROM academy_members
    WHERE user_id = auth.uid()
      AND role = 'owner'
      AND is_active = true
  ) INTO v_is_owner;
  
  RETURN v_is_owner;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_academy_with_owner(p_name text, p_slug text, p_logo_url text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  new_academy_id uuid;
  new_academy_record record;
  current_user_id uuid;
BEGIN
  -- Get current user
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Create Academy
  INSERT INTO academies (name, slug, logo_url, created_by)
  VALUES (p_name, p_slug, p_logo_url, current_user_id)
  RETURNING id, name, slug, logo_url, settings, created_by, created_at, updated_at, is_archived
  INTO new_academy_record;

  new_academy_id := new_academy_record.id;

  -- 2. Add Creator as Owner Member
  INSERT INTO academy_members (academy_id, user_id, role, accepted_at, is_active)
  VALUES (new_academy_id, current_user_id, 'owner', now(), true);

  -- 3. Update Profile Current Academy
  UPDATE profiles
  SET current_academy_id = new_academy_id
  WHERE id = current_user_id;

  -- Return the created academy as JSON
  RETURN to_jsonb(new_academy_record);
END;
$function$;

CREATE OR REPLACE FUNCTION public.transfer_academy_ownership(p_academy_id uuid, p_new_owner_id uuid, p_current_owner_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_current_owner_role text;
  v_new_owner_member_id uuid;
BEGIN
  -- Verify current owner is actually an owner
  SELECT role INTO v_current_owner_role
  FROM academy_members
  WHERE academy_id = p_academy_id
    AND user_id = p_current_owner_id
    AND is_active = true;
  
  IF v_current_owner_role != 'owner' THEN
    RAISE EXCEPTION 'Current user is not an owner of this academy';
  END IF;
  
  -- Verify new owner is a member of the academy
  SELECT id INTO v_new_owner_member_id
  FROM academy_members
  WHERE academy_id = p_academy_id
    AND user_id = p_new_owner_id
    AND is_active = true;
  
  IF v_new_owner_member_id IS NULL THEN
    RAISE EXCEPTION 'New owner must be an active member of the academy';
  END IF;
  
  -- Demote current owner to coach
  UPDATE academy_members
  SET role = 'coach'
  WHERE academy_id = p_academy_id
    AND user_id = p_current_owner_id;
  
  -- Promote new owner
  UPDATE academy_members
  SET role = 'owner'
  WHERE academy_id = p_academy_id
    AND user_id = p_new_owner_id;
  
  RETURN true;
END;
$function$;

-- ============================================================================
-- COMPLEX QUERY FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_global_sessions(start_date timestamp with time zone, end_date timestamp with time zone)
RETURNS TABLE(id uuid, created_at timestamp with time zone, academy_id uuid, coach_id uuid, instructor_id uuid, court text, location text, scheduled_at timestamp with time zone, duration_minutes integer, status text, notes text, academy_name text, coach_name text, instructor_name text, players_json jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.created_at,
    s.academy_id,
    s.coach_id,
    s.instructor_id,
    s.court,
    s.location,
    s.scheduled_at,
    s.duration_minutes,
    s.status::TEXT,
    s.notes,
    a.name as academy_name,
    p_coach.full_name as coach_name,
    p_inst.full_name as instructor_name,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'full_name', p.full_name,
          'avatar_url', p.avatar_url,
          'plan_name', pp.name,
          'attendance_status', sa.status,
          'attendance_notes', sa.notes
        )
      )
      FROM (
          -- 1. Session Players (Explicitly linked to the session)
          SELECT sp.player_id, sp.subscription_id
          FROM session_players sp
          WHERE sp.session_id = s.id
          
          UNION
          
          -- 2. Class Group Members (Implicitly linked via group)
          SELECT cgm.player_id, NULL::uuid as subscription_id
          FROM class_group_members cgm
          WHERE s.class_group_id IS NOT NULL 
            AND cgm.group_id = s.class_group_id
      ) all_players
      JOIN players p ON all_players.player_id = p.id
      LEFT JOIN player_subscriptions ps ON all_players.subscription_id = ps.id
      LEFT JOIN pricing_plans pp ON ps.plan_id = pp.id
      LEFT JOIN session_attendance sa ON (s.id = sa.session_id AND all_players.player_id = sa.player_id)
    ) as players_json
  FROM sessions s
  JOIN academies a ON s.academy_id = a.id
  LEFT JOIN profiles p_coach ON s.coach_id = p_coach.id
  LEFT JOIN profiles p_inst ON s.instructor_id = p_inst.id
  WHERE 
    s.scheduled_at >= start_date 
    AND s.scheduled_at <= end_date
    AND s.academy_id IN (
      SELECT am.academy_id 
      FROM academy_members am 
      WHERE am.user_id = auth.uid() 
      AND am.is_active = true
    )
  ORDER BY s.scheduled_at ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_monthly_activity(p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_academy_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid UUID;
  v_result JSONB;
BEGIN
  v_uid := auth.uid();
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'scheduled_at', s.scheduled_at,
      'location', s.location,
      'court', s.court,
      'status', s.status,
      'deleted_at', s.deleted_at,
      'cancellation_reason', s.cancellation_reason,
      'academy', jsonb_build_object('name', a.name),
      -- Instructor/Coach
      'instructor', jsonb_build_object(
        'full_name', COALESCE(inst.full_name, coach.full_name, 'Sin asignar')
      ),
      -- Players Array
      'players', (
        SELECT jsonb_agg(jsonb_build_object('full_name', p_player.full_name))
        FROM session_players sp
        JOIN profiles p_player ON p_player.id = sp.player_id
        WHERE sp.session_id = s.id
      )
    )
  )
  INTO v_result
  FROM sessions s
  LEFT JOIN academies a ON a.id = s.academy_id
  LEFT JOIN profiles inst ON inst.id = s.instructor_id
  LEFT JOIN profiles coach ON coach.id = s.coach_id
  WHERE s.scheduled_at >= p_start_date
    AND s.scheduled_at <= p_end_date
    AND (
      s.coach_id = v_uid 
      OR s.instructor_id = v_uid
      OR EXISTS (
        SELECT 1 FROM academy_members am
        WHERE am.user_id = v_uid
          AND am.academy_id = s.academy_id
          AND (p_academy_id IS NULL OR am.academy_id = p_academy_id)
      )
    );
  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$function$;

-- ============================================================================
-- DELETE AUDIT TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_session_delete_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;

-- ============================================================================
-- VERIFICATION: List updated functions
-- ============================================================================
-- After applying this migration, you can verify with:
-- SELECT proname, prosecdef, proconfig 
-- FROM pg_proc p
-- JOIN pg_namespace n ON p.pronamespace = n.oid
-- WHERE n.nspname = 'public' AND proconfig IS NOT NULL;
