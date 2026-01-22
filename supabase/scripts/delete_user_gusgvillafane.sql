-- Script to delete a specific user and all related data
-- To run this, copy and paste into Supabase SQL Editor

DO $$
DECLARE
  target_email text := 'gusgvillafane@yahoo.com.ar';
  target_user_id uuid;
BEGIN
  -- Get the user ID
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = target_email;

  IF target_user_id IS NOT NULL THEN
    RAISE NOTICE 'Deleting user: % (ID: %)', target_email, target_user_id;

    -- 1. Unlink profiles from academies created by this user
    -- This fixes the "violates foreign key constraint profiles_current_academy_id_fkey" error
    UPDATE public.profiles 
    SET current_academy_id = NULL 
    WHERE current_academy_id IN (
        SELECT id FROM public.academies WHERE created_by = target_user_id
    );

    -- 2. Delete invitations for this email
    DELETE FROM public.academy_invitations WHERE email = target_email;
    
    -- 3. Delete academies created by this user
    -- (This will cascade to academy_members for those academies)
    DELETE FROM public.academies WHERE created_by = target_user_id;

    -- 4. Delete the user from auth.users
    -- (This should cascade to profiles, academy_members, etc. based on ON DELETE CASCADE)
    DELETE FROM auth.users WHERE id = target_user_id;
    
    RAISE NOTICE 'User deleted successfully.';
  ELSE
    RAISE NOTICE 'User % not found.', target_email;
    
    -- Try to delete invitations even if user doesn't exist
    DELETE FROM public.academy_invitations WHERE email = target_email;
  END IF;
END $$;
