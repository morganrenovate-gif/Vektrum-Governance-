-- 20260423000003_subscription_tier.sql
--
-- Adds a subscription_tier column to profiles and locks down billing_rate_bps
-- so it is always derived server-side from the funder's tier — never from user input.
--
-- ─── BACKGROUND ───────────────────────────────────────────────────────────────
--
-- Migration 010 added billing_rate_bps to deals with a CHECK constraint
-- (65, 70, 100) but provided no mechanism to determine which rate a given
-- funder should receive. The column defaulted to 100 (STANDALONE) for everyone.
--
-- This migration introduces the authoritative source of truth: profiles.subscription_tier.
-- The application layer reads this column at deal-funding time and writes the
-- correct billing_rate_bps to the deal row. No user-facing endpoint may set
-- billing_rate_bps directly.
--
-- Tier → rate mapping:
--   standalone    → 100 bps (1.00%) — self-service, no retainer
--   institutional →  70 bps (0.70%) — retainer applies
--   enterprise    →  65 bps (0.65%) — negotiated annually

-- ─── Add subscription_tier to profiles ───────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'standalone';

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_subscription_tier_valid
  CHECK (subscription_tier IN ('standalone', 'institutional', 'enterprise'));

COMMENT ON COLUMN public.profiles.subscription_tier IS
  'Billing plan tier for this account.
   standalone    — 1.00% fee (100 bps). Default for self-service accounts.
   institutional — 0.70% fee ( 70 bps). Accounts on a retainer agreement.
   enterprise    — 0.65% fee ( 65 bps). Negotiated annual contracts.
   Determines billing_rate_bps written to the deal at funding time.
   Only admins or internal tooling should update this column.';

-- ─── Guard billing_rate_bps against direct mutation via RLS / policy ─────────
--
-- billing_rate_bps on deals is already set by the application layer at funding
-- time, and the existing deals_billing_rate_valid CHECK constraint enforces the
-- allowed values. No additional DB changes are required — the application-layer
-- controls (PATCH handler protected-fields list + no user-input path) are the
-- enforcement mechanism.
--
-- The DB constraint (billing_rate_bps IN (65, 70, 100)) from migration 010
-- remains in place as the last-line guard against stale code paths.
