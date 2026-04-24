-- ─── Minimum Fee Floor ───────────────────────────────────────────────────────
--
-- Introduces a $2.50 minimum fee floor in the billing_records_fee_accurate
-- constraint to accommodate small milestone releases where the rate-based fee
-- would otherwise fall below operational overhead.
--
-- Before: ABS(fee_amount - ROUND(gross * bps / 10000, 2)) <= 0.01
-- After:  ABS(fee_amount - GREATEST(ROUND(gross * bps / 10000, 2), 2.50)) <= 0.01
--
-- This mirrors the MINIMUM_FEE = 2.50 constant added to billing.ts in the same
-- release. Existing records are not affected because they were inserted when the
-- old constraint was in force.

ALTER TABLE public.billing_records
  DROP CONSTRAINT IF EXISTS billing_records_fee_accurate;

ALTER TABLE public.billing_records
  ADD CONSTRAINT billing_records_fee_accurate CHECK (
    ABS(
      fee_amount
      - GREATEST(ROUND(gross_amount * billing_rate_bps / 10000.0, 2), 2.50)
    ) <= 0.01
  );

COMMENT ON CONSTRAINT billing_records_fee_accurate ON public.billing_records IS
  'Validates fee_amount against the rate-based calculation with a $2.50 minimum '
  'fee floor. Allows ±$0.01 for rounding tolerance. Mirrors calculateFee() in '
  'src/lib/engine/billing.ts — keep these in sync.';
