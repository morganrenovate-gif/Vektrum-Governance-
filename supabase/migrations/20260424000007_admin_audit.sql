-- =============================================================================
-- 20260424000007_admin_audit.sql
-- Separate admin_audit_log table with four-eyes review and immutability.
--
-- PURPOSE
-- -------
-- Every admin-privileged write action is logged here IN ADDITION to the
-- regular audit_log. The two tables serve different purposes:
--
--   audit_log       — system-wide event history (all roles, all entities)
--   admin_audit_log — compliance register for admin actions specifically,
--                     with mandatory justification, optional authorization
--                     reference, and a four-eyes review workflow.
--
-- IMMUTABILITY MODEL
-- ------------------
-- Base fields (everything except reviewed_by / reviewed_at) are write-once
-- via a BEFORE UPDATE trigger that rejects any mutation of protected columns.
-- DELETE is blocked entirely. This differs from audit_log (where no UPDATE is
-- ever permitted) because the review workflow needs to set reviewed_by and
-- reviewed_at after initial insertion.
--
-- FOUR-EYES ENFORCEMENT
-- ---------------------
-- The immutability trigger also enforces:
--   1. reviewer != actor         — you cannot review your own action
--   2. review is irreversible    — once reviewed_by is set it cannot be cleared
--
-- HASH CHAIN
-- ----------
-- Same SHA-256 row_hash + chain_hash approach as audit_log (migration
-- 20260424000004). Hashes cover only the immutable base fields so the chain
-- remains valid when reviewed_by / reviewed_at are later set.
-- =============================================================================


-- ── 0. Enable pgcrypto (idempotent) ──────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ── 1. Sequence for monotonic ordering ───────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.admin_audit_log_event_seq;


-- ── 2. Table ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.admin_audit_log (

  -- ── Identity
  id               uuid        NOT NULL DEFAULT gen_random_uuid(),
  event_sequence   bigint      NOT NULL DEFAULT nextval('public.admin_audit_log_event_seq'),

  -- ── What happened
  entity_type      text        NOT NULL,
  entity_id        uuid        NOT NULL,
  action           text        NOT NULL,

  -- ── Who did it
  actor_id         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role       text,
  actor_name       text,
  actor_email      text,

  -- ── Where / how
  system_source    text,
  session_id       text,
  ip_address       text,

  -- ── Payload
  old_values       jsonb,
  new_values       jsonb,
  metadata         jsonb,

  -- ── Timestamp (DB-assigned, not application-supplied)
  created_at       timestamptz NOT NULL DEFAULT now(),

  -- ── Admin compliance fields
  admin_justification      text        NOT NULL,
  authorization_reference  text,

  -- ── Four-eyes review (mutable — only these two columns may be updated)
  reviewed_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at      timestamptz,

  -- ── Cryptographic integrity
  row_hash         text,
  chain_hash       text,

  -- ── Constraints
  CONSTRAINT admin_audit_log_pkey
    PRIMARY KEY (id),

  CONSTRAINT admin_audit_log_event_seq_unique
    UNIQUE (event_sequence),

  -- Justification must be meaningful — enforced at DB layer as a backstop
  -- (application layer also validates ≥ 20 chars before reaching here)
  CONSTRAINT admin_audit_log_justification_min_length
    CHECK (char_length(admin_justification) >= 20),

  -- reviewed_by and reviewed_at must be set together or not at all
  CONSTRAINT admin_audit_log_reviewed_consistency
    CHECK ( (reviewed_by IS NULL) = (reviewed_at IS NULL) ),

  -- Server-side clock skew guard — prevents future-dated records
  CONSTRAINT admin_audit_log_created_at_not_future
    CHECK (created_at <= now() + interval '5 minutes')
);

COMMENT ON TABLE public.admin_audit_log IS
  'Compliance register for all admin-privileged write actions. '
  'Every row requires a justification string (≥ 20 chars). '
  'Base fields are immutable after insert. Only reviewed_by and reviewed_at '
  'may be updated (four-eyes review workflow). DELETE is never permitted.';

COMMENT ON COLUMN public.admin_audit_log.admin_justification IS
  'Human-readable reason the admin performed this action. Minimum 20 characters. '
  'Passed by the caller in the request body or X-Admin-Justification header.';

COMMENT ON COLUMN public.admin_audit_log.authorization_reference IS
  'Optional external reference for the authorisation: email thread ID, support '
  'ticket number, approval URL, etc. Allows out-of-band audit evidence linking.';

COMMENT ON COLUMN public.admin_audit_log.reviewed_by IS
  'UUID of the second admin who reviewed this entry (four-eyes). '
  'Must differ from actor_id. Set via PATCH /api/admin/audit-log/[id]/review.';

COMMENT ON COLUMN public.admin_audit_log.reviewed_at IS
  'Timestamp when reviewed_by performed their review. '
  'Always set in the same UPDATE as reviewed_by — never independently.';

COMMENT ON COLUMN public.admin_audit_log.row_hash IS
  'SHA-256 hex digest of the immutable base fields. Computed by '
  'compute_admin_audit_hash() BEFORE INSERT trigger. NULL on pre-migration rows.';

COMMENT ON COLUMN public.admin_audit_log.chain_hash IS
  'SHA-256 hex digest of (row_hash || previous chain_hash), forming a '
  'Merkle-style append-only chain. Tampering or insertion breaks all subsequent '
  'hashes. Verified server-side by verify_admin_audit_chain().';


-- ── 3. Indexes ────────────────────────────────────────────────────────────────

-- Most common admin-side queries filter by action or actor
CREATE INDEX IF NOT EXISTS admin_audit_log_actor_idx
  ON public.admin_audit_log (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS admin_audit_log_action_idx
  ON public.admin_audit_log (action, created_at DESC);

-- Four-eyes queue: entries awaiting review
CREATE INDEX IF NOT EXISTS admin_audit_log_unreviewed_idx
  ON public.admin_audit_log (created_at DESC)
  WHERE reviewed_by IS NULL;

-- Entity lookups (e.g. "all admin actions on deal X")
CREATE INDEX IF NOT EXISTS admin_audit_log_entity_idx
  ON public.admin_audit_log (entity_type, entity_id, created_at DESC);


-- ── 4. BEFORE INSERT trigger: compute SHA-256 hash chain ─────────────────────
--
-- Hashes cover the base immutable fields only. reviewed_by / reviewed_at are
-- intentionally excluded so the chain stays valid after four-eyes updates.

CREATE OR REPLACE FUNCTION public.compute_admin_audit_hash()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_input      text;
  v_prev_chain text;
BEGIN
  -- Canonical pipe-delimited input from immutable base fields
  v_input :=
    COALESCE(NEW.entity_type,  '')             || '|' ||
    COALESCE(NEW.entity_id::text, '')          || '|' ||
    COALESCE(NEW.action,       '')             || '|' ||
    COALESCE(NEW.actor_id::text, 'NULL')       || '|' ||
    COALESCE(NEW.created_at::text, '')         || '|' ||
    COALESCE(NEW.admin_justification, '')      || '|' ||
    COALESCE(NEW.old_values::text, 'NULL')     || '|' ||
    COALESCE(NEW.new_values::text, 'NULL')     || '|' ||
    COALESCE(NEW.metadata::text,   'NULL');

  NEW.row_hash := encode(digest(v_input, 'sha256'), 'hex');

  -- Extend the chain: hash(row_hash || prev_chain_hash)
  SELECT chain_hash
  INTO   v_prev_chain
  FROM   public.admin_audit_log
  WHERE  chain_hash IS NOT NULL
  ORDER BY event_sequence DESC
  LIMIT  1;

  NEW.chain_hash := encode(
    digest(NEW.row_hash || COALESCE(v_prev_chain, ''), 'sha256'),
    'hex'
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.compute_admin_audit_hash() IS
  'BEFORE INSERT trigger on admin_audit_log. Computes SHA-256 row_hash from '
  'immutable base fields and extends the Merkle-style chain_hash. '
  'Mirrors compute_audit_hash() from migration 20260424000004 but scoped to '
  'the admin table so the chains are independent.';

DROP TRIGGER IF EXISTS admin_audit_log_hash_insert ON public.admin_audit_log;
CREATE TRIGGER admin_audit_log_hash_insert
  BEFORE INSERT ON public.admin_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.compute_admin_audit_hash();


-- ── 5. BEFORE UPDATE / DELETE trigger: immutability guard ────────────────────
--
-- Permits ONLY (reviewed_by, reviewed_at) to change.
-- All other columns, including hash fields, are frozen after insert.
-- DELETE is never permitted.
-- Four-eyes rules are enforced here at the database layer.

CREATE OR REPLACE FUNCTION public.guard_admin_audit_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- ── Block all deletes ──────────────────────────────────────────────────────
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'admin_audit_log rows are immutable and cannot be deleted. '
      'event_sequence=%, id=%.',
      OLD.event_sequence, OLD.id
    USING ERRCODE = 'restrict_violation';
    RETURN NULL;
  END IF;

  -- ── Block mutation of any protected column ─────────────────────────────────
  IF  OLD.entity_type             IS DISTINCT FROM NEW.entity_type
   OR OLD.entity_id               IS DISTINCT FROM NEW.entity_id
   OR OLD.action                  IS DISTINCT FROM NEW.action
   OR OLD.actor_id                IS DISTINCT FROM NEW.actor_id
   OR OLD.actor_role              IS DISTINCT FROM NEW.actor_role
   OR OLD.actor_name              IS DISTINCT FROM NEW.actor_name
   OR OLD.actor_email             IS DISTINCT FROM NEW.actor_email
   OR OLD.system_source           IS DISTINCT FROM NEW.system_source
   OR OLD.session_id              IS DISTINCT FROM NEW.session_id
   OR OLD.ip_address              IS DISTINCT FROM NEW.ip_address
   OR OLD.old_values              IS DISTINCT FROM NEW.old_values
   OR OLD.new_values              IS DISTINCT FROM NEW.new_values
   OR OLD.metadata                IS DISTINCT FROM NEW.metadata
   OR OLD.created_at              IS DISTINCT FROM NEW.created_at
   OR OLD.admin_justification     IS DISTINCT FROM NEW.admin_justification
   OR OLD.authorization_reference IS DISTINCT FROM NEW.authorization_reference
   OR OLD.row_hash                IS DISTINCT FROM NEW.row_hash
   OR OLD.chain_hash              IS DISTINCT FROM NEW.chain_hash
  THEN
    RAISE EXCEPTION
      'admin_audit_log: only reviewed_by and reviewed_at may be updated. '
      'Attempted modification of a protected field on event_sequence=%.',
      OLD.event_sequence
    USING ERRCODE = 'restrict_violation';
  END IF;

  -- ── Four-eyes: reviewer cannot be the actor ────────────────────────────────
  IF NEW.reviewed_by IS NOT NULL AND NEW.reviewed_by = OLD.actor_id THEN
    RAISE EXCEPTION
      'admin_audit_log: four-eyes violation — the reviewer cannot be the same '
      'person as the actor (actor_id=%).',
      OLD.actor_id
    USING ERRCODE = 'restrict_violation';
  END IF;

  -- ── Review is irreversible once set ───────────────────────────────────────
  IF OLD.reviewed_by IS NOT NULL AND NEW.reviewed_by IS NULL THEN
    RAISE EXCEPTION
      'admin_audit_log: a completed review cannot be reversed '
      '(event_sequence=%).',
      OLD.event_sequence
    USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_admin_audit_immutability() IS
  'BEFORE UPDATE OR DELETE trigger on admin_audit_log. '
  'Blocks deletes entirely. For updates, only reviewed_by and reviewed_at '
  'may change. Enforces four-eyes (reviewer != actor) and irreversibility '
  'of reviews at the database layer.';

DROP TRIGGER IF EXISTS admin_audit_log_immutable ON public.admin_audit_log;
CREATE TRIGGER admin_audit_log_immutable
  BEFORE UPDATE OR DELETE ON public.admin_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_admin_audit_immutability();


-- ── 6. RLS — restrict reads and writes ───────────────────────────────────────
-- Service-role writes bypass RLS (used by logAdminAudit via the admin client).
-- Authenticated admins can read. No authenticated UPDATE (only service-role
-- updates are permitted via the review API which uses the admin client).

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can read all entries
CREATE POLICY admin_audit_log_select
  ON public.admin_audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE  id   = auth.uid()
        AND  role = 'admin'
    )
  );

-- No INSERT, UPDATE, or DELETE for authenticated users — only service role
-- (application writes go through createSupabaseAdminClient() which bypasses RLS)


-- ── 7. Verify chain function ──────────────────────────────────────────────────
-- Server-side hash chain verifier for admin_audit_log.
-- Called by GET /api/admin/audit-log?verify=true.

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

      -- Row hash: re-derive from immutable fields
      (aal.row_hash = encode(digest(
        COALESCE(aal.entity_type,  '')         || '|' ||
        COALESCE(aal.entity_id::text, '')      || '|' ||
        COALESCE(aal.action,       '')         || '|' ||
        COALESCE(aal.actor_id::text, 'NULL')   || '|' ||
        COALESCE(aal.created_at::text, '')     || '|' ||
        COALESCE(aal.admin_justification, '')  || '|' ||
        COALESCE(aal.old_values::text, 'NULL') || '|' ||
        COALESCE(aal.new_values::text, 'NULL') || '|' ||
        COALESCE(aal.metadata::text,   'NULL'),
        'sha256'
      ), 'hex'))                                           AS row_hash_valid,

      -- Chain hash verified in application logic below (needs prior row)
      false                                               AS chain_hash_valid,

      aal.row_hash                                        AS stored_row_hash,
      encode(digest(
        COALESCE(aal.entity_type,  '')         || '|' ||
        COALESCE(aal.entity_id::text, '')      || '|' ||
        COALESCE(aal.action,       '')         || '|' ||
        COALESCE(aal.actor_id::text, 'NULL')   || '|' ||
        COALESCE(aal.created_at::text, '')     || '|' ||
        COALESCE(aal.admin_justification, '')  || '|' ||
        COALESCE(aal.old_values::text, 'NULL') || '|' ||
        COALESCE(aal.new_values::text, 'NULL') || '|' ||
        COALESCE(aal.metadata::text,   'NULL'),
        'sha256'
      ), 'hex')                                            AS computed_row_hash,

      aal.chain_hash                                      AS stored_chain_hash,
      ''                                                  AS expected_chain_hash

    FROM public.admin_audit_log aal
    WHERE aal.row_hash IS NOT NULL
      AND (p_entity_type IS NULL OR aal.entity_type = p_entity_type)
      AND (p_entity_id   IS NULL OR aal.entity_id   = p_entity_id)
    ORDER BY aal.event_sequence ASC
  LOOP
    -- Compute expected chain hash using the running previous value
    expected_chain_hash := encode(
      digest(computed_row_hash || v_prev_chain, 'sha256'),
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
  'against stored values. Called by the admin audit log API to detect tampering. '
  'Parameters are optional: pass NULL to verify the full table.';


-- =============================================================================
-- SUMMARY
-- =============================================================================
-- New table:   public.admin_audit_log
--   Columns:   id, event_sequence, entity_type, entity_id, action,
--              actor_id, actor_role, actor_name, actor_email,
--              system_source, session_id, ip_address,
--              old_values, new_values, metadata, created_at,
--              admin_justification (NOT NULL, ≥20 chars),
--              authorization_reference,
--              reviewed_by (nullable, FK → auth.users),
--              reviewed_at (nullable),
--              row_hash, chain_hash
-- Triggers:
--   admin_audit_log_hash_insert — BEFORE INSERT: compute SHA-256 chain
--   admin_audit_log_immutable   — BEFORE UPDATE OR DELETE: immutability guard
--                                 + four-eyes enforcement
-- RLS:         admins can SELECT; all writes via service-role only
-- Sequence:    public.admin_audit_log_event_seq
-- Indexes:     actor, action, unreviewed queue, entity
-- Functions:   compute_admin_audit_hash(), guard_admin_audit_immutability(),
--              verify_admin_audit_chain()
-- =============================================================================
