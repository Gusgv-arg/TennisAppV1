-- Update the videos bucket to allow image thumbnails (jpeg, png) alongside videos
UPDATE storage.buckets 
SET 
  allowed_mime_types = ARRAY['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png']
WHERE id = 'videos';
