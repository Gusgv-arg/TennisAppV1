-- Debug script to check visibility for a specific user
-- Replace with the email of the user reporting issues
DO $$
DECLARE
  target_email text := 'gusgvillafane@yahoo.com.ar';
  v_user_id uuid;
  v_academy_id uuid;
  v_role text;
  v_visible_count int;
  v_total_count int;
BEGIN
  -- 1. Get User ID
  SELECT id INTO v_user_id FROM auth.users WHERE email = target_email;
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User % not found', target_email;
    RETURN;
  END IF;

  RAISE NOTICE 'User ID: %', v_user_id;

  -- 2. Get Current Academy from Profile
  SELECT current_academy_id INTO v_academy_id 
  FROM public.profiles 
  WHERE id = v_user_id;

  RAISE NOTICE 'Current Academy ID: %', v_academy_id;

  IF v_academy_id IS NULL THEN
    RAISE NOTICE 'User has no current academy selected.';
    RETURN;
  END IF;

  -- 3. Get Role in that Academy
  -- We query manually to see what the DB sees
  SELECT role INTO v_role
  FROM public.academy_members
  WHERE user_id = v_user_id AND academy_id = v_academy_id;

  RAISE NOTICE 'Role in Academy: %', v_role;

  -- 4. Check Total Locations in that Academy (Bypassing RLS because we are superuser here)
  SELECT count(*) INTO v_total_count
  FROM public.locations
  WHERE academy_id = v_academy_id;

  RAISE NOTICE 'Total Locations in Academy (Raw): %', v_total_count;

  -- 5. Check what the user "sees" via RLS
  -- We can't easily "become" the user in a DO block without SET ROLE, 
  -- but we can simulate the policy logic.
  
  -- Policy: "View locations in academy" 
  -- USING (academy_id = get_current_academy_id() AND has_permission('locations.view'))
  
  -- Test has_permission logic manually
  RAISE NOTICE 'Testing permission locations.view...';
  
  -- Simulating has_permission function logic:
  -- It checks role and custom_permissions
  
  IF v_role = 'owner' THEN
     RAISE NOTICE 'Role is owner, should have full access.';
  ELSE
     RAISE NOTICE 'Role is %, checking default permissions...', v_role;
     -- 'coach', 'assistant', 'viewer' all have 'locations.view' in the big CASE statement
     IF v_role IN ('coach', 'assistant', 'viewer') THEN
       RAISE NOTICE 'Role % has access to locations.view by default.', v_role;
     ELSE
       RAISE NOTICE 'Role % might NOT have access.', v_role;
     END IF;
  END IF;

END $$;
