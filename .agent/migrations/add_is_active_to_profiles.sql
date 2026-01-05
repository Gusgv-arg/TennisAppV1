-- SQL Migration: Add is_active field to profiles
-- This field allows admins to activate/deactivate coaches

-- Add is_active column (defaults to true)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Update existing records to be active
UPDATE profiles SET is_active = true WHERE is_active IS NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_role_active 
ON profiles(role, is_active);

-- Verify the changes
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'is_active';
