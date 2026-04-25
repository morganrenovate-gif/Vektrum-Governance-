-- =============================================================================
-- Migration 20260425000011 — Partners: last_used_at + key_environment
--
-- Adds two columns to the partners table:
--
--   last_used_at     timestamptz   — Fire-and-forget timestamp of the most
--                                    recent successful API key authentication.
--                                    NULL = key has never been used.
--                                    Written by requirePartnerAuth() in
--                                    src/lib/auth/partner.ts on each valid
--                                    inbound partner request.
--
--   key_environment  text          — 'test' or 'live'. Reflected in the key
--                                    prefix: vkp_test_... or vkp_live_...
--                                    Test keys should not process real funds.
--                                    Set at creation; cannot be changed
--                                    (rotation generates a new key of the
--                                    same environment by default, overridable
--                                    via the rotate action body).
--
-- These columns support the partner ops dashboard: admins can see which
-- partners are actively calling the API and distinguish test integrations
-- from live ones at a glance.
-- =============================================================================


-- ─── 1. last_used_at ─────────────────────────────────────────────────────────

ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz;

COMMENT ON COLUMN public.partners.last_used_at IS
  'Timestamp of the most recent successful API key authentication via '
  'requirePartnerAuth(). NULL = key has never been used. '
  'Written fire-and-forget — does not block the authentication path. '
  'Precision is sufficient for ops visibility; not intended for billing.';

-- Index supports ops queries like "partners not used in N days"
CREATE INDEX IF NOT EXISTS partners_last_used_at_idx
  ON public.partners (last_used_at DESC NULLS LAST);


-- ─── 2. key_environment ──────────────────────────────────────────────────────

ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS key_environment text NOT NULL DEFAULT 'live';

ALTER TABLE public.partners
  ADD CONSTRAINT partners_key_environment_check
    CHECK (key_environment IN ('test', 'live'));

-- Backfill: all existing keys are live (the only mode before this migration)
UPDATE public.partners SET key_environment = 'live' WHERE key_environment IS NULL;

COMMENT ON COLUMN public.partners.key_environment IS
  'Whether this partner integration is test or live. Reflected in the '
  'API key prefix: vkp_test_... or vkp_live_... '
  'Test keys should not be used to process real funds. '
  'Set at creation time; to change environment, create a new partner or '
  'rotate the key with an explicit environment override.';

-- Index for dashboard filtering
CREATE INDEX IF NOT EXISTS partners_key_environment_idx
  ON public.partners (key_environment)
  WHERE key_environment = 'test';  -- live is the common case; only index test


-- =============================================================================
-- End of migration 20260425000011_partners_enhancements.sql
-- =============================================================================
