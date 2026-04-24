-- =============================================================================
-- 20260424000002_mfa_enforcement.sql
-- MFA enrollment tracking on the profiles table.
--
-- PURPOSE
-- -------
-- Adds two fields to profiles to track MFA enrollment state:
--   mfa_enrolled      boolean — true once the user has a verified TOTP factor
--   mfa_enrolled_at   timestamptz — when the factor was verified
--
-- These fields are maintained by a PostgreSQL trigger on auth.mfa_factors
-- (Supabase's internal MFA factor table). When a factor transitions to
-- 'verified' status, the trigger updates the matching profile row.
--
-- WHY TRACK THIS SEPARATELY FROM auth.mfa_factors
-- ------------------------------------------------
-- The Supabase auth.mfa_factors table is in the 'auth' schema and not
-- accessible via the standard RLS-protected 'public' schema queries used
-- by API routes and the reconciliation engine. By mirroring enrollment
-- state to the profiles table, application code can enforce MFA requirements
-- in a single fast column check rather than a cross-schema JOIN.
--
-- ENFORCEMENT ARCHITECTURE
-- ------------------------
-- This migration is the data layer. Enforcement is done at three levels:
--   1. API routes — requireMFA() in src/lib/auth/middleware.ts checks AAL
--      on the JWT for sensitive endpoints (fund, release, admin, contract sign)
--   2. Next.js middleware — AAL2 check for /dashboard/admin routes
--   3. UI — enrollment page gates funders/admins if mfa_enrolled = false
--
-- LIMITATION: The profile.mfa_enrolled flag is advisory. The authoritative
-- enforcement uses supabase.auth.mfa.getAuthenticatorAssuranceLevel() which
-- reads the JWT's 'aal' claim. The profile flag is used only for fast
-- redirect decisions in the UI enrollment gate.
-- =============================================================================


-- ── 1. Add columns ────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mfa_enrolled    boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mfa_enrolled_at timestamptz;

COMMENT ON COLUMN public.profiles.mfa_enrolled IS
  'True once the user has at least one verified TOTP factor in auth.mfa_factors. '
  'Set by the trg_mfa_factor_enrolled trigger. Used for UI-layer enrollment gates. '
  'Authoritative MFA enforcement uses the JWT aal claim, not this column.';

COMMENT ON COLUMN public.profiles.mfa_enrolled_at IS
  'Timestamp when the user first verified a TOTP factor. NULL if never enrolled. '
  'Set by the trg_mfa_factor_enrolled trigger. Immutable after first enrollment — '
  'unenrolling and re-enrolling does not reset this to preserve the enrollment history.';


-- ── 2. Trigger function: sync enrollment to profiles ─────────────────────────
-- Fires AFTER INSERT OR UPDATE on auth.mfa_factors.
-- Only acts when a factor's status transitions to 'verified'.
-- SECURITY DEFINER so it can UPDATE public.profiles from the auth schema context.

CREATE OR REPLACE FUNCTION public.handle_mfa_factor_enrolled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Only sync when a factor becomes verified
  -- (catches both INSERT with status='verified' and UPDATE status→'verified')
  IF NEW.status = 'verified' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'verified') THEN
    UPDATE public.profiles
    SET
      mfa_enrolled    = true,
      -- Preserve the original enrollment timestamp — don't overwrite if already set
      mfa_enrolled_at = COALESCE(mfa_enrolled_at, NOW()),
      updated_at      = NOW()
    WHERE id = NEW.user_id;

    -- Also write an audit record so enrollment is traceable without a profile JOIN
    INSERT INTO public.audit_log (
      entity_type,
      entity_id,
      action,
      actor_id,
      actor_name,
      actor_role,
      system_source,
      new_values,
      metadata
    )
    SELECT
      'profile',
      NEW.user_id,
      'mfa_enrolled',
      NEW.user_id,
      COALESCE(p.full_name, p.company_name, NEW.user_id::text),
      p.role::text,
      'db_trigger/handle_mfa_factor_enrolled',
      jsonb_build_object(
        'factor_id',   NEW.id,
        'factor_type', NEW.factor_type,
        'enrolled_at', NOW()
      ),
      jsonb_build_object(
        'mfa_factor_id', NEW.id,
        'source',        'auth.mfa_factors trigger'
      )
    FROM public.profiles p
    WHERE p.id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_mfa_factor_enrolled() IS
  'AFTER INSERT OR UPDATE trigger on auth.mfa_factors. '
  'Sets profiles.mfa_enrolled = true and profiles.mfa_enrolled_at = NOW() '
  'when a factor transitions to ''verified'' status. Also writes an audit_log '
  'entry for the enrollment event.';


-- ── 3. Attach trigger to auth.mfa_factors ─────────────────────────────────────

DROP TRIGGER IF EXISTS trg_mfa_factor_enrolled ON auth.mfa_factors;
CREATE TRIGGER trg_mfa_factor_enrolled
  AFTER INSERT OR UPDATE OF status ON auth.mfa_factors
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_mfa_factor_enrolled();


-- ── 4. Trigger function: handle factor deletion (unenroll) ────────────────────
-- When a factor is deleted (unenrolled), check if the user still has any
-- verified factors. If not, set mfa_enrolled = false.
-- This allows the enrollment gate to re-trigger if a funder unenrolls.

CREATE OR REPLACE FUNCTION public.handle_mfa_factor_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_remaining_verified integer;
BEGIN
  -- Count remaining verified factors for this user after deletion
  SELECT COUNT(*)
  INTO   v_remaining_verified
  FROM   auth.mfa_factors
  WHERE  user_id = OLD.user_id
    AND  status  = 'verified'
    AND  id      != OLD.id;

  IF v_remaining_verified = 0 THEN
    UPDATE public.profiles
    SET
      mfa_enrolled = false,
      updated_at   = NOW()
    WHERE id = OLD.user_id;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_mfa_factor_deleted ON auth.mfa_factors;
CREATE TRIGGER trg_mfa_factor_deleted
  AFTER DELETE ON auth.mfa_factors
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_mfa_factor_deleted();


-- ── 5. Backfill: sync existing enrolled users ─────────────────────────────────
-- For users who already have verified TOTP factors before this migration.

DO $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.profiles p
  SET
    mfa_enrolled    = true,
    mfa_enrolled_at = COALESCE(
      (SELECT MIN(f.created_at)
       FROM auth.mfa_factors f
       WHERE f.user_id = p.id AND f.status = 'verified'),
      NOW()
    ),
    updated_at = NOW()
  WHERE EXISTS (
    SELECT 1 FROM auth.mfa_factors f
    WHERE f.user_id = p.id AND f.status = 'verified'
  )
    AND p.mfa_enrolled = false;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE '20260424000002: Backfilled mfa_enrolled=true for % existing profiles.', v_updated;
END;
$$;


-- ── 6. Index for fast enrollment gate lookups ─────────────────────────────────
-- Dashboard and API routes check (role IN ('funder','admin') AND mfa_enrolled = false)
-- to decide whether to redirect to enrollment.

CREATE INDEX IF NOT EXISTS profiles_mfa_enrolled_idx
  ON public.profiles (role, mfa_enrolled)
  WHERE role IN ('funder', 'admin');


-- =============================================================================
-- SUMMARY
-- =============================================================================
-- Columns added to profiles:
--   mfa_enrolled     boolean NOT NULL DEFAULT false
--   mfa_enrolled_at  timestamptz
--
-- Triggers added:
--   trg_mfa_factor_enrolled  — AFTER INSERT/UPDATE on auth.mfa_factors
--                               → sets mfa_enrolled=true, logs audit event
--   trg_mfa_factor_deleted   — AFTER DELETE on auth.mfa_factors
--                               → clears mfa_enrolled if no verified factors remain
--
-- Index added:
--   profiles_mfa_enrolled_idx — partial on (role, mfa_enrolled) for funder/admin
--
-- Backfill:
--   Existing users with verified factors get mfa_enrolled=true
-- =============================================================================
