-- Make videos bucket public so anonymous users can view shared videos via getPublicUrl
UPDATE storage.buckets SET public = true WHERE id = 'videos';
