-- =============================================================================
-- 20260425000004_audit_hash_timestamp_fix.sql
-- Prevent audit log backdating by overriding created_at in the hash trigger.
--
-- PROBLEM
-- -------
-- The compute_audit_hash() trigger function (from 20260424000004) uses
-- NEW.created_at in the row_hash computation. If a caller with service_role
-- supplies an explicit created_at value in the past, the trigger hashes that
-- fabricated timestamp and the resulting hash is valid — making the backdated
-- entry cryptographically indistinguishable from a legitimate one.
--
-- SOLUTION
-- --------
-- Add `NEW.created_at := now();` at the top of compute_audit_hash(), before
-- any hash computation. This unconditionally overwrites any application-supplied
-- created_at with the authoritative DB clock. The hash then includes the real
-- insertion timestamp, making backdating impossible via the pooler.
--
-- The only remaining bypass is a direct superuser psql connection, which is
-- logged at the PostgreSQL server level and cannot use the pooler.
--
-- BACKWARD COMPATIBILITY
-- ----------------------
-- Pre-migration rows (row_hash IS NULL) are unaffected — the trigger only fires
-- on INSERT, and existing rows are never re-hashed. New rows after this migration
-- will always have their created_at set to the true insertion time.
-- =============================================================================

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
  -- ── Override application-supplied created_at ─────────────────────────────
  -- Unconditionally set to now() so the hash includes the authoritative DB
  -- clock, not any value supplied by the inserting application or service_role.
  -- This prevents backdating audit entries by supplying a past created_at.
  NEW.created_at := now();

  -- ── Compute row_hash ─────────────────────────────────────────────────────
  -- Fields are concatenated with '|' separator. NULL values are represented as
  -- the literal string 'NULL' to prevent: ('a' || NULL || 'b') = NULL in SQL.
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

  -- ── Compute chain_hash ───────────────────────────────────────────────────
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
  'BEFORE INSERT trigger function. Forces NEW.created_at := now() before computing '
  'row_hash (SHA-256 of key fields) and chain_hash (SHA-256 of row_hash || prev chain_hash). '
  'The created_at override prevents backdating via service_role inserts. '
  'Never called directly — invoked by trg_audit_log_hash.';
