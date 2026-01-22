-- Debug Script: Visibility Check (Returns Rows)
-- Run this and check the RESULTS tab

WITH target_user AS (
    SELECT u.id, u.email, p.current_academy_id 
    FROM auth.users u
    JOIN public.profiles p ON u.id = p.id
    WHERE u.email = 'gusgvillafane@yahoo.com.ar' -- Change if needed
)
SELECT 
    'User Info' as check_type,
    email as details,
    current_academy_id::text as id_or_value
FROM target_user

UNION ALL

SELECT 
    'Academy Info',
    name,
    id::text
FROM academies 
WHERE id = (SELECT current_academy_id FROM target_user)

UNION ALL

SELECT 
    'Member Role',
    role,
    is_active::text
FROM academy_members
WHERE user_id = (SELECT id FROM target_user) 
  AND academy_id = (SELECT current_academy_id FROM target_user)

UNION ALL

SELECT 
    'Location Count (Raw)',
    'Total in this academy',
    count(*)::text
FROM locations
WHERE academy_id = (SELECT current_academy_id FROM target_user)

UNION ALL

SELECT 
    'Actual Location Found',
    name,
    id::text
FROM locations
WHERE academy_id = (SELECT current_academy_id FROM target_user);
