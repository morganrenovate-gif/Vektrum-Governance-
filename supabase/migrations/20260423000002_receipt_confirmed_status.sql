-- 20260423000002_receipt_confirmed_status.sql
--
-- Adds 'confirmed' as a valid status on transaction_receipts.
--
-- ─── BACKGROUND ───────────────────────────────────────────────────────────────
--
-- The original schema was designed under the assumption that 'pending' is the
-- terminal success state for a receipt, because Stripe was not expected to fire
-- a transfer.succeeded event. The April 2026 audit identified this as a gap:
-- every successful payout remains permanently in 'pending' status, making it
-- impossible to distinguish "transfer in-flight" from "transfer confirmed by Stripe".
--
-- This migration expands the status enum so the new transfer.succeeded webhook
-- handler can explicitly mark receipts (and their corresponding releases) as
-- 'confirmed' when Stripe acknowledges delivery.
--
-- Status progression after this migration:
--   pending   → confirmed   (transfer.succeeded webhook — normal success path)
--   pending   → failed      (transfer.failed webhook)
--   pending   → reversed    (transfer.reversed webhook)
--   confirmed → [terminal]  (no further transitions; confirmed is the settled state)
--
-- Note: the transition confirmed → failed/reversed is intentionally allowed in
-- the application layer to handle rare out-of-order webhook delivery (Stripe may
-- fire transfer.succeeded before a subsequent transfer.reversed in edge cases).
-- The failure webhook handler guards against this with a conditional write.

-- ─── Expand the status CHECK constraint ───────────────────────────────────────
--
-- PostgreSQL names inline CHECK constraints as {table}_{column}_check.
-- Drop the old constraint and replace it with one that includes 'confirmed'.

ALTER TABLE public.transaction_receipts
  DROP CONSTRAINT IF EXISTS transaction_receipts_status_check;

ALTER TABLE public.transaction_receipts
  ADD CONSTRAINT transaction_receipts_status_check
  CHECK (status IN ('pending', 'confirmed', 'failed', 'reversed'));

COMMENT ON COLUMN public.transaction_receipts.status IS
  'pending   — Stripe transfer created; awaiting confirmation.
   confirmed — Stripe fired transfer.succeeded; funds reached the connected account.
   failed    — Stripe fired transfer.failed; payout did not complete.
   reversed  — Stripe fired transfer.reversed; transfer was reversed after creation.';
