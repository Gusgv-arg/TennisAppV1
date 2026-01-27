-- Add is_plan_exempt column to class_group_members to allow members to opt-out of group default plan
ALTER TABLE class_group_members 
ADD COLUMN IF NOT EXISTS is_plan_exempt boolean DEFAULT false;

COMMENT ON COLUMN class_group_members.is_plan_exempt IS 'If true, the member does not inherit the group default plan and has no plan.';
