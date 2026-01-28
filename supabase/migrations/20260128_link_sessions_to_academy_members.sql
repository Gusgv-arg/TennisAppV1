-- Migration: Link sessions.instructor_id to academy_members
-- Description: Establishes a formal Foreign Key relationship for data integrity and PostgREST joins.
-- Date: 2026-01-28

-- 1. Clean up invalid/orphan instructor_ids
-- We set to NULL any instructor_id that doesn't exist in academy_members.
-- This prevents the "ADD CONSTRAINT" command from failing due to existing violations.
UPDATE public.sessions
SET instructor_id = NULL
WHERE instructor_id IS NOT NULL
  AND instructor_id NOT IN (SELECT id FROM public.academy_members);

-- 2. Add the Foreign Key constraint
-- We use ON DELETE SET NULL to ensure that if an academy member is removed, their classes remain (just without an instructor).
ALTER TABLE public.sessions
  ADD CONSTRAINT fk_sessions_instructor
  FOREIGN KEY (instructor_id)
  REFERENCES public.academy_members (id)
  ON DELETE SET NULL;
