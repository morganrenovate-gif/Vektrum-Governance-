-- =============================================================================
-- Migration 20260425000003 — RLS bypass hardening
--
-- Addresses three confirmed findings from the Phase 3/4 security audit:
--
--   F-3  profiles_update_own WITH CHECK only blocked role escalation. Authenticated
--        users could self-write stripe_payouts_enabled, onboarding_complete,
--        stripe_account_id, and subscription_tier — fields that gatekeep payment
--        eligibility checks in the release gate.
--
--   F-4  milestones_update_funder had no WITH CHECK. Funders could directly set
--        protection_status = 'ready_for_release' via the Supabase REST API,
--        bypassing the dispute/approval workflow and release gate Condition 2
--        (which requires protection_status = 'ready_for_release' as evidence the
--        milestone cleared all holds before a transfer is initiated).
--
--   F-5  deals_update_funder had no constraint on the status column. Funders
--        could clear deal.status = 'frozen' without going through the admin
--        unfreeze endpoint (POST /api/admin/deals/[id]/unfreeze), which requires
--        AAL2 MFA, written justification, and dual audit logging.
--
-- Design:
--   - All three fixes are BEFORE UPDATE triggers. No columns are dropped and no
--     existing CHECK constraints are changed.
--   - Triggers test auth.uid() IS NULL to detect service-role connections
--     (Supabase admin client). Service-role callers bypass the triggers — this
--     is the intended path for trusted server flows:
--       stripe_payouts_enabled  ← Stripe webhook (admin client)
--       stripe_account_id       ← Stripe Connect flow (admin client)
--       onboarding_complete     ← /api/onboarding (admin client, post this migration)
--       subscription_tier       ← /api/admin/subscriptions/tier (admin client)
--       protection_status       ← dispute resolve, retry reset (admin client)
--       deal.status unfreeze    ← /api/admin/deals/[id]/unfreeze (admin client)
--   - Application code co-changes:
--       /api/onboarding/route.ts     — switched from createClient() to
--                                      createSupabaseAdminClient() for the
--                                      onboarding_complete profile write.
--       milestones/release/retry     — milestone UPDATE (protection_status reset)
--                                      switched to adminClient so the trigger's
--                                      service-role path handles it correctly.
-- =============================================================================


-- =============================================================================
-- FIX F-3 — profiles: block direct writes to platform-managed fields
-- =============================================================================

-- Step 1: Replace profiles_update_own.
--
-- The previous WITH CHECK enforced role immutability via a correlated subquery.
-- The new trigger (below) covers role plus all other platform-managed fields, so
-- the policy is simplified to purely enforce row ownership. Defense-in-depth:
-- the trigger remains the enforcement layer; this policy is the row-access gate.

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  USING  (id = auth.uid())
  WITH CHECK (id = auth.uid());

COMMENT ON POLICY "profiles_update_own" ON public.profiles IS
  'Allows a user to UPDATE only their own profile row. '
  'Column-level protection for platform-managed fields '
  '(role, stripe_payouts_enabled, onboarding_complete, stripe_account_id, '
  'subscription_tier) is enforced by trg_enforce_profile_platform_fields.';


-- Step 2: Trigger — block authenticated users from changing platform-managed fields.

CREATE OR REPLACE FUNCTION public.enforce_profile_platform_fields_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
-- ─────────────────────────────────────────────────────────────────────────────
-- Fires BEFORE UPDATE on the five platform-managed columns of public.profiles.
-- Service role (auth.uid() IS NULL — Supabase admin client) is always allowed.
-- Authenticated users are blocked from changing these fields regardless of the
-- client or API surface used (REST, SDK, direct psql).
--
-- Trusted server flows that legitimately write these columns must use the admin
-- client (createSupabaseAdminClient) so that auth.uid() resolves to NULL:
--   • role              — /api/admin/promote (admin client)
--   • stripe_payouts_enabled — Stripe webhook handler (admin client)
--   • onboarding_complete    — /api/onboarding (admin client after migration 003)
--   • stripe_account_id      — /api/stripe/connect (admin client)
--   • subscription_tier      — /api/admin/subscriptions/tier (admin client)
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN
  -- Service role: always permitted.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION
      'Changing role directly is not permitted. Role changes require admin action.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.stripe_payouts_enabled IS DISTINCT FROM OLD.stripe_payouts_enabled THEN
    RAISE EXCEPTION
      'stripe_payouts_enabled is managed by the Stripe webhook and cannot be self-updated.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.onboarding_complete IS DISTINCT FROM OLD.onboarding_complete THEN
    RAISE EXCEPTION
      'onboarding_complete is managed by the platform onboarding flow and cannot be self-updated.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.stripe_account_id IS DISTINCT FROM OLD.stripe_account_id THEN
    RAISE EXCEPTION
      'stripe_account_id is managed by the Stripe Connect flow and cannot be self-updated.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier THEN
    RAISE EXCEPTION
      'subscription_tier is managed by admins and cannot be self-updated.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

-- Scope the trigger to the five protected columns only. Updates that touch
-- only user-editable columns (full_name, company_name, updated_at, …) will
-- not fire this trigger at all.
CREATE TRIGGER trg_enforce_profile_platform_fields
  BEFORE UPDATE OF
    role,
    stripe_payouts_enabled,
    onboarding_complete,
    stripe_account_id,
    subscription_tier
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_platform_fields_immutable();

COMMENT ON FUNCTION public.enforce_profile_platform_fields_immutable() IS
  'Blocks authenticated users from self-updating platform-managed profile fields. '
  'Service role (auth.uid() IS NULL) is permitted — used by Stripe webhook, '
  'Stripe Connect route, onboarding API, and admin tier endpoint.';


-- =============================================================================
-- FIX F-4 — milestones: enforce protection_status transition rules
-- =============================================================================
--
-- Protects release gate Condition 2.
--
-- The release gate checks protection_status = 'ready_for_release' before
-- authorising any fund transfer. Without this trigger, a funder could bypass
-- an active dispute or lien hold by directly writing protection_status =
-- 'ready_for_release' via a raw Supabase REST PATCH, unlocking a transfer on
-- a milestone still under protection.
--
-- Valid transitions per caller role:
--   service_role (auth.uid() IS NULL):   any transition   ← admin client flows
--   admin (session):                      any transition   ← dispute resolve route
--   funder (session):                     → 'released' only
--                                           (set at end of release/authorize-external
--                                           after all gate conditions have passed)
--   contractor (session):                 → 'disputed' only
--                                           (set when contractor files a dispute
--                                           via POST /api/disputes)
--
-- The retry flow (POST /api/milestones/[id]/release/retry) resets protection_status
-- from 'released' back to 'ready_for_release'. That route was updated alongside this
-- migration to use createSupabaseAdminClient() for the milestone UPDATE, so it
-- travels the service-role path and bypasses this trigger correctly.

CREATE OR REPLACE FUNCTION public.enforce_protection_status_transitions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role public.user_role;
BEGIN
  -- Service role (admin client): unrestricted.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- No actual change to protection_status: nothing to validate.
  -- Fires even when the column is mentioned in SET but the value is unchanged
  -- (e.g. retry route setting 'ready_for_release' when it was already that value).
  IF NEW.protection_status IS NOT DISTINCT FROM OLD.protection_status THEN
    RETURN NEW;
  END IF;

  -- Resolve caller role.
  SELECT role INTO v_caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  -- Admins (session): unrestricted — used by dispute resolution, AI review overrides.
  IF v_caller_role = 'admin' THEN
    RETURN NEW;
  END IF;

  -- Funders (session): may only advance protection_status to 'released'.
  -- This transition is performed at the tail of a successful release or external
  -- authorisation, *after* release gate Condition 2 has already been verified by
  -- validateRelease(). Any other transition (e.g. pending → ready_for_release,
  -- disputed → ready_for_release) must go through the dispute-resolution workflow
  -- or the retry endpoint (both of which use the admin client).
  IF v_caller_role = 'funder' THEN
    IF NEW.protection_status = 'released' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION
      'Funders may not directly change protection_status to ''%''. '
      'Protection status transitions are managed by the platform dispute and '
      'approval workflows.',
      NEW.protection_status
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Contractors (session): may only set protection_status to 'disputed'.
  -- This happens when POST /api/disputes creates a dispute record and flags
  -- the milestone to block release until the dispute is resolved.
  IF v_caller_role = 'contractor' THEN
    IF NEW.protection_status = 'disputed' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION
      'Contractors may not directly change protection_status to ''%''. '
      'Only the dispute filing workflow may change protection_status.',
      NEW.protection_status
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Unrecognised role — fail closed.
  RAISE EXCEPTION
    'Unexpected role ''%'' attempting to change milestone protection_status.',
    v_caller_role
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER trg_enforce_protection_status
  BEFORE UPDATE OF protection_status ON public.milestones
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_protection_status_transitions();

COMMENT ON FUNCTION public.enforce_protection_status_transitions() IS
  'Enforces allowed protection_status transitions per caller role. '
  'Guards release gate Condition 2 against direct bypass via the Supabase '
  'REST API or direct database connections. '
  'Service role (auth.uid() IS NULL) is unrestricted — admin client flows '
  'use this path for retry resets and dispute resolution.';


-- =============================================================================
-- FIX F-5 — deals: block authenticated users from clearing frozen / void status
-- =============================================================================
--
-- Prevents funders from directly writing deal.status = 'active' (or any non-frozen
-- value) when the deal is currently frozen, bypassing the admin unfreeze endpoint.
--
-- The admin unfreeze route (/api/admin/deals/[id]/unfreeze) requires:
--   • Admin role
--   • AAL2 MFA session
--   • Written justification (≥ 20 characters)
--   • Dual write to audit_log + admin_audit_log
-- It uses createSupabaseAdminClient() for the deal UPDATE, so auth.uid() IS NULL
-- and this trigger is bypassed on that path.
--
-- 'void' is included for the same reason — reverting a voided deal should require
-- admin review, not a direct PATCH.

CREATE OR REPLACE FUNCTION public.enforce_frozen_deal_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role (admin client, e.g. unfreeze endpoint): unrestricted.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- No actual change to status: nothing to validate.
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Block any authenticated user from clearing the frozen status.
  -- Unfreezing requires the admin-client path with MFA + justification + audit log.
  -- This also protects the release gate check that hard-blocks releases on frozen deals.
  IF OLD.status = 'frozen' AND NEW.status <> 'frozen' THEN
    RAISE EXCEPTION
      'Deal % is frozen and may only be unfrozen by an admin via '
      'POST /api/admin/deals/[id]/unfreeze (requires AAL2 MFA + justification).',
      OLD.id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Block reverting a voided deal without admin intervention.
  IF OLD.status = 'void' AND NEW.status <> 'void' THEN
    RAISE EXCEPTION
      'Deal % has been voided and cannot be reactivated directly. '
      'Contact an admin if reactivation is needed.',
      OLD.id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_frozen_deal_status
  BEFORE UPDATE OF status ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_frozen_deal_status();

COMMENT ON FUNCTION public.enforce_frozen_deal_status() IS
  'Blocks authenticated users from directly clearing deal.status = ''frozen'' '
  'or ''void''. Unfreezing requires the admin-client path at '
  'POST /api/admin/deals/[id]/unfreeze (AAL2 MFA + justification + audit log). '
  'Service role (auth.uid() IS NULL) bypasses this trigger — that is the '
  'intended path for the admin unfreeze endpoint.';


-- =============================================================================
-- End of migration 20260425000003_rls_bypass_fixes.sql
-- =============================================================================
