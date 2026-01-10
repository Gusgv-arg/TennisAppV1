-- ============================================
-- MIGRAR Staff Members a Academy Members
-- (Sin columna role - todos serán 'assistant')
-- ============================================

-- Ver datos actuales
SELECT id, full_name, email, profile_id, coach_id FROM staff_members WHERE is_active = true;

-- Migrar los que tienen cuenta (profile_id)
INSERT INTO academy_members (academy_id, user_id, role, invited_by, accepted_at)
SELECT 
    p.current_academy_id,
    sm.profile_id,
    'assistant',
    sm.coach_id,
    now()
FROM staff_members sm
JOIN profiles p ON p.id = sm.coach_id
WHERE sm.is_active = true
  AND sm.profile_id IS NOT NULL
  AND p.current_academy_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM academy_members am 
    WHERE am.academy_id = p.current_academy_id AND am.user_id = sm.profile_id
  );

-- Crear invitaciones para los que solo tienen email
INSERT INTO academy_invitations (academy_id, email, role, invited_by)
SELECT 
    p.current_academy_id,
    sm.email,
    'assistant',
    sm.coach_id
FROM staff_members sm
JOIN profiles p ON p.id = sm.coach_id
WHERE sm.is_active = true
  AND sm.profile_id IS NULL
  AND sm.email IS NOT NULL
  AND p.current_academy_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM academy_invitations ai 
    WHERE ai.academy_id = p.current_academy_id AND ai.email = sm.email
  );

-- Verificar
SELECT 'Miembros:' as tipo, COUNT(*) FROM academy_members
UNION ALL
SELECT 'Invitaciones:' as tipo, COUNT(*) FROM academy_invitations WHERE accepted_at IS NULL;

-- LIMPIEZA (ejecutar después de verificar)
ALTER TABLE sessions DROP COLUMN IF EXISTS instructor_id;
DROP TABLE IF EXISTS staff_members;
SELECT 'Limpieza completada' as status;
