-- ─── Minimum Fee Floor Correction ────────────────────────────────────────────
--
-- PROBLEM
-- -------
-- Migration 20260424000009_minimum_fee_floor.sql introduced a $2.50 minimum fee
-- floor in the billing_records_fee_accurate constraint. However, MINIMUM_FEE in
-- src/lib/engine/billing.ts was subsequently raised to $50.00 to cover
-- operational overhead and match the public pricing page. The DB constraint was
-- not updated at the same time.
--
-- This creates a dangerous divergence: the code always writes fee_amount >= $50
-- but the constraint only requires fee_amount >= $2.50. Any milestone release
-- between $250 and $5,000 at the 1% Standalone rate would produce a fee_amount
-- of $2.50–$50, passing the $2.50 constraint but contradicting the pricing page
-- and billing.ts intent.
--
-- FIX
-- ---
-- Update the constraint floor from 2.50 to 50.00 to match MINIMUM_FEE in code.
-- This is a tightening (not a relaxation), so all previously-inserted records
-- that were computed with the $50 floor already satisfy the new constraint.
-- Any record that was accidentally inserted with fee_amount < $50 would have
-- been a bug (the application always applies the $50 floor), so tightening
-- here surfaces, rather than hides, any such records.

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
  'fee floor. Allows ±$0.01 for rounding tolerance. Mirrors MINIMUM_FEE = 50 in '
  'src/lib/engine/billing.ts — keep these in sync. '
  'Corrected from $2.50 floor (migration 20260424000009) to $50.00 to match '
  'the public pricing page and the billing engine constant.';
