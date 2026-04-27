-- =============================================================================
-- 20260427000000_audit_chain_health.sql
-- Append-only history of audit-chain verification runs.
--
-- WHY:
--   verify_audit_chain() (migration 20260424000004) re-computes row_hash and
--   chain_hash for every hashed audit_log row, but it has had no scheduled
--   invocation. A hash chain is only useful if someone is verifying it.
--
--   This table records the result of every verification run (cron + admin-
--   triggered) so admins can see, at a glance, when the chain was last checked
--   and whether it is currently healthy.
--
-- DATA STORED PER ROW (no payloads, no PII):
--   - timestamp, status, run duration
--   - count of rows checked, count of rows invalid
--   - the FIRST broken event_sequence + audit_id (for investigation)
--   - hash strings (deterministic, server-computed, never user-supplied)
--   - which mechanism triggered the run
--
-- Hash values stored here describe rows that already exist in audit_log.
-- They are not secrets; the same values are returned by verify_audit_chain().
--
-- TAMPER-EVIDENCE NOTE:
--   This table is append-only at the policy level (no UPDATE / DELETE for
--   any role). It is not itself hash-chained — that would be infinite
--   regress. Its integrity guarantee is: "what I show admins reflects what
--   the verifier reported when it ran." Detecting tampering of this table
--   requires inspecting audit_log activity around insert times, which is
--   out of scope.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.audit_chain_health (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  status          TEXT        NOT NULL
                  CHECK (status IN ('healthy', 'broken', 'error')),
  rows_checked    INTEGER     NOT NULL DEFAULT 0
                  CHECK (rows_checked >= 0),
  rows_invalid    INTEGER     NOT NULL DEFAULT 0
                  CHECK (rows_invalid >= 0),
  -- First broken row, if any. Captured so ops can pivot directly to the
  -- problem record without scanning the full verifier output.
  first_broken_event_sequence  BIGINT,
  first_broken_audit_id        UUID,
  -- Performance metric so admins can see if verification is slowing down
  -- (early signal for "we need to switch to incremental verification").
  duration_ms     INTEGER     NOT NULL DEFAULT 0
                  CHECK (duration_ms >= 0),
  -- Free-text only when status='error' (RPC failure, not chain failure).
  -- Truncated and scrubbed by the caller; never raw stack traces.
  error_message   TEXT,
  triggered_by    TEXT        NOT NULL
                  CHECK (triggered_by IN ('cron', 'admin_manual')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.audit_chain_health IS
  'Append-only history of verify_audit_chain() runs. One row per verification ' ||
  'pass. Read by admins to see current chain health and historical trend. ' ||
  'No audit_log payloads are stored here — only counts, IDs, and hashes ' ||
  'returned by the verifier. Mutating audit_log rows is out of scope.';

COMMENT ON COLUMN public.audit_chain_health.status IS
  'healthy = every checked row passed both row_hash and chain_hash; ' ||
  'broken = at least one checked row failed; ' ||
  'error = the verifier RPC itself failed (network, syntax, auth).';

-- ── Indexes ──────────────────────────────────────────────────────────────────
-- Ops query is "give me the latest run" — covered by ordering on checked_at.

CREATE INDEX IF NOT EXISTS audit_chain_health_checked_at_idx
  ON public.audit_chain_health (checked_at DESC);

CREATE INDEX IF NOT EXISTS audit_chain_health_status_idx
  ON public.audit_chain_health (status, checked_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Pattern mirrors admin_audit_log (20260424000007): admin-only SELECT,
-- service-role-only INSERT, no UPDATE / DELETE policy at all.

ALTER TABLE public.audit_chain_health ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_chain_health_select       ON public.audit_chain_health;
DROP POLICY IF EXISTS audit_chain_health_insert_deny  ON public.audit_chain_health;

-- Admins can read all rows.
CREATE POLICY audit_chain_health_select
  ON public.audit_chain_health
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE  id   = auth.uid()
        AND  role = 'admin'
    )
  );

-- Authenticated users have NO INSERT path. All writes come from the admin
-- client (service-role) used by the cron runner and the manual-trigger route.
CREATE POLICY audit_chain_health_insert_deny
  ON public.audit_chain_health
  FOR INSERT
  WITH CHECK (false);

-- *** No UPDATE policy ***
-- *** No DELETE policy ***
-- Append-only by policy. Service-role bypasses RLS, but no application code
-- mutates these rows after insert.

COMMENT ON POLICY audit_chain_health_select ON public.audit_chain_health IS
  'Admin-only read. The chain-health log is operational data, not partner-' ||
  'visible. Funders and contractors have no view of platform-wide audit ' ||
  'verification.';

COMMENT ON POLICY audit_chain_health_insert_deny ON public.audit_chain_health IS
  'Direct INSERT from authenticated users is denied. Writes flow through the ' ||
  'service-role admin client inside the cron runner and the admin manual-' ||
  'trigger route, both of which bypass RLS.';
