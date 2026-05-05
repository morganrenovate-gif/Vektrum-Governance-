-- =============================================================================
-- 20260504000001_authorization_tokens.sql
--
-- Stage B1 of the patent-readiness work (memo candidate #1: rail-agnostic
-- signed authorization token).
--
-- Introduces an append-only authorization_tokens table that the milestone
-- release route writes into BETWEEN funded-balance reservation and rail
-- dispatch. The token row is the durable on-platform artifact that says
-- "release X has been authorized; here are its rail scope, payee scope,
-- amount vector, policy version, expiry, and idempotency key — and here
-- is the hash that binds this artifact into the audit chain."
--
-- This migration ONLY introduces the table + immutability rules. Stage B1
-- writes the issuer helper and wires it into the route in code; Stages B2/B3
-- introduce the rail adapter pattern and the external_rail authorize-only
-- path. The token row's `status` field is the state machine that those
-- later stages drive.
--
-- HARD GUARANTEES
-- ---------------
-- - Append-only at the DB layer for everything except the status column and
--   confirmation/failure/expiry metadata. Mirrors the audit_log pattern
--   (20260424000004_audit_log_immutability.sql).
-- - Partial unique index enforces "at most one active token per milestone"
--   so a second authorization cannot be issued while the first is still
--   issued/delivered.
-- - jti (JWT id) is globally unique. idempotency_key is unique. (milestone_id,
--   sequence_index) is unique so per-milestone retries always increment.
-- - status enum is enforced via CHECK; rail_scope is a single text value
--   restricted to known rails (tightened later when the rail adapter ships).
--
-- NOT IN SCOPE FOR THIS MIGRATION
-- -------------------------------
-- - graph_commitment is nullable until evidence-graph (Tier D) ships.
-- - public partner-facing verifier endpoints (/v1/tokens/verify etc.) are
--   Tier B step 2; this migration produces tokens that those endpoints will
--   later validate.
-- - draw_requests is a separate aggregate in the patent memo (Tier C). Until
--   that table exists, draw_request_id on this table maps to deals.id —
--   documented on the column comment so the temporary mapping is explicit.
-- =============================================================================


-- =============================================================================
-- PART 0 — pgcrypto availability
-- =============================================================================
-- Same defensive re-assertion the Tier A migration uses.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


-- =============================================================================
-- PART 1 — TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.authorization_tokens (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity / canonical fields ----------------------------------------------
  jti                  TEXT        NOT NULL,
  idempotency_key      TEXT        NOT NULL,
  sequence_index       BIGINT      NOT NULL,

  -- Subject of the authorization --------------------------------------------
  -- Until the draw_requests table ships in Tier C, draw_request_id maps to
  -- deals.id. Document this on the column.
  draw_request_id      UUID        NOT NULL,
  milestone_id         UUID        NOT NULL REFERENCES public.milestones(id) ON DELETE RESTRICT,
  payee_id             UUID        NOT NULL,
  funder_id            UUID        NOT NULL,

  -- Scope -------------------------------------------------------------------
  -- rail_scope is currently a single value; once Stage B2 lands the adapter
  -- pattern this could grow to a TEXT[] of allowed rails per token.
  rail_scope           TEXT        NOT NULL CHECK (rail_scope IN ('stripe', 'external_rail')),
  payee_scope          UUID        NOT NULL,

  -- Amount vector -----------------------------------------------------------
  -- Stored as JSONB so Tier C's per-SOV-line release can populate this with
  -- multiple {sov_line_item_id, amount} entries without a schema change.
  -- Stage B1 always writes a single-entry vector: [{milestone_id, amount}].
  amount_vector        JSONB       NOT NULL,
  total_amount         NUMERIC(15, 2) NOT NULL CHECK (total_amount > 0),
  currency             TEXT        NOT NULL DEFAULT 'USD',

  -- Policy / evidence binding -----------------------------------------------
  policy_version       TEXT        NOT NULL,
  policy_hash          TEXT        NOT NULL,
  -- Nullable until Tier D's evidence graph ships.
  graph_commitment     TEXT,

  -- Token integrity ---------------------------------------------------------
  -- token_hash = sha256OfCanonicalJson(canonical_payload). The same value is
  -- bound into the success-path funds_released audit row via the Tier A
  -- audit_log.token_hash column.
  token_hash           TEXT        NOT NULL,
  nonce                TEXT        NOT NULL,
  -- Signature material: filled when the issuer signs (currently we record
  -- the algorithm + signature even if the verifier endpoint isn't yet public,
  -- so the on-disk artifact is already complete for patent claim alignment).
  signature_alg        TEXT        NOT NULL DEFAULT 'ed25519',
  signature            TEXT,

  -- Time bounds -------------------------------------------------------------
  not_before           TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at           TIMESTAMPTZ NOT NULL,

  -- State machine -----------------------------------------------------------
  status               TEXT        NOT NULL DEFAULT 'issued'
                                   CHECK (status IN ('issued', 'delivered', 'confirmed', 'failed', 'expired', 'revoked')),

  -- Optional confirmation / failure metadata (filled by rail adapter / confirm routes)
  confirmed_at         TIMESTAMPTZ,
  failed_at            TIMESTAMPTZ,
  failure_reason       TEXT,
  revoked_at           TIMESTAMPTZ,
  revoked_reason       TEXT,
  expired_at           TIMESTAMPTZ,

  -- Audit ------------------------------------------------------------------
  issued_by            UUID        NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Sanity checks ----------------------------------------------------------
  CONSTRAINT authorization_tokens_ttl_window
    CHECK (not_before <= expires_at AND expires_at > created_at),
  CONSTRAINT authorization_tokens_jti_unique
    UNIQUE (jti),
  CONSTRAINT authorization_tokens_idempotency_unique
    UNIQUE (idempotency_key),
  CONSTRAINT authorization_tokens_milestone_sequence_unique
    UNIQUE (milestone_id, sequence_index)
);

COMMENT ON TABLE public.authorization_tokens IS
  'Append-only ledger of rail-scoped release authorization tokens. Each row '
  'is the durable on-platform artifact for one release decision. Status '
  'transitions (issued → delivered → confirmed | failed | expired | revoked) '
  'are made via UPDATE on the status column only; all other columns are '
  'immutable per the BEFORE UPDATE trigger below. Patent memo candidate #1.';

COMMENT ON COLUMN public.authorization_tokens.draw_request_id IS
  'TEMPORARY MAPPING: equals deals.id until the draw_requests table ships in '
  'Tier C. The patent memo data model has draw_requests as a distinct aggregate; '
  'until that lands, this column holds the parent deal id so per-deal queries '
  'and joins keep working. Tier C will introduce a one-time backfill that '
  're-points this column to the new draw_requests.id.';

COMMENT ON COLUMN public.authorization_tokens.amount_vector IS
  'JSONB array of {milestone_id, sov_line_item_id?, amount} entries. Stage B1 '
  'always writes a single-entry vector [{milestone_id, amount}]; Tier C will '
  'expand this to per-SOV-line authorization vectors.';

COMMENT ON COLUMN public.authorization_tokens.graph_commitment IS
  'SHA-256 hex digest of the canonical evidence-graph snapshot that governed '
  'this authorization. NULL until Tier D evidence-graph ontology ships.';

COMMENT ON COLUMN public.authorization_tokens.token_hash IS
  'SHA-256 hex digest of the canonical-form token payload. Bound into the '
  'audit chain on the success-path release event via audit_log.token_hash '
  '(Tier A migration 20260504000000).';

COMMENT ON COLUMN public.authorization_tokens.status IS
  'State machine: issued (just written) → delivered (handed to rail adapter) → '
  'confirmed (rail returned execution proof) | failed (dispatch error) | '
  'expired (TTL passed before confirmation) | revoked (admin pre-emption). '
  'All non-terminal → terminal transitions are enforced by application code; '
  'the BEFORE UPDATE trigger blocks any non-status / non-metadata column edits.';


-- =============================================================================
-- PART 2 — INDEXES
-- =============================================================================

-- One *active* token per milestone — prevents a second authorization while a
-- prior one is still pending. Funders retrying a previously-failed authorization
-- can issue a new token because the partial filter excludes terminal states.
CREATE UNIQUE INDEX IF NOT EXISTS authorization_tokens_active_per_milestone
  ON public.authorization_tokens (milestone_id)
  WHERE status IN ('issued', 'delivered');

-- Lookups
CREATE INDEX IF NOT EXISTS authorization_tokens_draw_request_idx
  ON public.authorization_tokens (draw_request_id, sequence_index);
CREATE INDEX IF NOT EXISTS authorization_tokens_payee_idx
  ON public.authorization_tokens (payee_id);
CREATE INDEX IF NOT EXISTS authorization_tokens_funder_idx
  ON public.authorization_tokens (funder_id);
CREATE INDEX IF NOT EXISTS authorization_tokens_status_expires_idx
  ON public.authorization_tokens (status, expires_at)
  WHERE status IN ('issued', 'delivered');
CREATE INDEX IF NOT EXISTS authorization_tokens_token_hash_idx
  ON public.authorization_tokens (token_hash);


-- =============================================================================
-- PART 3 — IMMUTABILITY TRIGGER (BEFORE UPDATE)
-- =============================================================================
-- Mirrors the audit_log immutability pattern: only the status column and
-- explicitly-mutable confirmation/failure/expiry metadata may change after
-- INSERT. Everything else (jti, payload fields, hashes, signature) is frozen.

CREATE OR REPLACE FUNCTION public.deny_authorization_token_immutable_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- Allow updated_at to advance freely — trigger sets it below.
  -- Allow status + the lifecycle-metadata columns to be set.
  -- Everything else must match OLD.
  IF NEW.id                  IS DISTINCT FROM OLD.id                 THEN RAISE EXCEPTION 'authorization_tokens.id is immutable'              USING ERRCODE = 'restrict_violation'; END IF;
  IF NEW.jti                 IS DISTINCT FROM OLD.jti                THEN RAISE EXCEPTION 'authorization_tokens.jti is immutable'             USING ERRCODE = 'restrict_violation'; END IF;
  IF NEW.idempotency_key     IS DISTINCT FROM OLD.idempotency_key    THEN RAISE EXCEPTION 'authorization_tokens.idempotency_key is immutable' USING ERRCODE = 'restrict_violation'; END IF;
  IF NEW.sequence_index      IS DISTINCT FROM OLD.sequence_index     THEN RAISE EXCEPTION 'authorization_tokens.sequence_index is immutable'  USING ERRCODE = 'restrict_violation'; END IF;
  IF NEW.draw_request_id     IS DISTINCT FROM OLD.draw_request_id    THEN RAISE EXCEPTION 'authorization_tokens.draw_request_id is immutable' USING ERRCODE = 'restrict_violation'; END IF;
  IF NEW.milestone_id        IS DISTINCT FROM OLD.milestone_id       THEN RAISE EXCEPTION 'authorization_tokens.milestone_id is immutable'    USING ERRCODE = 'restrict_violation'; END IF;
  IF NEW.payee_id            IS DISTINCT FROM OLD.payee_id           THEN RAISE EXCEPTION 'authorization_tokens.payee_id is immutable'        USING ERRCODE = 'restrict_violation'; END IF;
  IF NEW.funder_id           IS DISTINCT FROM OLD.funder_id          THEN RAISE EXCEPTION 'authorization_tokens.funder_id is immutable'       USING ERRCODE = 'restrict_violation'; END IF;
  IF NEW.rail_scope          IS DISTINCT FROM OLD.rail_scope         THEN RAISE EXCEPTION 'authorization_tokens.rail_scope is immutable'      USING ERRCODE = 'restrict_violation'; END IF;
  IF NEW.payee_scope         IS DISTINCT FROM OLD.payee_scope        THEN RAISE EXCEPTION 'authorization_tokens.payee_scope is immutable'     USING ERRCODE = 'restrict_violation'; END IF;
  IF NEW.amount_vector       IS DISTINCT FROM OLD.amount_vector      THEN RAISE EXCEPTION 'authorization_tokens.amount_vector is immutable'   USING ERRCODE = 'restrict_violation'; END IF;
  IF NEW.total_amount        IS DISTINCT FROM OLD.total_amount       THEN RAISE EXCEPTION 'authorization_tokens.total_amount is immutable'    USING ERRCODE = 'restrict_violation'; END IF;
  IF NEW.currency            IS DISTINCT FROM OLD.currency           THEN RAISE EXCEPTION 'authorization_tokens.currency is immutable'        USING ERRCODE = 'restrict_violation'; END IF;
  IF NEW.policy_version      IS DISTINCT FROM OLD.policy_version     THEN RAISE EXCEPTION 'authorization_tokens.policy_version is immutable'  USING ERRCODE = 'restrict_violation'; END IF;
  IF NEW.policy_hash         IS DISTINCT FROM OLD.policy_hash        THEN RAISE EXCEPTION 'authorization_tokens.policy_hash is immutable'     USING ERRCODE = 'restrict_violation'; END IF;
  IF NEW.graph_commitment    IS DISTINCT FROM OLD.graph_commitment   THEN RAISE EXCEPTION 'authorization_tokens.graph_commitment is immutable' USING ERRCODE = 'restrict_violation'; END IF;
  IF NEW.token_hash          IS DISTINCT FROM OLD.token_hash         THEN RAISE EXCEPTION 'authorization_tokens.token_hash is immutable'      USING ERRCODE = 'restrict_violation'; END IF;
  IF NEW.nonce               IS DISTINCT FROM OLD.nonce              THEN RAISE EXCEPTION 'authorization_tokens.nonce is immutable'           USING ERRCODE = 'restrict_violation'; END IF;
  IF NEW.signature_alg       IS DISTINCT FROM OLD.signature_alg      THEN RAISE EXCEPTION 'authorization_tokens.signature_alg is immutable'   USING ERRCODE = 'restrict_violation'; END IF;
  IF NEW.signature           IS DISTINCT FROM OLD.signature          THEN RAISE EXCEPTION 'authorization_tokens.signature is immutable'       USING ERRCODE = 'restrict_violation'; END IF;
  IF NEW.not_before          IS DISTINCT FROM OLD.not_before         THEN RAISE EXCEPTION 'authorization_tokens.not_before is immutable'      USING ERRCODE = 'restrict_violation'; END IF;
  IF NEW.expires_at          IS DISTINCT FROM OLD.expires_at         THEN RAISE EXCEPTION 'authorization_tokens.expires_at is immutable'      USING ERRCODE = 'restrict_violation'; END IF;
  IF NEW.issued_by           IS DISTINCT FROM OLD.issued_by          THEN RAISE EXCEPTION 'authorization_tokens.issued_by is immutable'       USING ERRCODE = 'restrict_violation'; END IF;
  IF NEW.created_at          IS DISTINCT FROM OLD.created_at         THEN RAISE EXCEPTION 'authorization_tokens.created_at is immutable'      USING ERRCODE = 'restrict_violation'; END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.deny_authorization_token_immutable_writes() IS
  'BEFORE UPDATE trigger on authorization_tokens. Permits changes only to '
  'status + lifecycle metadata (confirmed_at, failed_at, failure_reason, '
  'revoked_at, revoked_reason, expired_at, updated_at). Everything else is '
  'rejected with restrict_violation (SQLSTATE 23001). Same pattern as '
  'audit_log immutability (20260424000004).';

DROP TRIGGER IF EXISTS authorization_tokens_immutable ON public.authorization_tokens;
CREATE TRIGGER authorization_tokens_immutable
  BEFORE UPDATE ON public.authorization_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.deny_authorization_token_immutable_writes();


-- =============================================================================
-- PART 4 — DELETE PROTECTION
-- =============================================================================
-- Tokens are evidence; never deletable.

CREATE OR REPLACE FUNCTION public.deny_authorization_token_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION
    'authorization_tokens rows are permanent evidence and cannot be deleted. '
    'Attempted delete of token id=%, jti=%.', OLD.id, OLD.jti
    USING ERRCODE = 'restrict_violation';
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS authorization_tokens_no_delete ON public.authorization_tokens;
CREATE TRIGGER authorization_tokens_no_delete
  BEFORE DELETE ON public.authorization_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.deny_authorization_token_delete();


-- =============================================================================
-- PART 5 — RLS
-- =============================================================================
-- Read access is funder-scoped (only the funder of a token's deal can read it)
-- via a join through deals. Writes go through the admin client only — no role
-- can INSERT directly.

ALTER TABLE public.authorization_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS authorization_tokens_select_funder ON public.authorization_tokens;
CREATE POLICY authorization_tokens_select_funder
  ON public.authorization_tokens
  FOR SELECT
  TO authenticated
  USING (
    funder_id = auth.uid()
    OR payee_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

-- No INSERT / UPDATE / DELETE policies for authenticated — the issuer uses the
-- admin client (auth.uid() IS NULL) which bypasses RLS.


-- =============================================================================
-- PART 6 — LINK TO releases
-- =============================================================================
-- Adds an optional FK from releases to authorization_tokens. UNIQUE so a
-- single token cannot settle two releases. NULLable to keep migration safe
-- against existing rows; new releases (post-Stage B1.3) populate it.

ALTER TABLE public.releases
  ADD COLUMN IF NOT EXISTS authorization_token_id UUID
    REFERENCES public.authorization_tokens(id) ON DELETE RESTRICT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'releases_authorization_token_unique'
      AND conrelid = 'public.releases'::regclass
  ) THEN
    ALTER TABLE public.releases
      ADD CONSTRAINT releases_authorization_token_unique
      UNIQUE (authorization_token_id);
  END IF;
END;
$$;

COMMENT ON COLUMN public.releases.authorization_token_id IS
  'Foreign key to authorization_tokens.id. UNIQUE — at most one release row '
  'per authorization token (memo claim 4: token cannot settle twice). NULL '
  'on releases written before Stage B1.3 ships.';


-- =============================================================================
-- SUMMARY
-- =============================================================================
--
-- Tables added:
--   authorization_tokens          — append-only with immutability + delete-deny triggers
--
-- Columns added to existing tables:
--   releases.authorization_token_id  UUID  UNIQUE  REFERENCES authorization_tokens(id)
--
-- Constraints / indexes:
--   authorization_tokens — PK (id), UNIQUE jti, UNIQUE idempotency_key,
--                          UNIQUE (milestone_id, sequence_index),
--                          partial UNIQUE (milestone_id) WHERE status IN ('issued','delivered'),
--                          CHECK ttl window, CHECK rail_scope, CHECK status enum,
--                          lookups on draw_request, payee, funder, status+expires_at, token_hash
--
-- Triggers:
--   authorization_tokens_immutable  — BEFORE UPDATE blocks edits to all but
--                                     status + lifecycle metadata + updated_at
--   authorization_tokens_no_delete  — BEFORE DELETE always raises
--
-- RLS:
--   authorization_tokens_select_funder — funder/payee/admin can SELECT;
--                                        no client-side INSERT/UPDATE/DELETE
-- =============================================================================
