-- CREATE FEEDBACK TABLE
CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  feedback_type text NOT NULL CHECK (feedback_type IN ('bug', 'suggestion', 'question')),
  screen_name text,
  description text NOT NULL,
  screenshot_url text,
  status text DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'resolved', 'wontfix')),
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  admin_notes text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ENABLE RLS
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES
-- Users can insert their own feedback
CREATE POLICY "Users submit feedback" ON feedback FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own feedback
CREATE POLICY "Users view own feedback" ON feedback FOR SELECT 
  USING (auth.uid() = user_id);

-- Admins can view and update all feedback
CREATE POLICY "Admins manage feedback" ON feedback FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- CREATE INDEX for performance
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);

-- UPDATE TRIGGER
CREATE OR REPLACE FUNCTION update_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER feedback_updated_at
  BEFORE UPDATE ON feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_feedback_updated_at();
