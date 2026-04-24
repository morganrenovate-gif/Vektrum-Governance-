-- 20260424000006_retainage.sql
--
-- Adds a configurable retainage mechanism for institutional construction lending.
--
-- ─── WHY RETAINAGE ───────────────────────────────────────────────────────────────
--
-- Industry standard: withhold 5-10% of each milestone disbursement until the
-- project reaches substantial completion (deal status = 'completed'). The withheld
-- retainage is then released to the contractor in a single lump sum.
--
-- This is a blocking requirement for institutional lenders — most state lien laws
-- and AIA contract forms specify retainage. Without it, Vektrum cannot serve
-- institutional draw management use-cases.
--
-- ─── ACCOUNTING MODEL ────────────────────────────────────────────────────────────
--
-- retainage_percentage (deal, 0–<100, default 0) — set at deal creation, locked
--   after first funding.
--
-- Per milestone release:
--   gross = milestone.amount
--   fee   = ROUND(gross × billing_rate_bps / 10000, 2)
--   ret   = ROUND(gross × retainage_percentage / 100, 2)
--   net_to_contractor = gross - ret
--   Stripe transfer   = net_to_contractor  (contractor receives net immediately)
--   Platform fee      = fee (retained in Vektrum platform Stripe account)
--
-- Deal-level accumulators:
--   retainage_held     — currently withheld, not yet released (decrements on release)
--   retainage_released — cumulative released to contractor (monotone increasing)
--
-- ─── INVARIANT ───────────────────────────────────────────────────────────────────
--
--   released_amount + fees_collected + reserved_amount + retainage_held <= funded_amount
--
-- Both increment_deal_financials and increment_deal_retainage preserve this invariant
-- because each one converts reserved_amount → another confirmed column with no net
-- change to the left-hand side sum:
--
--   After increment_deal_financials(net, fee):
--     +net +fee -(net+fee) [reserved] = 0 ✓
--
--   After increment_deal_retainage(ret):
--     +ret [retainage_held] -ret [reserved] = 0 ✓
--
--   After increment_deal_retainage_released(amount):
--     +amount [released_amount] -amount [retainage_held] = 0 ✓
--


-- ─── Step 1: Add retainage columns to deals ────────────────────────────────────

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS retainage_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0
    CONSTRAINT deals_retainage_pct_range CHECK (retainage_percentage >= 0 AND retainage_percentage < 100);

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS retainage_held NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS retainage_released NUMERIC(12, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.deals.retainage_percentage IS
  'Percentage of each milestone gross amount to withhold until project completion. '
  'Range: 0 to <100. Default 0 (no retainage). Locked after first funding event. '
  'Industry standard: 5-10% for institutional construction lending.';

COMMENT ON COLUMN public.deals.retainage_held IS
  'Cumulative retainage currently withheld from the contractor — sum of all '
  'milestones'' retainage_amount values for released milestones, minus any '
  'retainage subsequently released to the contractor. '
  'Decrements when the funder releases retainage via POST .../retainage/release. '
  'Part of the funded balance: funder must fund gross + fee + retainage.';

COMMENT ON COLUMN public.deals.retainage_released IS
  'Cumulative retainage paid out to the contractor (monotonically increasing). '
  'Incremented by increment_deal_retainage_released() when the funder releases '
  'the held retainage balance. Does NOT decrement — use retainage_held for the '
  'current outstanding balance.';


-- ─── Step 2: Add retainage_amount to milestones ────────────────────────────────

ALTER TABLE public.milestones
  ADD COLUMN IF NOT EXISTS retainage_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.milestones.retainage_amount IS
  'Dollar amount withheld from this milestone release as retainage. '
  'Computed at release time: ROUND(amount × deal.retainage_percentage / 100, 2). '
  'Zero when the deal has no retainage (retainage_percentage = 0). '
  'The contractor received (amount - retainage_amount) via Stripe at release time.';


-- ─── Step 3: Add retainage_amount to billing_records ──────────────────────────

ALTER TABLE public.billing_records
  ADD COLUMN IF NOT EXISTS retainage_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.billing_records.retainage_amount IS
  'Retainage withheld from this milestone release. Mirrors milestones.retainage_amount. '
  'Stored here for immutable billing audit trail — net_amount = gross_amount - retainage_amount. '
  'Zero on pre-retainage records (created before migration 20260424000006).';


-- ─── Step 4: Create retainage_releases table ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.retainage_releases (
  id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id             uuid         NOT NULL REFERENCES public.deals(id) ON DELETE RESTRICT,
  amount              NUMERIC(12, 2) NOT NULL,
  stripe_transfer_id  text,
  idempotency_key     text         UNIQUE,
  released_by         uuid         NOT NULL REFERENCES public.profiles(id),
  notes               text,
  created_at          timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT retainage_releases_amount_positive CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS retainage_releases_deal_id_idx
  ON public.retainage_releases(deal_id);

COMMENT ON TABLE public.retainage_releases IS
  'Immutable records of retainage released to the contractor by the funder. '
  'Each row represents one retainage disbursement event. '
  'Multiple partial releases are permitted (funder may release retainage incrementally).';

-- RLS
ALTER TABLE public.retainage_releases ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "admin_all_retainage_releases" ON public.retainage_releases
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Funder: read own deal retainage releases; insert is done via service role only
CREATE POLICY "funder_read_retainage_releases" ON public.retainage_releases
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deals
      WHERE id = retainage_releases.deal_id
        AND funder_id = auth.uid()
    )
  );

-- Contractor: read retainage releases for their deals
CREATE POLICY "contractor_read_retainage_releases" ON public.retainage_releases
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deals
      WHERE id = retainage_releases.deal_id
        AND contractor_id = auth.uid()
    )
  );


-- ─── Step 5: Update deals_financial_consistency constraint ────────────────────
--
-- Previous: released_amount + fees_collected + reserved_amount <= funded_amount
-- Updated:  released_amount + fees_collected + reserved_amount + retainage_held <= funded_amount
--
-- retainage_held represents funds that have physically left the general pool
-- (the contractor would have received them if not for retainage), so they must
-- be accounted for in the funded-balance constraint.

ALTER TABLE public.deals
  DROP CONSTRAINT IF EXISTS deals_financial_consistency;

ALTER TABLE public.deals
  ADD CONSTRAINT deals_financial_consistency CHECK (
    released_amount   >= 0
    AND fees_collected    >= 0
    AND reserved_amount   >= 0
    AND retainage_held    >= 0
    AND retainage_released >= 0
    AND (released_amount + fees_collected + reserved_amount + retainage_held) <= funded_amount
  );


-- ─── Step 6: Update reserve_release_funds ─────────────────────────────────────
--
-- Subtracts retainage_held from the available balance calculation.
-- retainage_held represents funds already committed to the contractor (withheld,
-- not yet released) — they must not be double-counted as available for new releases.

DROP FUNCTION IF EXISTS public.reserve_release_funds(uuid, numeric, numeric);

CREATE FUNCTION public.reserve_release_funds(
  p_deal_id  uuid,
  p_gross    numeric,
  p_fee      numeric
)
RETURNS TABLE(ok boolean, available numeric, required numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available numeric;
  v_required  numeric := p_gross + p_fee;
BEGIN
  -- Lock the deal row for the duration of this transaction.
  -- NOWAIT: if another release is in progress, fail immediately (55P03).
  SELECT (funded_amount - released_amount - fees_collected - reserved_amount - retainage_held)
  INTO   v_available
  FROM   public.deals
  WHERE  id = p_deal_id
  FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0::numeric, v_required;
    RETURN;
  END IF;

  IF v_available < v_required THEN
    RETURN QUERY SELECT false, v_available, v_required;
    RETURN;
  END IF;

  UPDATE public.deals
  SET    reserved_amount = reserved_amount + v_required,
         updated_at      = now()
  WHERE  id = p_deal_id;

  RETURN QUERY SELECT true, v_available, v_required;
END;
$$;

COMMENT ON FUNCTION public.reserve_release_funds(uuid, numeric, numeric) IS
  'Atomically checks available funded balance (net of reserved and held retainage) '
  'and reserves p_gross + p_fee for an in-flight milestone release. '
  'Uses SELECT FOR UPDATE NOWAIT for mutual exclusion. '
  'Must be called BEFORE the Stripe transfer. '
  'Available = funded - released - fees_collected - reserved - retainage_held.';


-- ─── Step 7: Update increment_deal_financials ────────────────────────────────
--
-- With retainage, p_released_amount is net_to_contractor (gross - retainage),
-- not the full gross. The safety-net WHERE clause is updated to include
-- retainage_held so it correctly reflects the full funded-balance constraint.

DROP FUNCTION IF EXISTS public.increment_deal_financials(uuid, numeric, numeric);

CREATE FUNCTION public.increment_deal_financials(
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
    -- Convert the reservation: net + fee confirmed, retainage portion stays in reserved
    -- until increment_deal_retainage() moves it to retainage_held.
    reserved_amount = GREATEST(0, reserved_amount - (p_released_amount + p_fee_amount)),
    updated_at      = now()
  WHERE  id = p_deal_id
    -- Safety net: ensure the new confirmed totals + retainage do not exceed funded_amount.
    -- Should never fire under normal operation because reserve_release_funds already
    -- validated the balance (including retainage_held) before Stripe was called.
    AND (released_amount + p_released_amount + fees_collected + p_fee_amount + retainage_held) <= funded_amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Deal % financials could not be updated: '
      'either the deal does not exist or releasing $% with fee $% '
      'would exceed the funded balance (accounting for retainage).',
      p_deal_id, p_released_amount, p_fee_amount;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.increment_deal_financials(uuid, numeric, numeric) IS
  'Atomically increments released_amount by p_released_amount (net_to_contractor) '
  'and fees_collected by p_fee_amount, and decrements reserved_amount by the same '
  'total (converting that portion of the prior reservation to confirmed state). '
  'The retainage portion of the reservation remains in reserved_amount until '
  'increment_deal_retainage() moves it to retainage_held. '
  'Guards against exceeding the funded balance including retainage_held.';


-- ─── Step 8: New RPC — increment_deal_retainage ───────────────────────────────
--
-- Called immediately after increment_deal_financials() during a milestone release.
-- Moves the retainage portion from reserved_amount into retainage_held, completing
-- the conversion of the full reservation (net + fee + retainage).
--
-- After both RPCs complete:
--   reserved_amount decremented by: (net + fee) + retainage = gross + fee (full reservation)
--   released_amount incremented by: net
--   fees_collected  incremented by: fee
--   retainage_held  incremented by: retainage
--
-- The funded-balance invariant is maintained throughout.

DROP FUNCTION IF EXISTS public.increment_deal_retainage(uuid, numeric);

CREATE FUNCTION public.increment_deal_retainage(
  p_deal_id    uuid,
  p_retainage  numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_retainage <= 0 THEN
    -- No retainage on this deal — nothing to do.
    RETURN;
  END IF;

  UPDATE public.deals
  SET
    retainage_held  = retainage_held + p_retainage,
    -- Clear the retainage portion from the reservation, completing the full conversion.
    reserved_amount = GREATEST(0, reserved_amount - p_retainage),
    updated_at      = now()
  WHERE id = p_deal_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Deal % not found — retainage of $% could not be recorded.',
      p_deal_id, p_retainage;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.increment_deal_retainage(uuid, numeric) IS
  'Moves the retainage portion of a milestone release from reserved_amount '
  'into retainage_held, completing the full reservation conversion. '
  'Called immediately after increment_deal_financials() for milestones with '
  'retainage > 0. No-op when p_retainage = 0. '
  'Maintains the funded-balance invariant: +retainage_held -reserved_amount = 0.';


-- ─── Step 9: New RPC — increment_deal_retainage_released ─────────────────────
--
-- Called by the retainage release endpoint after a successful Stripe transfer
-- to the contractor. Moves retainage from "held" to "released".
--
-- Validates that the release amount does not exceed the current retainage_held
-- balance, preventing overdraft.

DROP FUNCTION IF EXISTS public.increment_deal_retainage_released(uuid, numeric);

CREATE FUNCTION public.increment_deal_retainage_released(
  p_deal_id  uuid,
  p_amount   numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_held numeric;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'increment_deal_retainage_released: p_amount must be > 0 (received %).', p_amount;
  END IF;

  SELECT retainage_held INTO v_held
  FROM   public.deals
  WHERE  id = p_deal_id
  FOR UPDATE;  -- lock to prevent concurrent retainage releases

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deal % not found.', p_deal_id;
  END IF;

  IF p_amount > v_held THEN
    RAISE EXCEPTION
      'Cannot release $% of retainage — only $% currently held for deal %.',
      p_amount, v_held, p_deal_id;
  END IF;

  UPDATE public.deals
  SET
    -- Contractor receives the retainage — increment released_amount
    released_amount    = released_amount + p_amount,
    -- Clear from the held balance
    retainage_held     = retainage_held - p_amount,
    -- Cumulative tracker (monotone increasing — never decrements)
    retainage_released = retainage_released + p_amount,
    updated_at         = now()
  WHERE id = p_deal_id;
END;
$$;

COMMENT ON FUNCTION public.increment_deal_retainage_released(uuid, numeric) IS
  'Releases p_amount of withheld retainage to the contractor after a successful '
  'Stripe transfer. Increments released_amount and retainage_released, decrements '
  'retainage_held. Validates p_amount <= retainage_held to prevent overdraft. '
  'Uses SELECT FOR UPDATE to prevent concurrent retainage releases. '
  'Maintains the funded-balance invariant: +released -retainage_held = 0.';
