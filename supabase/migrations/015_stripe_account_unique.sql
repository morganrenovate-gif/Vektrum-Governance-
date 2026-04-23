-- =============================================================================
-- 015_stripe_account_unique.sql
-- Prevent duplicate Stripe Connect account usage across profiles.
--
-- PROBLEM:
--   profiles.stripe_account_id has no UNIQUE constraint. Multiple profiles
--   can reference the same Stripe Connect account, which would:
--     - Route payouts to the wrong contractor
--     - Cause the account.updated webhook's .single() query to throw
--     - Allow one user to intercept another's payouts
--
-- CHANGES:
--   1. Audit block    — scan for existing duplicates; resolve by keeping the
--                       most recently active profile and NULLing the rest
--   2. Unique index   — partial UNIQUE on stripe_account_id WHERE NOT NULL
--   3. Trigger        — BEFORE INSERT/UPDATE fires a clear unique_violation
--                       exception so the application receives error code 23505
--                       (the index alone returns a generic constraint message)
--   4. Admin function — audit_stripe_account_duplicates() for on-demand scans
--
-- NOTE ON AUDIT TRAIL DESIGN:
--   A trigger cannot both RAISE EXCEPTION and persist an audit record — the
--   exception rolls back all side-effects including pg_notify and INSERT into
--   audit_log. Persistent audit logging for conflict *attempts* therefore
--   lives in the application layer (/api/stripe/connect catches code 23505
--   and writes to audit_log + sends admin email in a fresh transaction).
--   This migration's DO block runs its own transaction and CAN write audit_log
--   for the one-time duplicate resolution.
-- =============================================================================


-- =============================================================================
-- PART 1 — AUDIT & RESOLVE EXISTING DUPLICATES
-- =============================================================================
-- Find every stripe_account_id shared by more than one profile.
-- Resolution strategy: keep the profile with the most recent updated_at
-- (most likely to be the legitimate active user). NULL out all others and
-- reset stripe_payouts_enabled so they re-enter Stripe onboarding cleanly.
-- Every change is recorded in audit_log for admin review.
-- =============================================================================

DO $$
DECLARE
  v_group         RECORD;
  v_loser         RECORD;
  v_dup_groups    integer := 0;
  v_profiles_fixed integer := 0;
BEGIN
  RAISE NOTICE '015_stripe_account_unique: scanning for duplicate stripe_account_id values…';

  -- Iterate over every group of profiles that share a stripe_account_id
  FOR v_group IN
    SELECT
      stripe_account_id,
      -- Profile to keep: most recently updated (most active / most legitimate)
      (array_agg(id ORDER BY updated_at DESC, created_at DESC))[1] AS keeper_id,
      -- Count of duplicates in this group
      COUNT(*) AS profile_count
    FROM public.profiles
    WHERE stripe_account_id IS NOT NULL
    GROUP BY stripe_account_id
    HAVING COUNT(*) > 1
  LOOP
    v_dup_groups := v_dup_groups + 1;

    RAISE NOTICE 'Duplicate found: stripe_account_id=% shared by % profiles. Keeping profile %.',
      v_group.stripe_account_id, v_group.profile_count, v_group.keeper_id;

    -- Iterate over every profile in this group that is NOT the keeper
    FOR v_loser IN
      SELECT id, full_name, company_name, stripe_payouts_enabled, updated_at
      FROM public.profiles
      WHERE stripe_account_id = v_group.stripe_account_id
        AND id != v_group.keeper_id
    LOOP
      v_profiles_fixed := v_profiles_fixed + 1;

      -- Write audit record BEFORE nulling so old values are captured
      INSERT INTO public.audit_log (
        entity_type,
        entity_id,
        action,
        actor_id,
        old_values,
        new_values,
        metadata
      ) VALUES (
        'profile',
        v_loser.id,
        'stripe_account_duplicate_resolved',
        NULL,  -- system action — no authenticated actor
        jsonb_build_object(
          'stripe_account_id',     v_group.stripe_account_id,
          'stripe_payouts_enabled', v_loser.stripe_payouts_enabled
        ),
        jsonb_build_object(
          'stripe_account_id',     NULL,
          'stripe_payouts_enabled', false
        ),
        jsonb_build_object(
          'resolution',             'duplicate_nulled_out',
          'kept_by_profile_id',     v_group.keeper_id,
          'duplicate_group_size',   v_group.profile_count,
          'migration',              '015_stripe_account_unique',
          'note', 'Profile must re-complete Stripe Connect onboarding. '
                  'The stripe_account_id was shared with keeper profile — '
                  're-onboarding will create a fresh Stripe Express account.'
        )
      );

      -- NULL out the duplicate — forces re-onboarding
      UPDATE public.profiles
      SET
        stripe_account_id      = NULL,
        stripe_payouts_enabled = false,
        updated_at             = now()
      WHERE id = v_loser.id;

      RAISE NOTICE '  → NULLed stripe_account_id on profile % (%)',
        v_loser.id,
        COALESCE(v_loser.full_name, v_loser.company_name, v_loser.id::text);
    END LOOP;
  END LOOP;

  -- Final report
  IF v_dup_groups = 0 THEN
    RAISE NOTICE '015_stripe_account_unique: ✓ No duplicate stripe_account_id values found.';
  ELSE
    RAISE NOTICE '015_stripe_account_unique: resolved % duplicate group(s), % profile(s) re-queued for onboarding.',
      v_dup_groups, v_profiles_fixed;
    RAISE NOTICE 'ACTION REQUIRED: Affected profiles are recorded in audit_log with action=stripe_account_duplicate_resolved.';
    RAISE NOTICE 'Notify affected users to re-complete Stripe Connect onboarding.';
  END IF;
END;
$$;


-- =============================================================================
-- PART 2 — PARTIAL UNIQUE INDEX
-- =============================================================================
-- Partial: only enforce uniqueness when stripe_account_id IS NOT NULL.
-- NULL is allowed on multiple profiles (contractors not yet onboarded,
-- funders, admins — none of these have Stripe accounts).
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS profiles_stripe_account_id_unique
  ON public.profiles (stripe_account_id)
  WHERE stripe_account_id IS NOT NULL;

COMMENT ON INDEX public.profiles_stripe_account_id_unique IS
  'Enforces one-to-one mapping between Vektrum profiles and Stripe Connect accounts. '
  'Partial (WHERE NOT NULL) so multiple NULL values are permitted for profiles '
  'without a Stripe account (funders, admins, onboarding-incomplete contractors). '
  'Violation raises PostgreSQL error code 23505 (unique_violation), caught by the '
  'application layer which logs the attempt and notifies admins.';


-- =============================================================================
-- PART 3 — BEFORE TRIGGER: clear conflict message
-- =============================================================================
-- The UNIQUE INDEX alone returns a generic constraint message. This trigger
-- fires BEFORE the constraint check and emits a structured exception that:
--   a) identifies the conflicting Stripe account ID by name
--   b) includes the existing profile UUID so the app can reference it
--   c) uses ERRCODE = 'unique_violation' (23505) so the app catch is consistent
--
-- IMPORTANT: Because RAISE EXCEPTION rolls back the entire transaction, this
-- trigger cannot write to audit_log or emit pg_notify. Both would be rolled
-- back with the failed INSERT/UPDATE. Audit logging for conflict *attempts*
-- is therefore handled by the application layer in /api/stripe/connect.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_stripe_account_id_unique()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conflict_profile_id uuid;
BEGIN
  -- Nothing to check if stripe_account_id is not being set
  IF NEW.stripe_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip the check when the value is not changing (UPDATE only)
  IF TG_OP = 'UPDATE' AND OLD.stripe_account_id IS NOT DISTINCT FROM NEW.stripe_account_id THEN
    RETURN NEW;
  END IF;

  -- Look for any OTHER profile already using this Stripe account ID
  SELECT id INTO v_conflict_profile_id
  FROM public.profiles
  WHERE stripe_account_id = NEW.stripe_account_id
    AND id IS DISTINCT FROM NEW.id   -- exclude self (matters for UPDATE)
  LIMIT 1;

  IF v_conflict_profile_id IS NOT NULL THEN
    -- Raise with the standard unique_violation ERRCODE (23505).
    -- The application layer catches this code and:
    --   1. Returns 409 Conflict to the caller
    --   2. Writes an audit_log entry (in a fresh transaction — not rolled back)
    --   3. Sends an admin notification email
    RAISE EXCEPTION
      'stripe_account_conflict: Stripe account % is already linked to profile %. '
      'Each Stripe Connect account may be linked to only one Vektrum profile. '
      'Existing profile: %',
      NEW.stripe_account_id,
      v_conflict_profile_id,
      v_conflict_profile_id
    USING
      ERRCODE = 'unique_violation',
      -- Embed structured data in the HINT so the app can parse it without
      -- string matching on the MESSAGE.
      HINT = format(
        '{"conflicting_stripe_account_id":"%s","existing_profile_id":"%s","attempted_profile_id":"%s"}',
        NEW.stripe_account_id,
        v_conflict_profile_id,
        NEW.id
      );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.check_stripe_account_id_unique() IS
  'BEFORE INSERT/UPDATE trigger on profiles. Checks for an existing profile '
  'already linked to the same Stripe account ID and raises unique_violation (23505) '
  'if one is found, with a structured HINT payload for the application layer. '
  'Cannot write to audit_log — RAISE EXCEPTION rolls back all side-effects. '
  'Audit logging for conflict attempts happens in /api/stripe/connect (code 23505 catch).';

DROP TRIGGER IF EXISTS trg_check_stripe_account_id_unique ON public.profiles;
CREATE TRIGGER trg_check_stripe_account_id_unique
  BEFORE INSERT OR UPDATE OF stripe_account_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_stripe_account_id_unique();

-- Grant execute on the function to roles that can INSERT/UPDATE profiles
REVOKE ALL    ON FUNCTION public.check_stripe_account_id_unique() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.check_stripe_account_id_unique() TO authenticated;
GRANT  EXECUTE ON FUNCTION public.check_stripe_account_id_unique() TO service_role;


-- =============================================================================
-- PART 4 — ADMIN SCAN FUNCTION
-- =============================================================================
-- Returns all stripe_account_id values currently shared by more than one
-- profile. Used by the admin API (/api/admin/stripe/duplicates) and can be
-- called directly by operators:
--
--   SELECT * FROM public.audit_stripe_account_duplicates();
-- =============================================================================

CREATE OR REPLACE FUNCTION public.audit_stripe_account_duplicates()
RETURNS TABLE (
  stripe_account_id   text,
  profile_count       bigint,
  profile_ids         uuid[],
  profile_names       text[],
  oldest_created_at   timestamptz,
  newest_updated_at   timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    p.stripe_account_id,
    COUNT(*)                                                          AS profile_count,
    array_agg(p.id          ORDER BY p.updated_at DESC)             AS profile_ids,
    array_agg(
      COALESCE(p.full_name, p.company_name, p.id::text)
      ORDER BY p.updated_at DESC
    )                                                                 AS profile_names,
    MIN(p.created_at)                                                 AS oldest_created_at,
    MAX(p.updated_at)                                                 AS newest_updated_at
  FROM public.profiles p
  WHERE p.stripe_account_id IS NOT NULL
  GROUP BY p.stripe_account_id
  HAVING COUNT(*) > 1
  ORDER BY COUNT(*) DESC, MAX(p.updated_at) DESC;
$$;

COMMENT ON FUNCTION public.audit_stripe_account_duplicates() IS
  'Returns all stripe_account_id values shared by more than one profile. '
  'Returns an empty result set when the database is clean. '
  'Call via the admin API at GET /api/admin/stripe/duplicates or directly in SQL. '
  'SECURITY DEFINER so it can read profiles regardless of the caller''s RLS context.';

-- Restrict to service_role and admin users only
REVOKE ALL    ON FUNCTION public.audit_stripe_account_duplicates() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.audit_stripe_account_duplicates() TO service_role;
-- Note: anon and authenticated roles do NOT get execute — only service_role
-- (admin API uses createSupabaseAdminClient which runs as service_role).


-- =============================================================================
-- SUMMARY
-- =============================================================================
--
-- Tables affected:
--   profiles — added partial UNIQUE INDEX on stripe_account_id (WHERE NOT NULL)
--              added BEFORE trigger trg_check_stripe_account_id_unique
--
-- Functions added:
--   check_stripe_account_id_unique()  — trigger function for clear error messages
--   audit_stripe_account_duplicates() — admin scan returning current duplicates
--
-- Audit trail:
--   - One-time resolution: audit_log rows with action='stripe_account_duplicate_resolved'
--   - Future conflict attempts: logged by /api/stripe/connect on 23505 catch
--     (audit_log action='stripe_account_conflict_attempted')
--
-- Affected application code:
--   src/app/api/stripe/connect/route.ts — must catch 23505 and notify admin
--   src/lib/engine/notifications.ts    — notifyAdminStripeConflict() added
--   src/app/api/admin/stripe/duplicates/route.ts — new admin scan endpoint
-- =============================================================================
