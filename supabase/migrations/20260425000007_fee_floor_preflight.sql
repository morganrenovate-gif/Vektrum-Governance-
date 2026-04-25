-- =============================================================================
-- Migration 20260425000007 — $50 minimum fee floor: pre-flight check +
--                             constraint re-statement
--
-- CONTEXT
-- -------
-- Migration 20260424000009 introduced a $2.50 minimum fee floor.
-- Migration 20260425000002 updated the constraint expression to 50.00 to match
-- the MINIMUM_FEE = 50 constant in src/lib/engine/billing.ts, but it did not
-- include a diagnostic pre-flight check. If any billing_records rows had
-- fee_amount below $50 the error would surface as a generic Postgres constraint
-- violation, not an actionable message.
--
-- This migration adds the missing safety net:
--   1. A DO block that scans billing_records for rows that would violate the
--      $50 constraint, and raises a clear exception with row IDs if any are found.
--      On a clean database (where 000002 applied successfully) this is a no-op.
--   2. Re-states the $50 constraint using DROP IF EXISTS / ADD CONSTRAINT, which
--      is idempotent with 000002 and acts as the canonical on-disk definition.
--
-- POLICY ON VIOLATING ROWS
-- ------------------------
-- Prefer raising, not silently updating, per audit policy: fee_amount is
-- financial data and any value below $50 (but above $2.50) means the record was
-- inserted during the brief window between MINIMUM_FEE being raised to $50 in
-- code (billing.ts) and this constraint being tightened in the database. Such
-- records require manual reconciliation — they may represent under-collected fees
-- that need to be invoiced separately.
--
-- If this migration fails, inspect:
--   SELECT id, release_id, gross_amount, billing_rate_bps, fee_amount,
--          GREATEST(ROUND(gross_amount * billing_rate_bps / 10000.0, 2), 50.00) AS expected_fee
--   FROM   billing_records
--   WHERE  ABS(fee_amount
--            - GREATEST(ROUND(gross_amount * billing_rate_bps / 10000.0, 2), 50.00)
--          ) > 0.01;
-- =============================================================================


-- ─── Step 1: Pre-flight check ─────────────────────────────────────────────────
--
-- Raises an exception if any billing_records row fails the $50 constraint
-- formula. On a correctly migrated database this always passes.

DO $$
DECLARE
  v_count   INTEGER;
  v_ids     TEXT;
  v_sample  RECORD;
BEGIN
  -- Count rows that would violate the $50 constraint.
  SELECT COUNT(*)
  INTO   v_count
  FROM   public.billing_records
  WHERE  ABS(
           fee_amount
           - GREATEST(ROUND(gross_amount * billing_rate_bps / 10000.0, 2), 50.00)
         ) > 0.01;

  IF v_count = 0 THEN
    -- All rows satisfy the $50 floor — safe to proceed.
    RETURN;
  END IF;

  -- Build a comma-separated sample of up to 10 violating IDs for diagnostics.
  SELECT string_agg(id::text, ', ' ORDER BY created_at)
  INTO   v_ids
  FROM  (
    SELECT id, created_at
    FROM   public.billing_records
    WHERE  ABS(
             fee_amount
             - GREATEST(ROUND(gross_amount * billing_rate_bps / 10000.0, 2), 50.00)
           ) > 0.01
    ORDER  BY created_at
    LIMIT  10
  ) sub;

  RAISE EXCEPTION
    E'Fee floor pre-flight failed: % billing_record row(s) have fee_amount that '
    'does not satisfy the $50.00 minimum fee constraint.\n'
    '\n'
    'These records were likely inserted during the window between MINIMUM_FEE '
    'being raised to $50 in billing.ts and the DB constraint being tightened. '
    'They may represent under-collected fees that require manual reconciliation '
    'before this migration can proceed.\n'
    '\n'
    'Violating row IDs (up to 10): %\n'
    '\n'
    'To inspect: SELECT id, release_id, gross_amount, billing_rate_bps, fee_amount, '
    'GREATEST(ROUND(gross_amount * billing_rate_bps / 10000.0, 2), 50.00) AS expected_fee '
    'FROM billing_records WHERE ABS(fee_amount - GREATEST(ROUND(gross_amount * billing_rate_bps / 10000.0, 2), 50.00)) > 0.01;',
    v_count,
    v_ids
    USING ERRCODE = 'check_violation';
END;
$$;


-- ─── Step 2: Re-state the $50 constraint (idempotent with 000002) ─────────────
--
-- The DROP IF EXISTS ensures this runs cleanly whether 000002 was applied or not.
-- The formula is identical to 000002 and to the BEFORE INSERT trigger added in
-- 000006 (enforce_billing_record_amounts), keeping all three enforcement layers
-- in sync.
--
-- Tolerance: ±$0.01 for rounding differences between PostgreSQL ROUND() and
-- JavaScript Math.round() on fractional-cent amounts.

ALTER TABLE public.billing_records
  DROP CONSTRAINT IF EXISTS billing_records_fee_accurate;

ALTER TABLE public.billing_records
  ADD CONSTRAINT billing_records_fee_accurate CHECK (
    ABS(
      fee_amount
      - GREATEST(ROUND(gross_amount * billing_rate_bps / 10000.0, 2), 50.00)
    ) <= 0.01
  );

COMMENT ON CONSTRAINT billing_records_fee_accurate ON public.billing_records IS
  'Validates fee_amount against the rate-based calculation with a $50.00 minimum '
  'fee floor. Allows ±$0.01 for rounding tolerance. '
  'Formula: ABS(fee_amount - GREATEST(ROUND(gross × bps / 10000, 2), 50.00)) <= 0.01 '
  'Mirrors MINIMUM_FEE = 50 in src/lib/engine/billing.ts and the '
  'enforce_billing_record_amounts() BEFORE INSERT trigger (migration 000006). '
  'Keep all three in sync. '
  'History: $2.50 floor (migration 20260424000009) → $50.00 (migration 20260425000002) '
  '→ pre-flight check added (this migration, 20260425000007).';


-- =============================================================================
-- End of migration 20260425000007_fee_floor_preflight.sql
-- =============================================================================
