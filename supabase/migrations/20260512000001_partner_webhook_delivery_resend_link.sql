-- =============================================================================
-- Migration 20260512000001 — Resend link for partner_webhook_deliveries
--
-- Adds a nullable self-referential FK resent_from_delivery_id to the
-- partner_webhook_deliveries table (created in 20260512000000).
--
-- When an admin resends a failed webhook via
-- POST /api/admin/partner-webhooks/[deliveryId]/resend, a NEW delivery row
-- is created for the resend attempt. The new row's resent_from_delivery_id
-- points to the original delivery row, creating a traceable chain:
--
--   original row (exhausted) → resend row 1 (success | exhausted) → …
--
-- This lets support trace the full retry history for any delivery.
-- =============================================================================

ALTER TABLE public.partner_webhook_deliveries
  ADD COLUMN IF NOT EXISTS resent_from_delivery_id uuid
    REFERENCES public.partner_webhook_deliveries(id)
    ON DELETE SET NULL;

COMMENT ON COLUMN public.partner_webhook_deliveries.resent_from_delivery_id IS
  'If this delivery row was created by an admin resend, this column points to '
  'the original delivery row that was being retried. NULL for first-attempt rows.';

-- Index for forward and backward chain traversal
CREATE INDEX IF NOT EXISTS partner_webhook_deliveries_resend_chain_idx
  ON public.partner_webhook_deliveries (resent_from_delivery_id)
  WHERE resent_from_delivery_id IS NOT NULL;
