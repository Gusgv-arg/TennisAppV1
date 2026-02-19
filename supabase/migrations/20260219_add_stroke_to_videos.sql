-- Add stroke column to videos table
ALTER TABLE videos 
ADD COLUMN stroke text CHECK (stroke IN ('Serve', 'Forehand', 'Backhand', 'Volley', 'Smash', 'Other'));

-- Comment on column
COMMENT ON COLUMN videos.stroke IS 'Category of the tennis stroke in the video';
