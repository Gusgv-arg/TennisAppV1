-- 1. Campo para vincular player ↔ auth user
ALTER TABLE public.players ADD COLUMN linked_user_id UUID REFERENCES auth.users(id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_linked_user ON public.players(linked_user_id) WHERE linked_user_id IS NOT NULL;

-- 2. RLS: El player puede leer SU propia data
CREATE POLICY "Players can read own record"
ON public.players FOR SELECT
USING (linked_user_id = auth.uid());

-- 3. RLS: El player puede leer sus propios análisis
CREATE POLICY "Players can read own analyses"
ON public.analyses FOR SELECT
USING (player_id IN (
  SELECT id FROM public.players WHERE linked_user_id = auth.uid()
));

-- 4. RLS: El player puede leer sus propios videos
CREATE POLICY "Players can read own videos"
ON public.videos FOR SELECT
USING (player_id IN (
  SELECT id FROM public.players WHERE linked_user_id = auth.uid()
));

-- 5. Trigger: Auto-vincular cuando se registra un usuario con email coincidente
CREATE OR REPLACE FUNCTION public.auto_link_player_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Buscar si existe un player con ese email y sin vincular
  UPDATE public.players
  SET linked_user_id = NEW.id
  WHERE contact_email = NEW.email
    AND linked_user_id IS NULL
    AND is_deleted = false;

  -- Si hubo match, actualizar el profile del nuevo usuario
  IF FOUND THEN
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

DROP TRIGGER IF EXISTS trg_auto_link_player ON public.profiles;
CREATE TRIGGER trg_auto_link_player
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.auto_link_player_on_signup();

-- 6. Trigger: Auto-vincular cuando el coach actualiza el email del player
CREATE OR REPLACE FUNCTION public.auto_link_player_on_email_update()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Solo actuar si el email cambió y ahora tiene valor
  IF NEW.contact_email IS NOT NULL
     AND NEW.contact_email != ''
     AND NEW.linked_user_id IS NULL
     AND (OLD.contact_email IS NULL OR OLD.contact_email != NEW.contact_email)
  THEN
    -- Buscar si existe un profile/user con ese email
    SELECT id INTO v_user_id
    FROM public.profiles
    WHERE email = NEW.contact_email
    LIMIT 1;

    IF v_user_id IS NOT NULL THEN
      NEW.linked_user_id := v_user_id;

      UPDATE public.profiles
      SET role = 'player',
          current_academy_id = NEW.academy_id
      WHERE id = v_user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_auto_link_on_email_update ON public.players;
CREATE TRIGGER trg_auto_link_on_email_update
BEFORE UPDATE OF contact_email ON public.players
FOR EACH ROW
EXECUTE FUNCTION public.auto_link_player_on_email_update();
