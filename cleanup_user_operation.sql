-- =====================================================
-- LIMPIEZA OPERATIVA POR USUARIO
-- USAGE: Reemplazar 'testuserggv@gmail.com' con el email deseado
-- =====================================================

DO $$
DECLARE
    target_email TEXT := 'testuserggv@gmail.com';
    target_user_id UUID;
BEGIN
    -- 1. Obtener ID del usuario
    SELECT id INTO target_user_id
    FROM auth.users
    WHERE email = target_email;

    IF target_user_id IS NULL THEN
        RAISE NOTICE 'Usuario no encontrado: %', target_email;
        RETURN;
    END IF;

    RAISE NOTICE 'Iniciando limpieza para usuario: % (ID: %)', target_email, target_user_id;

    -- 2. Limpiar Transacciones (Deuda, Pagos, Ajustes)
    -- Borramos todas las transacciones asociadas a ALUMNOS de este coach
    -- O creadas por este coach (para cubrir ajustes manuales sin alumno si los hubiera, aunque siempre tienen player_id)
    DELETE FROM transactions
    WHERE player_id IN (SELECT id FROM players WHERE coach_id = target_user_id);
    
    RAISE NOTICE 'Transacciones eliminadas.';

    -- 3. Limpiar Sesiones (Clases)
    -- Esto disparará triggers si existen, pero ya borramos transacciones así que no habrá reembolsos fantasmas.
    -- session_players debería borrarse en cascada si está configurado así, sino lo borramos explícitamente.
    -- Por seguridad borramos session_players primero.
    
    DELETE FROM session_players
    WHERE session_id IN (SELECT id FROM sessions WHERE coach_id = target_user_id);

    DELETE FROM sessions
    WHERE coach_id = target_user_id;

    RAISE NOTICE 'Sesiones eliminadas.';

    -- 4. Opcional: Limpiar Asistencia si existe tabla separada
    -- session_attendance usually cascades from session_id

    -- 5. Resetear contadores de paquetes en suscripciones?
    -- El usuario pidió "como si la operación comenzara de cero".
    -- Si los alumnos tienen planes activos con clases consumidas, deberíamos resetearlas?
    -- "Suscripciones" son operational state? O structural?
    -- "Solo quiero conservar los alumnos, los planes..."
    -- Las suscripciones vinculan alumno con plan. Si borramos las clases, las clases consumidas deberían volver a su estado original?
    -- O quizás borrar las suscripciones y que las asigne de nuevo?
    -- "Infraestructura lista para comenzar a registrar" implica que los alumnos ya existen. 
    -- Probablemente quiera mantener las asignaciones de planes (suscripciones) pero resetear sus contadores si son paquetes.
    
    -- Resetear clases consumidas en paquetes activos
    UPDATE player_subscriptions
    SET remaining_classes = (SELECT package_classes FROM pricing_plans WHERE id = player_subscriptions.plan_id)
    WHERE player_id IN (SELECT id FROM players WHERE coach_id = target_user_id)
    AND remaining_classes IS NOT NULL;
    
    RAISE NOTICE 'Contadores de paquetes reseteados.';

    RAISE NOTICE 'Limpieza completada exitosamente.';
END $$;
