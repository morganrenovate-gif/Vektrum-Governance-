-- =============================================================================
-- 013_transfer_failure.sql
-- Transfer failure handling: schema additions for payout failure tracking,
-- retry support, and financial reversal.
--
-- Changes:
--   1. Add 'payout_failed' to milestone_status enum
--   2. Add transfer_status, failure tracking columns to releases
--   3. Add transfer_status to billing_records
--   4. Add failure tracking columns to milestones
--   5. Drop hard UNIQUE (milestone_id) on releases, replace with partial index
--      that only prevents duplicates where transfer_status = 'confirmed'
--      → allows a new release row to be created after a failure (retry)
--   6. Create reverse_deal_financials(deal_id, released_amount, fee_amount) RPC
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extend milestone_status enum with payout_failed
-- ---------------------------------------------------------------------------
-- PostgreSQL requires ADD VALUE outside a transaction block when using
-- the transactional DDL approach, so we guard with IF NOT EXISTS.
ALTER TYPE public.milestone_status ADD VALUE IF NOT EXISTS 'payout_failed';

COMMENT ON TYPE public.milestone_status IS
  'not_started | in_progress | ready_for_review | approved | released | disputed | payout_failed';

-- ---------------------------------------------------------------------------
-- 2. Add transfer tracking columns to releases
-- ---------------------------------------------------------------------------
-- transfer_status tracks whether the Stripe transfer for this release
-- actually settled. On insert, defaults to 'pending'; the webhook handler
-- sets it to 'confirmed', 'failed', or 'reversed'.
ALTER TABLE public.releases
  ADD COLUMN IF NOT EXISTS transfer_status text NOT NULL DEFAULT 'pending'
    CONSTRAINT releases_transfer_status_check
    CHECK (transfer_status IN ('pending', 'confirmed', 'failed', 'reversed')),

  ADD COLUMN IF NOT EXISTS failure_code    text,
  ADD COLUMN IF NOT EXISTS failure_message text,
  ADD COLUMN IF NOT EXISTS failed_at       timestamptz;

COMMENT ON COLUMN public.releases.transfer_status IS
  'Lifecycle of the Stripe transfer: pending (created) → confirmed (webhook) | failed | reversed.';
COMMENT ON COLUMN public.releases.failure_code IS
  'Stripe failure code from transfer.failed event, e.g. "account_closed".';
COMMENT ON COLUMN public.releases.failure_message IS
  'Human-readable failure message from Stripe.';
COMMENT ON COLUMN public.releases.failed_at IS
  'Timestamp when Stripe reported the transfer as failed or reversed.';

-- ---------------------------------------------------------------------------
-- 3. Add transfer_status to billing_records
-- ---------------------------------------------------------------------------
-- Mirrors releases.transfer_status so billing records can be invalidated
-- when a transfer fails without deleting the immutable row.
ALTER TABLE public.billing_records
  ADD COLUMN IF NOT EXISTS transfer_status text NOT NULL DEFAULT 'pending'
    CONSTRAINT billing_records_transfer_status_check
    CHECK (transfer_status IN ('pending', 'confirmed', 'failed', 'reversed'));

COMMENT ON COLUMN public.billing_records.transfer_status IS
  'Mirrors releases.transfer_status. Failed/reversed records are excluded from fee totals.';

-- ---------------------------------------------------------------------------
-- 4. Add payout failure tracking columns to milestones
-- ---------------------------------------------------------------------------
ALTER TABLE public.milestones
  ADD COLUMN IF NOT EXISTS payout_failure_count   integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_payout_failure_at  timestamptz;

COMMENT ON COLUMN public.milestones.payout_failure_count IS
  'Number of times a payout for this milestone has failed. Incremented by the transfer.failed webhook.';
COMMENT ON COLUMN public.milestones.last_payout_failure_at IS
  'Timestamp of the most recent payout failure for this milestone.';

-- ---------------------------------------------------------------------------
-- 5. Replace hard UNIQUE (milestone_id) with a partial unique index
-- ---------------------------------------------------------------------------
-- The old constraint prevents a second release row being created after a
-- failure. The partial index only blocks duplicates where the transfer
-- actually succeeded, so failed/reversed rows don't block a retry.

ALTER TABLE public.releases
  DROP CONSTRAINT IF EXISTS releases_milestone_unique;

-- Partial unique index: only one 'confirmed' (or 'pending') release per milestone.
-- 'pending' is included so the release route still blocks concurrent requests
-- before Stripe confirms. Failed rows are excluded — they become audit trail.
CREATE UNIQUE INDEX IF NOT EXISTS releases_milestone_active_unique
  ON public.releases (milestone_id)
  WHERE transfer_status IN ('pending', 'confirmed');

COMMENT ON INDEX public.releases_milestone_active_unique IS
  'Ensures at most one active (pending or confirmed) release per milestone. '
  'Failed/reversed rows are excluded so retries can create new release rows.';

-- ---------------------------------------------------------------------------
-- 6. Create reverse_deal_financials RPC
-- ---------------------------------------------------------------------------
-- Called by the transfer.failed webhook handler to roll back the deal's
-- released_amount and fees_collected after a payout fails.
-- The function decrements atomically with a floor of 0 to prevent negative ledger.

CREATE OR REPLACE FUNCTION public.reverse_deal_financials(
  p_deal_id         uuid,
  p_released_amount numeric,
  p_fee_amount      numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.deals
  SET
    released_amount  = GREATEST(0, released_amount  - p_released_amount),
    fees_collected   = GREATEST(0, fees_collected   - p_fee_amount),
    updated_at       = now()
  WHERE id = p_deal_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'reverse_deal_financials: deal % not found', p_deal_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.reverse_deal_financials(uuid, numeric, numeric) IS
  'Atomically decrements released_amount and fees_collected on a deal when a '
  'Stripe transfer fails or is reversed. Uses GREATEST(0, …) to prevent negative '
  'ledger values in case of double-reversals. Called only from trusted server code.';

-- Grant execute only to the service role (used by admin/webhook clients)
REVOKE ALL ON FUNCTION public.reverse_deal_financials(uuid, numeric, numeric) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.reverse_deal_financials(uuid, numeric, numeric) TO service_role;

-- ---------------------------------------------------------------------------
-- 7. increment_payout_failure_count helper RPC
-- ---------------------------------------------------------------------------
-- Simple atomic increment called by the transfer.failed webhook handler.
-- Separate from the main status update so we don't need to read + write
-- payout_failure_count in a single round-trip.

CREATE OR REPLACE FUNCTION public.increment_payout_failure_count(
  p_milestone_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.milestones
  SET
    payout_failure_count  = payout_failure_count + 1,
    last_payout_failure_at = now(),
    updated_at             = now()
  WHERE id = p_milestone_id;
END;
$$;

REVOKE ALL   ON FUNCTION public.increment_payout_failure_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_payout_failure_count(uuid) TO service_role;

COMMENT ON FUNCTION public.increment_payout_failure_count(uuid) IS
  'Atomically increments payout_failure_count and sets last_payout_failure_at on a milestone.';

-- ---------------------------------------------------------------------------
-- 8. Index for fast stripe_transfer_id lookups (used by webhook handler)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS releases_stripe_transfer_id_idx
  ON public.releases (stripe_transfer_id)
  WHERE stripe_transfer_id IS NOT NULL;

COMMENT ON INDEX public.releases_stripe_transfer_id_idx IS
  'Enables the transfer.failed webhook handler to look up a release by '
  'Stripe transfer ID in O(log n) rather than a full table scan.';
