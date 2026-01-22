-- Script to wipe all data for a specific user to allow a fresh start
-- Usage: Set the email variable to the target user's email

DO $$
DECLARE
    target_email text := 'testuserggv@gmail.com';
    target_user_id uuid;
BEGIN
    -- 1. Get the User ID
    SELECT id INTO target_user_id FROM auth.users WHERE email = target_email;

    IF target_user_id IS NULL THEN
        RAISE NOTICE 'User % not found', target_email;
        RETURN;
    END IF;

    RAISE NOTICE 'Wiping data for user % (ID: %)', target_email, target_user_id;

    -- 2. Clean up Academy Dependencies first (Child tables)
    
    -- Academy Members
    DELETE FROM academy_members WHERE user_id = target_user_id;
    DELETE FROM academy_members WHERE academy_id IN (SELECT id FROM academies WHERE created_by = target_user_id);

    -- Academy Invitations
    DELETE FROM academy_invitations WHERE academy_id IN (SELECT id FROM academies WHERE created_by = target_user_id);

    -- Update Profiles to un-link from academies we are about to delete
    UPDATE profiles 
    SET current_academy_id = NULL 
    WHERE current_academy_id IN (SELECT id FROM academies WHERE created_by = target_user_id);
    
    -- Unlink or Delete Players linked to these academies
    -- (Players belong to academies, so we delete them)
    -- This handles player_subscriptions via CASCADE usually, but let's be safe
    DELETE FROM players 
    WHERE academy_id IN (SELECT id FROM academies WHERE created_by = target_user_id)
       OR coach_id = target_user_id;

    -- Sessions
    DELETE FROM sessions 
    WHERE academy_id IN (SELECT id FROM academies WHERE created_by = target_user_id)
       OR coach_id = target_user_id;

    -- Class Groups
    DELETE FROM class_groups 
    WHERE academy_id IN (SELECT id FROM academies WHERE created_by = target_user_id)
       OR coach_id = target_user_id;

    -- Transactions
    DELETE FROM transactions 
    WHERE academy_id IN (SELECT id FROM academies WHERE created_by = target_user_id)
       OR created_by = target_user_id;
    
    -- Pricing Plans (must be after players due to subscriptions linking to plans)
    -- Note: If player_subscriptions table doesn't cascade, this might fail if we didn't delete players first.
    -- But we deleted players above.
    DELETE FROM pricing_plans
    WHERE academy_id IN (SELECT id FROM academies WHERE created_by = target_user_id);

    -- Locations
    DELETE FROM locations
    WHERE academy_id IN (SELECT id FROM academies WHERE created_by = target_user_id);

    -- Videos & Analyses
    DELETE FROM videos WHERE academy_id IN (SELECT id FROM academies WHERE created_by = target_user_id);
    DELETE FROM analyses WHERE academy_id IN (SELECT id FROM academies WHERE created_by = target_user_id);

    -- Unified Payment Groups
    DELETE FROM unified_payment_groups WHERE academy_id IN (SELECT id FROM academies WHERE created_by = target_user_id);

    -- 3. Delete the Academies themselves
    DELETE FROM academies WHERE created_by = target_user_id;

    -- 4. Delete Profile and User
    DELETE FROM profiles WHERE id = target_user_id;
    DELETE FROM auth.users WHERE id = target_user_id;

    RAISE NOTICE 'Data wipe complete for user %', target_email;
END $$;
