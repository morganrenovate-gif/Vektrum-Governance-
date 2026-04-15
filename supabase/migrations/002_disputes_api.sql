-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 002: Dispute isolation support
--
-- What this does:
--   1. Confirms the protection_status enum has 'disputed' (already in 001, this
--      is a safety check — Postgres will no-op if the value already exists).
--   2. Adds a partial index so dispute lookups by milestone are fast.
--   3. Adds a constraint: only one OPEN dispute per milestone at a time.
--      (Resolved disputes are allowed to accumulate for the audit trail.)
--
-- Run this in Supabase SQL Editor after deploying the new API routes.
-- ─────────────────────────────────────────────────────────────────────────────

-- Safety check: ensure 'disputed' is in the protection_status enum.
-- If it's already there (from migration 001) this is a no-op on supported PG versions.
-- On older versions, manually verify via: SELECT enum_range(NULL::protection_status);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'protection_status'
      AND e.enumlabel = 'disputed'
  ) THEN
    ALTER TYPE public.protection_status ADD VALUE 'disputed';
  END IF;
END;
$$;

-- Partial unique index: only one open dispute allowed per milestone at a time.
-- Resolved and escalated disputes do not count against this constraint.
CREATE UNIQUE INDEX IF NOT EXISTS disputes_one_open_per_milestone
  ON public.disputes (milestone_id)
  WHERE status = 'open';

-- Index for fast lookup of all open disputes (admin dashboard use case)
CREATE INDEX IF NOT EXISTS disputes_open_status_idx
  ON public.disputes (status)
  WHERE status = 'open';

-- Confirm the audit_log entity_type check includes 'dispute' (should already be in 001)
-- If not, add it:
-- ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_entity_type_check;
-- ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_entity_type_check
--   CHECK (entity_type IN ('deal', 'milestone', 'release', 'change_order', 'dispute'));
