-- Drop the potentially fragile path-based policy
DROP POLICY IF EXISTS "Coaches manage own videos" ON storage.objects;

-- Create a more robust owner-based policy
CREATE POLICY "Coaches manage own videos" ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'videos' AND 
  (auth.uid() = owner OR owner IS NULL) -- Allow if owner matches, or fallback (though owner should be set)
)
WITH CHECK (
  bucket_id = 'videos' AND 
  (auth.uid() = owner OR owner IS NULL)
);

-- Note: We include `OR owner IS NULL` tentatively to avoid locking out old files if they didn't have owner set, 
-- but ideally all authenticated uploads have owner. 
-- A stricter and safer check is just owner = auth.uid().
-- Let's stick to the strict check for security, but we might access via path if owner is missing as a fallback?
-- No, let's try the combined approach for maximum compatibility with existing files.

DROP POLICY IF EXISTS "Coaches manage own videos" ON storage.objects;

CREATE POLICY "Coaches manage own videos" ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'videos' AND (
    auth.uid() = owner 
    OR 
    (storage.foldername(name))[1] = auth.uid()::text
  )
)
WITH CHECK (
  bucket_id = 'videos' AND (
    auth.uid() = owner 
    OR 
    (storage.foldername(name))[1] = auth.uid()::text
  )
);
