-- =============================================================================
-- Migration 20260511000000 — Atomic partner release state transitions
--
-- PROBLEM (concurrency audit — concurrent confirm/fail race)
-- ----------------------------------------------------------
-- The partner confirm and fail routes previously used a read-then-conditional-
-- write pattern:
--
--   1. SELECT release WHERE id = $1
--   2. JavaScript-level status check (idempotency / rail guard)
--   3. UPDATE releases SET execution_status = X WHERE id = $1 AND execution_status = 'pending'
--   4. Check rowCount; if 0 → 409
--
-- This provides *some* protection because PostgreSQL serialises concurrent UPDATEs
-- to the same row. But it leaves two gaps:
--
--   Gap A — TOCTOU for idempotency: both concurrent confirms could read 'pending'
--   (before either writes). The JavaScript-level 'already confirmed' branch never
--   fires; both proceed to the conditional UPDATE, one wins, the other returns a
--   generic 409 with no audit event and no idempotency semantics.
--
--   Gap B — No audit for the losing concurrent request. The 409 from step 4 is
--   silent — the audit log has no record that a second terminal transition was
--   attempted. Governance requires every attempt to be visible.
--
-- FIX
-- ---
-- Two SECURITY DEFINER functions that wrap the entire status-check + state-
-- transition in a single transaction with SELECT FOR UPDATE on the release row.
--
--   partner_confirm_release_atomic(...)
--   partner_fail_release_atomic(...)
--
-- The SELECT FOR UPDATE means:
--   1. Only one call can hold the row lock at a time.
--   2. The loser of the lock blocks until the winner commits or rolls back, then
--      re-reads the row in its post-transition state.
--   3. All status comparisons happen INSIDE the lock. There is no window between
--      the status check and the state-change UPDATE — they are the same
--      serialised transaction.
--
-- Both functions return a structured result so the route can:
--   - Emit the correct audit event (success, idempotent, conflict, rejection)
--   - Return the appropriate HTTP status code
--   - Surface current state to the caller for response composition
--
-- OUTCOMES
-- --------
-- partner_confirm_release_atomic returns outcome ∈ {
--   'confirmed'         Success — pending → confirmed. Winner of any race.
--   'already_confirmed' Idempotent — already confirmed AND payment_reference matches.
--                       Caller should return 200 and emit idempotent audit event.
--   'conflict'          Conflicting — already confirmed but with a DIFFERENT
--                       payment_reference. Caller should return 409 and emit
--                       conflict audit event.
--   'wrong_status'      Release is in a non-pending, non-confirmed terminal state
--                       (e.g. 'failed', 'reversed'). Cannot be confirmed.
--   'not_found'         No release row matched (defensive — route pre-validates).
-- }
--
-- partner_fail_release_atomic returns outcome ∈ {
--   'failed'            Success — pending → failed.
--   'already_failed'    Idempotent — already failed. Caller should return 200.
--   'conflict'          Release is already confirmed; cannot fail. Return 409 +
--                       conflict audit event.
--   'wrong_status'      Release is in an unexpected terminal state (e.g. 'reversed').
--   'not_found'         No release row matched (defensive).
-- }
--
-- SECURITY
-- --------
-- Both functions are SECURITY DEFINER so they run as the database owner and
-- bypass RLS. Only the service-role (admin client) should call them; the
-- partner routes already authenticate via requirePartnerAuth before calling.
-- The functions deliberately do NOT verify partner ownership — that check is
-- done in the route before the RPC is invoked.
-- =============================================================================


-- =============================================================================
-- Function 1: partner_confirm_release_atomic
-- =============================================================================

DROP FUNCTION IF EXISTS public.partner_confirm_release_atomic(uuid, text, text, timestamptz, uuid, text, uuid);

CREATE FUNCTION public.partner_confirm_release_atomic(
  p_release_id        uuid,
  p_payment_method    text,
  p_payment_reference text,
  p_executed_at       timestamptz,
  p_executed_by       uuid,        -- funder UUID (auth.users) attributed as executor
  p_notes             text,
  p_proof_doc_id      uuid
)
RETURNS TABLE (
  outcome                   text,
  current_execution_status  text,
  current_payment_reference text,
  current_executed_at       timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status  text;
  v_ref     text;
  v_exec_at timestamptz;
BEGIN
  -- ── Acquire a row-level lock and read current state atomically ─────────────
  --
  -- SELECT FOR UPDATE serialises concurrent calls on this release row.
  -- The first caller acquires the lock and proceeds. Every concurrent caller
  -- blocks here until the lock holder commits (or rolls back), then re-reads
  -- the row and sees the committed state — including any status change made by
  -- the lock holder.
  --
  -- This eliminates the TOCTOU window between the JavaScript-level status check
  -- (step 2 in the old flow) and the conditional UPDATE (step 3). All state
  -- decisions happen under the lock.
  SELECT
    execution_status,
    external_payment_reference,
    external_executed_at
  INTO
    v_status,
    v_ref,
    v_exec_at
  FROM  public.releases
  WHERE id = p_release_id
  FOR UPDATE;

  -- ── Release not found ──────────────────────────────────────────────────────
  IF NOT FOUND THEN
    RETURN QUERY
      SELECT
        'not_found'::text,
        NULL::text,
        NULL::text,
        NULL::timestamptz;
    RETURN;
  END IF;

  -- ── Already confirmed ──────────────────────────────────────────────────────
  IF v_status = 'confirmed' THEN
    IF v_ref = p_payment_reference THEN
      -- Idempotent: same payment reference → safe to return 200
      RETURN QUERY
        SELECT
          'already_confirmed'::text,
          v_status,
          v_ref,
          v_exec_at;
    ELSE
      -- Conflict: confirmed with a DIFFERENT reference — two different payments
      -- were reported for the same release. This requires human review.
      RETURN QUERY
        SELECT
          'conflict'::text,
          v_status,
          v_ref,
          v_exec_at;
    END IF;
    RETURN;
  END IF;

  -- ── Unexpected terminal state (failed, reversed, executing, …) ────────────
  IF v_status <> 'pending' THEN
    RETURN QUERY
      SELECT
        'wrong_status'::text,
        v_status,
        v_ref,
        v_exec_at;
    RETURN;
  END IF;

  -- ── Transition: pending → confirmed ───────────────────────────────────────
  --
  -- The row is already locked. We do not need an additional WHERE clause here
  -- because no concurrent UPDATE can occur until we release the lock at commit.
  UPDATE public.releases
  SET
    execution_status              = 'confirmed',
    external_payment_method       = p_payment_method,
    external_payment_reference    = p_payment_reference,
    external_executed_at          = p_executed_at,
    external_executed_by          = p_executed_by,
    external_execution_notes      = p_notes,
    proof_of_payment_document_id  = p_proof_doc_id
  WHERE id = p_release_id;

  RETURN QUERY
    SELECT
      'confirmed'::text,
      'confirmed'::text,
      p_payment_reference,
      p_executed_at;
END;
$$;

COMMENT ON FUNCTION public.partner_confirm_release_atomic(uuid, text, text, timestamptz, uuid, text, uuid) IS
  'Atomically confirms a partner release execution. Uses SELECT FOR UPDATE to '
  'serialise concurrent confirm/fail requests on the same release row, closing '
  'the TOCTOU gap in the read-then-conditional-update pattern. '
  'Returns outcome: ''confirmed'' | ''already_confirmed'' | ''conflict'' | ''wrong_status'' | ''not_found''. '
  'Does NOT check partner ownership — caller must authenticate and authorise before invoking.';


-- =============================================================================
-- Function 2: partner_fail_release_atomic
-- =============================================================================

DROP FUNCTION IF EXISTS public.partner_fail_release_atomic(uuid, text);

CREATE FUNCTION public.partner_fail_release_atomic(
  p_release_id   uuid,
  p_failure_note text   -- full note to store in external_execution_notes
)
RETURNS TABLE (
  outcome                  text,
  current_execution_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  -- ── Acquire row lock and read current state ────────────────────────────────
  SELECT execution_status
  INTO   v_status
  FROM   public.releases
  WHERE  id = p_release_id
  FOR UPDATE;

  -- ── Release not found ──────────────────────────────────────────────────────
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::text;
    RETURN;
  END IF;

  -- ── Already failed (idempotent) ────────────────────────────────────────────
  IF v_status = 'failed' THEN
    RETURN QUERY SELECT 'already_failed'::text, v_status;
    RETURN;
  END IF;

  -- ── Confirmed: cannot fail — conflict ─────────────────────────────────────
  --
  -- A confirmed release represents executed payment evidence. Failing it would
  -- contradict recorded confirmation and require admin intervention, not a
  -- partner API call.
  IF v_status = 'confirmed' THEN
    RETURN QUERY SELECT 'conflict'::text, v_status;
    RETURN;
  END IF;

  -- ── Unexpected terminal state (reversed, executing, …) ────────────────────
  IF v_status <> 'pending' THEN
    RETURN QUERY SELECT 'wrong_status'::text, v_status;
    RETURN;
  END IF;

  -- ── Transition: pending → failed ───────────────────────────────────────────
  UPDATE public.releases
  SET
    execution_status         = 'failed',
    external_execution_notes = p_failure_note
  WHERE id = p_release_id;

  RETURN QUERY SELECT 'failed'::text, 'failed'::text;
END;
$$;

COMMENT ON FUNCTION public.partner_fail_release_atomic(uuid, text) IS
  'Atomically marks a partner release as failed. Uses SELECT FOR UPDATE to '
  'serialise concurrent confirm/fail requests on the same release row. '
  'Returns outcome: ''failed'' | ''already_failed'' | ''conflict'' | ''wrong_status'' | ''not_found''. '
  'Does NOT check partner ownership — caller must authenticate and authorise before invoking. '
  'The conflict outcome (''confirmed'' status) requires admin intervention to reverse.';


-- =============================================================================
-- End of migration 20260511000000_partner_release_atomic_transitions.sql
-- =============================================================================
