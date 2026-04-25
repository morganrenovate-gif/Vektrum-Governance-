-- =============================================================================
-- Migration 20260425000001 — Partners (institutional payment-rail partners)
--
-- Adds the `partners` table for institutional execution-rail partners such as
-- construction loan servicers, title companies, and escrow agents. Partners:
--
--   - Receive Vektrum authorization signals via signed outbound webhooks when
--     the 10-condition gate passes on an external-rail deal associated with them.
--   - Confirm execution back to Vektrum by calling POST /api/partner/releases/
--     [id]/confirm, authenticated with a per-partner API key.
--   - Mark failures via POST /api/partner/releases/[id]/fail.
--
-- Also adds `partner_id` FK to `deals` so each external-rail deal can be
-- associated with the partner responsible for executing its disbursements.
--
-- Key design decisions:
--   api_key_hash          : SHA-256 of the partner API key. Plaintext shown once
--                           at creation and never stored. Lookup happens by hash.
--   api_key_prefix        : First 12 chars of the key for UI identification.
--   webhook_signing_secret: Stored plaintext — Vektrum signs outbound webhook
--                           payloads with this; partner verifies using the same
--                           value. Treat as a credential.
--
-- RLS: partners table is service-role-only. No authenticated user read.
-- =============================================================================

-- ─── 1. Partners table ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.partners (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                      text        NOT NULL,
  webhook_url               text,
  webhook_signing_secret    text,
  api_key_hash              text        NOT NULL UNIQUE,
  api_key_prefix            text        NOT NULL,
  is_active                 boolean     NOT NULL DEFAULT true,
  notes                     text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- ─── 2. Add partner_id FK to deals ───────────────────────────────────────────

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS partner_id uuid
    REFERENCES public.partners(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS deals_partner_id_idx
  ON public.deals (partner_id)
  WHERE partner_id IS NOT NULL;

-- ─── 3. RLS — service role only ──────────────────────────────────────────────

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- No authenticated-user access. All reads/writes go through the admin client
-- (service role) which bypasses RLS.
CREATE POLICY "partners_service_role_only"
  ON public.partners
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── 4. updated_at trigger ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_partners_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS partners_set_updated_at ON public.partners;
CREATE TRIGGER partners_set_updated_at
  BEFORE UPDATE ON public.partners
  FOR EACH ROW EXECUTE FUNCTION public.set_partners_updated_at();

-- ─── 5. Column comments ───────────────────────────────────────────────────────

COMMENT ON TABLE public.partners IS
  'Institutional execution-rail partners (construction loan servicers, title companies, escrow agents) that receive Vektrum authorization signals and execute payments on their own licensed rails.';

COMMENT ON COLUMN public.partners.webhook_url IS
  'URL to POST signed authorization signals when the release gate passes on an associated deal. NULL = partner has no webhook; they must poll or use the ops dashboard.';

COMMENT ON COLUMN public.partners.webhook_signing_secret IS
  'Secret Vektrum uses to HMAC-SHA256-sign outbound webhook payloads (format: whsec_<hex>). Partners use this same value to verify received webhooks. Stored plaintext — treat as a credential.';

COMMENT ON COLUMN public.partners.api_key_hash IS
  'SHA-256 hex digest of the partner API key. Plaintext key is shown once at creation and never stored. Used to authenticate inbound partner callbacks to /api/partner/*.';

COMMENT ON COLUMN public.partners.api_key_prefix IS
  'First 12 characters of the full API key (e.g. "vkp_A1B2C3D4") for identification in the ops dashboard without exposing the key.';

COMMENT ON COLUMN public.partners.is_active IS
  'When false, all API key lookups for this partner return 401. Deactivate rather than delete to preserve audit trail associations.';

COMMENT ON COLUMN public.deals.partner_id IS
  'FK to partners — the licensed institutional partner executing disbursements on external-rail deals. NULL for Stripe-rail deals.';

-- =============================================================================
-- End of migration 20260425000001_partners.sql
-- =============================================================================
