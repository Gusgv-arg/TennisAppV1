-- Migration to change the foreign key constraint on academies.created_by to ON DELETE SET NULL
-- This ensures that when a user is deleted, the academy they created doesn't block the deletion,
-- but instead the created_by field becomes NULL.

DO $$
BEGIN
    -- Drop the existing constraint if it exists
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'academies_created_by_fkey') THEN
        ALTER TABLE "public"."academies" DROP CONSTRAINT "academies_created_by_fkey";
    END IF;

    -- Add the new constraint with ON DELETE SET NULL
    ALTER TABLE "public"."academies"
    ADD CONSTRAINT "academies_created_by_fkey"
    FOREIGN KEY ("created_by")
    REFERENCES "auth"."users" ("id")
    ON DELETE SET NULL;
END $$;
