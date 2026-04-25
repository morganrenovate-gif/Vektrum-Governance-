-- =============================================================================
-- Migration 20260425000009 — Stripe webhook: dedup lifecycle +
--                             transactional transfer confirmation
--
-- FINDINGS (Phase 5 concurrency / reliability audit)
-- ---------------------------------------------------
-- A. Dedup lifecycle bug (F-W1)
--    stripe_processed_events inserts a row with result='ok' BEFORE processing.
--    On handler error the row is updated to result='error' and 500 is returned —
--    Stripe will retry. But the retry finds the existing row (SQLSTATE 23505) and
--    returns 200 immediately, silently skipping the retry. Failed events can
--    never be retried via Stripe's automatic mechanism.
--
-- B. Non-atomic transfer confirmation (F-W2)
--    handleTransferSucceeded() updates releases.transfer_status, then (separately)
--    billing_records.transfer_status. If the billing update fails after the release
--    update commits, the billing record stays 'pending' permanently while the
--    release is 'confirmed'. The handler treats billing failure as non-fatal and
--    returns 200, so Stripe does not retry. This creates a silent fee-tracking
--    discrepancy.
--
-- FIXES
-- -----
-- Part 1 — Dedup lifecycle:
--   Add processing_status column to stripe_processed_events:
--     'processing' — row inserted, handler running
--     'processed'  — handler completed successfully
--     'failed'     — handler threw; Stripe is retrying
--   Webhook handler logic changes (see route.ts):
--     INSERT with processing_status='processing'.
--     On 23505: inspect processing_status of existing row.
--       'processed'  → 200 (already done)
--       'processing' → 200 (concurrent delivery in-flight)
--       'failed'     → atomic UPDATE WHERE processing_status='failed' RETURNING;
--                      if claimed → re-run handler; if not → 200 (concurrent retry)
--     On success: UPDATE processing_status='processed', processed_at=now()
--     On error:   UPDATE processing_status='failed', error_message=<msg>, return 500
--
-- Part 2 — Transactional transfer confirmation RPC:
--   confirm_stripe_transfer(p_stripe_transfer_id) wraps the release and
--   billing_records status updates in a single ACID transaction using SELECT
--   FOR UPDATE NOWAIT on the release row. Both updates commit or neither does.
--   The webhook handler calls this RPC instead of two separate writes.
--
-- OTHER NOTES
-- -----------
-- increment_deal_financials() is NOT called here. The release route calls it
-- synchronously before returning (converts reserved_amount → released_amount +
-- fees_collected). Calling it again in the webhook would double-increment the
-- deal ledger. The webhook only confirms already-settled status fields.
-- =============================================================================


-- =============================================================================
-- Part 1 — Dedup lifecycle columns
-- =============================================================================

-- ─── 1a. Add processing_status column ────────────────────────────────────────
--
-- DEFAULT 'processed' so that every existing row is immediately classified as
-- successfully processed (they were all inserted with result='ok', meaning the
-- old handler had no error). We backfill 'error' rows below, then change the
-- default to 'processing' for future inserts.

ALTER TABLE public.stripe_processed_events
  ADD COLUMN IF NOT EXISTS processing_status text NOT NULL DEFAULT 'processed';

-- ─── 1b. Backfill: result='error' rows → processing_status='failed' ──────────
--
-- These are events where the handler threw. Under the old schema they could not
-- be retried. Under the new schema they can be claimed by the next Stripe retry.

UPDATE public.stripe_processed_events
SET    processing_status = 'failed'
WHERE  result = 'error'
  AND  processing_status = 'processed';  -- only update rows we just defaulted

-- ─── 1c. Add check constraint ─────────────────────────────────────────────────

ALTER TABLE public.stripe_processed_events
  ADD CONSTRAINT stripe_processed_events_processing_status_check
  CHECK (processing_status IN ('processing', 'processed', 'failed'));

-- ─── 1d. Change column default for future inserts ─────────────────────────────
--
-- New rows start as 'processing' and are updated to 'processed' or 'failed'
-- when the handler completes.

ALTER TABLE public.stripe_processed_events
  ALTER COLUMN processing_status SET DEFAULT 'processing';

-- ─── 1e. Add error_message column ────────────────────────────────────────────

ALTER TABLE public.stripe_processed_events
  ADD COLUMN IF NOT EXISTS error_message text;

-- ─── 1f. Make processed_at nullable ──────────────────────────────────────────
--
-- Old schema: NOT NULL DEFAULT now() — set at INSERT time (= row creation time).
-- New schema: NULL at INSERT time; set to now() when processing_status→'processed'.
-- Existing rows keep their insert-time value (a reasonable approximation for
-- historical rows).

ALTER TABLE public.stripe_processed_events
  ALTER COLUMN processed_at DROP NOT NULL;

-- ─── 1g. Add partial index for retry queries ─────────────────────────────────
--
-- The retry path SELECTs by stripe_event_id (already covered by the unique index)
-- and then conditionally UPDATEs WHERE processing_status='failed'. This partial
-- index makes the conditional UPDATE fast on tables with many 'processed' rows.

CREATE INDEX IF NOT EXISTS stripe_processed_events_failed_idx
  ON public.stripe_processed_events (stripe_event_id)
  WHERE processing_status = 'failed';

-- ─── 1h. Update comments ──────────────────────────────────────────────────────

COMMENT ON TABLE public.stripe_processed_events IS
  'Atomic idempotency log for Stripe webhook events with processing lifecycle. '
  'The webhook handler inserts a row with processing_status=''processing'' BEFORE '
  'handling the event. A unique constraint on stripe_event_id serializes concurrent '
  'deliveries. On success: update to ''processed''. On failure: update to ''failed'' '
  'and return 500 so Stripe retries. On retry: the handler inspects processing_status '
  'and atomically claims ''failed'' rows for re-processing.';

COMMENT ON COLUMN public.stripe_processed_events.processing_status IS
  'Lifecycle state: '
  '''processing'' = handler running; '
  '''processed''  = completed successfully (idempotency gate: return 200); '
  '''failed''     = handler threw; Stripe retrying (retry path: claim and re-run).';

COMMENT ON COLUMN public.stripe_processed_events.error_message IS
  'Handler error message when processing_status=''failed''. NULL for processed events.';

COMMENT ON COLUMN public.stripe_processed_events.processed_at IS
  'Timestamp when processing_status transitioned to ''processed''. '
  'NULL for ''processing''/''failed'' rows. '
  'Historical rows (migrated from result=''ok'') retain their original insert time.';


-- =============================================================================
-- Part 2 — confirm_stripe_transfer() RPC
-- =============================================================================
--
-- Wraps the two status updates from handleTransferSucceeded() in a single
-- ACID transaction. Uses SELECT FOR UPDATE NOWAIT on the release row to
-- serialize concurrent deliveries of the same transfer.succeeded event.
--
-- Caller (webhook handler) is responsible for:
--   • Metadata validation (vektrum_action, milestone_id, deal_id)
--   • Pre-checking release state for detailed idempotency logging
--   • Calling confirmTransactionReceipt() after this RPC succeeds
--   • Audit logging
--
-- Return values:
--   already_confirmed  boolean  — true if transfer was already 'confirmed' when
--                                  the lock was acquired (idempotent no-op)
--   release_id         uuid     — ID of the locked release row
--   billing_updated    boolean  — true if billing_records row was updated
--
-- Exceptions raised (caller must handle):
--   SQLSTATE P0002 (no_data_found)               — release row not yet visible;
--                                                   Stripe should retry (throw → 500)
--   SQLSTATE 55P03 (lock_not_available)           — concurrent confirmation in
--                                                   progress; Stripe should retry
--   SQLSTATE 55000 (object_not_in_prerequisite_state)
--                                                 — release is in 'failed'/'reversed'
--                                                   state; failure wins; caller should
--                                                   return 200 (no retry)

DROP FUNCTION IF EXISTS public.confirm_stripe_transfer(text);

CREATE FUNCTION public.confirm_stripe_transfer(
  p_stripe_transfer_id text
)
RETURNS TABLE(already_confirmed boolean, release_id uuid, billing_updated boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_release_id      uuid;
  v_transfer_status text;
  v_billing_rows    integer;
BEGIN
  -- ── Acquire exclusive row lock on the release ──────────────────────────────
  --
  -- FOR UPDATE NOWAIT: if another webhook delivery is concurrently confirming
  -- the same transfer, we return SQLSTATE 55P03 immediately. The caller throws
  -- so Stripe retries — it will find the release already confirmed.
  --
  -- Reading transfer_status inside the lock gives us the definitive post-lock
  -- view. Any concurrent failure event that committed before we locked will be
  -- visible here; one still in flight will block waiting for us to release.
  SELECT id, transfer_status
  INTO   v_release_id, v_transfer_status
  FROM   public.releases
  WHERE  stripe_transfer_id = p_stripe_transfer_id
  FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    -- Release row not yet committed — the release route is still in flight.
    -- Raising causes the handler to return 500; Stripe will retry.
    RAISE EXCEPTION
      'No release found for Stripe transfer id ''%''. '
      'The release route may not have committed yet — Stripe will retry.',
      p_stripe_transfer_id
      USING ERRCODE = 'no_data_found';   -- SQLSTATE P0002
  END IF;

  -- ── Idempotency: already confirmed ────────────────────────────────────────
  --
  -- A previous delivery already confirmed this transfer. Return the sentinel
  -- so the caller can log and return 200 without re-applying side-effects.
  IF v_transfer_status = 'confirmed' THEN
    RETURN QUERY SELECT true, v_release_id, false;
    RETURN;
  END IF;

  -- ── Failure state takes precedence ────────────────────────────────────────
  --
  -- A transfer.failed or transfer.reversed event arrived and committed before
  -- this transfer.succeeded. Out-of-order delivery — failure wins.
  -- Raising SQLSTATE 55000 signals the caller to return 200 (not 500): Stripe
  -- should not retry a late success after a confirmed failure.
  IF v_transfer_status IN ('failed', 'reversed') THEN
    RAISE EXCEPTION
      'Release % is already in ''%'' state. '
      'A late-arriving transfer.succeeded event cannot overwrite a failure — '
      'failure state takes precedence. Caller should return 200 without retry.',
      v_release_id, v_transfer_status
      USING ERRCODE = 'object_not_in_prerequisite_state';   -- SQLSTATE 55000
  END IF;

  -- ── Atomically confirm release and billing record ─────────────────────────
  --
  -- Both UPDATEs execute inside the same transaction (implicitly, since this is
  -- a PL/pgSQL function called inside the caller's transaction). If either
  -- UPDATE fails, the entire transaction rolls back, leaving the release in
  -- 'pending' so Stripe can retry.
  --
  -- The WHERE transfer_status = 'pending' guard on the releases UPDATE is a
  -- second safety net against a concurrent failure event that managed to commit
  -- between our FOR UPDATE lock acquisition and this point (which cannot happen
  -- because the lock serializes us, but is included as a defensive belt-and-
  -- suspenders guard).

  UPDATE public.releases
  SET    transfer_status = 'confirmed'
  WHERE  id             = v_release_id
    AND  transfer_status = 'pending';

  UPDATE public.billing_records
  SET    transfer_status = 'confirmed'
  WHERE  release_id      = v_release_id
    AND  transfer_status = 'pending';

  GET DIAGNOSTICS v_billing_rows = ROW_COUNT;

  RETURN QUERY SELECT false, v_release_id, (v_billing_rows > 0);
END;
$$;

COMMENT ON FUNCTION public.confirm_stripe_transfer(text) IS
  'Atomically confirms a Stripe transfer by updating releases.transfer_status '
  'and billing_records.transfer_status from ''pending'' to ''confirmed'' in a '
  'single transaction. Uses SELECT FOR UPDATE NOWAIT on the release row to '
  'serialize concurrent transfer.succeeded deliveries. '
  'Returns already_confirmed=true if the transfer was already confirmed (idempotent). '
  'Raises SQLSTATE P0002 if the release does not exist yet (caller returns 500; '
  'Stripe retries). Raises SQLSTATE 55000 if the release is already failed/reversed '
  '(failure state wins; caller returns 200 without retry). '
  'Raises SQLSTATE 55P03 on lock conflict (concurrent confirmation; caller returns '
  '500 so Stripe retries after the first delivery commits). '
  'NOTE: Does NOT call increment_deal_financials(). That function is called by the '
  'release route before it returns — calling it again here would double-increment.';


-- =============================================================================
-- End of migration 20260425000009_webhook_transfer_settlement.sql
-- =============================================================================
