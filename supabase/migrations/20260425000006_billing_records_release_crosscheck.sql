-- =============================================================================
-- 20260425000006_billing_records_release_crosscheck.sql
-- Cross-check billing_records.gross_amount against its authoritative source.
--
-- PROBLEM
-- -------
-- billing_records.gross_amount is supplied by application code when inserting
-- a billing record. The billing_records_fee_accurate constraint validates
-- internal consistency (fee = GREATEST(gross * rate, 50)), but it trusts
-- the application-supplied gross_amount.
--
-- A service_role caller (e.g., a future code path or direct SQL) could supply
-- an underreported gross_amount that still satisfies the constraint. The fee
-- would be computed correctly relative to the fake gross, but the platform
-- would under-collect relative to the real milestone amount.
--
-- SOLUTION
-- --------
-- A BEFORE INSERT trigger on billing_records reads the authoritative amount
-- from the associated release row and:
--   1. Overwrites gross_amount with releases.amount (cannot be underreported).
--   2. Recomputes fee_amount using GREATEST(ROUND(gross * rate/10000, 2), 50.00).
--   3. Recomputes net_amount as gross - retainage_amount.
--
-- Application code can no longer influence gross_amount or fee_amount by
-- supplying values — they are always derived from releases.amount at insert time.
--
-- WHICH COLUMNS ARE ENFORCED?
--   gross_amount  — overwritten from releases.amount
--   fee_amount    — recomputed from gross × billing_rate_bps with $50 floor
--   net_amount    — gross − retainage_amount (retainage stays as supplied)
--
-- billing_rate_bps is taken from the billing_records row itself (supplied by
-- application code) because the deal's rate can change over its lifetime.
-- The trigger does NOT override billing_rate_bps — callers are trusted to
-- supply the correct deal rate. The billing_rate_bps CHECK constraint on the
-- column (65|70|100) prevents invalid values.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enforce_billing_record_amounts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_release_amount   NUMERIC;
  v_fee_calculated   NUMERIC;
BEGIN
  -- ── Read authoritative gross_amount from the release row ──────────────────
  SELECT amount
  INTO   v_release_amount
  FROM   public.releases
  WHERE  id = NEW.release_id;

  IF NOT FOUND OR v_release_amount IS NULL THEN
    RAISE EXCEPTION
      'billing_records: release_id % not found or has NULL amount. '
      'Cannot derive authoritative gross_amount.',
      NEW.release_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_release_amount <= 0 THEN
    RAISE EXCEPTION
      'billing_records: release % has amount = %. gross_amount must be > 0.',
      NEW.release_id, v_release_amount
      USING ERRCODE = 'check_violation';
  END IF;

  -- ── Override gross_amount with canonical release amount ───────────────────
  NEW.gross_amount := v_release_amount;

  -- ── Recompute fee_amount: GREATEST(ROUND(gross × bps / 10000, 2), 50.00) ──
  v_fee_calculated := ROUND(NEW.gross_amount * NEW.billing_rate_bps / 10000.0, 2);
  NEW.fee_amount   := GREATEST(v_fee_calculated, 50.00);

  -- ── Recompute net_amount = gross − retainage ──────────────────────────────
  NEW.net_amount := NEW.gross_amount - COALESCE(NEW.retainage_amount, 0);

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_billing_record_amounts() IS
  'BEFORE INSERT trigger on billing_records. Overwrites gross_amount with '
  'releases.amount (the authoritative source), recomputes fee_amount as '
  'GREATEST(ROUND(gross * billing_rate_bps / 10000, 2), 50.00), and recomputes '
  'net_amount = gross - retainage_amount. Prevents application code from '
  'underreporting gross_amount to reduce the platform fee.';

DROP TRIGGER IF EXISTS billing_records_enforce_amounts ON public.billing_records;
CREATE TRIGGER billing_records_enforce_amounts
  BEFORE INSERT ON public.billing_records
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_billing_record_amounts();

COMMENT ON TRIGGER billing_records_enforce_amounts ON public.billing_records IS
  'Fires BEFORE INSERT to derive gross_amount from releases.amount and recompute '
  'fee_amount and net_amount. Application-supplied values for these three columns '
  'are discarded.';
