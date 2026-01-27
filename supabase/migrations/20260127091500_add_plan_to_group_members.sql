-- Migration: Add plan_id to class_group_members
-- Description: Allows specifying a pricing plan per member within a class group

-- 1. Add plan_id column to class_group_members
ALTER TABLE class_group_members 
ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES pricing_plans(id) ON DELETE SET NULL;

-- 2. Index for performance
CREATE INDEX IF NOT EXISTS idx_class_group_members_plan ON class_group_members(plan_id);

-- 3. Comment
COMMENT ON COLUMN class_group_members.plan_id IS 'Specific pricing plan for this member in this group';
