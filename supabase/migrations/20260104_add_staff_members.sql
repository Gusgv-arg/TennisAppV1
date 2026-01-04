-- Migration: Add staff_members table and instructor tracking
-- Description: Allow coaches to manage team members and assign them to sessions

-- Create staff_members table
CREATE TABLE staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role text DEFAULT 'assistant_coach' CHECK (role IN ('assistant_coach', 'instructor', 'intern')),
  email text,
  phone text,
  notes text,
  is_active boolean DEFAULT true,
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;

-- Coaches manage their own staff
CREATE POLICY "Coaches manage own staff" ON staff_members FOR ALL 
  USING (coach_id = auth.uid());

-- Admins manage all staff
CREATE POLICY "Admins manage all staff" ON staff_members FOR ALL
  USING (public.get_user_role() = 'admin');

-- Add instructor_id to sessions table
ALTER TABLE sessions ADD COLUMN instructor_id uuid REFERENCES staff_members(id) ON DELETE SET NULL;

-- Create trigger for updated_at
CREATE TRIGGER tr_staff_members_updated_at 
  BEFORE UPDATE ON staff_members 
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
