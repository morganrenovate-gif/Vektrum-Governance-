-- ──────────────────────────────────────────────────────────────────────────
-- contract_release_rule_drafts
--
-- Stores AI-extracted DRAFT release-governance rules from a fully-signed
-- contract. The funder/admin reviews the draft and decides whether to:
--   - accept (write SOV / retainage / release-condition values into the
--     existing release-gate tables — separate human action),
--   - revise, or
--   - discard.
--
-- This table NEVER controls release authorization on its own:
--   * status is draft until a human accepts.
--   * Even after status='accepted', the existing release-gate tables remain
--     the source of truth for the deterministic release gate.
--   * No row here moves money or marks a milestone released.
--
-- Trigger event:
--   POST /api/deals/{dealId}/release-rules/generate-from-contract
--   (funder/admin only; contract must be fully signed).
--
-- RLS:
--   SELECT: deal participants (funder/contractor) and admins.
--   INSERT/UPDATE/DELETE: service-role only (the API route uses the admin
--   client after enforcing role + deal-access guards).
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.contract_release_rule_drafts (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id       uuid        NOT NULL REFERENCES public.deals(id)     ON DELETE CASCADE,
  contract_id   uuid        NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  generated_by  uuid        NOT NULL REFERENCES auth.users(id)       ON DELETE SET NULL,
  status        text        NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft', 'reviewed', 'accepted', 'discarded')),
  source        text        NOT NULL DEFAULT 'perplexity'
                            CHECK (source IN ('perplexity', 'manual', 'other')),
  payload       jsonb       NOT NULL,
  warnings      jsonb       NOT NULL DEFAULT '[]'::jsonb,
  -- Free-form per-row notes captured at review time. NEVER set automatically;
  -- only present when a human reviewer leaves a comment alongside an
  -- accept/discard action.
  reviewer_notes text,
  reviewed_by    uuid       REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contract_release_rule_drafts_deal_id_idx
  ON public.contract_release_rule_drafts (deal_id, created_at DESC);

CREATE INDEX IF NOT EXISTS contract_release_rule_drafts_contract_id_idx
  ON public.contract_release_rule_drafts (contract_id, created_at DESC);

-- Only one ACTIVE draft per contract at a time. Discarded/accepted drafts
-- remain as audit history but new drafts cannot be generated while an
-- in-flight draft exists. Enforced via a partial unique index.
CREATE UNIQUE INDEX IF NOT EXISTS contract_release_rule_drafts_active_per_contract
  ON public.contract_release_rule_drafts (contract_id)
  WHERE status IN ('draft', 'reviewed');

ALTER TABLE public.contract_release_rule_drafts ENABLE ROW LEVEL SECURITY;

-- SELECT — deal participants + admins.
DROP POLICY IF EXISTS contract_release_rule_drafts_select_participants
  ON public.contract_release_rule_drafts;
CREATE POLICY contract_release_rule_drafts_select_participants
  ON public.contract_release_rule_drafts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.deals d
      WHERE  d.id = contract_release_rule_drafts.deal_id
        AND  (d.contractor_id = auth.uid() OR d.funder_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE  p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- INSERT/UPDATE/DELETE — DENY for all anon/auth roles. The API route uses the
-- service-role admin client after its own role + deal-access guards.
DROP POLICY IF EXISTS contract_release_rule_drafts_no_user_insert
  ON public.contract_release_rule_drafts;
CREATE POLICY contract_release_rule_drafts_no_user_insert
  ON public.contract_release_rule_drafts FOR INSERT
  WITH CHECK (false);

DROP POLICY IF EXISTS contract_release_rule_drafts_no_user_update
  ON public.contract_release_rule_drafts;
CREATE POLICY contract_release_rule_drafts_no_user_update
  ON public.contract_release_rule_drafts FOR UPDATE
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS contract_release_rule_drafts_no_user_delete
  ON public.contract_release_rule_drafts;
CREATE POLICY contract_release_rule_drafts_no_user_delete
  ON public.contract_release_rule_drafts FOR DELETE
  USING (false);
