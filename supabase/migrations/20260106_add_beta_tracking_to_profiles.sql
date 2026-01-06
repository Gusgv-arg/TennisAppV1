-- ADD ANALYTICS AND BETA TRACKING FIELDS TO PROFILES
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS beta_feedback_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS beta_joined_at timestamptz;

-- UPDATE TRIGGER for last_active_at
CREATE OR REPLACE FUNCTION update_profile_last_active()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_active_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Only create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_profile_activity_update'
  ) THEN
    CREATE TRIGGER on_profile_activity_update
      BEFORE UPDATE ON profiles
      FOR EACH ROW
      EXECUTE FUNCTION update_profile_last_active();
  END IF;
END
$$;
