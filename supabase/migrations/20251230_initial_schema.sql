-- 1. UTILITY FUNCTIONS
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. TABLES

-- PROFILES (extends auth.users)
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role text DEFAULT 'coach' CHECK (role IN ('coach', 'student', 'admin')),
  locale text DEFAULT 'en' CHECK (locale IN ('en', 'es')),
  preferences jsonb DEFAULT '{}',
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- PLAYERS
CREATE TABLE players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  birth_date date,
  level text CHECK (level IN ('beginner', 'intermediate', 'advanced', 'professional')),
  dominant_hand text CHECK (dominant_hand IN ('left', 'right', 'ambidextrous')),
  contact_email text,
  contact_phone text,
  notes text,
  is_archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- SESSIONS
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES profiles(id),
  player_id uuid REFERENCES players(id) ON DELETE SET NULL,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer DEFAULT 60,
  location text,
  session_type text CHECK (session_type IN ('individual', 'group', 'match')),
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- VIDEOS
CREATE TABLE videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by uuid NOT NULL REFERENCES profiles(id),
  storage_path text NOT NULL,
  original_filename text,
  duration_ms integer,
  file_size_bytes bigint,
  mime_type text,
  status text DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'error')),
  thumbnail_path text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- ANALYSES
CREATE TABLE analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  player_id uuid NOT NULL REFERENCES players(id),
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES profiles(id),
  stroke_type text NOT NULL CHECK (stroke_type IN ('forehand', 'backhand', 'serve', 'volley', 'smash', 'return', 'footwork')),
  pose_data jsonb,
  metrics jsonb NOT NULL,
  ai_feedback jsonb,
  coach_feedback text,
  coach_approved boolean DEFAULT false,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- COACH ANNOTATIONS
CREATE TABLE coach_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES profiles(id),
  timestamp_ms integer NOT NULL,
  annotation_type text CHECK (annotation_type IN ('text', 'drawing', 'audio')),
  content text,
  drawing_data jsonb,
  position jsonb,
  created_at timestamptz DEFAULT now()
);

-- SHARE LINKS
CREATE TABLE share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES profiles(id),
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz NOT NULL,
  is_active boolean DEFAULT true,
  view_count integer DEFAULT 0,
  max_views integer,
  created_at timestamptz DEFAULT now()
);

-- 3. TRIGGERS FOR updated_at
CREATE TRIGGER tr_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER tr_players_updated_at BEFORE UPDATE ON players FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER tr_sessions_updated_at BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER tr_analyses_updated_at BEFORE UPDATE ON analyses FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- 4. AUTO-PROFILE CREATION ON SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. ENABLE ROW LEVEL SECURITY
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;

-- 6. RLS POLICIES

-- Profiles
CREATE POLICY "Users view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Players
CREATE POLICY "Coaches manage own players" ON players FOR ALL USING (coach_id = auth.uid());

-- Sessions
CREATE POLICY "Coaches manage own sessions" ON sessions FOR ALL USING (coach_id = auth.uid());

-- Videos
CREATE POLICY "Coaches manage own videos" ON videos FOR ALL USING (uploaded_by = auth.uid());

-- Analyses
CREATE POLICY "Coaches manage own analyses" ON analyses FOR ALL USING (coach_id = auth.uid());

-- Coach Annotations
CREATE POLICY "Coaches manage own annotations" ON coach_annotations FOR ALL USING (coach_id = auth.uid());

-- Share Links
CREATE POLICY "Coaches manage own share links" ON share_links FOR ALL 
  USING (EXISTS (SELECT 1 FROM analyses WHERE analyses.id = share_links.analysis_id AND analyses.coach_id = auth.uid()));
