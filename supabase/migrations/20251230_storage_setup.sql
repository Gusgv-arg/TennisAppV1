-- 1. CREATE BUCKETS
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', false),
       ('analysis-artifacts', 'analysis-artifacts', false),
       ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 2. ENABLE RLS ON STORAGE (If not already enabled)
-- Note: Supabase Storage has RLS enabled by default on the storage.objects table.

-- 3. STORAGE POLICIES

-- AVATARS: Public Read, Authenticated Write (Own Folder)
CREATE POLICY "Public Access for Avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload own avatar" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- VIDEOS: Private, Only Owner can manage
CREATE POLICY "Coaches manage own videos" ON storage.objects
  FOR ALL USING (
    bucket_id = 'videos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- ANALYSIS ARTIFACTS: Private, Only Owner can manage
CREATE POLICY "Coaches manage own analysis artifacts" ON storage.objects
  FOR ALL USING (
    bucket_id = 'analysis-artifacts' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
