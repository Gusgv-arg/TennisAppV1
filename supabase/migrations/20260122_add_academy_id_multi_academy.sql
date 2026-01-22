-- Migration: Add academy_id to sessions, class_groups, and transactions
-- Date: 2026-01-22
-- Description: Enables multi-academy support by associating business entities with academies

-- ============================================
-- 1. Add academy_id to sessions
-- ============================================
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS academy_id uuid REFERENCES academies(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_sessions_academy_id ON sessions(academy_id);

-- ============================================
-- 2. Add academy_id to class_groups
-- ============================================
ALTER TABLE class_groups 
ADD COLUMN IF NOT EXISTS academy_id uuid REFERENCES academies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_class_groups_academy_id ON class_groups(academy_id);

-- ============================================
-- 3. Add academy_id to transactions
-- ============================================
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS academy_id uuid REFERENCES academies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_academy_id ON transactions(academy_id);

-- ============================================
-- 4. Backfill existing data with owner's first academy
-- ============================================
-- For existing records, we'll set academy_id to the owner's first (oldest) academy

-- Backfill sessions
UPDATE sessions s
SET academy_id = (
    SELECT a.id 
    FROM academies a 
    JOIN academy_members am ON a.id = am.academy_id
    WHERE am.user_id = s.coach_id 
      AND am.role = 'owner'
      AND a.is_archived = false
    ORDER BY a.created_at ASC
    LIMIT 1
)
WHERE s.academy_id IS NULL;

-- Backfill class_groups
UPDATE class_groups cg
SET academy_id = (
    SELECT a.id 
    FROM academies a 
    JOIN academy_members am ON a.id = am.academy_id
    WHERE am.user_id = cg.coach_id 
      AND am.role = 'owner'
      AND a.is_archived = false
    ORDER BY a.created_at ASC
    LIMIT 1
)
WHERE cg.academy_id IS NULL;

-- Backfill transactions (via player's coach)
UPDATE transactions t
SET academy_id = (
    SELECT a.id 
    FROM academies a 
    JOIN academy_members am ON a.id = am.academy_id
    JOIN players p ON p.coach_id = am.user_id
    WHERE p.id = t.player_id 
      AND am.role = 'owner'
      AND a.is_archived = false
    ORDER BY a.created_at ASC
    LIMIT 1
)
WHERE t.academy_id IS NULL;

-- ============================================
-- 5. Update RLS Policies (optional, can be added later)
-- ============================================
-- Note: Current RLS policies rely on coach_id which still works.
-- Academy-based RLS can be added as an enhancement.

COMMENT ON COLUMN sessions.academy_id IS 'Academy this session belongs to for multi-academy support';
COMMENT ON COLUMN class_groups.academy_id IS 'Academy this group belongs to for multi-academy support';
COMMENT ON COLUMN transactions.academy_id IS 'Academy this transaction is attributed to for reporting';
