-- =============================================================================
-- Migration 20260425000000 — Payment-rail abstraction (Phase 1)
--
-- Adds additive columns to `releases` so execution on an external/manual rail
-- can be tracked alongside the existing Stripe Connect rail. No existing
-- behaviour is changed; all current releases are backfilled as stripe_connect.
--
-- Design principles:
--   - Additive only. No DROP, no type changes.
--   - Existing Stripe releases remain untouched in logic; this migration just
--     records their rail classification for reconciliation filtering.
--   - External execution means Vektrum authorises; a human/partner executes
--     payment outside Vektrum. Vektrum never holds or transmits funds.
--
-- Columns added to `releases`:
--   execution_rail              TEXT (CHECK) — 'stripe_connect' | 'external_manual'
--   execution_status            TEXT (CHECK) — 'pending'|'executing'|'confirmed'|'failed'|'reversed'
--   external_payment_method     TEXT — 'wire'|'ach'|'check'|'other'
--   external_payment_reference  TEXT — funder-supplied bank ref / check no
--   external_executed_at        TIMESTAMPTZ — when external payment was confirmed
--   external_executed_by        UUID FK auth.users — who confirmed the external payment
--   external_execution_notes    TEXT — free-form notes from confirming actor
--   proof_of_payment_document_id UUID FK milestone_documents — optional proof attachment
--
-- Invariants enforced by CHECK constraints:
--   (1) execution_rail must be a known value
--   (2) execution_status must be a known value (or NULL for legacy rows)
--   (3) external_manual rail must not have stripe_transfer_id (rail-mismatch guard)
--   (4) external_manual rail at execution_status='confirmed' must have
--       reference, executed_at, and executed_by populated
--   (5) stripe_connect rail at execution_status='confirmed' must have
--       stripe_transfer_id populated
--
-- Reconciliation implications (enforced in code, not schema):
--   - Pass 1 / 2 filter by execution_rail = 'stripe_connect'
--   - New passes flag external-rail hygiene issues (overdue, missing proof, etc.)
-- =============================================================================

-- ─── 1. Add columns ──────────────────────────────────────────────────────────

ALTER TABLE public.releases
  ADD COLUMN IF NOT EXISTS execution_rail              text NOT NULL DEFAULT 'stripe_connect',
  ADD COLUMN IF NOT EXISTS execution_status            text,
  ADD COLUMN IF NOT EXISTS external_payment_method     text,
  ADD COLUMN IF NOT EXISTS external_payment_reference  text,
  ADD COLUMN IF NOT EXISTS external_executed_at        timestamptz,
  ADD COLUMN IF NOT EXISTS external_executed_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_execution_notes    text,
  ADD COLUMN IF NOT EXISTS proof_of_payment_document_id uuid REFERENCES public.milestone_documents(id) ON DELETE SET NULL;

-- ─── 2. Backfill legacy rows ─────────────────────────────────────────────────
--
-- All existing rows are Stripe Connect releases. Their execution_status is
-- derived from the existing transfer_status column.

UPDATE public.releases
SET execution_status = CASE
    WHEN transfer_status = 'confirmed' THEN 'confirmed'
    WHEN transfer_status = 'failed'    THEN 'failed'
    WHEN transfer_status = 'reversed'  THEN 'reversed'
    WHEN transfer_status = 'pending'   THEN 'executing'
    ELSE 'confirmed'  -- legacy rows predating 013_transfer_failure still had stripe_transfer_id set
  END
WHERE execution_status IS NULL;

-- ─── 3. CHECK constraints ────────────────────────────────────────────────────

-- 3a. execution_rail whitelist
ALTER TABLE public.releases
  DROP CONSTRAINT IF EXISTS releases_execution_rail_chk;
ALTER TABLE public.releases
  ADD CONSTRAINT releases_execution_rail_chk
    CHECK (execution_rail IN ('stripe_connect', 'external_manual'));

-- 3b. execution_status whitelist (NULL allowed for defensive safety;
--     backfill above populates all existing rows, so in practice NULL only
--     appears for rows written before this migration that fail the backfill)
ALTER TABLE public.releases
  DROP CONSTRAINT IF EXISTS releases_execution_status_chk;
ALTER TABLE public.releases
  ADD CONSTRAINT releases_execution_status_chk
    CHECK (execution_status IS NULL
           OR execution_status IN ('pending','executing','confirmed','failed','reversed'));

-- 3c. external_manual rail must NOT have a stripe_transfer_id.
--     This is the rail-mismatch guard that reconciliation's
--     `external_rail_mismatch` check defends at the query layer.
ALTER TABLE public.releases
  DROP CONSTRAINT IF EXISTS releases_external_no_stripe_chk;
ALTER TABLE public.releases
  ADD CONSTRAINT releases_external_no_stripe_chk
    CHECK (execution_rail <> 'external_manual' OR stripe_transfer_id IS NULL);

-- 3d. external_manual at execution_status='confirmed' must have the actor,
--     reference, and timestamp populated. Required payment_method is also
--     enforced because a confirmation without a method cannot be reconciled.
ALTER TABLE public.releases
  DROP CONSTRAINT IF EXISTS releases_external_confirmed_chk;
ALTER TABLE public.releases
  ADD CONSTRAINT releases_external_confirmed_chk
    CHECK (
      execution_rail <> 'external_manual'
      OR execution_status IS DISTINCT FROM 'confirmed'
      OR (
        external_payment_method    IS NOT NULL
        AND external_payment_reference IS NOT NULL
        AND external_executed_at   IS NOT NULL
        AND external_executed_by   IS NOT NULL
      )
    );

-- 3e. stripe_connect at execution_status='confirmed' must have a
--     stripe_transfer_id. This codifies the existing runtime invariant.
ALTER TABLE public.releases
  DROP CONSTRAINT IF EXISTS releases_stripe_confirmed_chk;
ALTER TABLE public.releases
  ADD CONSTRAINT releases_stripe_confirmed_chk
    CHECK (
      execution_rail <> 'stripe_connect'
      OR execution_status IS DISTINCT FROM 'confirmed'
      OR stripe_transfer_id IS NOT NULL
    );

-- ─── 4. Indexes ──────────────────────────────────────────────────────────────
-- Primary lookup patterns:
--   - Ops dashboard: "external releases awaiting confirmation"
--     WHERE execution_rail = 'external_manual' AND execution_status = 'pending'
--   - Reconciliation:
--     WHERE execution_rail = 'stripe_connect'

CREATE INDEX IF NOT EXISTS releases_rail_status_idx
  ON public.releases (execution_rail, execution_status);

CREATE INDEX IF NOT EXISTS releases_external_pending_idx
  ON public.releases (created_at DESC)
  WHERE execution_rail = 'external_manual' AND execution_status = 'pending';

-- ─── 5. Comments ─────────────────────────────────────────────────────────────

COMMENT ON COLUMN public.releases.execution_rail IS
  'The payment rail used to execute this release. ''stripe_connect'' is the automated rail; ''external_manual'' means a funder/partner executes payment outside Vektrum and Vektrum records confirmation only.';

COMMENT ON COLUMN public.releases.execution_status IS
  'Lifecycle of the execution on the chosen rail. pending = authorised but not yet executed; executing = in flight (Stripe transfer in progress); confirmed = funds moved and evidenced; failed = execution failed; reversed = executed then reversed.';

COMMENT ON COLUMN public.releases.external_payment_method IS
  'For external_manual rail only — the method funder used to execute payment (wire | ach | check | other).';

COMMENT ON COLUMN public.releases.external_payment_reference IS
  'For external_manual rail only — the bank reference, check number, or partner transfer ID provided by the funder to evidence execution.';

COMMENT ON COLUMN public.releases.external_executed_at IS
  'For external_manual rail only — server timestamp at which the funder or admin confirmed external execution in Vektrum. Not the bank settlement time.';

COMMENT ON COLUMN public.releases.external_executed_by IS
  'For external_manual rail only — auth.users id of the actor who confirmed external execution. Typically the funder; admin confirmations additionally write admin_audit_log.';

COMMENT ON COLUMN public.releases.external_execution_notes IS
  'For external_manual rail only — free-form notes captured at confirmation (e.g., bank name, settlement date).';

COMMENT ON COLUMN public.releases.proof_of_payment_document_id IS
  'Optional FK to milestone_documents for an uploaded proof-of-payment attachment (wire confirmation PDF, check image, bank statement screenshot).';

-- =============================================================================
-- End of migration 20260425000000_rail_abstraction.sql
-- =============================================================================
