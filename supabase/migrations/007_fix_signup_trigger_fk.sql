-- 007_fix_signup_trigger_fk.sql
-- The audit_user_signup trigger was setting actor_id = NEW.id, but at the
-- moment auth.users INSERT fires, the profiles row doesn't exist yet in the
-- same transaction, causing a FK violation on audit_log.actor_id → profiles(id)
-- and aborting the entire signup.
-- Fix: set actor_id = NULL (system event) and keep the user UUID in entity_id only.

CREATE OR REPLACE FUNCTION public.audit_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = NEW.id;

  INSERT INTO public.audit_log (
    entity_type,
    entity_id,
    action,
    actor_id,   -- NULL: profiles row may not be committed yet; avoids FK violation
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
    NULL,
    v_role,
    jsonb_build_object('email', NEW.email, 'role', v_role),
    jsonb_build_object('source', 'auth.users trigger', 'user_id', NEW.id)
  );
  RETURN NEW;
END;
$$;
