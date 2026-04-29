-- =============================================================================
-- 20260429000000_signup_audit_defensive.sql
-- Prevent audit log failures from blocking user signup.
--
-- PROBLEM
-- -------
-- audit_user_signup() fires AFTER INSERT on auth.users and immediately tries
-- to INSERT into audit_log. That INSERT triggers trg_audit_log_hash (BEFORE
-- INSERT on audit_log), which calls compute_audit_hash(). compute_audit_hash()
-- uses encode(digest(..., 'sha256'), 'hex') from pgcrypto.
--
-- If pgcrypto is not yet enabled on the remote database, or if the
-- audit_log_event_seq sequence is missing, compute_audit_hash() raises an
-- exception. Because the exception propagates inside the same transaction as
-- the auth.users INSERT, Supabase Auth aborts the entire signup and returns
-- "Database error saving new user" to the client.
--
-- This blocks every signup — not just funders — whenever the audit chain
-- infrastructure has a dependency gap.
--
-- SOLUTION
-- --------
-- Wrap the body of audit_user_signup() in EXCEPTION WHEN OTHERS THEN
-- RAISE WARNING. The signup always succeeds. Audit failures are logged as
-- Postgres WARNING messages, visible in database logs, but never surfaced to
-- users or abort the transaction.
--
-- RATIONALE
-- ---------
-- audit_user_signup() is observability infrastructure, not a security gate.
-- Its failure must never block legitimate user creation. The same fire-and-forget
-- pattern is used in auth/callback/route.ts for the session-exchange audit event.
--
-- EFFECT ON AUDIT INTEGRITY
-- -------------------------
-- If the audit INSERT fails, the signup event will be missing from the chain.
-- This is recoverable: the user row exists in auth.users, and the profiles
-- row is created by handle_new_user (a separate trigger). Missing signup events
-- can be detected by comparing auth.users created_at against audit_log entries
-- for the same user id.
-- =============================================================================


CREATE OR REPLACE FUNCTION public.audit_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  BEGIN
    -- Read the role that handle_new_user just set.
    -- Returns NULL if the profiles row does not exist yet (harmless).
    SELECT role INTO v_role FROM public.profiles WHERE id = NEW.id;

    INSERT INTO public.audit_log (
      entity_type,
      entity_id,
      action,
      actor_id,     -- NULL: profiles row may not be committed yet; avoids FK violation
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
  EXCEPTION WHEN OTHERS THEN
    -- Audit failure must never block signup. Log for investigation but proceed.
    RAISE WARNING
      '[audit_user_signup] Failed to write signup audit entry for user %: % (SQLSTATE %)',
      NEW.id, SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.audit_user_signup() IS
  'AFTER INSERT trigger on auth.users. Writes a signup audit event to audit_log. '
  'Wrapped in EXCEPTION WHEN OTHERS so audit infrastructure failures (missing '
  'pgcrypto, missing sequence, FK violations) never abort user creation. '
  'Failure is logged as a Postgres WARNING. actor_id is always NULL to avoid '
  'FK violations before the profiles row is committed.';
