-- FIX: Cambiar la relación de academy_members para que apunte a profiles
-- Esto es necesario para poder traer los datos del usuario (nombre, avatar) en las consultas

BEGIN;

-- 1. Eliminar la restricción actual que apunta a auth.users
ALTER TABLE public.academy_members
DROP CONSTRAINT IF EXISTS academy_members_user_id_fkey;

-- 2. Crear nueva restricción apuntando a public.profiles
ALTER TABLE public.academy_members
ADD CONSTRAINT academy_members_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

COMMIT;
