-- migration to fix role triggers robustness

-- 1. Update handle_new_user to respect intended_role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'avatar_url',
    COALESCE(new.raw_user_meta_data->>'intended_role', 'coach')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update auto_link_player_on_signup to never downgrade a coach
CREATE OR REPLACE FUNCTION public.auto_link_player_on_signup()
RETURNS TRIGGER AS $$
DECLARE
  v_current_role TEXT;
BEGIN
  -- Get the current role from the profile
  SELECT role INTO v_current_role FROM public.profiles WHERE id = NEW.id;

  -- Buscar si existe un player con ese email y sin vincular
  UPDATE public.players
  SET linked_user_id = NEW.id
  WHERE contact_email = NEW.email
    AND linked_user_id IS NULL
    AND is_deleted = false;

  -- Si hubo match, y el usuario NO es un coach, lo convertimos a player
  -- O si explícitamente se registró como player
  IF FOUND AND v_current_role != 'coach' THEN
    UPDATE public.profiles
    SET role = 'player',
        current_academy_id = (
          SELECT academy_id FROM public.players
          WHERE linked_user_id = NEW.id
          LIMIT 1
        )
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Update auto_link_player_on_email_update to never downgrade a coach
CREATE OR REPLACE FUNCTION public.auto_link_player_on_email_update()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_current_role TEXT;
BEGIN
  -- Solo actuar si el email cambió y ahora tiene valor
  IF NEW.contact_email IS NOT NULL
     AND NEW.contact_email != ''
     AND NEW.linked_user_id IS NULL
     AND (OLD.contact_email IS NULL OR OLD.contact_email != NEW.contact_email)
  THEN
    -- Buscar si existe un profile/user con ese email
    SELECT id, role INTO v_user_id, v_current_role
    FROM public.profiles
    WHERE email = NEW.contact_email
    LIMIT 1;

    IF v_user_id IS NOT NULL THEN
      NEW.linked_user_id := v_user_id;

      -- SOLO cambiar a player si NO es un coach
      IF v_current_role != 'coach' THEN
        UPDATE public.profiles
        SET role = 'player',
            current_academy_id = NEW.academy_id
        WHERE id = v_user_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
