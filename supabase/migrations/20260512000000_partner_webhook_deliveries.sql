-- =============================================================================
-- Migration 20260512000000 — Partner webhook delivery logging
--
-- PURPOSE
-- -------
-- Every outbound partner webhook delivery attempt must be durably recorded.
-- This table provides auditability, debugging, partner support, and compliance
-- readiness for webhook delivery operations.
--
-- The sender (src/lib/engine/partner-webhook.ts) inserts a 'pending' row
-- BEFORE the HTTP call, then updates it with the outcome (success / exhausted)
-- after delivery or retry exhaustion. If the process crashes mid-flight the
-- row stays as 'pending' and is observable via admin tooling.
--
-- SECURITY
-- --------
-- - webhook_signing_secret is NEVER stored here (it lives only on partners.webhook_signing_secret).
-- - The X-Vektrum-Signature header value (which contains the HMAC) is not stored.
-- - Only a SHA-256 hash of the request body is stored (request_body_hash).
-- - request_headers_meta is a sanitized JSONB with non-sensitive header metadata only.
-- - response_body_snippet is truncated to 500 characters.
-- - RLS allows admin reads only; all writes go through the service-role admin
--   client which bypasses RLS.
--
-- DELIVERY STATUS STATE MACHINE
-- -----------------------------
--   pending   → success    (HTTP 2xx within attempt budget)
--   pending   → exhausted  (all retry attempts failed)
--   pending   → failed     (non-HTTP error: partner inactive, no URL, etc.)
--
-- The 'failed' status is reserved for non-delivery skips or unexpected errors;
-- 'exhausted' specifically means all HTTP attempts were made without a 2xx.
-- =============================================================================


-- =============================================================================
-- PART 1 — TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.partner_webhook_deliveries (
  -- Identity -----------------------------------------------------------------
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership ----------------------------------------------------------------
  -- RESTRICT prevents deleting a partner while delivery history exists.
  -- Delivery logs are compliance evidence — they outlive their relationship.
  partner_id            uuid        NOT NULL
                                    REFERENCES public.partners(id)
                                    ON DELETE RESTRICT,

  -- Nullable because some event types may not be release-scoped in future.
  release_id            uuid        REFERENCES public.releases(id)
                                    ON DELETE SET NULL,

  -- Event identity -----------------------------------------------------------
  webhook_event_type    text        NOT NULL,   -- e.g. 'release.authorized'
  idempotency_key       text        NOT NULL,   -- from payload.idempotency_key

  -- Request metadata (no secrets) -------------------------------------------
  target_url            text        NOT NULL,   -- partner.webhook_url at delivery time
  request_body_hash     text        NOT NULL,   -- SHA-256 hex of the JSON request body
  -- Sanitized header metadata — X-Vektrum-Signature is excluded intentionally.
  -- Contains: X-Vektrum-Event, X-Vektrum-DeliveryId, signed (bool).
  request_headers_meta  jsonb,
  signed                boolean     NOT NULL DEFAULT false,

  -- Response metadata --------------------------------------------------------
  response_status_code  integer,               -- HTTP status from final attempt (null if no response)
  response_body_snippet text,                  -- first 500 chars of response body

  -- Delivery lifecycle -------------------------------------------------------
  attempt_count         integer     NOT NULL DEFAULT 0,
  delivery_status       text        NOT NULL DEFAULT 'pending',
  error_message         text,                  -- human-readable failure summary

  -- Timestamps ---------------------------------------------------------------
  sent_at               timestamptz NOT NULL DEFAULT now(),   -- when delivery was initiated
  completed_at          timestamptz,                          -- when final outcome was recorded
  created_at            timestamptz NOT NULL DEFAULT now(),

  -- Constraints --------------------------------------------------------------
  CONSTRAINT partner_webhook_deliveries_status_check CHECK (
    delivery_status IN ('pending', 'success', 'failed', 'exhausted')
  ),
  CONSTRAINT partner_webhook_deliveries_attempt_non_negative CHECK (
    attempt_count >= 0
  ),
  CONSTRAINT partner_webhook_deliveries_body_hash_format CHECK (
    request_body_hash ~ '^[0-9a-f]{64}$'   -- SHA-256 hex = 64 hex chars
  )
);

COMMENT ON TABLE public.partner_webhook_deliveries IS
  'Durable log of every outbound partner webhook delivery attempt. '
  'One row per delivery sequence (up to N retries). Inserted as ''pending'' '
  'before the HTTP call; updated with outcome after all retries complete. '
  'No secrets, no raw payloads — only hashes and sanitized metadata.';

COMMENT ON COLUMN public.partner_webhook_deliveries.request_body_hash IS
  'SHA-256 hex digest of the exact JSON bytes sent as the request body. '
  'Allows payload integrity verification without storing the full body.';

COMMENT ON COLUMN public.partner_webhook_deliveries.request_headers_meta IS
  'Sanitized JSONB of non-sensitive headers: X-Vektrum-Event, '
  'X-Vektrum-DeliveryId, signed (bool). '
  'X-Vektrum-Signature is deliberately excluded (it contains the HMAC).';

COMMENT ON COLUMN public.partner_webhook_deliveries.response_body_snippet IS
  'First 500 characters of the partner endpoint response body. '
  'Truncated — never stores full response to limit exposure of partner internals.';

COMMENT ON COLUMN public.partner_webhook_deliveries.delivery_status IS
  'State machine: pending → success (2xx) | exhausted (all retries failed) | '
  'failed (non-HTTP error / skipped). All terminal writes go through '
  'the admin client; no direct authenticated-user writes are permitted.';

COMMENT ON COLUMN public.partner_webhook_deliveries.signed IS
  'True if the delivery was signed with partner.webhook_signing_secret. '
  'False if no signing secret was configured (unsigned delivery).';


-- =============================================================================
-- PART 2 — INDEXES
-- =============================================================================

-- Partner-scoped queries (support dashboard, partner delivery history)
CREATE INDEX IF NOT EXISTS partner_webhook_deliveries_partner_idx
  ON public.partner_webhook_deliveries (partner_id, created_at DESC);

-- Release-scoped lookup (trace all webhooks for a given release)
CREATE INDEX IF NOT EXISTS partner_webhook_deliveries_release_idx
  ON public.partner_webhook_deliveries (release_id)
  WHERE release_id IS NOT NULL;

-- Monitoring: find stuck or failed deliveries quickly
CREATE INDEX IF NOT EXISTS partner_webhook_deliveries_status_idx
  ON public.partner_webhook_deliveries (delivery_status, created_at DESC)
  WHERE delivery_status IN ('pending', 'exhausted', 'failed');

-- Idempotency key lookup (dedup detection, partner support)
CREATE INDEX IF NOT EXISTS partner_webhook_deliveries_idempotency_idx
  ON public.partner_webhook_deliveries (idempotency_key);


-- =============================================================================
-- PART 3 — RLS
-- =============================================================================
-- All writes go through the service-role admin client (auth.uid() IS NULL)
-- which bypasses RLS. No INSERT / UPDATE / DELETE policies are granted to
-- authenticated users.
--
-- Read access:
--   - Admin users can read all delivery rows for support and compliance.
--   - Funders can read delivery rows for their own releases (traceability).
--   - Partners do NOT have direct DB access — they use the partner API.
--   - No anonymous access.

ALTER TABLE public.partner_webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Admins: read all
DROP POLICY IF EXISTS partner_webhook_deliveries_admin_select ON public.partner_webhook_deliveries;
CREATE POLICY partner_webhook_deliveries_admin_select
  ON public.partner_webhook_deliveries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

-- Funders: read deliveries for their own releases
DROP POLICY IF EXISTS partner_webhook_deliveries_funder_select ON public.partner_webhook_deliveries;
CREATE POLICY partner_webhook_deliveries_funder_select
  ON public.partner_webhook_deliveries
  FOR SELECT
  TO authenticated
  USING (
    release_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.releases r
      JOIN public.deals d ON d.id = r.deal_id
      WHERE r.id = partner_webhook_deliveries.release_id
        AND d.funder_id = auth.uid()
    )
  );


-- =============================================================================
-- End of migration 20260512000000_partner_webhook_deliveries.sql
-- =============================================================================
