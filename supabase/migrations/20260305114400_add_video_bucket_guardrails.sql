-- Guardrail 1: Limit file size to 100MB
-- Guardrail 2: Only allow video mime types
UPDATE storage.buckets 
SET 
  file_size_limit = 104857600,  -- 100MB in bytes
  allowed_mime_types = ARRAY['video/mp4', 'video/quicktime', 'video/webm']
WHERE id = 'videos';
