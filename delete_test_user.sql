-- SCRIPT PARA BORRAR USUARIO DE PRUEBA Y SUS DATOS
-- Copia y pega todo este bloque en el Editor SQL de Supabase y dale "RUN".

DO $$
DECLARE
    -- CAMBIA EL EMAIL AQUI SI NECESITAS BORRAR OTRO USUARIO
    v_target_email TEXT := 'testuserggv@gmail.com';
    v_user_id UUID;
BEGIN
    -- 1. Buscar ID del usuario
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_target_email;
    
    -- Si no existe, avisar y salir
    IF v_user_id IS NULL THEN
        RAISE NOTICE 'El usuario % no fue encontrado. No se hizo nada.', v_target_email;
        RETURN;
    END IF;

    RAISE NOTICE 'Borrando datos para el usuario % (ID: %)...', v_target_email, v_user_id;

    -- 2. Desvincular academia del perfil (para evitar errores de FK circular)
    UPDATE public.profiles SET current_academy_id = NULL WHERE id = v_user_id;

    -- 3. Borrar Sesiones y todo lo relacionado (Asistencia, Jugadores en sesión, Transacciones de sesión)
    DELETE FROM public.session_attendance WHERE session_id IN (SELECT id FROM public.sessions WHERE coach_id = v_user_id);
    DELETE FROM public.session_players WHERE session_id IN (SELECT id FROM public.sessions WHERE coach_id = v_user_id);
    DELETE FROM public.transactions WHERE session_id IN (SELECT id FROM public.sessions WHERE coach_id = v_user_id);
    DELETE FROM public.sessions WHERE coach_id = v_user_id;

    -- 4. Borrar Grupos y sus relaciones
    DELETE FROM public.class_group_members WHERE group_id IN (SELECT id FROM public.class_groups WHERE coach_id = v_user_id);
    DELETE FROM public.class_groups WHERE coach_id = v_user_id;
    
    -- 5. Borrar Suscripciones y Planes de Precio
    DELETE FROM public.player_subscriptions WHERE plan_id IN (SELECT id FROM public.pricing_plans WHERE coach_id = v_user_id);
    DELETE FROM public.pricing_plan_prices WHERE plan_id IN (SELECT id FROM public.pricing_plans WHERE coach_id = v_user_id);
    DELETE FROM public.pricing_plans WHERE coach_id = v_user_id;

    -- 6. Borrar Jugadores (Players)
    DELETE FROM public.players WHERE coach_id = v_user_id;

    -- 7. Borrar Ubicaciones (Locations/Courts)
    DELETE FROM public.locations WHERE coach_id = v_user_id;

    -- 8. Borrar Academias, Invitaciones y Miembros
    DELETE FROM public.academy_invitations WHERE academy_id IN (SELECT id FROM public.academies WHERE created_by = v_user_id);
    DELETE FROM public.academy_members WHERE academy_id IN (SELECT id FROM public.academies WHERE created_by = v_user_id);
    DELETE FROM public.academies WHERE created_by = v_user_id;

    -- 9. Borrar Perfil y Usuario de Auth
    DELETE FROM public.profiles WHERE id = v_user_id;
    DELETE FROM auth.users WHERE id = v_user_id;

    RAISE NOTICE '✅ Usuario % eliminado completamente.', v_target_email;
END $$;
