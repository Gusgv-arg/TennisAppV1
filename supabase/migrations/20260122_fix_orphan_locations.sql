-- Fix Orphan Locations
-- Assigns locations with NULL academy_id to the specific academy 'Academia de gus'
-- Academy ID taken from debug output: b788d738-5653-4be0-8e5e-593cbae97a36

UPDATE locations
SET academy_id = 'b788d738-5653-4be0-8e5e-593cbae97a36'
WHERE academy_id IS NULL;
