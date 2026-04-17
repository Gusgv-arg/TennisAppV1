-- Migration: Fix player auto link trigger
-- Date: 2026-04-17
-- Description: Modifies the auto link trigger to also fire on INSERT so newly created players get linked immediately. Handle OLD being null on INSERT.

CREATE OR REPLACE FUNCTION public.auto_link_player_on_email_update()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_should_link BOOLEAN := false;
BEGIN
  -- Determine if we should attempt linking
  IF NEW.contact_email IS NOT NULL AND NEW.contact_email != '' AND NEW.linked_user_id IS NULL THEN
    IF TG_OP = 'INSERT' THEN
      v_should_link := true;
    ELSIF TG_OP = 'UPDATE' THEN
      IF (OLD.contact_email IS NULL OR OLD.contact_email != NEW.contact_email) THEN
        v_should_link := true;
      END IF;
    END IF;
  END IF;

  IF v_should_link THEN
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
BEFORE INSERT OR UPDATE OF contact_email ON public.players
FOR EACH ROW
EXECUTE FUNCTION public.auto_link_player_on_email_update();
