-- ============================================
-- SETUP: Create academy for existing user
-- Run this in Supabase SQL Editor
-- ============================================

-- Replace with your actual user ID (from profiles table)
-- You can find it with: SELECT id, email, full_name FROM profiles;

DO $$
DECLARE
    v_user_id uuid;
    v_academy_id uuid;
BEGIN
    -- Get the first coach user (or change to specific ID)
    SELECT id INTO v_user_id FROM profiles WHERE role = 'coach' LIMIT 1;
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No coach user found';
    END IF;
    
    -- Check if user already has an academy
    IF EXISTS (SELECT 1 FROM academy_members WHERE user_id = v_user_id) THEN
        RAISE NOTICE 'User already has academy membership';
        
        -- Set current_academy_id if not set
        UPDATE profiles 
        SET current_academy_id = (
            SELECT academy_id FROM academy_members 
            WHERE user_id = v_user_id LIMIT 1
        )
        WHERE id = v_user_id AND current_academy_id IS NULL;
        
        RETURN;
    END IF;
    
    -- Create academy
    INSERT INTO academies (id, name, slug, created_by)
    VALUES (
        gen_random_uuid(),
        'Mi Academia',
        'mi-academia-' || substr(v_user_id::text, 1, 8),
        v_user_id
    )
    RETURNING id INTO v_academy_id;
    
    -- Add user as owner
    INSERT INTO academy_members (academy_id, user_id, role, accepted_at)
    VALUES (v_academy_id, v_user_id, 'owner', now());
    
    -- Set as current academy
    UPDATE profiles SET current_academy_id = v_academy_id WHERE id = v_user_id;
    
    -- Migrate existing data to this academy
    UPDATE players SET academy_id = v_academy_id WHERE coach_id = v_user_id;
    UPDATE sessions SET academy_id = v_academy_id WHERE coach_id = v_user_id;
    UPDATE locations SET academy_id = v_academy_id WHERE coach_id = v_user_id;
    UPDATE pricing_plans SET academy_id = v_academy_id WHERE coach_id = v_user_id;
    
    RAISE NOTICE 'Academy created with ID: %', v_academy_id;
    RAISE NOTICE 'Existing data migrated to academy';
END $$;

-- Verify the setup
SELECT 
    p.id as user_id,
    p.email,
    p.full_name,
    p.current_academy_id,
    a.name as academy_name,
    am.role
FROM profiles p
LEFT JOIN academies a ON a.id = p.current_academy_id
LEFT JOIN academy_members am ON am.user_id = p.id AND am.academy_id = a.id
WHERE p.role = 'coach';
