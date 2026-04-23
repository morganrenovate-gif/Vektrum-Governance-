-- ─── Migration 017: Transaction Receipts ──────────────────────────────────────
--
-- Creates the transaction_receipts table which generates a VKT-YYYY-NNNNNN
-- receipt number for every successful milestone fund release.
--
-- Design decisions:
--   • All financial and party fields are denormalized at write time so the
--     receipt is legally self-contained even if the underlying rows change.
--   • receipt_number is set by a BEFORE INSERT trigger using a dedicated
--     sequence — application code never needs to pass it.
--   • RLS allows deal participants (contractor or funder) to SELECT their own
--     receipts. INSERT/UPDATE/DELETE are service-role only (WITH CHECK (false)).
--   • status mirrors releases.transfer_status: pending → failed/reversed on
--     Stripe webhook, or stays pending if the transfer settles (Stripe has no
--     transfer.succeeded event — pending IS the success state).

-- ─── Receipt number sequence ──────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.transaction_receipts_seq
  START 1
  INCREMENT 1
  NO CYCLE
  OWNED BY NONE;   -- ownership transferred to the column below

COMMENT ON SEQUENCE public.transaction_receipts_seq IS
  'Monotonic counter for transaction receipt numbers. '
  'Combined with the year prefix to produce VKT-YYYY-NNNNNN strings. '
  'Never reset — gaps from rollbacks are expected and do not affect uniqueness.';

-- ─── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE public.transaction_receipts (
  -- ── Identity ────────────────────────────────────────────────────────────────
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  /** Human-readable receipt identifier: VKT-2026-000001.
   *  Set by the set_receipt_number trigger — never insert manually. */
  receipt_number   text        NOT NULL UNIQUE,

  -- ── Foreign keys ────────────────────────────────────────────────────────────
  release_id       uuid        NOT NULL REFERENCES public.releases(id) ON DELETE RESTRICT,
  milestone_id     uuid        NOT NULL REFERENCES public.milestones(id) ON DELETE RESTRICT,
  deal_id          uuid        NOT NULL REFERENCES public.deals(id) ON DELETE RESTRICT,
  /** May be null if the billing record insert failed (partial release). */
  billing_record_id uuid       REFERENCES public.billing_records(id) ON DELETE SET NULL,

  -- ── Status ──────────────────────────────────────────────────────────────────
  /** pending  → transfer created in Stripe (this IS the success state).
   *  failed   → Stripe fired transfer.failed webhook.
   *  reversed → Stripe fired transfer.reversed webhook. */
  status           text        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'failed', 'reversed')),

  -- ── Financial snapshot (immutable — denormalized at insert time) ─────────────
  /** Full contract value released to the contractor. */
  gross_amount     numeric(12,2) NOT NULL,
  /** Vektrum platform fee charged to the funder. */
  fee_amount       numeric(12,2) NOT NULL,
  /** Rate applied at release time, in basis points. */
  fee_rate_bps     integer     NOT NULL,
  /** Total funder debit: gross_amount + fee_amount. */
  total_charged    numeric(12,2) NOT NULL,

  -- ── Stripe ──────────────────────────────────────────────────────────────────
  stripe_transfer_id text       NOT NULL,

  -- ── Party identifiers (for RLS + joins) ─────────────────────────────────────
  contractor_id    uuid        NOT NULL,
  funder_id        uuid        NOT NULL,

  -- ── Denormalized display values (immutable) ──────────────────────────────────
  /** company_name ?? full_name at time of release. */
  contractor_name  text        NOT NULL,
  funder_name      text        NOT NULL,
  deal_title       text        NOT NULL,
  milestone_title  text        NOT NULL,

  -- ── Timestamps ──────────────────────────────────────────────────────────────
  /** UTC timestamp when the release was initiated (copied from releases.released_at). */
  released_at      timestamptz NOT NULL,
  /** Set when the transfer failure webhook fires. */
  failed_at        timestamptz,
  /** Updated each time the receipt email is (re-)sent. */
  email_sent_at    timestamptz,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Constraint: UNIQUE release → receipt (one receipt per release, ever)
ALTER TABLE public.transaction_receipts
  ADD CONSTRAINT transaction_receipts_release_id_unique UNIQUE (release_id);

-- ─── Sequence ownership ───────────────────────────────────────────────────────
-- Tie the sequence lifecycle to the table so it drops together.
ALTER SEQUENCE public.transaction_receipts_seq
  OWNED BY public.transaction_receipts.id;

-- ─── Trigger: auto-generate receipt_number ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_receipt_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.receipt_number IS NULL OR NEW.receipt_number = '' THEN
    NEW.receipt_number :=
      'VKT-' ||
      to_char(now() AT TIME ZONE 'UTC', 'YYYY') || '-' ||
      lpad(nextval('public.transaction_receipts_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_receipt_number() IS
  'BEFORE INSERT trigger that assigns the VKT-YYYY-NNNNNN receipt number. '
  'Application code should always pass receipt_number as NULL or omit it entirely.';

CREATE TRIGGER set_receipt_number
  BEFORE INSERT ON public.transaction_receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_receipt_number();

-- ─── Trigger: updated_at ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at_receipts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at_receipts
  BEFORE UPDATE ON public.transaction_receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_receipts();

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX transaction_receipts_deal_id_idx      ON public.transaction_receipts (deal_id);
CREATE INDEX transaction_receipts_milestone_id_idx ON public.transaction_receipts (milestone_id);
CREATE INDEX transaction_receipts_contractor_id_idx ON public.transaction_receipts (contractor_id);
CREATE INDEX transaction_receipts_funder_id_idx    ON public.transaction_receipts (funder_id);
CREATE INDEX transaction_receipts_status_idx       ON public.transaction_receipts (status);
CREATE INDEX transaction_receipts_released_at_idx  ON public.transaction_receipts (released_at DESC);
CREATE INDEX transaction_receipts_stripe_id_idx    ON public.transaction_receipts (stripe_transfer_id);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE public.transaction_receipts ENABLE ROW LEVEL SECURITY;

-- Deal participants can read their own receipts
CREATE POLICY "receipt_select_participant" ON public.transaction_receipts
  FOR SELECT
  USING (
    auth.uid() = contractor_id
    OR auth.uid() = funder_id
  );

-- Admin users can read all receipts
CREATE POLICY "receipt_select_admin" ON public.transaction_receipts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- No direct INSERT/UPDATE/DELETE from the client — service role only
CREATE POLICY "receipt_insert_deny"  ON public.transaction_receipts FOR INSERT  WITH CHECK (false);
CREATE POLICY "receipt_update_deny"  ON public.transaction_receipts FOR UPDATE  WITH CHECK (false);
CREATE POLICY "receipt_delete_deny"  ON public.transaction_receipts FOR DELETE  USING (false);

-- ─── Column comments ─────────────────────────────────────────────────────────

COMMENT ON TABLE  public.transaction_receipts IS
  'Immutable financial receipts generated for every successful milestone release. '
  'Used for in-app display, email delivery, and PDF export. '
  'All financial and party fields are denormalized at insert time.';

COMMENT ON COLUMN public.transaction_receipts.receipt_number IS
  'Human-readable unique identifier in VKT-YYYY-NNNNNN format. '
  'Set by the set_receipt_number trigger. Never assign manually.';

COMMENT ON COLUMN public.transaction_receipts.status IS
  'pending: Stripe transfer created — this is the normal settled state. '
  'failed: Stripe fired transfer.failed. '
  'reversed: Stripe fired transfer.reversed.';

COMMENT ON COLUMN public.transaction_receipts.gross_amount IS
  'Milestone contract value. The amount the contractor receives.';

COMMENT ON COLUMN public.transaction_receipts.fee_amount IS
  'Vektrum platform fee. Charged to the funder on top of the gross amount.';

COMMENT ON COLUMN public.transaction_receipts.total_charged IS
  'Total funder debit: gross_amount + fee_amount.';

COMMENT ON COLUMN public.transaction_receipts.contractor_name IS
  'company_name ?? full_name of the contractor at the time of release. '
  'Denormalized so the receipt is valid even if the profile is later changed.';

COMMENT ON COLUMN public.transaction_receipts.released_at IS
  'UTC timestamp when the release was initiated (copied from releases.released_at). '
  'Always display as exact UTC — never as relative time.';
