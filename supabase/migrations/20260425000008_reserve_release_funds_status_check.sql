-- =============================================================================
-- Migration 20260425000008 — reserve_release_funds: status re-check inside lock
--
-- FINDING (Phase 5 concurrency audit, F-C1)
-- -----------------------------------------
-- reserve_release_funds() acquires a SELECT FOR UPDATE NOWAIT row lock on the
-- deal and then validates available balance. However, it never re-reads
-- deal.status after acquiring the lock.
--
-- The release gate (validateRelease() in release-gate.ts) checks deal.status
-- before calling this RPC, but there is a sub-millisecond race window between
-- that application-layer check and the moment the RPC acquires the row lock:
--
--   T_funder:  validateRelease() → deal.status = 'active' → PASS
--   T_admin:   UPDATE deals SET status = 'frozen' WHERE id = X  ← commits
--   T_funder:  reserve_release_funds() → acquires lock → (no status check)
--              → reserved_amount incremented → Stripe transfer initiated
--
-- Result: a release starts on a frozen deal. The trg_enforce_frozen_deal_status
-- trigger (migration 20260425000003) blocks direct authenticated status changes,
-- but the admin unfreeze/freeze route uses the admin client (service role), which
-- correctly bypasses that trigger. Therefore the race is still possible when an
-- admin freezes a deal at the same instant a funder initiates a release.
--
-- FIX
-- ---
-- After acquiring the FOR UPDATE NOWAIT lock — and therefore after any
-- concurrent freeze/void commit has either (a) committed and is visible to us
-- or (b) is still in flight and we are now serialized ahead of it — re-read
-- deal.status and raise an exception if the deal is not release-eligible.
--
-- Because the lock serializes us with any concurrent deal row UPDATE (including
-- a freeze), reading status inside the lock gives us the definitive post-lock
-- view of the deal's state. If a freeze committed before we locked, we see
-- 'frozen'. If the freeze is still in progress, we hold the lock and the freeze
-- will block until we commit or roll back.
--
-- CHANGES TO THE FUNCTION
-- -----------------------
-- 1. Added DECLARE variable: v_deal_status text
-- 2. The SELECT ... FOR UPDATE NOWAIT now also reads `status` into v_deal_status.
--    No second query needed — status and balance are read atomically in one lock.
-- 3. After the NOT FOUND check, new block:
--      IF v_deal_status IN ('frozen', 'void', 'cancelled') THEN RAISE EXCEPTION
-- 4. All other logic (balance check, UPDATE, RETURN) is byte-identical to the
--    original in 20260423000001_release_concurrency_fix.sql.
--
-- INELIGIBLE STATUSES
-- -------------------
-- 'frozen'    — deal frozen pending admin review; releases blocked until unfreeze
-- 'void'      — contract voided; no further releases permitted
-- 'cancelled' — deal cancelled; included defensively (no current code path creates
--               this status, but the check is forward-compatible)
--
-- Add new ineligible statuses here as the deal state machine grows. The comment
-- on the function lists the definitive set at any given migration version.
--
-- OTHER FUNCTIONS
-- ---------------
-- increment_deal_financials() and cancel_release_reservation() are unchanged.
-- They do not need status checks: increment is called after Stripe confirms
-- (the reservation already passed the status gate), and cancel is called in
-- error paths where we want to free the reservation regardless of status.
-- =============================================================================


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
  v_available   numeric;
  v_required    numeric := p_gross + p_fee;
  v_deal_status text;     -- ← NEW: read inside the lock for status re-check
BEGIN
  -- ── Acquire row lock + read balance and status atomically ─────────────────
  --
  -- SELECT FOR UPDATE NOWAIT serves two purposes:
  --   1. Mutual exclusion: concurrent calls for the same deal serialize here.
  --      A second concurrent call either fails immediately (NOWAIT → 55P03
  --      lock_not_available, caught by the caller as a 409) or sees the
  --      updated reserved_amount from the first call after it commits.
  --   2. Status consistency: reading deal.status inside the lock guarantees
  --      we see the committed state as of lock acquisition. Any concurrent
  --      freeze/void that committed before we locked is visible here; any
  --      that is still in progress will block waiting for us to release.
  --
  -- This is the critical fix for the release-during-freeze race (F-C1):
  -- validateRelease() reads status without a lock; by the time the RPC
  -- acquires the row lock the deal may have been frozen by an admin. Re-reading
  -- status here, under the lock, closes that window.
  SELECT
    (funded_amount - released_amount - fees_collected - reserved_amount),
    status
  INTO
    v_available,
    v_deal_status
  FROM   public.deals
  WHERE  id = p_deal_id
  FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0::numeric, v_required;
    RETURN;
  END IF;

  -- ── Re-check deal status under the row lock ────────────────────────────────
  --
  -- Even though validateRelease() checks status before calling this RPC, there
  -- is a race window between that check and the lock acquisition above. Re-checking
  -- here, inside the lock, eliminates that window entirely.
  --
  -- Ineligible statuses:
  --   'frozen'    — deal frozen pending admin review (admin unfreeze required)
  --   'void'      — contract voided; all releases permanently blocked
  --   'cancelled' — deal cancelled (forward-compatible guard)
  --
  -- A RAISE here causes the caller's transaction to abort, which automatically
  -- releases the lock — no explicit ROLLBACK needed.
  IF v_deal_status IN ('frozen', 'void', 'cancelled') THEN
    RAISE EXCEPTION
      'Deal % cannot accept a release reservation: status is ''%''. '
      'Frozen deals require admin review before releases can proceed. '
      'Voided or cancelled deals cannot be released.',
      p_deal_id, v_deal_status
      USING ERRCODE = 'object_not_in_prerequisite_state';   -- SQLSTATE 55000
  END IF;

  -- ── Balance check ──────────────────────────────────────────────────────────
  IF v_available < v_required THEN
    -- Insufficient balance — either genuinely underfunded, or another in-flight
    -- release has already reserved the remaining capacity.
    RETURN QUERY SELECT false, v_available, v_required;
    RETURN;
  END IF;

  -- ── Atomically reserve funds ───────────────────────────────────────────────
  -- Reserved within this locked transaction. The reservation is visible to any
  -- concurrent call that acquires the lock after we commit.
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
  'After acquiring the lock, re-checks deal.status to reject reservations on '
  'frozen (status=''frozen''), voided (status=''void''), or cancelled deals — '
  'closing the race window between validateRelease() and lock acquisition. '
  'Raises SQLSTATE 55000 (object_not_in_prerequisite_state) if the deal is '
  'not release-eligible. '
  'Must be called BEFORE the Stripe transfer. '
  'On success: call increment_deal_financials() after Stripe succeeds. '
  'On Stripe failure: call cancel_release_reservation() to free the reservation. '
  'Ineligible statuses: frozen, void, cancelled.';


-- =============================================================================
-- End of migration 20260425000008_reserve_release_funds_status_check.sql
-- =============================================================================
