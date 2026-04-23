-- 20260423000004_governance_fee_model.sql
--
-- Introduces the Governance Fee Model — an additive presentation layer that
-- frames the platform fee as a funder-paid governance cost on top of the
-- construction budget, rather than something deducted from project funds.
--
-- ─── PHILOSOPHY ───────────────────────────────────────────────────────────────
--
-- Previous framing: "Vektrum charges a fee on each milestone release."
-- New framing:      "The funder deposits a facility that consists of:
--                       Construction Budget  (what contractors are paid)
--                     + Governance Layer     (Vektrum fee for oversight / compliance)
--                     = Total Facility Size"
--
-- The financial behavior is UNCHANGED:
--   - Contractor receives the full milestone.amount (gross) — no deduction.
--   - Stripe transfer amount = milestone.amount (no change).
--   - billing_rate_bps, fees_collected, released_amount all remain and still
--     drive the actual release / reconciliation logic.
--
-- These new columns are ADDITIVE — informational fields that give the funder a
-- clearer picture of the total facility commitment they are making.
--
-- ─── BACKWARD COMPATIBILITY ───────────────────────────────────────────────────
--
-- All four new deal columns are nullable. Existing rows default to NULL, and
-- the application layer renders the legacy financial view when NULL. New deals
-- created after this migration get all four fields populated at creation and
-- updated at funding time with the funder's actual tier rate.
--
-- billing_records.billing_source is nullable. Existing rows get NULL (treated
-- as 'legacy' by the application). New records created after this migration
-- receive 'governance_layer'.

-- ─── deals: governance fee columns ────────────────────────────────────────────

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS construction_budget  NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS governance_fee_bps   INTEGER,
  ADD COLUMN IF NOT EXISTS governance_fee_total NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS facility_total       NUMERIC(12, 2);

COMMENT ON COLUMN public.deals.construction_budget IS
  'The total contract value committed to contractor disbursements. '
  'Mirrors total_amount for new deals. NULL on deals created before migration 004.';

COMMENT ON COLUMN public.deals.governance_fee_bps IS
  'Governance fee rate in basis points applied to this deal. '
  'Mirrors billing_rate_bps under the governance model terminology. '
  'Set at deal creation (default STANDALONE = 100 bps) and updated at '
  'first funding to the funder''s actual subscription tier rate. '
  'NULL on deals created before migration 004.';

COMMENT ON COLUMN public.deals.governance_fee_total IS
  'Total governance fee owed for the full deal life: '
  'ROUND(construction_budget * governance_fee_bps / 10000, 2). '
  'Represents the funder''s governance commitment across all milestones. '
  'NULL on deals created before migration 004.';

COMMENT ON COLUMN public.deals.facility_total IS
  'Total funding facility required from the funder: '
  'construction_budget + governance_fee_total. '
  'This is the full financial commitment including the governance layer. '
  'NULL on deals created before migration 004.';

-- ─── Integrity constraints ────────────────────────────────────────────────────

-- When all three governance amount fields are set, facility_total must equal
-- construction_budget + governance_fee_total (within ±$0.01 rounding tolerance).
ALTER TABLE public.deals
  ADD CONSTRAINT deals_facility_total_consistent CHECK (
    facility_total       IS NULL
    OR governance_fee_total IS NULL
    OR construction_budget  IS NULL
    OR ABS(facility_total - (construction_budget + governance_fee_total)) <= 0.01
  );

-- governance_fee_bps must be one of the three supported tier rates when set.
ALTER TABLE public.deals
  ADD CONSTRAINT deals_governance_fee_bps_valid CHECK (
    governance_fee_bps IS NULL
    OR governance_fee_bps IN (65, 70, 100)
  );

-- ─── billing_records: billing_source column ───────────────────────────────────
--
-- Flags whether this billing record was created under the governance fee model
-- or under the legacy implicit-fee model. Allows reporting and auditing to
-- distinguish historical records from governance-model records.

ALTER TABLE public.billing_records
  ADD COLUMN IF NOT EXISTS billing_source TEXT;

ALTER TABLE public.billing_records
  ADD CONSTRAINT billing_records_billing_source_valid CHECK (
    billing_source IS NULL
    OR billing_source IN ('governance_layer', 'legacy')
  );

COMMENT ON COLUMN public.billing_records.billing_source IS
  'Indicates the billing model under which this record was created. '
  'governance_layer — created after migration 004; fee is a funder-paid '
  '  governance overlay on top of the construction budget. '
  'legacy — created before migration 004 (implicit fee model). '
  'NULL — equivalent to ''legacy''; present on records created before this migration.';

-- ─── Index: governance reporting ─────────────────────────────────────────────
--
-- Allows efficient aggregation of governance fees across a portfolio by filtering
-- on billing_source = 'governance_layer'.
CREATE INDEX IF NOT EXISTS billing_records_billing_source_idx
  ON public.billing_records (billing_source)
  WHERE billing_source IS NOT NULL;

COMMENT ON INDEX public.billing_records_billing_source_idx IS
  'Enables efficient portfolio-level governance fee aggregation.';
