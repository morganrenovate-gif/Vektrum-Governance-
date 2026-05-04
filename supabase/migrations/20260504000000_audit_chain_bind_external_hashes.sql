-- =============================================================================
-- 20260504000000_audit_chain_bind_external_hashes.sql
--
-- Tier A of the patent-readiness work (memo candidate #4): bind the existing
-- hash-chained audit ledger to external evidence sources so each audit row
-- cryptographically commits to the artifacts produced outside the database.
--
-- BACKGROUND
-- ----------
-- 20260424000004_audit_log_immutability.sql gave audit_log a SHA-256 row_hash
-- + chain_hash via a BEFORE INSERT trigger. The chain proves no row has been
-- altered or retroactively inserted.
--
-- The patent claim (#4 in the technical-moat memo) requires the chain to also
-- bind external artifacts that govern release authorization:
--
--   * graph_snapshot_hash    — the canonical evidence-graph commitment that
--                              governed the release decision (memo candidate
--                              #2 produces this; today the column is plumbing)
--   * token_hash             — the rail-scoped authorization token issued for
--                              the event (memo candidate #1 produces this)
--   * webhook_delivery_hash  — hash of the outbound webhook payload sent to a
--                              partner / rail (DocuSign, Stripe, partner API)
--   * partner_ack_hash       — hash of the partner acknowledgement received
--                              for that webhook
--   * rail_confirmation_hash — hash of the final settlement confirmation from
--                              the executing rail (Stripe transfer, external
--                              partner confirm)
--
-- Without this binding, the chain proves "what was logged has not changed"
-- but does NOT prove "the artifact handed to the rail matched the evidence
-- graph at authorization time, and the rail's confirmation matches what was
-- handed to it." That end-to-end binding is the patent-novel piece.
--
-- WHAT THIS MIGRATION DOES
-- ------------------------
-- 1. Adds 5 nullable hash columns + 1 hash_schema_version discriminator.
-- 2. Replaces compute_audit_hash() with a v2 formula that includes the 5 new
--    fields. Stamps every NEW row with hash_schema_version = 2.
-- 3. Replaces verify_audit_chain() with a dispatcher that re-computes v1 or v2
--    based on the row's stored hash_schema_version. Pre-migration rows
--    (version IS NULL) are still verified under the original v1 formula —
--    no existing audit row's row_hash_valid flag changes.
-- 4. chain_hash logic is unchanged (still SHA-256(row_hash || prev_chain_hash))
--    so the chain continues seamlessly across the v1 → v2 schema boundary.
--
-- BACKWARD COMPATIBILITY
-- ----------------------
-- Pre-migration rows: row_hash, chain_hash already present, hash_schema_version
-- IS NULL. verify_audit_chain() treats version IS NULL as v1 and re-computes
-- using the original 8-field formula → existing valid rows stay valid.
--
-- New rows post-migration: hash_schema_version = 2 (set by trigger).
-- row_hash is computed from 8 original fields PLUS the 5 new bound hashes.
-- Rows where the 5 new hashes are all NULL still get a valid v2 hash — they
-- just happen to use 'NULL' tokens for those fields, identical to how
-- old_values / new_values / metadata are already handled when null.
-- =============================================================================


-- =============================================================================
-- PART 1 — ADD COLUMNS
-- =============================================================================

ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS graph_snapshot_hash    TEXT,
  ADD COLUMN IF NOT EXISTS token_hash             TEXT,
  ADD COLUMN IF NOT EXISTS webhook_delivery_hash  TEXT,
  ADD COLUMN IF NOT EXISTS partner_ack_hash       TEXT,
  ADD COLUMN IF NOT EXISTS rail_confirmation_hash TEXT,
  ADD COLUMN IF NOT EXISTS hash_schema_version    SMALLINT;

COMMENT ON COLUMN public.audit_log.graph_snapshot_hash IS
  'SHA-256 hex digest of the canonical evidence-graph snapshot that governed the '
  'release decision recorded in this row. NULL until memo candidate #2 (evidence '
  'graph ontology) is implemented and produces snapshots. Bound into row_hash '
  'when present so any later contradiction between graph state and authorization '
  'is detectable.';

COMMENT ON COLUMN public.audit_log.token_hash IS
  'SHA-256 hex digest of the rail-scoped authorization token issued for this '
  'event (memo candidate #1). NULL until token issuance ships. Bound into '
  'row_hash so the audit row cryptographically commits to the exact token '
  'handed to the rail.';

COMMENT ON COLUMN public.audit_log.webhook_delivery_hash IS
  'SHA-256 hex digest of the canonical webhook payload delivered to a partner '
  'or rail for this event (DocuSign, partner API, Stripe). Populated by the '
  'webhook dispatcher at delivery time. Proves the chain commits to the exact '
  'bytes sent off-platform.';

COMMENT ON COLUMN public.audit_log.partner_ack_hash IS
  'SHA-256 hex digest of the canonical acknowledgement payload received from a '
  'partner for the webhook tied to this event. Populated by the inbound ack '
  'handler. Together with webhook_delivery_hash, proves an end-to-end binding '
  'of outbound and inbound partner messages.';

COMMENT ON COLUMN public.audit_log.rail_confirmation_hash IS
  'SHA-256 hex digest of the canonical rail-level confirmation payload (Stripe '
  'transfer object, external rail confirmation receipt) for this event. Proves '
  'the chain commits to the rail-side execution proof.';

COMMENT ON COLUMN public.audit_log.hash_schema_version IS
  'Hash schema version stamped at INSERT time by compute_audit_hash(). '
  'NULL = pre-migration v1 (8 fields). 2 = v2 (8 v1 fields + 5 bound external '
  'hashes). The verify_audit_chain() function dispatches on this value so '
  'pre-migration rows stay valid under v1 and new rows are verified under v2.';


-- =============================================================================
-- PART 2 — V2 HASH COMPUTATION TRIGGER FUNCTION (BEFORE INSERT)
-- =============================================================================
-- Replaces compute_audit_hash(). Stamps hash_schema_version = 2 on every new
-- row and includes the 5 bound external hashes in row_hash. chain_hash logic
-- unchanged — the chain continues seamlessly across the schema boundary.

CREATE OR REPLACE FUNCTION public.compute_audit_hash()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_input          TEXT;
  v_prev_chain     TEXT;
BEGIN
  -- ── v2 row_hash input ───────────────────────────────────────────────────────
  -- Same 8 base fields as v1, then 5 external-hash bindings appended.
  -- NULL values use the literal 'NULL' marker to prevent collisions between
  -- adjacent nullable fields, identical to how v1 handles old_values/etc.
  v_input :=
       COALESCE(NEW.entity_type,                  '')
    || '|' || COALESCE(NEW.entity_id::text,       '')
    || '|' || COALESCE(NEW.action,                '')
    || '|' || COALESCE(NEW.actor_id::text,        'NULL')
    || '|' || COALESCE(NEW.created_at::text,      '')
    || '|' || COALESCE(NEW.old_values::text,      'NULL')
    || '|' || COALESCE(NEW.new_values::text,      'NULL')
    || '|' || COALESCE(NEW.metadata::text,        'NULL')
    -- v2 additions — 5 bound external-evidence hashes
    || '|' || COALESCE(NEW.graph_snapshot_hash,    'NULL')
    || '|' || COALESCE(NEW.token_hash,             'NULL')
    || '|' || COALESCE(NEW.webhook_delivery_hash,  'NULL')
    || '|' || COALESCE(NEW.partner_ack_hash,       'NULL')
    || '|' || COALESCE(NEW.rail_confirmation_hash, 'NULL');

  NEW.hash_schema_version := 2;
  NEW.row_hash := encode(digest(v_input, 'sha256'), 'hex');

  -- ── chain_hash unchanged ────────────────────────────────────────────────────
  -- SHA-256(row_hash || previous chain_hash). Anchors to '' for the genesis row.
  -- Concurrency note from v1 still applies — parallel inserts may form parallel
  -- branches at the same sequence point.
  SELECT chain_hash
  INTO   v_prev_chain
  FROM   public.audit_log
  WHERE  chain_hash IS NOT NULL
  ORDER  BY event_sequence DESC
  LIMIT  1;

  NEW.chain_hash := encode(
    digest(NEW.row_hash || COALESCE(v_prev_chain, ''), 'sha256'),
    'hex'
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.compute_audit_hash() IS
  'BEFORE INSERT trigger function (v2). Computes row_hash from 8 base fields + '
  '5 external-evidence bindings (graph_snapshot_hash, token_hash, '
  'webhook_delivery_hash, partner_ack_hash, rail_confirmation_hash) and stamps '
  'hash_schema_version = 2. chain_hash logic unchanged from v1 so the chain '
  'continues seamlessly across the schema boundary. Never called directly — '
  'invoked by trg_audit_log_hash.';

-- Trigger binding is unchanged (already on BEFORE INSERT); the CREATE OR REPLACE
-- above swaps the function body in place, so trg_audit_log_hash now invokes v2.


-- =============================================================================
-- PART 3 — VERSION-AWARE CHAIN VERIFICATION
-- =============================================================================
-- Replaces verify_audit_chain(). Dispatches on hash_schema_version:
--   NULL or 1  → re-compute under v1 formula (8 fields)
--   2          → re-compute under v2 formula (8 fields + 5 bound hashes)
--
-- This means existing pre-migration rows that verified true under v1 continue
-- to verify true after this migration (no false-positive failures).

CREATE OR REPLACE FUNCTION public.verify_audit_chain(
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id   TEXT DEFAULT NULL
)
RETURNS TABLE (
  audit_id              UUID,
  event_seq             BIGINT,
  row_hash_valid        BOOLEAN,
  chain_hash_valid      BOOLEAN,
  stored_row_hash       TEXT,
  computed_row_hash     TEXT,
  stored_chain_hash     TEXT,
  expected_chain_hash   TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  r                   RECORD;
  v_input             TEXT;
  v_computed_row_hash TEXT;
  v_prev_chain_hash   TEXT := NULL;  -- starts as genesis anchor (empty string)
  v_expected_chain    TEXT;
  v_version           SMALLINT;
BEGIN
  FOR r IN
    SELECT
      al.id,
      al.event_sequence,
      al.entity_type,
      al.entity_id,
      al.action,
      al.actor_id,
      al.created_at,
      al.old_values,
      al.new_values,
      al.metadata,
      al.row_hash,
      al.chain_hash,
      al.hash_schema_version,
      al.graph_snapshot_hash,
      al.token_hash,
      al.webhook_delivery_hash,
      al.partner_ack_hash,
      al.rail_confirmation_hash
    FROM public.audit_log al
    WHERE al.row_hash IS NOT NULL
      AND (p_entity_type IS NULL OR al.entity_type = p_entity_type)
      AND (p_entity_id   IS NULL OR al.entity_id::text = p_entity_id)
    ORDER BY al.event_sequence ASC
  LOOP
    -- Default to v1 for pre-migration rows (version IS NULL).
    v_version := COALESCE(r.hash_schema_version, 1);

    IF v_version = 2 THEN
      v_input :=
           COALESCE(r.entity_type,                  '')
        || '|' || COALESCE(r.entity_id::text,       '')
        || '|' || COALESCE(r.action,                '')
        || '|' || COALESCE(r.actor_id::text,        'NULL')
        || '|' || COALESCE(r.created_at::text,      '')
        || '|' || COALESCE(r.old_values::text,      'NULL')
        || '|' || COALESCE(r.new_values::text,      'NULL')
        || '|' || COALESCE(r.metadata::text,        'NULL')
        || '|' || COALESCE(r.graph_snapshot_hash,    'NULL')
        || '|' || COALESCE(r.token_hash,             'NULL')
        || '|' || COALESCE(r.webhook_delivery_hash,  'NULL')
        || '|' || COALESCE(r.partner_ack_hash,       'NULL')
        || '|' || COALESCE(r.rail_confirmation_hash, 'NULL');
    ELSE
      -- v1 formula — exactly the original 8-field input.
      v_input :=
           COALESCE(r.entity_type,            '')
        || '|' || COALESCE(r.entity_id::text, '')
        || '|' || COALESCE(r.action,          '')
        || '|' || COALESCE(r.actor_id::text,  'NULL')
        || '|' || COALESCE(r.created_at::text,'')
        || '|' || COALESCE(r.old_values::text,'NULL')
        || '|' || COALESCE(r.new_values::text,'NULL')
        || '|' || COALESCE(r.metadata::text,  'NULL');
    END IF;

    v_computed_row_hash := encode(digest(v_input, 'sha256'), 'hex');

    -- chain_hash check — unchanged from v1: SHA-256(computed_row_hash || prev_stored_chain).
    -- Uses STORED previous chain_hash so each row is independently assessable.
    v_expected_chain := encode(
      digest(v_computed_row_hash || COALESCE(v_prev_chain_hash, ''), 'sha256'),
      'hex'
    );

    audit_id            := r.id;
    event_seq           := r.event_sequence;
    row_hash_valid      := (r.row_hash   = v_computed_row_hash);
    chain_hash_valid    := (r.chain_hash = v_expected_chain);
    stored_row_hash     := r.row_hash;
    computed_row_hash   := v_computed_row_hash;
    stored_chain_hash   := r.chain_hash;
    expected_chain_hash := v_expected_chain;

    v_prev_chain_hash := r.chain_hash;

    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.verify_audit_chain(TEXT, TEXT) IS
  'Re-computes row_hash and chain_hash for all hashed audit_log rows. '
  'Dispatches on hash_schema_version (NULL/1 → v1 8-field formula; 2 → v2 '
  '13-field formula including the 5 bound external-evidence hashes). '
  'chain_hash anchor is the STORED previous chain_hash so each row is '
  'independently assessable — one broken row does not cascade.';


-- =============================================================================
-- PART 4 — INDEXES ON NEW BINDING COLUMNS
-- =============================================================================
-- Partial indexes — only index rows where the binding hash is populated.

CREATE INDEX IF NOT EXISTS audit_log_graph_snapshot_hash_idx
  ON public.audit_log (graph_snapshot_hash)
  WHERE graph_snapshot_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS audit_log_token_hash_idx
  ON public.audit_log (token_hash)
  WHERE token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS audit_log_webhook_delivery_hash_idx
  ON public.audit_log (webhook_delivery_hash)
  WHERE webhook_delivery_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS audit_log_partner_ack_hash_idx
  ON public.audit_log (partner_ack_hash)
  WHERE partner_ack_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS audit_log_rail_confirmation_hash_idx
  ON public.audit_log (rail_confirmation_hash)
  WHERE rail_confirmation_hash IS NOT NULL;


-- =============================================================================
-- SUMMARY
-- =============================================================================
--
-- Columns added to audit_log:
--   graph_snapshot_hash    TEXT
--   token_hash             TEXT
--   webhook_delivery_hash  TEXT
--   partner_ack_hash       TEXT
--   rail_confirmation_hash TEXT
--   hash_schema_version    SMALLINT  (2 for new rows; NULL for pre-migration)
--
-- Functions replaced:
--   compute_audit_hash()  — v2 formula (8 base + 5 bound hashes)
--   verify_audit_chain()  — version-aware dispatcher (v1 or v2 per row)
--
-- Indexes added:
--   audit_log_graph_snapshot_hash_idx     (partial)
--   audit_log_token_hash_idx              (partial)
--   audit_log_webhook_delivery_hash_idx   (partial)
--   audit_log_partner_ack_hash_idx        (partial)
--   audit_log_rail_confirmation_hash_idx  (partial)
--
-- Triggers unchanged:
--   trg_audit_log_hash    — still BEFORE INSERT, now invokes v2 compute_audit_hash()
--   audit_log_immutable   — still BEFORE UPDATE OR DELETE
--
-- Existing rows: row_hash and chain_hash unchanged. hash_schema_version remains
-- NULL → verify_audit_chain() treats them as v1 → they still verify true.
-- =============================================================================
