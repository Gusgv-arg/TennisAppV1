-- Function: get_sessions_skill
-- Description: Retrieves sessions with full details (players, plans, attendance, coach, instructor) 
--              to avoid N+1 queries and client-side patching.
--              Respects RLS by using SECURITY INVOKER (default) or explicit filtering if needed.

CREATE OR REPLACE FUNCTION get_sessions_skill(
    p_start_date TIMESTAMP WITH TIME ZONE,
    p_end_date TIMESTAMP WITH TIME ZONE,
    p_academy_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Bypass RLS to ensure joins work (we filter by logic)
SET search_path = public, extensions -- Best practice for SECURITY DEFINER
            'location', s.location,
            'coach_id', s.coach_id,
            'instructor_id', s.instructor_id,
            'academy_id', s.academy_id,
            'class_group_id', s.class_group_id,
            
            -- Joined Objects
            'coach', jsonb_build_object(
                'full_name', c.full_name,
                'avatar_url', c.avatar_url
            ),
            'instructor', CASE WHEN i.id IS NOT NULL THEN jsonb_build_object(
                'full_name', i.full_name,
                'avatar_url', i.avatar_url
            ) ELSE NULL END,
            'academy', CASE WHEN a.id IS NOT NULL THEN jsonb_build_object(
                'id', a.id,
                'name', a.name
            ) ELSE NULL END,
            'class_group', CASE WHEN cg.id IS NOT NULL THEN jsonb_build_object(
                'id', cg.id,
                'name', cg.name,
                'image_url', cg.image_url
            ) ELSE NULL END,
            
            -- Nested Collections
            'players', COALESCE((
                -- Combine players from session_players AND class_group members
                -- Logic: 
                -- 1. Get explicit session_players (with plan info)
                -- 2. Get class_group members (base info)
                -- 3. Merge them (session_players take precedence)
                -- For SQL simplicity in this "Skill", we will return a unified list.
                
                WHERE sp.session_id = s.id
            ), '[]'::jsonb),
-- Function: get_sessions_skill
-- Description: Retrieves sessions with full details (players, plans, attendance, coach, instructor) 
--              to avoid N+1 queries and client-side patching.
--              Respects RLS by using SECURITY INVOKER (default) or explicit filtering if needed.

CREATE OR REPLACE FUNCTION get_sessions_skill(
    p_start_date TIMESTAMP WITH TIME ZONE,
    p_end_date TIMESTAMP WITH TIME ZONE,
    p_academy_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Bypass RLS to ensure joins work (we filter by logic)
SET search_path = public, extensions
AS $$
DECLARE
    v_sessions JSONB;
BEGIN
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', s.id,
            'scheduled_at', s.scheduled_at,
            'duration_minutes', s.duration_minutes,
            'location', s.location,
            'status', s.status,
            'cancellation_reason', s.cancellation_reason,
            'deleted_at', s.deleted_at,
            'coach_id', s.coach_id,
            'instructor_id', s.instructor_id,
            'academy_id', s.academy_id,
            'class_group_id', s.class_group_id,
            
            -- Joined Objects
            'coach', jsonb_build_object(
                'full_name', c.full_name,
                'avatar_url', c.avatar_url
            ),
            'instructor', CASE WHEN am.id IS NOT NULL THEN jsonb_build_object(
                'full_name', COALESCE(i.full_name, i.email, am.member_name, am.member_email, 'Instructor'),
                'avatar_url', i.avatar_url
            ) ELSE NULL END,
            'academy', CASE WHEN a.id IS NOT NULL THEN jsonb_build_object(
                'id', a.id,
                'name', a.name
            ) ELSE NULL END,
            'class_group', CASE WHEN cg.id IS NOT NULL THEN jsonb_build_object(
                'id', cg.id,
                'name', cg.name,
                'image_url', cg.image_url
            ) ELSE NULL END,
            
            -- Nested Collections
            'players', COALESCE((
                -- Combine players from session_players AND class_group members
                -- Logic: 
                -- 1. Get explicit session_players (with plan info)
                -- 2. Get class_group members (base info)
                -- 3. Merge them (session_players take precedence)
                -- For SQL simplicity in this "Skill", we will return a unified list.
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', p.id,
                        'full_name', p.full_name,
                        'avatar_url', p.avatar_url,
                        'email', p.contact_email,
                        'plan_name', pp.name,
                        'subscription_id', sp.subscription_id
                    )
                )
                FROM session_players sp
                JOIN players p ON sp.player_id = p.id
                LEFT JOIN player_subscriptions psub ON sp.subscription_id = psub.id
                LEFT JOIN pricing_plans pp ON psub.plan_id = pp.id
                WHERE sp.session_id = s.id
            ), '[]'::jsonb),
            
            'attendance', COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'player_id', sa.player_id,
                        'status', sa.status,
                        'notes', sa.notes,
                        'created_at', sa.marked_at
                    )
                )
                FROM session_attendance sa
                WHERE sa.session_id = s.id
            ), '[]'::jsonb)
        )
    ) ORDER BY s.scheduled_at ASC
    INTO v_sessions
    FROM sessions s
    LEFT JOIN profiles c ON s.coach_id = c.id
    LEFT JOIN academy_members am ON s.instructor_id = am.id -- Correct join!
    LEFT JOIN profiles i ON am.user_id = i.id -- Get profile via academy_member
    LEFT JOIN academies a ON s.academy_id = a.id
    LEFT JOIN class_groups cg ON s.class_group_id = cg.id
    WHERE 
        s.scheduled_at >= p_start_date 
        AND s.scheduled_at <= p_end_date
        AND (p_academy_id IS NULL OR s.academy_id = p_academy_id);

    RETURN COALESCE(v_sessions, '[]'::jsonb);
END;
$$;
