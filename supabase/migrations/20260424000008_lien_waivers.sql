-- 20260424000008_lien_waivers.sql
--
-- Adds a full lien waiver system for institutional construction lending compliance.
--
-- ─── BACKGROUND ──────────────────────────────────────────────────────────────────
--
-- Lien waivers are legally required in most US states before construction
-- disbursements can be made (see Cal. Civil Code §8132-8138; Texas Property Code
-- §53.281; NY Lien Law §34). Without them, the funder's collateral interest is
-- at risk from unpaid subcontractor or supplier mechanics' liens.
--
-- The four standard AIA/CSLB waiver types map to payment timing:
--
--   conditional_progress    — Contractor waives lien rights for a PROGRESS draw,
--                             CONDITIONAL on actually receiving payment. This is the
--                             standard pre-release waiver for each milestone. The
--                             most common form for draw-based construction lending.
--
--   unconditional_progress  — Contractor unconditionally waives lien rights for a
--                             progress draw. Used AFTER payment is confirmed. Provides
--                             stronger protection to the funder/title company.
--
--   conditional_final       — Contractor waives all lien rights on the project,
--                             CONDITIONAL on receiving the final payment amount.
--                             Required at project close.
--
--   unconditional_final     — Contractor unconditionally waives all lien rights.
--                             Used AFTER final payment is confirmed. Most protective
--                             form for the lender.
--
-- ─── RELEASE GATE INTEGRATION ────────────────────────────────────────────────────
--
-- When deal.lien_waiver_required = true:
--   An APPROVED conditional_progress waiver is required per milestone before
--   Vektrum will authorise a Stripe transfer (Condition 10 in validateRelease()).
--
-- ─── WORKFLOW ─────────────────────────────────────────────────────────────────────
--
--   1. Funder requests a lien waiver (POST .../lien-waiver)
--      → Creates record with status = 'requested'
--   2. Contractor uploads signed PDF (POST /api/lien-waivers/[id]/upload)
--      → status = 'uploaded', file_path stored in Supabase Storage
--   3. Funder reviews the PDF and approves or rejects
--      → status = 'approved' or 'rejected'
--   4. If approved: the release gate passes Condition 10
--


-- ─── Enums ────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.lien_waiver_type AS ENUM (
    'conditional_progress',
    'unconditional_progress',
    'conditional_final',
    'unconditional_final'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TYPE public.lien_waiver_type IS
  'The four standard construction lien waiver types. '
  'conditional_progress: waives lien rights for this progress payment once received. '
  'unconditional_progress: unconditionally waives rights for progress payment (post-payment). '
  'conditional_final: waives all rights on project, conditional on final payment. '
  'unconditional_final: unconditionally waives all rights after final payment.';

DO $$ BEGIN
  CREATE TYPE public.lien_waiver_status AS ENUM (
    'requested',
    'uploaded',
    'approved',
    'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TYPE public.lien_waiver_status IS
  'Lifecycle status of a lien waiver. '
  'requested: funder has requested the waiver from the contractor. '
  'uploaded: contractor has uploaded the signed PDF, awaiting funder review. '
  'approved: funder has reviewed and approved the waiver. '
  'rejected: funder rejected the waiver (rejection_reason explains why).';


-- ─── lien_waivers table ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.lien_waivers (
  id                uuid                     PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id           uuid                     NOT NULL REFERENCES public.deals(id) ON DELETE RESTRICT,
  milestone_id      uuid                     REFERENCES public.milestones(id) ON DELETE SET NULL,
  waiver_type       public.lien_waiver_type  NOT NULL,
  status            public.lien_waiver_status NOT NULL DEFAULT 'requested',

  -- Parties
  uploaded_by       uuid                     REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by       uuid                     REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- File storage — Supabase Storage path in the 'lien-waivers' bucket
  file_path         text,

  -- Financial snapshot at waiver time (from milestone/deal)
  waiver_amount     NUMERIC(12, 2),
  through_date      date,

  -- Rejection
  rejection_reason  text,

  -- Timestamps
  requested_at      timestamptz              NOT NULL DEFAULT now(),
  uploaded_at       timestamptz,
  approved_at       timestamptz,
  rejected_at       timestamptz,
  created_at        timestamptz              NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT lien_waivers_amount_positive CHECK (waiver_amount IS NULL OR waiver_amount > 0),
  CONSTRAINT lien_waivers_rejection_reason_required
    CHECK (status <> 'rejected' OR rejection_reason IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS lien_waivers_deal_id_idx       ON public.lien_waivers(deal_id);
CREATE INDEX IF NOT EXISTS lien_waivers_milestone_id_idx  ON public.lien_waivers(milestone_id);
CREATE INDEX IF NOT EXISTS lien_waivers_status_idx        ON public.lien_waivers(status)
  WHERE status IN ('requested', 'uploaded');   -- only index actionable statuses

COMMENT ON TABLE public.lien_waivers IS
  'Lien waiver requests and their lifecycle state. One record per waiver request; '
  'multiple waivers may exist for a single milestone (history of rejections/re-uploads). '
  'The most recent approved conditional_progress waiver satisfies Condition 10 of validateRelease().';

COMMENT ON COLUMN public.lien_waivers.file_path IS
  'Supabase Storage path within the ''lien-waivers'' bucket. '
  'Format: {dealId}/{milestoneId ?? ''deal''}/{waiverId}/{filename}. '
  'Generate a signed download URL server-side before exposing to clients — '
  'never expose raw paths to the browser.';

COMMENT ON COLUMN public.lien_waivers.waiver_amount IS
  'Dollar amount covered by this waiver, typically equal to milestone.amount. '
  'Required by many state statutes (e.g. California Civil Code §8132).';


-- ─── Add lien_waiver_required to deals ────────────────────────────────────────────

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS lien_waiver_required boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.deals.lien_waiver_required IS
  'When true, an approved conditional_progress lien waiver is required for every '
  'milestone release (Condition 10 of validateRelease()). '
  'Required by institutional lenders in most US states. Defaults to false.';


-- ─── Add lien_waiver_id to milestones (soft reference, no circular FK) ────────────
-- Note: lien_waivers already references milestones, so a back-FK would be circular.
-- This column is a convenience denormalization pointing to the active/approved waiver.
-- The authoritative query is: SELECT * FROM lien_waivers WHERE milestone_id = $1
--   AND waiver_type = 'conditional_progress' AND status = 'approved'.

ALTER TABLE public.milestones
  ADD COLUMN IF NOT EXISTS lien_waiver_id uuid;

COMMENT ON COLUMN public.milestones.lien_waiver_id IS
  'Soft reference to the active lien waiver for this milestone. '
  'Updated when a waiver is approved. Not a FK to avoid circular reference '
  '(lien_waivers already references milestones). '
  'Source of truth: lien_waivers table filtered by milestone_id + type + status.';


-- ─── RLS ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.lien_waivers ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "admin_all_lien_waivers" ON public.lien_waivers
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Funder: read and update (approve/reject) waivers for their deals
CREATE POLICY "funder_read_lien_waivers" ON public.lien_waivers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deals
      WHERE id = lien_waivers.deal_id AND funder_id = auth.uid()
    )
  );

-- Contractor: read waivers for their deals
CREATE POLICY "contractor_read_lien_waivers" ON public.lien_waivers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deals
      WHERE id = lien_waivers.deal_id AND contractor_id = auth.uid()
    )
  );

-- Note: INSERT and UPDATE are performed via service role in API routes (admin client)
-- to enforce business logic (role checks, state machine transitions) server-side.
-- Direct client INSERT/UPDATE is intentionally disallowed.


-- ─── Supabase Storage bucket for lien waiver PDFs ────────────────────────────────
-- Private bucket — all access via signed URLs generated server-side.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lien-waivers',
  'lien-waivers',
  false,
  20971520,  -- 20 MB limit
  ARRAY['application/pdf', 'image/png', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;
