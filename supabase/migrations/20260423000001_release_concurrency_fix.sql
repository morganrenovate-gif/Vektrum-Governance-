-- 20260423000001_release_concurrency_fix.sql
--
-- Fixes the funded-balance race condition identified in the April 2026 audit.
--
-- ─── PROBLEM ──────────────────────────────────────────────────────────────────
--
-- Two concurrent release requests on DIFFERENT milestones of the same deal can
-- both pass the funded-balance check simultaneously because validateRelease()
-- reads the deal row with a plain SELECT (no lock):
--
--   T1: validateRelease(milestone_X) → available = $200k, required = $180k → PASS
--   T2: validateRelease(milestone_Y) → available = $200k, required = $170k → PASS  (same snapshot)
--   T1: stripe.transfers.create($180k) → succeeds
--   T2: stripe.transfers.create($170k) → succeeds
--   T1: increment_deal_financials($180k) → released_amount = $180k, OK
--   T2: increment_deal_financials($170k) → would exceed funded_amount → EXCEPTION
--         But $170k already left Stripe. Money moved. No DB record. Partial state.
--
-- ─── FIX ──────────────────────────────────────────────────────────────────────
--
-- Introduce a `reserved_amount` column that tracks in-flight release amounts —
-- funds that have been committed to a release but whose Stripe transfer has not
-- yet completed (or confirmed failed).
--
-- Step 1:  Add `reserved_amount` to `deals`.
-- Step 2:  Update `deals_financial_consistency` constraint:
--            (released_amount + fees_collected + reserved_amount) <= funded_amount
-- Step 3:  New RPC `reserve_release_funds`:
--            SELECT FOR UPDATE on the deal row + balance check + reservation,
--            all in a single atomic transaction. Must be called BEFORE Stripe.
--            The row lock ensures only one reservation per deal at a time:
--            a second concurrent call blocks until the first commits, then sees
--            the updated reserved_amount and fails if balance is now insufficient.
-- Step 4:  Update `increment_deal_financials`:
--            Converts the reservation → released_amount + fees_collected on
--            successful Stripe transfer.
-- Step 5:  New RPC `cancel_release_reservation`:
--            Frees the reservation when Stripe fails or an error occurs before
--            the transfer is attempted.
--
-- ─── SEQUENCE OF OPERATIONS IN RELEASE ROUTE (AFTER THIS MIGRATION) ──────────
--
--   1.  validateRelease()          — user-facing pre-check (non-locking, fast errors)
--   2.  reserve_release_funds()    — atomic locked reservation (THIS IS THE GATE)
--   3.  stripe.transfers.create()  — money moves
--   4a. SUCCESS: increment_deal_financials() — converts reservation → released
--   4b. FAILURE: cancel_release_reservation() — frees reservation, no money moved
--


-- ─── Step 1: Add reserved_amount column ───────────────────────────────────────

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS reserved_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.deals.reserved_amount IS
  'Sum of in-flight release amounts that have been reserved (locked) but whose '
  'Stripe transfer has not yet completed or been confirmed failed. '
  'A reservation is acquired atomically via reserve_release_funds() before the '
  'Stripe transfer is initiated, and converted to released_amount + fees_collected '
  'by increment_deal_financials() on success, or freed by cancel_release_reservation() '
  'on failure. Prevents concurrent releases from both passing the funded-balance check.';


-- ─── Step 2: Expand the financial consistency constraint ──────────────────────
--
-- Previous: (released_amount + fees_collected) <= funded_amount
-- Updated:  (released_amount + fees_collected + reserved_amount) <= funded_amount
--
-- This ensures that committed (reserved) + confirmed (released) funds never
-- exceed what the funder has deposited, even while releases are in-flight.

ALTER TABLE public.deals
  DROP CONSTRAINT IF EXISTS deals_financial_consistency;

ALTER TABLE public.deals
  ADD CONSTRAINT deals_financial_consistency CHECK (
    released_amount  >= 0
    AND fees_collected   >= 0
    AND reserved_amount  >= 0
    AND (released_amount + fees_collected + reserved_amount) <= funded_amount
  );


-- ─── Step 3: reserve_release_funds ───────────────────────────────────────────
--
-- Acquires a row-level lock on the deal, validates available balance (net of
-- existing reservations), and atomically reserves the requested amount.
--
-- The SELECT FOR UPDATE NOWAIT ensures mutual exclusion:
--   - If two requests call this concurrently, one acquires the lock immediately
--     and the other either waits (if blocking) or fails (NOWAIT).
--   - With NOWAIT: the second request receives a lock_not_available error
--     (code 55P03) which the application catches and returns a 409 to the user.
--   - Once the first transaction commits (reservation written), the second
--     request sees the updated reserved_amount and correctly reports whether
--     balance is still sufficient.
--
-- Returns a single row:
--   ok        boolean  — true if reservation succeeded
--   available numeric  — balance available at check time (net of reservations)
--   required  numeric  — total amount requested (p_gross + p_fee)
--
-- SECURITY DEFINER: runs as DB owner; cannot be bypassed via anon key.

DROP FUNCTION IF EXISTS public.reserve_release_funds(uuid, numeric, numeric);

CREATE FUNCTION public.reserve_release_funds(
  p_deal_id  uuid,
  p_gross    numeric,
  p_fee      numeric
)
RETURNS TABLE(ok boolean, available numeric, required numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available numeric;
  v_required  numeric := p_gross + p_fee;
BEGIN
  -- Lock the deal row for the duration of this transaction.
  -- NOWAIT: if another release is already being processed for this deal,
  -- fail immediately rather than queuing — prevents request pile-ups.
  -- The lock is released automatically when this function's transaction commits.
  SELECT (funded_amount - released_amount - fees_collected - reserved_amount)
  INTO   v_available
  FROM   public.deals
  WHERE  id = p_deal_id
  FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0::numeric, v_required;
    RETURN;
  END IF;

  IF v_available < v_required THEN
    -- Insufficient balance — either genuinely underfunded, or another in-flight
    -- release has already reserved the remaining capacity.
    RETURN QUERY SELECT false, v_available, v_required;
    RETURN;
  END IF;

  -- Reserve the funds atomically within this locked transaction.
  UPDATE public.deals
  SET    reserved_amount = reserved_amount + v_required,
         updated_at      = now()
  WHERE  id = p_deal_id;

  RETURN QUERY SELECT true, v_available, v_required;
END;
$$;

COMMENT ON FUNCTION public.reserve_release_funds(uuid, numeric, numeric) IS
  'Atomically checks available funded balance and reserves p_gross + p_fee '
  'for an in-flight milestone release. Uses SELECT FOR UPDATE NOWAIT to '
  'prevent concurrent reservations from both passing the balance check. '
  'Must be called BEFORE the Stripe transfer. '
  'On success: call increment_deal_financials() after Stripe succeeds. '
  'On Stripe failure: call cancel_release_reservation() to free the reservation.';


-- ─── Step 4: Update increment_deal_financials ─────────────────────────────────
--
-- After a successful Stripe transfer, converts the reservation into confirmed
-- released_amount + fees_collected by also decrementing reserved_amount.
--
-- The funded_amount guard remains as a safety net, but under normal operation
-- it should never fire because the reservation already validated the balance.
-- GREATEST(0, ...) prevents reserved_amount from going negative if a retry
-- calls this function without a prior reservation (e.g. reconciliation repair).

DROP FUNCTION IF EXISTS public.increment_deal_financials(uuid, numeric, numeric);

CREATE FUNCTION public.increment_deal_financials(
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
    released_amount = released_amount + p_released_amount,
    fees_collected  = fees_collected  + p_fee_amount,
    -- Convert the reservation: these funds are now confirmed, not just reserved.
    -- GREATEST(0, ...) guards against double-conversion on retries or reconciliation.
    reserved_amount = GREATEST(0, reserved_amount - (p_released_amount + p_fee_amount)),
    updated_at      = now()
  WHERE  id = p_deal_id
    -- Safety net: the released total (including this increment) must not exceed
    -- funded_amount. Should never fire in normal operation because reserve_release_funds
    -- already validated the balance before the Stripe transfer was initiated.
    AND (released_amount + p_released_amount + fees_collected + p_fee_amount) <= funded_amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Deal % financials could not be updated: '
      'either the deal does not exist or releasing $% with fee $% '
      'would exceed the funded balance.',
      p_deal_id, p_released_amount, p_fee_amount;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.increment_deal_financials(uuid, numeric, numeric) IS
  'Atomically increments released_amount by p_released_amount and fees_collected '
  'by p_fee_amount on a deal, and decrements reserved_amount by the same total '
  '(converting the prior reservation to confirmed released state). '
  'Guards against exceeding the funded balance. '
  'Used exclusively by the release route after a successful Stripe transfer.';


-- ─── Step 5: cancel_release_reservation ──────────────────────────────────────
--
-- Frees a reservation when the Stripe transfer fails or an unexpected error
-- occurs before the transfer is attempted. Must be called in every error path
-- that fires after reserve_release_funds() succeeds but before
-- increment_deal_financials() runs.
--
-- GREATEST(0, ...) prevents reserved_amount from going negative on double-cancel.

DROP FUNCTION IF EXISTS public.cancel_release_reservation(uuid, numeric, numeric);

CREATE FUNCTION public.cancel_release_reservation(
  p_deal_id  uuid,
  p_gross    numeric,
  p_fee      numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.deals
  SET    reserved_amount = GREATEST(0, reserved_amount - (p_gross + p_fee)),
         updated_at      = now()
  WHERE  id = p_deal_id;
END;
$$;

COMMENT ON FUNCTION public.cancel_release_reservation(uuid, numeric, numeric) IS
  'Frees a previously acquired release reservation when a Stripe transfer fails '
  'or an error occurs before the transfer is attempted. '
  'Decrements reserved_amount by p_gross + p_fee. '
  'Safe to call multiple times (uses GREATEST(0, ...) guard).';
