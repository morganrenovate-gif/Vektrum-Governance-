-- =============================================================================
-- Vektrum — Migration 012: Stripe ↔ DB Reconciliation System
--
-- Two tables:
--
--   reconciliation_runs   — one row per job execution (cron or manual).
--                           Tracks what was checked, when, and the headline
--                           issue count. Immutable after status → completed.
--
--   reconciliation_issues — one row per detected discrepancy.
--                           Deduplicated across runs via dedup_key.
--                           Resolved/false-positive issues are never deleted —
--                           they form a permanent compliance audit trail.
--
-- Issue types (severity):
--   orphaned_transfer         CRITICAL  Stripe transfer, no DB release record
--   missing_stripe_id         CRITICAL  DB release has no stripe_transfer_id
--   amount_mismatch           CRITICAL  Transfer cents ≠ release amount × 100
--   ledger_drift              CRITICAL  deal.released_amount ≠ SUM(releases)
--   stripe_transfer_not_found HIGH      stripe_transfer_id in DB not found in Stripe
--   missing_billing_record    HIGH      release exists, billing_record missing
--   fee_ledger_drift          HIGH      deal.fees_collected ≠ SUM(billing_records)
--   metadata_mismatch         MEDIUM    Stripe metadata disagrees with DB values
-- =============================================================================


-- ── reconciliation_runs ───────────────────────────────────────────────────────

CREATE TABLE public.reconciliation_runs (
  id                 uuid           NOT NULL DEFAULT gen_random_uuid(),

  -- Time window that was compared against Stripe
  window_start       timestamptz    NOT NULL,
  window_end         timestamptz    NOT NULL,

  -- Execution bookkeeping
  started_at         timestamptz    NOT NULL DEFAULT now(),
  completed_at       timestamptz,
  status             text           NOT NULL DEFAULT 'running',
  -- running | completed | failed | timed_out

  -- What triggered this run
  triggered_by       text           NOT NULL DEFAULT 'cron',
  -- 'cron' | 'manual:{user_id}'

  -- Counts
  releases_checked   integer        NOT NULL DEFAULT 0,
  transfers_checked  integer        NOT NULL DEFAULT 0,
  deals_checked      integer        NOT NULL DEFAULT 0,
  issues_found       integer        NOT NULL DEFAULT 0,
  issues_auto_fixed  integer        NOT NULL DEFAULT 0,

  -- Failure details (populated only when status = 'failed')
  error_message      text,

  created_at         timestamptz    NOT NULL DEFAULT now(),

  CONSTRAINT reconciliation_runs_pkey         PRIMARY KEY (id),
  CONSTRAINT reconciliation_runs_status_valid CHECK (
    status IN ('running', 'completed', 'failed', 'timed_out')
  )
);

COMMENT ON TABLE public.reconciliation_runs IS
  'One row per reconciliation job execution. Immutable once completed.';

COMMENT ON COLUMN public.reconciliation_runs.triggered_by IS
  'Who triggered the run. "cron" for scheduled jobs; "manual:{user_uuid}" for admin-triggered runs.';

CREATE INDEX reconciliation_runs_status_idx     ON public.reconciliation_runs (status);
CREATE INDEX reconciliation_runs_started_at_idx ON public.reconciliation_runs (started_at DESC);


-- ── reconciliation_issues ─────────────────────────────────────────────────────

CREATE TABLE public.reconciliation_issues (
  id                 uuid           NOT NULL DEFAULT gen_random_uuid(),
  run_id             uuid           NOT NULL REFERENCES public.reconciliation_runs(id) ON DELETE RESTRICT,

  -- ── Classification ────────────────────────────────────────────────────────
  issue_type         text           NOT NULL,
  severity           text           NOT NULL,

  -- ── Context (nullable depending on issue type) ────────────────────────────
  deal_id            uuid           REFERENCES public.deals(id)      ON DELETE SET NULL,
  milestone_id       uuid           REFERENCES public.milestones(id) ON DELETE SET NULL,
  release_id         uuid           REFERENCES public.releases(id)   ON DELETE SET NULL,
  stripe_transfer_id text,

  -- ── Financial evidence ────────────────────────────────────────────────────
  -- For amount_mismatch / ledger_drift: expected is the DB value, actual is Stripe
  expected_amount    numeric(12, 2),
  actual_amount      numeric(12, 2),

  -- Human-readable description of what was found
  description        text           NOT NULL,

  -- Full raw evidence snapshot: DB row(s) + Stripe object at time of detection
  raw_evidence       jsonb,

  -- ── Deduplication ─────────────────────────────────────────────────────────
  -- Stable key that uniquely identifies this inconsistency.
  -- Subsequent runs update run_id/updated_at rather than inserting a duplicate.
  -- Format examples:
  --   "orphaned_transfer:{stripe_transfer_id}"
  --   "missing_billing_record:{release_id}"
  --   "ledger_drift:{deal_id}"
  --   "amount_mismatch:{release_id}"
  dedup_key          text           NOT NULL,

  -- ── Resolution ────────────────────────────────────────────────────────────
  status             text           NOT NULL DEFAULT 'open',
  -- open | acknowledged | resolved | false_positive | auto_resolved

  resolved_at        timestamptz,
  resolved_by        uuid           REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolution_note    text,

  -- Short label of what action was taken, e.g. "billing_record_created"
  resolution_action  text,

  -- ── Auto-fix eligibility ──────────────────────────────────────────────────
  -- True when the engine has determined this issue can be safely auto-fixed
  -- without human judgment (e.g. insert a missing billing_record).
  auto_fixable       boolean        NOT NULL DEFAULT false,

  created_at         timestamptz    NOT NULL DEFAULT now(),
  updated_at         timestamptz    NOT NULL DEFAULT now(),

  CONSTRAINT reconciliation_issues_pkey          PRIMARY KEY (id),
  -- Dedup: open issues are unique per key. Resolved issues remain for audit history.
  CONSTRAINT reconciliation_issues_dedup_open    UNIQUE (dedup_key),
  CONSTRAINT reconciliation_issues_type_valid    CHECK (
    issue_type IN (
      'orphaned_transfer',
      'missing_stripe_id',
      'amount_mismatch',
      'ledger_drift',
      'stripe_transfer_not_found',
      'missing_billing_record',
      'fee_ledger_drift',
      'metadata_mismatch'
    )
  ),
  CONSTRAINT reconciliation_issues_severity_valid CHECK (
    severity IN ('critical', 'high', 'medium', 'low')
  ),
  CONSTRAINT reconciliation_issues_status_valid  CHECK (
    status IN ('open', 'acknowledged', 'resolved', 'false_positive', 'auto_resolved')
  )
);

COMMENT ON TABLE public.reconciliation_issues IS
  'Detected Stripe ↔ DB discrepancies. Deduplicated across runs. Never deleted — '
  'resolved and dismissed issues form a permanent compliance audit trail.';

COMMENT ON COLUMN public.reconciliation_issues.dedup_key IS
  'Stable key identifying this inconsistency. Used to prevent duplicate issues '
  'across repeated runs. Format: "{issue_type}:{primary_id}".';

COMMENT ON COLUMN public.reconciliation_issues.raw_evidence IS
  'Full snapshot of DB rows and Stripe API response at detection time. '
  'Preserved for auditor review even after resolution.';

COMMENT ON COLUMN public.reconciliation_issues.auto_fixable IS
  'True for issue types where the engine can safely create missing records '
  'without human judgment. Admin must still trigger the fix — never automatic.';

-- Indexes
CREATE INDEX reconciliation_issues_run_id_idx       ON public.reconciliation_issues (run_id);
CREATE INDEX reconciliation_issues_status_idx        ON public.reconciliation_issues (status);
CREATE INDEX reconciliation_issues_severity_idx      ON public.reconciliation_issues (severity);
CREATE INDEX reconciliation_issues_type_idx          ON public.reconciliation_issues (issue_type);
CREATE INDEX reconciliation_issues_deal_id_idx       ON public.reconciliation_issues (deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX reconciliation_issues_created_at_idx    ON public.reconciliation_issues (created_at DESC);


-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Both tables are admin-only. No user-level access.

ALTER TABLE public.reconciliation_runs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reconciliation_runs_admin_only"
  ON public.reconciliation_runs
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "reconciliation_issues_admin_only"
  ON public.reconciliation_issues
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ── updated_at trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_reconciliation_issues_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reconciliation_issues_updated_at
  BEFORE UPDATE ON public.reconciliation_issues
  FOR EACH ROW EXECUTE FUNCTION public.update_reconciliation_issues_updated_at();


-- ── Helper view: open critical/high issues count ──────────────────────────────
-- Used by the admin health strip for a fast badge query.

CREATE VIEW public.reconciliation_health AS
SELECT
  COUNT(*) FILTER (WHERE severity = 'critical' AND status = 'open') AS open_critical,
  COUNT(*) FILTER (WHERE severity = 'high'     AND status = 'open') AS open_high,
  COUNT(*) FILTER (WHERE status = 'open')                            AS open_total,
  MAX(r.started_at)                                                  AS last_run_at,
  MAX(r.status)  FILTER (WHERE r.status = 'completed')               AS last_run_status
FROM public.reconciliation_issues i
LEFT JOIN public.reconciliation_runs r ON r.id = i.run_id;

COMMENT ON VIEW public.reconciliation_health IS
  'Single-row summary of open reconciliation issues and last run status. '
  'Used by the admin dashboard health strip.';
