-- Migration: 20260520000001_authorization_tokens_reserved_amounts.sql
--
-- B3 hardening (issue #133): persist the original reserved gross and fee amounts
-- on the authorization_tokens row at issuance time so that expire-if-stale
-- (and any future reject path) can cancel exactly the reserved amount without
-- recomputing from deal.billing_rate_bps at expiry time.
--
-- Today billing_rate_bps is immutable post-funding, so the recomputation would
-- produce the same value — but that is an assumption baked in, not an enforced
-- invariant. If billing_rate_bps were ever changed (rate renegotiation, admin
-- correction, future feature), the cancellation math would silently diverge
-- from the original reservation, corrupting deals.reserved_amount.
--
-- Fix: store the amounts locked at authorization-time on the token itself.
-- expire-if-stale reads token.reserved_gross_amount / reserved_fee_amount and
-- passes those to cancel_release_reservation instead of recomputing.
--
-- Safe defaults for existing rows: 0 (no active pre-hardening external-rail
-- tokens should exist in production at time of migration). Nullable alternative
-- would signal "unknown" on old rows, but NOT NULL + DEFAULT 0 is simpler and
-- any existing rows should be terminal (confirmed/failed/expired) by rollout.

ALTER TABLE public.authorization_tokens
  ADD COLUMN IF NOT EXISTS reserved_gross_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reserved_fee_amount   NUMERIC(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.authorization_tokens.reserved_gross_amount IS
  'Gross amount (milestone.amount) reserved at authorization time. '
  'Used by expire-if-stale and reject paths to cancel exactly the right '
  'reservation without recomputing from deal.billing_rate_bps.';

COMMENT ON COLUMN public.authorization_tokens.reserved_fee_amount IS
  'Platform fee amount reserved at authorization time (max(50, gross × billing_rate_bps/10000)). '
  'Used by expire-if-stale and reject paths to cancel exactly the right '
  'reservation without recomputing from deal.billing_rate_bps.';
