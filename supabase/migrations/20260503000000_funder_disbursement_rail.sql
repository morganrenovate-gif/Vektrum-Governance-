-- ──────────────────────────────────────────────────────────────────────────
-- profiles.disbursement_rail
--
-- Records which disbursement execution rail a funder has selected during
-- onboarding. Vektrum is a draw-governance and authorization-readiness
-- layer; the rail field captures *how* disbursement will be executed
-- after authorization. Vektrum does not hold funds, move money, act as
-- escrow, act as a lender, or act as a money transmitter.
--
-- Allowed values:
--   'stripe'         — funder has chosen Stripe Connect for execution.
--                      stripe_account_id is the source of truth for actual
--                      Stripe connection state; this column captures intent.
--   'external_rail'  — funder will use a lender/title/escrow/fund-control/
--                      loan-servicer/other approved external partner process.
--                      No Stripe Connect required.
--   'not_configured' — funder has chosen "Set up later" during onboarding.
--                      Dashboard access permitted; release execution
--                      remains gated by the deterministic release gate
--                      and rail configuration.
--   NULL             — never made a choice yet (pre-migration funders).
--
-- Hard guarantees preserved:
--   - Does not change release-gate semantics. The deterministic release
--     gate continues to enforce all 10 conditions server-side.
--   - Does not loosen Stripe Connect security. stripe_account_id remains
--     immutable from the user via trg_enforce_profile_platform_fields.
--   - Contractor onboarding is unaffected — contractors still receive
--     released funds via Stripe Connect (the only execution path
--     implemented today).
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS disbursement_rail text
    CHECK (
      disbursement_rail IS NULL
      OR disbursement_rail IN ('stripe', 'external_rail', 'not_configured')
    );

COMMENT ON COLUMN public.profiles.disbursement_rail IS
  'Funder-selected disbursement execution rail: stripe | external_rail | not_configured | NULL. '
  'Captures intent, not execution authority. Release authorization remains separate; '
  'the deterministic release gate continues to enforce all 10 conditions server-side.';

CREATE INDEX IF NOT EXISTS profiles_disbursement_rail_idx
  ON public.profiles (disbursement_rail)
  WHERE disbursement_rail IS NOT NULL;
