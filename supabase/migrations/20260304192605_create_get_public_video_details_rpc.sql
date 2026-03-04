-- Function to get public video details securely by ID without needing to be logged in
CREATE OR REPLACE FUNCTION get_public_video_details(p_video_id uuid)
RETURNS TABLE (
    id uuid,
    title text,
    description text,
    storage_path text,
    thumbnail_path text,
    created_at timestamptz,
    duration_secs double precision,
    stroke text,
    player_id uuid,
    player_name text
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.id,
        v.title,
        v.description,
        v.storage_path,
        v.thumbnail_path,
        v.created_at,
        v.duration_secs,
        v.stroke,
        v.player_id,
        p.full_name as player_name
    FROM videos v
    LEFT JOIN players p ON v.player_id = p.id
    WHERE v.id = p_video_id;
END;
$$ LANGUAGE plpgsql;
