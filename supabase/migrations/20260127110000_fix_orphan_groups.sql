-- Backfill missing academy_id for class_groups
-- This script assigns 'orphan' groups to the primary academy of their creator (coach)

UPDATE class_groups cg
SET academy_id = (
    SELECT am.academy_id
    FROM academy_members am
    WHERE am.user_id = cg.coach_id
    -- We assume the coach's "main" academy is the one they joined/created first
    -- This handles cases where a coach might belong to multiple academies
    ORDER BY am.created_at ASC 
    LIMIT 1
)
WHERE cg.academy_id IS NULL;
