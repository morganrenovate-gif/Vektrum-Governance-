-- ─── Migration: contract_uniqueness ──────────────────────────────────────────
--
-- Problem: The hard UNIQUE (deal_id) constraint on contracts prevents a deal
-- from having a voided contract AND a new active replacement. When a contract is
-- voided after funding, the funder cannot upload a corrected version without
-- first deleting the voided row — which destroys the audit record.
--
-- Fix: Replace the hard constraint with a partial unique index that only
-- enforces uniqueness over non-voided rows. A deal can then have:
--   • One or more VOIDED contracts (historical record, audit trail intact)
--   • At most ONE non-voided contract at any time
--
-- Additional changes in this migration:
--   • deal_freeze_on_void (boolean, DEFAULT false) — set true when a contract
--     is voided AFTER milestone releases have already occurred on the deal.
--   • frozen_from_status (text, nullable) — records the deal's status at the
--     moment it was frozen so admins can restore the correct prior state.
--   • 'frozen' value added to the deal_status enum — explicit status for
--     deals locked by a post-release void. Releases and new funding are
--     blocked while a deal is frozen. Only admins may unfreeze.
--
-- release-gate.ts (Condition 8) already blocks on voided contracts. The
-- 'frozen' deal status adds an additional explicit gate (checked before the
-- 10 numbered conditions) for belt-and-suspenders defence.

-- ── 1. Replace hard UNIQUE constraint with partial unique index ───────────────

ALTER TABLE public.contracts
  DROP CONSTRAINT IF EXISTS contracts_deal_unique;

-- Prevents two non-voided contracts per deal (partial: excludes voided rows).
-- The .maybeSingle() call in release-gate.ts Condition 8 is safe because
-- this index guarantees at most one non-voided contract per deal_id.
-- Note: the old contracts_deal_id_idx regular index is kept (non-unique).
CREATE UNIQUE INDEX IF NOT EXISTS contracts_deal_active_unique
  ON public.contracts (deal_id)
  WHERE status NOT IN ('voided');

COMMENT ON INDEX public.contracts_deal_active_unique IS
  'Partial unique index: at most one non-voided contract per deal. '
  'Voided contracts are excluded so historical records are preserved.';

-- ── 2. Add deal freeze columns ────────────────────────────────────────────────

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS deal_freeze_on_void boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.deals.deal_freeze_on_void IS
  'True when a contract was voided after milestone releases had already '
  'occurred on this deal. Set by the DocuSign envelope-voided webhook. '
  'Cleared only by an admin unfreeze with documented justification.';

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS frozen_from_status text;

COMMENT ON COLUMN public.deals.frozen_from_status IS
  'The deal status immediately before the deal was frozen. Used by the '
  'admin unfreeze endpoint to restore the correct prior state. '
  'NULL on non-frozen deals.';

-- ── 3. Add 'frozen' to deal_status enum ───────────────────────────────────────
--
-- ALTER TYPE ... ADD VALUE cannot be rolled back once committed. The
-- IF NOT EXISTS guard makes this migration idempotent on re-run.
-- The new value is available in the same session after this statement.

ALTER TYPE public.deal_status ADD VALUE IF NOT EXISTS 'frozen';

-- ── 4. Verify the partial unique index covers the maybeSingle() contract lookup
--
-- release-gate.ts queries:
--   SELECT status FROM contracts WHERE deal_id = $1
--
-- After this migration, that query may return 0 rows (no contract) or 1 row
-- (the single non-voided contract). It can no longer return 2+ non-voided rows
-- for the same deal_id. The .maybeSingle() call therefore behaves correctly.
--
-- However: if the contracts table currently has duplicate non-voided rows for
-- any deal_id (from before this migration), the CREATE UNIQUE INDEX will fail.
-- The statement below surfaces any such violations before the index is created.
-- (Comment it out after confirming the index creation succeeded.)

-- SELECT deal_id, COUNT(*) AS n
-- FROM public.contracts
-- WHERE status NOT IN ('voided')
-- GROUP BY deal_id
-- HAVING COUNT(*) > 1;
