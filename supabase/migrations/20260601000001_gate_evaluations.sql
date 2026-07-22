-- =============================================================================
-- 20260601000001_gate_evaluations.sql
-- Phase 1 (policy-engine foundation) — immutable, reproducible gate evaluations.
--
-- Records ONE gate_evaluations row per authoritative release-gate attempt that
-- reaches evaluation, plus ONE gate_condition_results row per condition
-- evaluated (passed / failed / not_applicable / error). These tables make a
-- historical release decision reproducible (audit §8, F-1). They are:
--   • append-only (DB-enforced BEFORE UPDATE/DELETE trigger, mirroring
--     audit_log immutability in 20260424000004),
--   • service-role-insert only (a client cannot forge a passing evaluation),
--   • readable by the deal's participants only (tenant-scoped).
--
-- This migration is ADDITIVE and does NOT change release eligibility. The
-- dual-write from the release routes and the transactional token binding are a
-- LATER phase; authorization_tokens.gate_evaluation_id is added here as a
-- nullable FK so that binding can populate it atomically without a schema change.
--
-- NOTE: authored without a database; NOT YET APPLIED. Immutability, RLS, and
-- binding behaviour are covered by written tests that MUST be executed against a
-- real Postgres before deployment.
-- =============================================================================

-- ─── Enums (mirror src/lib/engine/gate-conditions.ts) ────────────────────────
DO $$ BEGIN CREATE TYPE public.gate_evaluation_status AS ENUM ('completed', 'errored');            EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.gate_overall_outcome  AS ENUM ('passed', 'failed');                 EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.gate_condition_outcome AS ENUM ('passed','failed','not_applicable','error'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.gate_condition_applicability AS ENUM ('applicable','not_applicable'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.gate_condition_category AS ENUM ('platform_safeguard','payment_rail_safeguard','lender_policy','hybrid_legacy'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.gate_payment_rail AS ENUM ('stripe_connect','external_manual');     EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── gate_evaluations ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gate_evaluations (
  id                     uuid                         PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scope ---------------------------------------------------------------------
  deal_id                uuid                         NOT NULL REFERENCES public.deals(id)      ON DELETE RESTRICT,
  milestone_id           uuid                         NOT NULL REFERENCES public.milestones(id) ON DELETE RESTRICT,
  organization_id        uuid                         REFERENCES public.organizations(id) ON DELETE SET NULL,

  -- Actor ---------------------------------------------------------------------
  actor_id               uuid                         NOT NULL,
  actor_role             text                         NOT NULL,
  payment_rail           public.gate_payment_rail     NOT NULL,

  -- Policy identity + reproducible snapshot -----------------------------------
  policy_code            text                         NOT NULL DEFAULT 'vektrum_standard_release',
  policy_version         text                         NOT NULL DEFAULT 'v1',
  policy_snapshot        jsonb                        NOT NULL,   -- canonical policy definition used
  policy_snapshot_hash   text                         NOT NULL,   -- sha256 of canonical policy_snapshot
  gate_engine_version    text                         NOT NULL,

  -- Decision-binding inputs ---------------------------------------------------
  input_snapshot         jsonb                        NOT NULL,   -- release-relevant inputs (no secrets)
  input_fingerprint      text                         NOT NULL,   -- sha256 of canonical input_snapshot

  -- Exact AI review/override used ---------------------------------------------
  ai_review_audit_id     uuid,                                    -- audit_log id of the review/override
  ai_result_snapshot     jsonb,                                   -- normalized AiReviewSnapshot
  ai_result_hash         text,

  -- Outcome -------------------------------------------------------------------
  evaluation_status      public.gate_evaluation_status NOT NULL,
  overall_outcome        public.gate_overall_outcome   NOT NULL,
  failure_codes          text[]                        NOT NULL DEFAULT '{}',

  -- Token binding (populated atomically at authorization time in a later phase)
  authorization_token_id uuid                          REFERENCES public.authorization_tokens(id) ON DELETE SET NULL,

  -- Timing --------------------------------------------------------------------
  started_at             timestamptz                   NOT NULL,
  completed_at           timestamptz                   NOT NULL,
  created_at             timestamptz                   NOT NULL DEFAULT now(),

  -- A passing evaluation must not carry failure codes, and vice-versa.
  CONSTRAINT gate_evaluations_outcome_consistent CHECK (
    (overall_outcome = 'passed' AND cardinality(failure_codes) = 0) OR
    (overall_outcome = 'failed' AND cardinality(failure_codes) > 0)
  )
);

CREATE INDEX IF NOT EXISTS gate_evaluations_deal_idx      ON public.gate_evaluations (deal_id);
CREATE INDEX IF NOT EXISTS gate_evaluations_milestone_idx ON public.gate_evaluations (milestone_id);
CREATE INDEX IF NOT EXISTS gate_evaluations_token_idx     ON public.gate_evaluations (authorization_token_id) WHERE authorization_token_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS gate_evaluations_created_idx   ON public.gate_evaluations (created_at DESC);

COMMENT ON TABLE public.gate_evaluations IS
  'Immutable, append-only record of every authoritative release-gate evaluation. Service-role insert only; no UPDATE/DELETE. A successful authorization token binds to exactly one row where overall_outcome = passed.';

-- ─── gate_condition_results ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gate_condition_results (
  id                     uuid                              PRIMARY KEY DEFAULT gen_random_uuid(),
  gate_evaluation_id     uuid                              NOT NULL REFERENCES public.gate_evaluations(id) ON DELETE RESTRICT,

  condition_code         text                              NOT NULL,
  condition_label        text                              NOT NULL,
  condition_category     public.gate_condition_category    NOT NULL,
  evaluator_version      text                              NOT NULL,
  evaluation_order       integer                           NOT NULL,

  applicability          public.gate_condition_applicability NOT NULL,
  outcome                public.gate_condition_outcome     NOT NULL,
  result_code            text                              NOT NULL,   -- stable machine code, never prose
  explanation            text,                                          -- human-readable (may equal user error)

  configuration_snapshot jsonb,                                         -- condition config used (v1: standard)
  input_snapshot         jsonb,                                         -- release-relevant inputs (no secrets)
  evidence_references    text[]                            NOT NULL DEFAULT '{}',  -- source-record ids
  evidence_hashes        text[]                            NOT NULL DEFAULT '{}',
  verifier_id            uuid,                                          -- manual verifier when applicable

  evaluated_at           timestamptz                       NOT NULL,
  created_at             timestamptz                       NOT NULL DEFAULT now(),

  -- Each condition code appears at most once per evaluation.
  CONSTRAINT gate_condition_results_unique_code UNIQUE (gate_evaluation_id, condition_code),
  -- not_applicable outcome must be flagged not_applicable, and vice-versa.
  CONSTRAINT gate_condition_results_applicability_consistent CHECK (
    (outcome = 'not_applicable') = (applicability = 'not_applicable')
  )
);

CREATE INDEX IF NOT EXISTS gate_condition_results_eval_idx ON public.gate_condition_results (gate_evaluation_id);

COMMENT ON TABLE public.gate_condition_results IS
  'Immutable per-condition results for a gate_evaluation (passed/failed/not_applicable/error). Append-only; service-role insert only.';

-- ─── authorization_tokens: bind to the exact evaluation (nullable, additive) ──
ALTER TABLE public.authorization_tokens
  ADD COLUMN IF NOT EXISTS gate_evaluation_id uuid
    REFERENCES public.gate_evaluations(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS authorization_tokens_gate_eval_idx
  ON public.authorization_tokens (gate_evaluation_id) WHERE gate_evaluation_id IS NOT NULL;

COMMENT ON COLUMN public.authorization_tokens.gate_evaluation_id IS
  'FK to the exact successful gate_evaluations row this token authorizes. Nullable for pre-Phase-1 tokens; populated atomically at token issuance in the binding phase.';

-- ─── Append-only immutability (mirrors 20260424000004) ───────────────────────
CREATE OR REPLACE FUNCTION public.deny_gate_record_modification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION
    '% rows are immutable. Attempted % of id=%. Gate evaluation records are permanent decision evidence and cannot be modified or deleted.',
    TG_TABLE_NAME, TG_OP, OLD.id
    USING ERRCODE = 'restrict_violation';  -- SQLSTATE 23001
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_gate_evaluations_immutable ON public.gate_evaluations;
CREATE TRIGGER trg_gate_evaluations_immutable
  BEFORE UPDATE OR DELETE ON public.gate_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.deny_gate_record_modification();

DROP TRIGGER IF EXISTS trg_gate_condition_results_immutable ON public.gate_condition_results;
CREATE TRIGGER trg_gate_condition_results_immutable
  BEFORE UPDATE OR DELETE ON public.gate_condition_results
  FOR EACH ROW EXECUTE FUNCTION public.deny_gate_record_modification();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.gate_evaluations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gate_condition_results ENABLE ROW LEVEL SECURITY;

-- Deal participants (funder or contractor of the deal) may READ the decision
-- history for their deal. Consistent with current gate visibility on the deal
-- page. (Phase 2 will separate lender-internal fields from contractor-visible
-- ones; Phase 1 records only the same conditions already shown to participants.)
CREATE POLICY gate_evaluations_select_participant ON public.gate_evaluations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deals d
      WHERE d.id = gate_evaluations.deal_id
        AND (d.funder_id = auth.uid() OR d.contractor_id = auth.uid())
    )
  );

CREATE POLICY gate_condition_results_select_participant ON public.gate_condition_results
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gate_evaluations e
      JOIN public.deals d ON d.id = e.deal_id
      WHERE e.id = gate_condition_results.gate_evaluation_id
        AND (d.funder_id = auth.uid() OR d.contractor_id = auth.uid())
    )
  );

-- No client (authenticated) may INSERT/UPDATE/DELETE. All writes are performed
-- by the service-role client / a SECURITY DEFINER binding RPC (later phase),
-- which itself must validate actor, scope, completeness, and outcome before
-- inserting. A normal client therefore cannot forge a passing evaluation.
CREATE POLICY gate_evaluations_no_client_write ON public.gate_evaluations
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY gate_condition_results_no_client_write ON public.gate_condition_results
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
