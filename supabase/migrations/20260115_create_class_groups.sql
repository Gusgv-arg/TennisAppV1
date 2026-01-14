-- Migration: Class Groups for Group Sessions
-- Description: Allows coaches to create groups of students for recurring group classes

-- 1. Create class_groups table
CREATE TABLE IF NOT EXISTS class_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    plan_id uuid REFERENCES pricing_plans(id) ON DELETE SET NULL,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Create class_group_members table (N:N relationship)
CREATE TABLE IF NOT EXISTS class_group_members (
    group_id uuid REFERENCES class_groups(id) ON DELETE CASCADE,
    player_id uuid REFERENCES players(id) ON DELETE CASCADE,
    joined_at timestamptz DEFAULT now(),
    PRIMARY KEY (group_id, player_id)
);

-- 3. Add class_group_id to sessions
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS class_group_id uuid REFERENCES class_groups(id) ON DELETE SET NULL;

-- 4. Enable RLS
ALTER TABLE class_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_group_members ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for class_groups
CREATE POLICY "Coaches manage own class groups" ON class_groups
    FOR ALL USING (coach_id = auth.uid());

-- Academy-based policy (if using academy system)
CREATE POLICY "Academy members view class groups" ON class_groups
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM academy_members am
            WHERE am.user_id = auth.uid()
            AND am.academy_id = (
                SELECT academy_id FROM academy_members 
                WHERE user_id = class_groups.coach_id 
                LIMIT 1
            )
        )
    );

-- 6. RLS Policies for class_group_members
CREATE POLICY "Coach manages group members" ON class_group_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM class_groups cg
            WHERE cg.id = class_group_members.group_id
            AND cg.coach_id = auth.uid()
        )
    );

CREATE POLICY "Academy members view group members" ON class_group_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM class_groups cg
            JOIN academy_members am ON am.user_id = auth.uid()
            WHERE cg.id = class_group_members.group_id
            AND am.academy_id = (
                SELECT academy_id FROM academy_members 
                WHERE user_id = cg.coach_id 
                LIMIT 1
            )
        )
    );

-- 7. Trigger for updated_at
CREATE TRIGGER tr_class_groups_updated_at
    BEFORE UPDATE ON class_groups
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- 8. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_class_groups_coach ON class_groups(coach_id);
CREATE INDEX IF NOT EXISTS idx_class_group_members_group ON class_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_class_group_members_player ON class_group_members(player_id);
CREATE INDEX IF NOT EXISTS idx_sessions_class_group ON sessions(class_group_id);

-- 9. Comments
COMMENT ON TABLE class_groups IS 'Groups of students for recurring group classes';
COMMENT ON TABLE class_group_members IS 'Many-to-many relationship between class groups and players';
COMMENT ON COLUMN class_groups.plan_id IS 'Optional pricing plan that applies to all members of this group';
COMMENT ON COLUMN sessions.class_group_id IS 'If session is for a class group, reference to that group';
