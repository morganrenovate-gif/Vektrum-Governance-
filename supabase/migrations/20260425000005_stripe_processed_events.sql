-- =============================================================================
-- 20260425000005_stripe_processed_events.sql
-- Atomic idempotency table for Stripe webhook events.
--
-- PROBLEM
-- -------
-- The webhook handler performs application-level status checks (e.g.,
-- transfer_status === 'confirmed') to detect already-processed events.
-- Two concurrent deliveries of the same Stripe event ID can both pass the
-- status check before either write completes, potentially double-applying
-- effects (double billing record insert, double ledger increment, etc.).
--
-- SOLUTION
-- --------
-- A dedicated stripe_processed_events table with a UNIQUE constraint on
-- stripe_event_id. The webhook handler inserts a row BEFORE processing.
-- If the INSERT fails with a unique violation (23505), the handler returns
-- 200 immediately without processing — the event was already handled.
-- This makes idempotency atomic at the DB layer.
--
-- TTL: processed events older than 30 days are eligible for cleanup.
-- A partial index on (processed_at) enables efficient cleanup queries.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.stripe_processed_events (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id  TEXT        NOT NULL,
  event_type       TEXT        NOT NULL,
  processed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  processing_ms    INTEGER,       -- wall-clock time to process the event, for monitoring
  result           TEXT           -- 'ok' | 'skipped' | 'error'
);

-- The critical uniqueness guarantee: one row per Stripe event ID.
CREATE UNIQUE INDEX IF NOT EXISTS stripe_processed_events_event_id_unique
  ON public.stripe_processed_events (stripe_event_id);

-- Cleanup index: find events older than 30 days efficiently.
CREATE INDEX IF NOT EXISTS stripe_processed_events_processed_at_idx
  ON public.stripe_processed_events (processed_at)
  WHERE processed_at < now() - INTERVAL '30 days';

COMMENT ON TABLE public.stripe_processed_events IS
  'Atomic idempotency log for Stripe webhook events. The webhook handler inserts '
  'a row with the stripe_event_id BEFORE processing. A unique constraint on '
  'stripe_event_id means a second concurrent delivery of the same event receives '
  'a unique violation and is short-circuited without processing.';

COMMENT ON COLUMN public.stripe_processed_events.stripe_event_id IS
  'Stripe event.id — globally unique per event. Used as the idempotency key.';

COMMENT ON COLUMN public.stripe_processed_events.processing_ms IS
  'Milliseconds to process this event. NULL if the event was skipped (already processed).';

COMMENT ON COLUMN public.stripe_processed_events.result IS
  'ok = processed successfully; skipped = duplicate; error = handler failed.';

-- RLS: this table is written exclusively by the webhook handler (service_role).
-- No user-facing read access is needed.
ALTER TABLE public.stripe_processed_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY stripe_processed_events_service_only
  ON public.stripe_processed_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
