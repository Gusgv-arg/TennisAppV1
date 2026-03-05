-- ============================================================
-- Guardrail 4: Orphan Video Cleanup
-- Deletes video records stuck in 'uploading' for over 24 hours
-- and their associated storage files.
-- ============================================================

CREATE OR REPLACE FUNCTION public.cleanup_orphan_videos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    orphan RECORD;
BEGIN
    FOR orphan IN
        SELECT id, storage_path, thumbnail_path
        FROM public.videos
        WHERE upload_status = 'uploading'
          AND created_at < NOW() - INTERVAL '24 hours'
    LOOP
        -- Delete video file from storage
        IF orphan.storage_path IS NOT NULL AND orphan.storage_path != 'placeholder' THEN
            DELETE FROM storage.objects WHERE bucket_id = 'videos' AND name = orphan.storage_path;
        END IF;
        -- Delete thumbnail from storage
        IF orphan.thumbnail_path IS NOT NULL THEN
            DELETE FROM storage.objects WHERE bucket_id = 'videos' AND name = orphan.thumbnail_path;
        END IF;
        -- Delete the database record
        DELETE FROM public.videos WHERE id = orphan.id;
    END LOOP;
END;
$$;

-- Schedule the cleanup to run daily at 4:00 AM UTC
SELECT cron.schedule(
    'cleanup-orphan-videos',
    '0 4 * * *',
    $$SELECT public.cleanup_orphan_videos()$$
);

-- ============================================================
-- Guardrail 5: Video Quota Per Coach
-- Returns the current count and max allowed videos for a coach.
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_video_quota(p_coach_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INT;
    v_max INT := 50; -- Default max videos per coach
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM public.videos
    WHERE uploaded_by = p_coach_id
      AND upload_status = 'ready';

    RETURN json_build_object(
        'current_count', v_count,
        'max_allowed', v_max,
        'can_upload', v_count < v_max
    );
END;
$$;
