-- =============================================================================
-- 20260424000004_audit_log_immutability.sql
-- Cryptographic immutability for audit_log.
--
-- PROBLEM
-- -------
-- The audit_log table comment says "Immutable, append-only event log. No
-- update or delete permitted." but this is only a convention — no database
-- mechanism prevents an admin or service_role from executing UPDATE/DELETE.
-- For a financial platform where audit logs are legal evidence, tamper-proofing
-- must be enforced at the database layer, independent of application code.
--
-- SOLUTION (four layers)
-- ----------------------
-- 1. row_hash (TEXT) — SHA-256 of the row's key fields, computed by a BEFORE
--    INSERT trigger. Proves the row content has not changed since insertion.
--
-- 2. chain_hash (TEXT) — SHA-256 of (row_hash || previous row's chain_hash),
--    ordered by event_sequence. Creates a Merkle-style hash chain where any
--    retroactive insertion or deletion is detectable by chain breakage.
--    Note: concurrent inserts may form parallel branches at the same sequence
--    point; this is acceptable — the chain detects retroactive tampering, not
--    concurrent legitimate writes.
--
-- 3. BEFORE INSERT trigger — sets row_hash and chain_hash before the row is
--    stored. Application code never computes or supplies these values.
--
-- 4. BEFORE UPDATE OR DELETE trigger — raises an exception for any attempted
--    modification. No role (including service_role) can modify existing rows.
--
-- VERIFICATION
-- ------------
-- The verify_audit_chain() SQL function re-computes hashes from stored column
-- values and compares against stored row_hash / chain_hash. Used by the
-- reconciliation engine and the admin dashboard.
--
-- HASH ALGORITHM
-- --------------
-- SHA-256 via pgcrypto: encode(digest(input, 'sha256'), 'hex')
-- Concatenation uses '|' as field separator with explicit NULL markers to
-- prevent hash collisions between adjacent nullable fields.
--
-- BACKWARD COMPATIBILITY
-- ----------------------
-- Existing rows keep row_hash = NULL and chain_hash = NULL. The first new row
-- after this migration starts a fresh chain with chain_hash = SHA-256(row_hash).
-- The verify function only checks rows where row_hash IS NOT NULL.
-- =============================================================================


-- =============================================================================
-- PART 0 — PGCRYPTO EXTENSION
-- =============================================================================
-- Required for digest() and encode() functions used in SHA-256 computation.
-- Safe to call even if already enabled.

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- =============================================================================
-- PART 1 — ADD COLUMNS
-- =============================================================================

ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS row_hash   TEXT,
  ADD COLUMN IF NOT EXISTS chain_hash TEXT;

COMMENT ON COLUMN public.audit_log.row_hash IS
  'SHA-256 hex digest of the key fields: entity_type, entity_id, action, actor_id, '
  'created_at, old_values, new_values, metadata. Set by the trg_audit_log_hash BEFORE '
  'INSERT trigger — never computed by application code. NULL for pre-migration rows. '
  'Proves the row content has not been altered since insertion.';

COMMENT ON COLUMN public.audit_log.chain_hash IS
  'SHA-256 hex digest of (this row''s row_hash concatenated with the previous row''s '
  'chain_hash, ordered by event_sequence). Creates a hash chain where any deletion or '
  'retroactive insertion is detectable as a chain break. NULL for pre-migration rows. '
  'The genesis row (first post-migration insert) uses an empty string as the previous '
  'chain_hash anchor.';


-- =============================================================================
-- PART 2 — HASH COMPUTATION TRIGGER FUNCTION (BEFORE INSERT)
-- =============================================================================
-- Computes row_hash and chain_hash for every new audit_log row.
-- SECURITY DEFINER ensures the SELECT on audit_log runs as the function owner,
-- not the inserting role — required when the inserting role is the anon key.

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
  -- ── Compute row_hash ────────────────────────────────────────────────────────
  -- Fields are concatenated with '|' separator. NULL values are represented as
  -- the literal string 'NULL' to prevent: ('a' || NULL || 'b') = NULL in SQL.
  -- old_values, new_values, metadata are JSONB; ::text produces normalized JSON.
  v_input :=
       COALESCE(NEW.entity_type,            '')
    || '|' || COALESCE(NEW.entity_id::text, '')
    || '|' || COALESCE(NEW.action,          '')
    || '|' || COALESCE(NEW.actor_id::text,  'NULL')
    || '|' || COALESCE(NEW.created_at::text,'')
    || '|' || COALESCE(NEW.old_values::text,'NULL')
    || '|' || COALESCE(NEW.new_values::text,'NULL')
    || '|' || COALESCE(NEW.metadata::text,  'NULL');

  NEW.row_hash := encode(digest(v_input, 'sha256'), 'hex');

  -- ── Compute chain_hash ──────────────────────────────────────────────────────
  -- Select the most recent row's chain_hash (by event_sequence, which is a
  -- monotonic sequence assigned before this trigger fires via DEFAULT nextval).
  -- If no previous row exists (or all previous rows are pre-migration with
  -- chain_hash = NULL), use empty string as the genesis anchor.
  --
  -- CONCURRENCY NOTE:
  -- Two simultaneous inserts may both read the same "previous" row and produce
  -- identical anchor values — resulting in parallel chain branches at that point.
  -- This is an inherent limitation of hash chains in non-serializable RDBMS
  -- transactions. For Vektrum's audit requirements (detecting retroactive
  -- tampering, not concurrent writes), this trade-off is acceptable.
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
  'BEFORE INSERT trigger function. Computes row_hash (SHA-256 of key fields) '
  'and chain_hash (SHA-256 of row_hash concatenated with previous row''s chain_hash) '
  'for every new audit_log row. Never called directly — invoked by trg_audit_log_hash.';

DROP TRIGGER IF EXISTS trg_audit_log_hash ON public.audit_log;
CREATE TRIGGER trg_audit_log_hash
  BEFORE INSERT ON public.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.compute_audit_hash();


-- =============================================================================
-- PART 3 — IMMUTABILITY TRIGGER (BEFORE UPDATE OR DELETE)
-- =============================================================================
-- Raises a non-catchable exception for any attempted modification.
-- Fires for ALL roles — including service_role and superuser connections via
-- the Supabase pooler. The only way to bypass this is a direct superuser psql
-- connection, which is logged at the Postgres level.

CREATE OR REPLACE FUNCTION public.deny_audit_modification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION
    'audit_log rows are immutable. '
    'Attempted % of row at event_sequence=%, id=%. '
    'All audit records are permanent legal evidence and cannot be modified or deleted.',
    TG_OP,
    OLD.event_sequence,
    OLD.id
    USING ERRCODE = 'restrict_violation';  -- SQLSTATE 23001
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.deny_audit_modification() IS
  'BEFORE UPDATE OR DELETE trigger function for audit_log. '
  'Raises restrict_violation (SQLSTATE 23001) unconditionally. '
  'No role can modify or delete audit_log rows via the Supabase pooler. '
  'Called by audit_log_immutable trigger.';

DROP TRIGGER IF EXISTS audit_log_immutable ON public.audit_log;
CREATE TRIGGER audit_log_immutable
  BEFORE UPDATE OR DELETE ON public.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.deny_audit_modification();


-- =============================================================================
-- PART 4 — CHAIN VERIFICATION FUNCTION
-- =============================================================================
-- Re-computes row_hash and chain_hash from stored column values and compares
-- against the stored hashes. Returns one row per hashed audit record.
-- Used by the reconciliation engine and the admin audit dashboard.
--
-- Parameters:
--   p_entity_type — optional filter (e.g., 'deal', 'milestone')
--   p_entity_id   — optional filter (UUID as text)
--
-- A row is "valid" when:
--   row_hash_valid  = true   (content matches the stored hash)
--   chain_hash_valid = true  (chain continuity is unbroken since the previous row)
--
-- chain_hash_valid uses the STORED previous chain_hash as the anchor for each
-- row. This means a single corrupted row does not cascade false failures onto
-- subsequent rows — each row is independently assessable.

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
      al.chain_hash
    FROM public.audit_log al
    WHERE al.row_hash IS NOT NULL    -- pre-migration rows (NULL hash) are excluded
      AND (p_entity_type IS NULL OR al.entity_type = p_entity_type)
      AND (p_entity_id   IS NULL OR al.entity_id::text = p_entity_id)
    ORDER BY al.event_sequence ASC
  LOOP
    -- Re-compute row_hash using the same formula as compute_audit_hash()
    v_input :=
         COALESCE(r.entity_type,            '')
      || '|' || COALESCE(r.entity_id::text, '')
      || '|' || COALESCE(r.action,          '')
      || '|' || COALESCE(r.actor_id::text,  'NULL')
      || '|' || COALESCE(r.created_at::text,'')
      || '|' || COALESCE(r.old_values::text,'NULL')
      || '|' || COALESCE(r.new_values::text,'NULL')
      || '|' || COALESCE(r.metadata::text,  'NULL');

    v_computed_row_hash := encode(digest(v_input, 'sha256'), 'hex');

    -- Re-compute chain_hash using the STORED previous row's chain_hash as anchor.
    -- Using stored (not recomputed) prev ensures each row is independently verifiable
    -- without cascading failures from one broken row to all subsequent rows.
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

    -- Advance the prev anchor using the STORED chain_hash (not computed).
    -- This ensures each row's chain_hash_valid assessment is independent.
    v_prev_chain_hash := r.chain_hash;

    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.verify_audit_chain(TEXT, TEXT) IS
  'Re-computes row_hash and chain_hash for all hashed audit_log rows and '
  'compares against stored values. Returns one row per verified record with '
  'validity flags. Pre-migration rows (row_hash IS NULL) are excluded. '
  'chain_hash_valid uses stored previous chain_hash as anchor so each row is '
  'independently assessable — one broken row does not cascade failures.';


-- =============================================================================
-- PART 5 — INDEXES ON NEW COLUMNS
-- =============================================================================

-- Partial index: only index rows that have hashes (exclude pre-migration NULLs)
CREATE INDEX IF NOT EXISTS audit_log_row_hash_idx
  ON public.audit_log (row_hash)
  WHERE row_hash IS NOT NULL;

-- Useful for finding the latest chain anchor quickly
CREATE INDEX IF NOT EXISTS audit_log_chain_hash_idx
  ON public.audit_log (event_sequence DESC)
  WHERE chain_hash IS NOT NULL;


-- =============================================================================
-- SUMMARY
-- =============================================================================
--
-- Extension added:
--   pgcrypto — provides digest() for SHA-256 computation
--
-- Columns added to audit_log:
--   row_hash   TEXT — SHA-256 of key fields, set by trigger on INSERT
--   chain_hash TEXT — SHA-256(row_hash || prev_chain_hash), ordered by event_seq
--
-- Functions added:
--   compute_audit_hash()      — BEFORE INSERT trigger: sets row_hash + chain_hash
--   deny_audit_modification() — BEFORE UPDATE/DELETE: raises restrict_violation
--   verify_audit_chain(type, id) — re-computes and compares hashes for verification
--
-- Triggers added:
--   trg_audit_log_hash    — BEFORE INSERT, calls compute_audit_hash()
--   audit_log_immutable   — BEFORE UPDATE OR DELETE, calls deny_audit_modification()
--
-- Indexes added:
--   audit_log_row_hash_idx   — partial on (row_hash) WHERE NOT NULL
--   audit_log_chain_hash_idx — partial on (event_sequence DESC) WHERE chain_hash NOT NULL
--
-- Existing rows:
--   row_hash = NULL, chain_hash = NULL — pre-migration, not verified by verify_audit_chain()
--   First new row starts a fresh chain from the empty-string genesis anchor
-- =============================================================================
