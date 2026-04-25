-- =============================================================================
-- 20260425000003_releases_active_unique.sql
-- Enforce at the DB layer that only one active release can exist per milestone.
--
-- PROBLEM
-- -------
-- The duplicate-release guard in release-gate.ts (Condition 10) is an
-- application-level read-then-write check. Two simultaneous requests can both
-- read NULL (no active release) and both proceed to insert. The RPC
-- reserve_release_funds provides partial protection via SELECT FOR UPDATE, but
-- a direct INSERT (e.g., via a future code path or direct SQL) bypasses it.
--
-- SOLUTION
-- --------
-- A partial unique index on (milestone_id) filtered to active transfer_status
-- values makes the constraint atomic at the storage layer. The second
-- concurrent INSERT fails with a unique violation — no application code needed.
--
-- WHICH STATUSES ARE "ACTIVE"?
-- ----------------------------
-- For Stripe-rail releases: 'pending' and 'confirmed' (transfer in flight or
-- complete). 'failed' and 'reversed' are terminal — a new release after failure
-- is a retry and must be allowed.
--
-- For external-rail releases: execution_status tracks 'pending'/'confirmed'.
-- Since the releases table uses transfer_status for Stripe and execution_status
-- for external, the index covers both using the transfer_status column for
-- Stripe and a separate partial index for external_manual:
--
-- Index 1: Stripe rail — transfer_status IN ('pending','confirmed')
-- Index 2: External rail — execution_status IN ('pending','confirmed')
--          WHERE execution_rail = 'external_manual'
--
-- NULL transfer_status (pre-migration rows) are excluded by the WHERE clause.
-- =============================================================================

-- ── Index 1: Stripe-rail active releases ────────────────────────────────────
-- Prevents two Stripe-rail releases for the same milestone from being active
-- simultaneously. 'failed' and 'reversed' are excluded so retry is permitted.

CREATE UNIQUE INDEX IF NOT EXISTS releases_stripe_active_unique
  ON public.releases (milestone_id)
  WHERE transfer_status IN ('pending', 'confirmed')
    AND (execution_rail IS NULL OR execution_rail = 'stripe_connect');

COMMENT ON INDEX public.releases_stripe_active_unique IS
  'Enforces that at most one Stripe-rail release is active (pending or confirmed) '
  'per milestone at any time. Prevents duplicate releases from concurrent requests '
  'even if the application-level gate is bypassed.';


-- ── Index 2: External-rail active releases ───────────────────────────────────
-- Mirrors the Stripe constraint for external_manual releases, using
-- execution_status rather than transfer_status.

CREATE UNIQUE INDEX IF NOT EXISTS releases_external_active_unique
  ON public.releases (milestone_id)
  WHERE execution_status IN ('pending', 'confirmed')
    AND execution_rail = 'external_manual';

COMMENT ON INDEX public.releases_external_active_unique IS
  'Enforces that at most one external-rail release is active (pending or confirmed) '
  'per milestone at any time. Companion to releases_stripe_active_unique for the '
  'external_manual execution rail.';
