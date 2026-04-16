-- 006_audit_enhancements.sql
-- Adds actor_role denormalization to audit_log and a signup tracking trigger.

-- 1a. Add actor_role column to audit_log for fast filtering without joins
ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS actor_role text; -- 'contractor' | 'funder' | 'admin' | 'system' | null

CREATE INDEX IF NOT EXISTS audit_log_actor_role_idx ON public.audit_log (actor_role);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON public.audit_log (action);

-- 1b. Trigger: log every new user signup to audit_log
-- Fires on INSERT into auth.users (Supabase calls handle_new_user first, so profiles row exists by the time we read it)
CREATE OR REPLACE FUNCTION public.audit_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  -- Read the role that handle_new_user just set
  SELECT role INTO v_role FROM public.profiles WHERE id = NEW.id;

  INSERT INTO public.audit_log (
    entity_type,
    entity_id,
    action,
    actor_id,
    actor_role,
    new_values,
    metadata
  ) VALUES (
    'profile',
    NEW.id,
    CASE
      WHEN v_role = 'funder'     THEN 'funder_signed_up'
      WHEN v_role = 'contractor' THEN 'contractor_signed_up'
      WHEN v_role = 'admin'      THEN 'admin_signed_up'
      ELSE 'user_signed_up'
    END,
    NEW.id,
    v_role,
    jsonb_build_object('email', NEW.email, 'role', v_role),
    jsonb_build_object('source', 'auth.users trigger')
  );
  RETURN NEW;
END;
$$;

-- Drop and recreate trigger to avoid duplicate
DROP TRIGGER IF EXISTS trg_audit_user_signup ON auth.users;
CREATE TRIGGER trg_audit_user_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.audit_user_signup();
