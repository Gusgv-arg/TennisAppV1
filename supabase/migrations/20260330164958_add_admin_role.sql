-- Migration: Add 'admin' role, restrict 'owner' to only the creator
-- Date: 2026-03-30
-- 1. Updates CHECK constraints
-- 2. Downgrades secondary owners to admin
-- 3. Updates transfer_academy_ownership to demote to admin instead of coach

-- Update constraints
ALTER TABLE academy_members DROP CONSTRAINT IF EXISTS academy_members_role_check;
ALTER TABLE academy_members ADD CONSTRAINT academy_members_role_check CHECK (role IN ('owner', 'admin', 'coach', 'assistant', 'viewer'));

ALTER TABLE academy_invitations DROP CONSTRAINT IF EXISTS academy_invitations_role_check;
ALTER TABLE academy_invitations ADD CONSTRAINT academy_invitations_role_check CHECK (role IN ('owner', 'admin', 'coach', 'assistant', 'viewer'));

-- Downgrade secondary owners (anyone who is an owner but not the created_by of their academy)
UPDATE academy_members
SET role = 'admin'
WHERE role = 'owner' 
AND user_id NOT IN (
    SELECT created_by FROM academies WHERE id = academy_members.academy_id
);

-- Update transfer_academy_ownership to demote to 'admin' instead of 'coach'
CREATE OR REPLACE FUNCTION public.transfer_academy_ownership(p_academy_id uuid, p_new_owner_id uuid, p_current_owner_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_owner_role text;
  v_new_owner_member_id uuid;
BEGIN
  -- Verify current owner is actually an owner
  SELECT role INTO v_current_owner_role
  FROM academy_members
  WHERE academy_id = p_academy_id
    AND user_id = p_current_owner_id
    AND is_active = true;
  
  IF v_current_owner_role != 'owner' THEN
    RAISE EXCEPTION 'Current user is not an owner of this academy';
  END IF;
  
  -- Verify new owner is a member of the academy
  SELECT id INTO v_new_owner_member_id
  FROM academy_members
  WHERE academy_id = p_academy_id
    AND user_id = p_new_owner_id
    AND is_active = true;
  
  IF v_new_owner_member_id IS NULL THEN
    RAISE EXCEPTION 'New owner must be an active member of the academy';
  END IF;
  
  -- Demote current owner to admin (formerly was 'coach')
  UPDATE academy_members
  SET role = 'admin'
  WHERE academy_id = p_academy_id
    AND user_id = p_current_owner_id;
  
  -- Promote new owner
  UPDATE academy_members
  SET role = 'owner'
  WHERE academy_id = p_academy_id
    AND user_id = p_new_owner_id;
    
  -- Update academies table created_by column to reflect the true owner
  UPDATE academies
  SET created_by = p_new_owner_id
  WHERE id = p_academy_id;
  
  RETURN true;
END;
$function$;

-- Update the main RLS checker function so admins get the same RLS bypasses as owners
CREATE OR REPLACE FUNCTION public.check_is_academy_owner(_academy_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM academy_members 
    WHERE academy_id = _academy_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
      AND is_active = true
  );
END;
$function$;

-- Trigger to prevent admins from modifying or deleting the owner
CREATE OR REPLACE FUNCTION public.protect_owner_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_user_role text;
BEGIN
  -- We only care if someone is trying to modify or delete an owner
  IF TG_OP = 'UPDATE' AND OLD.role = 'owner' AND NEW.role != 'owner' THEN
    -- Check who is doing the action
    SELECT role INTO v_current_user_role
    FROM academy_members
    WHERE academy_id = OLD.academy_id
      AND user_id = auth.uid()
      AND is_active = true;
      
    IF v_current_user_role != 'owner' THEN
      RAISE EXCEPTION 'Only an owner can modify another owner';
    END IF;
  END IF;
  
  IF TG_OP = 'UPDATE' AND OLD.role = 'owner' AND NEW.is_active = false THEN
    -- Check who is doing the action
    SELECT role INTO v_current_user_role
    FROM academy_members
    WHERE academy_id = OLD.academy_id
      AND user_id = auth.uid()
      AND is_active = true;
      
    IF v_current_user_role != 'owner' THEN
      RAISE EXCEPTION 'Only an owner can remove another owner';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS protect_owner_role_trigger ON academy_members;
CREATE TRIGGER protect_owner_role_trigger
  BEFORE UPDATE ON academy_members
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_owner_role();
