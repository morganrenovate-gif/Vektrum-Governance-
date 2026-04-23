-- ─── Migration 20260424000001: Funding Confirmation ──────────────────────────
--
-- PURPOSE
-- -------
-- Shifts the funded_amount increment from the PaymentIntent creation call
-- to the payment_intent.succeeded webhook handler. This eliminates the
-- phantom-balance bug where funded_amount reflected committed-but-unconfirmed
-- Stripe payments that could still fail.
--
-- DATA INTEGRITY GUARANTEE
-- ------------------------
-- After this migration:
--   - funded_amount ONLY increases via the payment_intent.succeeded webhook
--   - funds_pending_amount tracks in-flight Stripe amounts not yet bank-confirmed
--   - funds_captured = true once any payment_intent.succeeded has been processed
--
-- INVARIANT (enforced by application layer, not DB CHECK):
--   funded_amount <= SUM(amount) of succeeded PaymentIntents for this deal
--
-- BACKWARD COMPATIBILITY
-- ----------------------
-- Existing deals that were funded under the old model (funded_amount incremented
-- at PI creation) will have funds_captured = false and funds_pending_amount = 0,
-- which correctly represents their ambiguous legacy state. The reconcile cron
-- will flag those deals for manual review if the amounts don't match Stripe.

-- ── 1. funds_pending_amount ───────────────────────────────────────────────────
-- Tracks the dollar value of Stripe PaymentIntents that have been created but
-- not yet confirmed by the funder's bank. Incremented by POST /fund, decremented
-- by payment_intent.succeeded or payment_intent.payment_failed webhook.
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS funds_pending_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN deals.funds_pending_amount IS
  'Sum of Stripe PaymentIntent amounts created but not yet bank-confirmed. '
  'Incremented at PI creation; decremented on payment_intent.succeeded or '
  'payment_intent.payment_failed. Must never be negative.';

-- ── 2. funds_captured ────────────────────────────────────────────────────────
-- Flipped to true by the payment_intent.succeeded webhook handler the first
-- time a confirmed payment is received. Used by the reconcile cron to identify
-- deals that should have Stripe confirmation records.
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS funds_captured BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN deals.funds_captured IS
  'True once payment_intent.succeeded has been processed at least once for this deal. '
  'funded_amount is only incremented by the webhook handler, never the fund API route.';

-- ── 3. Non-negative guards ────────────────────────────────────────────────────
ALTER TABLE deals
  ADD CONSTRAINT deals_funds_pending_non_negative
    CHECK (funds_pending_amount >= 0);

-- ── 4. Index on stripe_payment_intent_id ─────────────────────────────────────
-- Required for O(1) webhook lookup by payment intent ID.
-- The column already exists (added in an earlier migration); this adds the index.
CREATE INDEX IF NOT EXISTS deals_stripe_payment_intent_id_idx
  ON deals (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;
