-- =============================================================================
-- Vektrum — Migration 010: Billing System
--
-- Adds per-deal billing rates, fee tracking, and an immutable billing_records
-- table that captures gross / fee / net for every milestone release.
--
-- Billing model:
--   - Platform charges the FUNDER a % fee on each milestone release.
--   - The fee is charged ON TOP of the milestone amount — contractor always
--     receives the full gross milestone value.
--   - Fee stays in the Vektrum platform Stripe account; billing_records is
--     the authoritative ledger.
--
-- Supported rates (billing_rate_bps):
--   100 bps = 1.00% — Standalone tier   (self-service, no retainer)
--    70 bps = 0.70% — Institutional tier (retainer applies)
--    65 bps = 0.65% — Enterprise tier    (negotiated annually)
-- =============================================================================


-- ── Step 1: Add billing columns to deals ─────────────────────────────────────

ALTER TABLE public.deals
  ADD COLUMN billing_rate_bps integer        NOT NULL DEFAULT 100,
  ADD COLUMN fees_collected    numeric(12, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.deals.billing_rate_bps IS
  'Vektrum platform fee rate in basis points. 100 = 1.00%, 70 = 0.70%, 65 = 0.65%. '
  'Set at deal creation from the funder''s plan. Immutable after first release.';

COMMENT ON COLUMN public.deals.fees_collected IS
  'Cumulative Vektrum platform fees charged to the funder across all released milestones. '
  'Incremented atomically alongside released_amount via increment_deal_financials().';

-- Validate rate is one of the three supported tiers
ALTER TABLE public.deals
  ADD CONSTRAINT deals_billing_rate_valid
  CHECK (billing_rate_bps IN (65, 70, 100));


-- ── Step 2: Relax funded_amount constraint ────────────────────────────────────
--
-- Previously: funded_amount <= total_amount
--   Problem: funders must deposit milestone amounts + platform fees.
--            Requiring funded <= total blocks them from depositing enough.
--
-- New model: funded_amount has no ceiling (just non-negative).
--   The real guard is: released_amount + fees_collected <= funded_amount.

ALTER TABLE public.deals
  DROP CONSTRAINT deals_funded_lte_total;

ALTER TABLE public.deals
  ADD CONSTRAINT deals_funded_non_negative
  CHECK (funded_amount >= 0);


-- ── Step 3: Update released_lte_funded to include fees ───────────────────────
--
-- Previously: released_amount <= funded_amount
-- Now:        released_amount + fees_collected <= funded_amount
--
-- This enforces that the platform never disburses more than the funder
-- has deposited, accounting for both contractor payouts and platform fees.

ALTER TABLE public.deals
  DROP CONSTRAINT deals_released_lte_funded;

ALTER TABLE public.deals
  ADD CONSTRAINT deals_financial_consistency
  CHECK (
    released_amount  >= 0
    AND fees_collected   >= 0
    AND (released_amount + fees_collected) <= funded_amount
  );


-- ── Step 4: billing_records table ────────────────────────────────────────────
--
-- Immutable. One row per milestone release.
-- NO UPDATE or DELETE policies are ever created for this table.

CREATE TABLE public.billing_records (
  id                 uuid           NOT NULL DEFAULT gen_random_uuid(),
  deal_id            uuid           NOT NULL REFERENCES public.deals(id)      ON DELETE RESTRICT,
  milestone_id       uuid           NOT NULL REFERENCES public.milestones(id) ON DELETE RESTRICT,
  release_id         uuid           NOT NULL REFERENCES public.releases(id)   ON DELETE RESTRICT,
  funder_id          uuid           NOT NULL REFERENCES public.profiles(id)   ON DELETE RESTRICT,

  -- Financial amounts — all in USD
  gross_amount       numeric(12, 2) NOT NULL,  -- milestone.amount (contract value)
  billing_rate_bps   integer        NOT NULL,  -- rate applied at time of release (historical record)
  fee_amount         numeric(12, 2) NOT NULL,  -- platform fee charged to funder
  net_amount         numeric(12, 2) NOT NULL,  -- contractor payout (= gross_amount)

  -- Stripe reference — links this billing record to the concrete Stripe transfer
  stripe_transfer_id text           NOT NULL,

  created_at         timestamptz    NOT NULL DEFAULT now(),

  CONSTRAINT billing_records_pkey               PRIMARY KEY (id),
  -- One billing record per milestone (mirrors releases.milestone_unique)
  CONSTRAINT billing_records_milestone_unique   UNIQUE (milestone_id),
  -- One billing record per release
  CONSTRAINT billing_records_release_unique     UNIQUE (release_id),
  -- Supported rates only — enforces no arbitrary rate was applied
  CONSTRAINT billing_records_rate_valid         CHECK (billing_rate_bps IN (65, 70, 100)),
  -- Amounts must be positive
  CONSTRAINT billing_records_gross_positive     CHECK (gross_amount > 0),
  CONSTRAINT billing_records_fee_non_negative   CHECK (fee_amount >= 0),
  CONSTRAINT billing_records_net_positive       CHECK (net_amount > 0),
  -- Fee must equal gross * rate / 10000, rounded to 2 decimal places.
  -- Allows ±0.01 for rounding tolerance.
  CONSTRAINT billing_records_fee_accurate       CHECK (
    ABS(fee_amount - ROUND(gross_amount * billing_rate_bps / 10000.0, 2)) <= 0.01
  )
);

COMMENT ON TABLE  public.billing_records IS
  'Immutable per-milestone billing records. No update or delete permitted. '
  'One row is created for every successful milestone release.';
COMMENT ON COLUMN public.billing_records.gross_amount IS
  'Milestone amount — the full contract value released to the contractor.';
COMMENT ON COLUMN public.billing_records.fee_amount IS
  'Vektrum platform fee charged to the funder on top of the gross amount.';
COMMENT ON COLUMN public.billing_records.net_amount IS
  'Contractor payout. Always equals gross_amount — contractors are never charged.';
COMMENT ON COLUMN public.billing_records.billing_rate_bps IS
  'Rate applied at the time of this release. Immutable historical record — '
  'reflects the deal''s plan at the moment of disbursement.';
COMMENT ON COLUMN public.billing_records.stripe_transfer_id IS
  'Stripe transfer ID for the contractor payout. Links this fee record to '
  'the specific Stripe transfer it was assessed on.';

-- Indexes
CREATE INDEX billing_records_deal_id_idx    ON public.billing_records (deal_id);
CREATE INDEX billing_records_funder_id_idx  ON public.billing_records (funder_id);
CREATE INDEX billing_records_created_at_idx ON public.billing_records (created_at DESC);


-- ── Step 5: RLS for billing_records ──────────────────────────────────────────

ALTER TABLE public.billing_records ENABLE ROW LEVEL SECURITY;

-- Funders see billing records for their deals.
-- Contractors see billing records for their deals (for transparency).
-- Admins see all.
CREATE POLICY "billing_records_select"
  ON public.billing_records
  FOR SELECT
  USING (public.is_deal_participant(deal_id) OR public.is_admin());

-- Only the service role (admin client) may insert.
-- The release route uses createSupabaseAdminClient() for this insert.
CREATE POLICY "billing_records_insert_service_only"
  ON public.billing_records
  FOR INSERT
  WITH CHECK (false);

-- *** No UPDATE policy ***
-- *** No DELETE policy ***
-- Billing records are immutable by design.


-- ── Step 6: Replace increment_deal_released_amount with increment_deal_financials
--
-- The old function only incremented released_amount.
-- The new function atomically increments both released_amount and fees_collected.
-- The old function is kept for backwards compatibility but marked deprecated.

CREATE OR REPLACE FUNCTION public.increment_deal_financials(
  p_deal_id         uuid,
  p_released_amount numeric,
  p_fee_amount      numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.deals
  SET
    released_amount = released_amount + p_released_amount,
    fees_collected  = fees_collected  + p_fee_amount,
    updated_at      = now()
  WHERE id = p_deal_id
    -- Enforce financial consistency atomically in a single guarded write.
    -- This prevents the ledger from going negative or exceeding funded_amount,
    -- even under concurrent release attempts.
    AND (released_amount + p_released_amount + fees_collected + p_fee_amount) <= funded_amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Deal % financials could not be updated: '
      'either the deal does not exist or releasing $% with fee $% '
      'would exceed the funded balance.',
      p_deal_id, p_released_amount, p_fee_amount;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.increment_deal_financials(uuid, numeric, numeric) IS
  'Atomically increments released_amount by p_released_amount and '
  'fees_collected by p_fee_amount on a deal. '
  'Guards against exceeding the funded balance. '
  'Used exclusively by the release route. '
  'Replaces increment_deal_released_amount for billing-aware releases.';


-- ── Step 7: Audit trigger for billing_records ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.audit_billing_records()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_log (
    entity_type, entity_id, action,
    actor_id,
    old_values,  new_values,
    metadata
  )
  VALUES (
    'billing_record',
    NEW.id,
    'fee_collected',
    auth.uid(),
    NULL,
    to_jsonb(NEW),
    jsonb_build_object(
      'trigger',            tg_name,
      'deal_id',            NEW.deal_id,
      'milestone_id',       NEW.milestone_id,
      'release_id',         NEW.release_id,
      'funder_id',          NEW.funder_id,
      'gross_amount',       NEW.gross_amount,
      'fee_amount',         NEW.fee_amount,
      'billing_rate_bps',   NEW.billing_rate_bps,
      'stripe_transfer_id', NEW.stripe_transfer_id
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_billing_records
  AFTER INSERT ON public.billing_records
  FOR EACH ROW EXECUTE FUNCTION public.audit_billing_records();
