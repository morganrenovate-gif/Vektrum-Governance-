-- =============================================================================
-- 20260429000001_pgcrypto_schema_fix.sql
-- Qualify pgcrypto digest() calls with the extensions schema.
--
-- ROOT CAUSE
-- ----------
-- Supabase installs extensions in the `extensions` schema, not `public`.
-- Migrations 20260424000004, 20260424000007, and 20260425000004 all called
-- `CREATE EXTENSION IF NOT EXISTS pgcrypto` without `WITH SCHEMA extensions`,
-- which does not guarantee the function lands in a schema on the search_path.
--
-- All audit hash functions had `SET search_path = public, pg_catalog` (or no
-- explicit search_path), so bare `digest()` calls could not resolve to
-- `extensions.digest()` and raised SQLSTATE 42883:
--   "function digest(text, unknown) does not exist"
--
-- This error surfaced as the deal assignment failing during invite acceptance:
--   1. deals.update(funder_id) fires trg_audit_deals (AFTER UPDATE)
--   2. audit_deals() detects funder_id changed → INSERT into audit_log
--   3. trg_audit_log_hash (BEFORE INSERT on audit_log) fires compute_audit_hash()
--   4. compute_audit_hash() calls bare digest → 42883 → propagates to the UPDATE
--   5. dealUpdateError.code = '42883', "Failed to assign you as funder."
--
-- SOLUTION
-- --------
-- 1. Re-run pgcrypto creation explicitly in the extensions schema.
-- 2. Rewrite all four hash functions to call extensions.digest() directly.
--    This is independent of search_path and will work even if extensions is
--    not on any session's search_path.
--
-- FUNCTIONS UPDATED
-- -----------------
--   compute_audit_hash()        — BEFORE INSERT trigger on audit_log
--   verify_audit_chain()        — RPC for admin reconciliation and cron
--   compute_admin_audit_hash()  — BEFORE INSERT trigger on admin_audit_log
--   verify_admin_audit_chain()  — RPC for admin audit review
--
-- BEHAVIOR UNCHANGED
-- ------------------
-- Hash inputs, chain logic, and immutability behavior are identical.
-- Only the function resolution path for digest() changes.
-- The signup defensive wrapper (20260429000000) is unaffected — it catches
-- errors from this path anyway, but with this fix the path succeeds.
-- =============================================================================


-- =============================================================================
-- PART 0 — ensure pgcrypto is in extensions schema
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


-- =============================================================================
-- PART 1 — compute_audit_hash() with extensions.digest()
-- =============================================================================
-- BEFORE INSERT trigger on public.audit_log.
-- Identical to migration 20260425000004 except bare digest → extensions.digest.

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
  -- Override application-supplied created_at (backdating prevention).
  NEW.created_at := now();

  -- Canonical pipe-delimited row hash input.
  -- NULL values are represented as the literal 'NULL' to prevent collisions.
  v_input :=
       COALESCE(NEW.entity_type,            '')
    || '|' || COALESCE(NEW.entity_id::text, '')
    || '|' || COALESCE(NEW.action,          '')
    || '|' || COALESCE(NEW.actor_id::text,  'NULL')
    || '|' || COALESCE(NEW.created_at::text,'')
    || '|' || COALESCE(NEW.old_values::text,'NULL')
    || '|' || COALESCE(NEW.new_values::text,'NULL')
    || '|' || COALESCE(NEW.metadata::text,  'NULL');

  NEW.row_hash := encode(extensions.digest(v_input, 'sha256'), 'hex');

  -- Chain: hash(row_hash || previous_chain_hash).
  -- Genesis row uses empty string as anchor.
  SELECT chain_hash
  INTO   v_prev_chain
  FROM   public.audit_log
  WHERE  chain_hash IS NOT NULL
  ORDER  BY event_sequence DESC
  LIMIT  1;

  NEW.chain_hash := encode(
    extensions.digest(NEW.row_hash || COALESCE(v_prev_chain, ''), 'sha256'),
    'hex'
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.compute_audit_hash() IS
  'BEFORE INSERT trigger function. Forces NEW.created_at := now() before computing '
  'row_hash (SHA-256 of key fields) and chain_hash (SHA-256 of row_hash || prev chain_hash). '
  'Uses extensions.digest() to resolve pgcrypto regardless of search_path. '
  'Never called directly — invoked by trg_audit_log_hash.';


-- =============================================================================
-- PART 2 — verify_audit_chain() with extensions.digest()
-- =============================================================================
-- Used by the reconciliation cron and admin audit dashboard.
-- Identical to migration 20260424000004 except bare digest → extensions.digest.

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
  v_prev_chain_hash   TEXT := NULL;
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
    WHERE al.row_hash IS NOT NULL
      AND (p_entity_type IS NULL OR al.entity_type = p_entity_type)
      AND (p_entity_id   IS NULL OR al.entity_id::text = p_entity_id)
    ORDER BY al.event_sequence ASC
  LOOP
    v_input :=
         COALESCE(r.entity_type,            '')
      || '|' || COALESCE(r.entity_id::text, '')
      || '|' || COALESCE(r.action,          '')
      || '|' || COALESCE(r.actor_id::text,  'NULL')
      || '|' || COALESCE(r.created_at::text,'')
      || '|' || COALESCE(r.old_values::text,'NULL')
      || '|' || COALESCE(r.new_values::text,'NULL')
      || '|' || COALESCE(r.metadata::text,  'NULL');

    v_computed_row_hash := encode(extensions.digest(v_input, 'sha256'), 'hex');

    v_expected_chain := encode(
      extensions.digest(v_computed_row_hash || COALESCE(v_prev_chain_hash, ''), 'sha256'),
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

    -- Advance chain anchor using the STORED value so each row is independently
    -- assessable (one broken row does not cascade failures to subsequent rows).
    v_prev_chain_hash := r.chain_hash;

    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.verify_audit_chain(TEXT, TEXT) IS
  'Re-computes row_hash and chain_hash for all hashed audit_log rows and '
  'compares against stored values. Returns one row per verified record with '
  'validity flags. Uses extensions.digest() to resolve pgcrypto regardless of '
  'search_path. Pre-migration rows (row_hash IS NULL) are excluded. '
  'chain_hash_valid uses stored previous chain_hash as anchor — one broken row '
  'does not cascade failures.';


-- =============================================================================
-- PART 3 — compute_admin_audit_hash() with extensions.digest()
-- =============================================================================
-- BEFORE INSERT trigger on public.admin_audit_log.
-- Identical to migration 20260424000007 except digest() → extensions.digest()
-- and an explicit search_path is added.

CREATE OR REPLACE FUNCTION public.compute_admin_audit_hash()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_input      text;
  v_prev_chain text;
BEGIN
  v_input :=
    COALESCE(NEW.entity_type,          '')       || '|' ||
    COALESCE(NEW.entity_id::text,      '')       || '|' ||
    COALESCE(NEW.action,               '')       || '|' ||
    COALESCE(NEW.actor_id::text,       'NULL')   || '|' ||
    COALESCE(NEW.created_at::text,     '')       || '|' ||
    COALESCE(NEW.admin_justification,  '')       || '|' ||
    COALESCE(NEW.old_values::text,     'NULL')   || '|' ||
    COALESCE(NEW.new_values::text,     'NULL')   || '|' ||
    COALESCE(NEW.metadata::text,       'NULL');

  NEW.row_hash := encode(extensions.digest(v_input, 'sha256'), 'hex');

  SELECT chain_hash
  INTO   v_prev_chain
  FROM   public.admin_audit_log
  WHERE  chain_hash IS NOT NULL
  ORDER  BY event_sequence DESC
  LIMIT  1;

  NEW.chain_hash := encode(
    extensions.digest(NEW.row_hash || COALESCE(v_prev_chain, ''), 'sha256'),
    'hex'
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.compute_admin_audit_hash() IS
  'BEFORE INSERT trigger on admin_audit_log. Computes SHA-256 row_hash from '
  'immutable base fields and extends the Merkle-style chain_hash. '
  'Uses extensions.digest() to resolve pgcrypto regardless of search_path. '
  'Mirrors compute_audit_hash() but scoped to admin_audit_log.';


-- =============================================================================
-- PART 4 — verify_admin_audit_chain() with extensions.digest()
-- =============================================================================
-- Used by admin audit review routes.
-- Identical to migration 20260424000007 except digest() → extensions.digest()
-- and an explicit search_path is added.

CREATE OR REPLACE FUNCTION public.verify_admin_audit_chain(
  p_entity_type text DEFAULT NULL,
  p_entity_id   uuid DEFAULT NULL
)
RETURNS TABLE (
  audit_id            uuid,
  event_seq           bigint,
  row_hash_valid      boolean,
  chain_hash_valid    boolean,
  stored_row_hash     text,
  computed_row_hash   text,
  stored_chain_hash   text,
  expected_chain_hash text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_prev_chain text := '';
BEGIN
  FOR audit_id, event_seq,
      row_hash_valid, chain_hash_valid,
      stored_row_hash, computed_row_hash,
      stored_chain_hash, expected_chain_hash
  IN
    SELECT
      aal.id,
      aal.event_sequence,

      (aal.row_hash = encode(extensions.digest(
        COALESCE(aal.entity_type,          '')     || '|' ||
        COALESCE(aal.entity_id::text,      '')     || '|' ||
        COALESCE(aal.action,               '')     || '|' ||
        COALESCE(aal.actor_id::text,       'NULL') || '|' ||
        COALESCE(aal.created_at::text,     '')     || '|' ||
        COALESCE(aal.admin_justification,  '')     || '|' ||
        COALESCE(aal.old_values::text,     'NULL') || '|' ||
        COALESCE(aal.new_values::text,     'NULL') || '|' ||
        COALESCE(aal.metadata::text,       'NULL'),
        'sha256'
      ), 'hex'))                                      AS row_hash_valid,

      false                                           AS chain_hash_valid,

      aal.row_hash                                    AS stored_row_hash,
      encode(extensions.digest(
        COALESCE(aal.entity_type,          '')     || '|' ||
        COALESCE(aal.entity_id::text,      '')     || '|' ||
        COALESCE(aal.action,               '')     || '|' ||
        COALESCE(aal.actor_id::text,       'NULL') || '|' ||
        COALESCE(aal.created_at::text,     '')     || '|' ||
        COALESCE(aal.admin_justification,  '')     || '|' ||
        COALESCE(aal.old_values::text,     'NULL') || '|' ||
        COALESCE(aal.new_values::text,     'NULL') || '|' ||
        COALESCE(aal.metadata::text,       'NULL'),
        'sha256'
      ), 'hex')                                       AS computed_row_hash,

      aal.chain_hash                                  AS stored_chain_hash,
      ''                                              AS expected_chain_hash

    FROM public.admin_audit_log aal
    WHERE aal.row_hash IS NOT NULL
      AND (p_entity_type IS NULL OR aal.entity_type = p_entity_type)
      AND (p_entity_id   IS NULL OR aal.entity_id   = p_entity_id)
    ORDER BY aal.event_sequence ASC
  LOOP
    expected_chain_hash := encode(
      extensions.digest(computed_row_hash || v_prev_chain, 'sha256'),
      'hex'
    );
    chain_hash_valid := (stored_chain_hash = expected_chain_hash);
    v_prev_chain     := stored_chain_hash;

    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.verify_admin_audit_chain(text, uuid) IS
  'Re-derives SHA-256 hashes server-side for admin_audit_log rows and compares '
  'against stored values. Uses extensions.digest() to resolve pgcrypto regardless '
  'of search_path. Called by the admin audit log API to detect tampering. '
  'Parameters are optional: pass NULL to verify the full table.';


-- =============================================================================
-- SUMMARY
-- =============================================================================
--
-- Extension:
--   pgcrypto — ensured in extensions schema (WHERE Supabase installs it)
--
-- Functions updated (bare digest() → extensions.digest()):
--   compute_audit_hash()       — BEFORE INSERT on audit_log
--   verify_audit_chain()       — reconciliation / admin RPC
--   compute_admin_audit_hash() — BEFORE INSERT on admin_audit_log
--   verify_admin_audit_chain() — admin audit review RPC
--
-- No schema, table, trigger, RLS, or index changes.
-- Hash algorithm and chain logic are identical — only function resolution changes.
-- Pre-migration hashes remain valid (they were computed with the same algorithm).
-- =============================================================================
