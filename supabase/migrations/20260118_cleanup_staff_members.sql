-- Migration: Cleanup Staff Members Table
-- Description: Drops the deprecated staff_members table and removes foreign key references
-- Date: 2026-01-18

-- Safe deletion of the table. 
-- "CASCADE" is critical here because the 'sessions' table has a foreign key pointing to 'staff_members'.
-- Using CASCADE will remove that foreign key constraint automatically, but keep the 'sessions' table and data intact.

DROP TABLE IF EXISTS staff_members CASCADE;

-- Optional: You might want to confirm if you want to add a new foreign key to academy_members later.
-- For now, we leave the sessions.instructor_id column as a logical reference to avoid blocking migration
-- if there are any ID mismatches.

-- If you deleted the 'collaborators' related triggers manually before, good. 
-- If not, dropping the table drops its own triggers automatically.
