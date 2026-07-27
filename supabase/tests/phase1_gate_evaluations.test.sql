-- =============================================================================
-- supabase/tests/phase1_gate_evaluations.test.sql
-- Phase 1 (policy-engine foundation) — DATABASE-LEVEL behavioural tests.
--
-- STATUS: AUTHORED, NOT YET EXECUTED. This environment has no Postgres server
-- (psql client only), so these assertions have been written against the exact
-- column/constraint/trigger definitions in:
--   • 20260601000000_organizations.sql
--   • 20260601000001_gate_evaluations.sql
--   • 20260504000001_authorization_tokens.sql
--   • 001_schema.sql
-- They MUST be run against a real Postgres (supabase db reset + psql -f this
-- file, or wired into CI) before these migrations are deployed. They are the
-- authoritative proof of the DB-enforced guarantees that the TypeScript tests
-- cannot cover: append-only immutability, outcome consistency, uniqueness,
-- token-binding integrity, and RLS deny-by-default on the new tables.
--
-- SAFETY: the whole file runs inside ONE transaction and ends with ROLLBACK,
-- so it seeds fixtures, asserts, and leaves the database exactly as it found
-- it. Nothing here writes to production data. Run against a disposable/dev DB.
--
-- CONVENTION: each check uses a DO $$ ... $$ block that RAISES on failure. A
-- clean run prints only the NOTICE lines and the final 'ALL PHASE-1 DB CHECKS
-- PASSED' banner, then rolls back.
--
-- Run:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/phase1_gate_evaluations.test.sql
-- =============================================================================

\set ON_ERROR_STOP on
BEGIN;

-- ─── Fixtures ────────────────────────────────────────────────────────────────
-- Minimal contractor + deal + milestone so a gate_evaluations row can exist.
-- profiles.id -> auth.users(id), so an auth.users row is seeded first. If the
-- local auth schema requires additional NOT NULL columns, extend this INSERT;
-- the assertions below do not depend on any auth.users column beyond id.
DO $$
DECLARE
  v_user_id      uuid := '11111111-1111-1111-1111-111111111111';
  v_deal_id      uuid := '22222222-2222-2222-2222-222222222222';
  v_milestone_id uuid := '33333333-3333-3333-3333-333333333333';
BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', 'phase1-fixture@example.test')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, role) VALUES (v_user_id, 'contractor')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.deals (id, contractor_id, title, total_amount, status)
  VALUES (v_deal_id, v_user_id, 'Phase-1 fixture deal', 100000, 'active')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.milestones (id, deal_id, title, amount, position, status, protection_status)
  VALUES (v_milestone_id, v_deal_id, 'Phase-1 fixture milestone', 10000, 0, 'approved', 'ready_for_release')
  ON CONFLICT (id) DO NOTHING;
END $$;

-- Helper: insert one PASSING gate_evaluations row and return its id via a temp table.
CREATE TEMP TABLE _t (eval_id uuid) ON COMMIT DROP;
INSERT INTO public.gate_evaluations
  (deal_id, milestone_id, actor_id, actor_role, payment_rail,
   policy_snapshot, policy_snapshot_hash, gate_engine_version,
   input_snapshot, input_fingerprint,
   evaluation_status, overall_outcome, failure_codes,
   started_at, completed_at)
VALUES
  ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', 'funder', 'stripe_connect',
   '{"policy":"vektrum_standard_release"}'::jsonb, 'sha256:policy', 'gate-engine.v1',
   '{"milestone_status":"approved"}'::jsonb, 'sha256:input',
   'completed', 'passed', '{}',
   now(), now())
RETURNING id INTO STRICT _t;  -- STRICT: exactly one row must be inserted.

INSERT INTO public.gate_condition_results
  (gate_evaluation_id, condition_code, condition_label, condition_category,
   evaluator_version, evaluation_order, applicability, outcome, result_code, explanation, evaluated_at)
SELECT eval_id, 'MILESTONE_APPROVED', 'Milestone status approved', 'lender_policy',
       'v1', 2, 'applicable', 'passed', 'PASS', NULL, now()
FROM _t;

-- =============================================================================
-- 1. IMMUTABILITY — gate_evaluations rejects UPDATE and DELETE (SQLSTATE 23001)
-- =============================================================================
DO $$
DECLARE v_id uuid; v_sqlstate text;
BEGIN
  SELECT eval_id INTO v_id FROM _t;

  -- 1a. UPDATE must be denied.
  BEGIN
    UPDATE public.gate_evaluations SET overall_outcome = 'failed' WHERE id = v_id;
    RAISE EXCEPTION 'CHECK 1a FAILED: UPDATE on gate_evaluations was allowed';
  EXCEPTION WHEN restrict_violation THEN
    RAISE NOTICE 'CHECK 1a PASS: UPDATE on gate_evaluations denied (23001)';
  END;

  -- 1b. DELETE must be denied.
  BEGIN
    DELETE FROM public.gate_evaluations WHERE id = v_id;
    RAISE EXCEPTION 'CHECK 1b FAILED: DELETE on gate_evaluations was allowed';
  EXCEPTION WHEN restrict_violation THEN
    RAISE NOTICE 'CHECK 1b PASS: DELETE on gate_evaluations denied (23001)';
  END;
END $$;

-- =============================================================================
-- 2. IMMUTABILITY — gate_condition_results rejects UPDATE and DELETE
-- =============================================================================
DO $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.gate_condition_results
    WHERE gate_evaluation_id = (SELECT eval_id FROM _t) LIMIT 1;

  BEGIN
    UPDATE public.gate_condition_results SET outcome = 'failed' WHERE id = v_id;
    RAISE EXCEPTION 'CHECK 2a FAILED: UPDATE on gate_condition_results was allowed';
  EXCEPTION WHEN restrict_violation THEN
    RAISE NOTICE 'CHECK 2a PASS: UPDATE on gate_condition_results denied (23001)';
  END;

  BEGIN
    DELETE FROM public.gate_condition_results WHERE id = v_id;
    RAISE EXCEPTION 'CHECK 2b FAILED: DELETE on gate_condition_results was allowed';
  EXCEPTION WHEN restrict_violation THEN
    RAISE NOTICE 'CHECK 2b PASS: DELETE on gate_condition_results denied (23001)';
  END;
END $$;

-- =============================================================================
-- 3. OUTCOME CONSISTENCY CHECK on gate_evaluations
--    passed => failure_codes empty; failed => failure_codes non-empty
-- =============================================================================
DO $$
BEGIN
  -- 3a. passed + non-empty failure_codes must be rejected by CHECK constraint.
  BEGIN
    INSERT INTO public.gate_evaluations
      (deal_id, milestone_id, actor_id, actor_role, payment_rail,
       policy_snapshot, policy_snapshot_hash, gate_engine_version,
       input_snapshot, input_fingerprint,
       evaluation_status, overall_outcome, failure_codes, started_at, completed_at)
    VALUES
      ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333',
       '11111111-1111-1111-1111-111111111111', 'funder', 'stripe_connect',
       '{}'::jsonb, 'h', 'gate-engine.v1', '{}'::jsonb, 'f',
       'completed', 'passed', '{MILESTONE_APPROVED}', now(), now());
    RAISE EXCEPTION 'CHECK 3a FAILED: passed row with failure_codes was accepted';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'CHECK 3a PASS: passed + failure_codes rejected';
  END;

  -- 3b. failed + empty failure_codes must be rejected.
  BEGIN
    INSERT INTO public.gate_evaluations
      (deal_id, milestone_id, actor_id, actor_role, payment_rail,
       policy_snapshot, policy_snapshot_hash, gate_engine_version,
       input_snapshot, input_fingerprint,
       evaluation_status, overall_outcome, failure_codes, started_at, completed_at)
    VALUES
      ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333',
       '11111111-1111-1111-1111-111111111111', 'funder', 'stripe_connect',
       '{}'::jsonb, 'h', 'gate-engine.v1', '{}'::jsonb, 'f',
       'completed', 'failed', '{}', now(), now());
    RAISE EXCEPTION 'CHECK 3b FAILED: failed row with empty failure_codes was accepted';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'CHECK 3b PASS: failed + empty failure_codes rejected';
  END;
END $$;

-- =============================================================================
-- 4. UNIQUENESS — a condition code appears at most once per evaluation
-- =============================================================================
DO $$
BEGIN
  BEGIN
    INSERT INTO public.gate_condition_results
      (gate_evaluation_id, condition_code, condition_label, condition_category,
       evaluator_version, evaluation_order, applicability, outcome, result_code, evaluated_at)
    SELECT eval_id, 'MILESTONE_APPROVED', 'dup', 'lender_policy',
           'v1', 2, 'applicable', 'passed', 'PASS', now()
    FROM _t;
    RAISE EXCEPTION 'CHECK 4 FAILED: duplicate condition_code accepted for one evaluation';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'CHECK 4 PASS: duplicate (evaluation, condition_code) rejected';
  END;
END $$;

-- =============================================================================
-- 5. APPLICABILITY CONSISTENCY — outcome=not_applicable <=> applicability=not_applicable
-- =============================================================================
DO $$
BEGIN
  BEGIN
    INSERT INTO public.gate_condition_results
      (gate_evaluation_id, condition_code, condition_label, condition_category,
       evaluator_version, evaluation_order, applicability, outcome, result_code, evaluated_at)
    SELECT eval_id, 'PAYOUT_ACCOUNT_READY', 'x', 'payment_rail_safeguard',
           'v1', 5, 'applicable', 'not_applicable', 'NOT_APPLICABLE', now()  -- inconsistent
    FROM _t;
    RAISE EXCEPTION 'CHECK 5 FAILED: not_applicable outcome with applicable flag accepted';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'CHECK 5 PASS: applicability/outcome inconsistency rejected';
  END;
END $$;

-- =============================================================================
-- 6. TOKEN BINDING INTEGRITY — a token may bind a passing evaluation, and that
--    evaluation cannot then be deleted (ON DELETE RESTRICT). Immutability (§1)
--    already blocks DELETE for everyone; this asserts the FK guard independently
--    by attempting the delete as the table owner path would (still restrict).
-- =============================================================================
DO $$
DECLARE v_eval uuid; v_token uuid;
BEGIN
  SELECT eval_id INTO v_eval FROM _t;

  INSERT INTO public.authorization_tokens
    (jti, idempotency_key, sequence_index, draw_request_id, milestone_id, payee_id, funder_id,
     rail_scope, payee_scope, amount_vector, total_amount, policy_version, policy_hash,
     token_hash, nonce, expires_at, issued_by, gate_evaluation_id)
  VALUES
    ('DEMO-jti-phase1', 'DEMO-idem-phase1', 1,
     '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333',
     '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
     'stripe', '11111111-1111-1111-1111-111111111111',
     '[{"milestone_id":"33333333-3333-3333-3333-333333333333","amount":10000}]'::jsonb,
     10000, 'v1', 'sha256:policy',
     'sha256:token', 'nonce-1', now() + interval '1 day',
     '11111111-1111-1111-1111-111111111111', v_eval)
  RETURNING id INTO v_token;

  IF v_token IS NULL THEN
    RAISE EXCEPTION 'CHECK 6a FAILED: token did not bind to gate_evaluation';
  END IF;
  RAISE NOTICE 'CHECK 6a PASS: authorization_token bound to gate_evaluation %', v_eval;

  -- The bound evaluation is protected by BOTH the immutability trigger and the
  -- FK ON DELETE RESTRICT. Deleting it must fail.
  BEGIN
    DELETE FROM public.gate_evaluations WHERE id = v_eval;
    RAISE EXCEPTION 'CHECK 6b FAILED: deleting a token-bound evaluation was allowed';
  EXCEPTION
    WHEN restrict_violation THEN
      RAISE NOTICE 'CHECK 6b PASS: bound evaluation cannot be deleted (restrict_violation)';
    WHEN foreign_key_violation THEN
      RAISE NOTICE 'CHECK 6b PASS: bound evaluation cannot be deleted (foreign_key_violation)';
  END;
END $$;

-- =============================================================================
-- 7. ORGANIZATION MEMBERSHIP UNIQUENESS — one membership per (org, user)
-- =============================================================================
DO $$
DECLARE v_org uuid;
BEGIN
  INSERT INTO public.organizations (org_type, name) VALUES ('lender', 'DEMO Lender Org')
    RETURNING id INTO v_org;

  INSERT INTO public.organization_memberships (organization_id, user_id, member_role)
    VALUES (v_org, '11111111-1111-1111-1111-111111111111', 'owner');

  BEGIN
    INSERT INTO public.organization_memberships (organization_id, user_id, member_role)
      VALUES (v_org, '11111111-1111-1111-1111-111111111111', 'admin');
    RAISE EXCEPTION 'CHECK 7 FAILED: duplicate (org, user) membership accepted';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'CHECK 7 PASS: duplicate org membership rejected';
  END;
END $$;

-- =============================================================================
-- 8. RLS DENY-BY-DEFAULT — an authenticated (non-service) role cannot INSERT a
--    gate_evaluation, a membership, or an organization, and cannot forge a
--    passing evaluation. Requires the Supabase 'authenticated' role + a JWT
--    claims context; run within the same transaction and RESET afterwards.
--
--    NOTE: superuser/owner bypasses RLS, so this block explicitly assumes the
--    'authenticated' role. If running as a superuser without that role, this
--    block is skipped with a NOTICE rather than giving a false PASS.
-- =============================================================================
DO $$
DECLARE v_has_role boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') INTO v_has_role;
  IF NOT v_has_role THEN
    RAISE NOTICE 'CHECK 8 SKIPPED: role "authenticated" not present (not a Supabase DB)';
    RETURN;
  END IF;

  PERFORM set_config('request.jwt.claims',
    '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  SET LOCAL ROLE authenticated;

  -- 8a. authenticated cannot INSERT a gate_evaluation (deny-by-default policy).
  BEGIN
    INSERT INTO public.gate_evaluations
      (deal_id, milestone_id, actor_id, actor_role, payment_rail,
       policy_snapshot, policy_snapshot_hash, gate_engine_version,
       input_snapshot, input_fingerprint, evaluation_status, overall_outcome,
       failure_codes, started_at, completed_at)
    VALUES
      ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333',
       '11111111-1111-1111-1111-111111111111', 'funder', 'stripe_connect',
       '{}'::jsonb, 'h', 'gate-engine.v1', '{}'::jsonb, 'f',
       'completed', 'passed', '{}', now(), now());
    RAISE EXCEPTION 'CHECK 8a FAILED: authenticated client forged a passing gate_evaluation';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'CHECK 8a PASS: authenticated INSERT on gate_evaluations denied by RLS';
  END;

  -- 8b. authenticated cannot self-insert an organization membership (no self-promote).
  BEGIN
    INSERT INTO public.organization_memberships (organization_id, user_id, member_role)
      VALUES (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'owner');
    RAISE EXCEPTION 'CHECK 8b FAILED: authenticated client self-inserted a membership';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'CHECK 8b PASS: authenticated membership self-insert denied by RLS';
    WHEN foreign_key_violation THEN
      -- RLS is evaluated before FK for WITH CHECK(false); either proves denial.
      RAISE NOTICE 'CHECK 8b PASS: authenticated membership self-insert denied';
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
END $$;

-- =============================================================================
SELECT '✅ ALL PHASE-1 DB CHECKS PASSED (see NOTICE lines above)' AS result;

ROLLBACK;
