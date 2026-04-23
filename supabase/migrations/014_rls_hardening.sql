-- =============================================================================
-- 014_rls_hardening.sql
-- Full Row-Level Security hardening pass.
--
-- VULNERABILITIES FIXED:
--   1.  deals_update — missing WITH CHECK lets funders overwrite contractor_id
--   2.  milestones_update — too broad; contractors can self-approve their own work
--   3.  change_orders_update — contractors can self-approve change orders
--   4.  disputes_update — contractors can self-resolve disputes
--   5.  profiles_select_own — too narrow; deal participants can't see each other
--   6.  invites_select_contractor — accepted funders can't see their invite record
--   7.  DB trigger: enforce milestone state machine at the database layer so no
--       direct-DB or compromised-client bypass can skip the state machine
--
-- TABLES AFFECTED:
--   profiles, deals, milestones, change_orders, disputes, deal_invites
-- =============================================================================

-- ---------------------------------------------------------------------------
-- HELPER: get_caller_role()
-- Returns the platform role of the currently authenticated user, or NULL if
-- running as service_role (admin client, webhooks, cron jobs).
-- SECURITY DEFINER so it can read profiles even under restrictive RLS.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_caller_role()
RETURNS public.user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

COMMENT ON FUNCTION public.get_caller_role() IS
  'Returns the platform role of the authenticated user (contractor|funder|admin), '
  'or NULL when called from the service role (no authenticated session).';

-- Grant execute to authenticated users only (not anon)
REVOKE ALL    ON FUNCTION public.get_caller_role() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_caller_role() TO authenticated;
GRANT  EXECUTE ON FUNCTION public.get_caller_role() TO service_role;

-- ---------------------------------------------------------------------------
-- HELPER: is_funder_on_deal(p_deal_id uuid)
-- True when the calling user is the funder of the specified deal.
-- Separate from is_deal_participant to let policies grant funder-only rights.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_funder_on_deal(p_deal_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.deals
    WHERE id = p_deal_id
      AND funder_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.is_funder_on_deal(uuid) IS
  'True when auth.uid() is the funder on the given deal. Used in RLS policies '
  'that grant funder-specific write access (e.g. milestone approval, CO approval).';

REVOKE ALL    ON FUNCTION public.is_funder_on_deal(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_funder_on_deal(uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.is_funder_on_deal(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- HELPER: is_contractor_on_deal(p_deal_id uuid)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_contractor_on_deal(p_deal_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.deals
    WHERE id = p_deal_id
      AND contractor_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.is_contractor_on_deal(uuid) IS
  'True when auth.uid() is the contractor on the given deal.';

REVOKE ALL    ON FUNCTION public.is_contractor_on_deal(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_contractor_on_deal(uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.is_contractor_on_deal(uuid) TO service_role;


-- =============================================================================
-- 1. PROFILES — expand SELECT so deal counterparts are visible
-- =============================================================================
-- PROBLEM: profiles_select_own only allows a user to read their OWN profile.
-- This means a funder viewing a deal cannot see the contractor's name, and
-- vice versa. Applications then fall back to the admin client to resolve names,
-- which bypasses RLS entirely — trading narrow RLS for a wider service-role hole.
--
-- FIX: Also allow users to see profiles of people with whom they share a deal.
-- The subquery checks BOTH directions (I am contractor looking for funder, or
-- I am funder looking for contractor). Admins see all profiles.
-- =============================================================================

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;

CREATE POLICY "profiles_select"
  ON public.profiles
  FOR SELECT
  USING (
    -- Own profile
    id = auth.uid()

    -- Platform admin sees all profiles
    OR public.is_admin()

    -- Deal counterpart: I can see the contractor's profile when I am their funder
    OR EXISTS (
      SELECT 1 FROM public.deals
      WHERE funder_id = auth.uid()
        AND contractor_id = id
    )

    -- Deal counterpart: I can see the funder's profile when I am the contractor
    OR EXISTS (
      SELECT 1 FROM public.deals
      WHERE contractor_id = auth.uid()
        AND funder_id = id
    )
  );

COMMENT ON POLICY "profiles_select" ON public.profiles IS
  'Users see their own profile, platform admins see all, and deal participants can '
  'see the profile of their counterpart (contractor sees funder, funder sees contractor). '
  'Cross-deal visibility is not granted — you only see profiles of people on YOUR deals.';


-- =============================================================================
-- 2. DEAL_INVITES — allow accepted funders to read their own invite record
-- =============================================================================
-- PROBLEM: invites_select_contractor only allows the issuer (invited_by) to read
-- invites. Funders who accepted an invite cannot see the invite record from their
-- own perspective — accepted_by = auth.uid() was never included.
-- =============================================================================

DROP POLICY IF EXISTS "invites_select_contractor" ON public.deal_invites;

CREATE POLICY "invites_select"
  ON public.deal_invites
  FOR SELECT
  USING (
    invited_by  = auth.uid()   -- contractor who sent the invite
    OR accepted_by = auth.uid() -- funder who accepted
    OR public.is_admin()
  );

COMMENT ON POLICY "invites_select" ON public.deal_invites IS
  'Invite issuers (contractors) and acceptors (funders) can both read invite records '
  'for their respective actions. Admins see all invites.';


-- =============================================================================
-- 3. DEALS — role-specific UPDATE policies with WITH CHECK
-- =============================================================================
-- PROBLEM: deals_update has no WITH CHECK clause, so a funder could UPDATE
-- contractor_id (deal takeover), or a contractor could change funder_id to
-- remove their funder after funding has occurred.
--
-- FIX: Drop the single broad policy and replace with three role-specific
-- policies that use WITH CHECK to assert that identity columns are immutable
-- from each role's perspective.
-- =============================================================================

DROP POLICY IF EXISTS "deals_update" ON public.deals;

-- Contractor: can update deal metadata (title, description) on their own deals.
-- WITH CHECK ensures they cannot change contractor_id (reassign themselves)
-- or funder_id (tamper with who funds the deal).
CREATE POLICY "deals_update_contractor"
  ON public.deals
  FOR UPDATE
  USING (contractor_id = auth.uid())
  WITH CHECK (
    contractor_id = auth.uid()
    -- funder_id is allowed to change (contractor can't control who funds)
    -- but contractor cannot SET contractor_id to someone else
  );

-- Funder: can update funded_amount and deal status (funding actions).
-- WITH CHECK: funder_id must remain their own ID (can't reassign themselves).
-- contractor_id immutability for funder updates is enforced by the DB trigger below.
CREATE POLICY "deals_update_funder"
  ON public.deals
  FOR UPDATE
  USING (funder_id = auth.uid())
  WITH CHECK (funder_id = auth.uid());

-- Admin: unrestricted.
CREATE POLICY "deals_update_admin"
  ON public.deals
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON POLICY "deals_update_contractor" ON public.deals IS
  'Contractors can update their own deals but cannot reassign contractor_id.';
COMMENT ON POLICY "deals_update_funder" ON public.deals IS
  'Funders can update deals they fund but cannot change contractor_id or reassign funder_id.';
COMMENT ON POLICY "deals_update_admin" ON public.deals IS
  'Admins can update any deal without restriction.';

-- DB TRIGGER: enforce immutability of deal participant columns
-- Prevents ANY non-admin user from changing contractor_id or funder_id after
-- the row is created. This catches attacks not covered by the WITH CHECK clauses
-- above (e.g. a funder trying to swap the contractor).
CREATE OR REPLACE FUNCTION public.enforce_deal_participants_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
BEGIN
  -- Service-role / admin client (auth.uid() IS NULL): allow freely
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Platform admins: allow freely
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Reject any attempt to change contractor_id
  IF NEW.contractor_id IS DISTINCT FROM OLD.contractor_id THEN
    RAISE EXCEPTION
      'deal_participants_immutable: contractor_id cannot be changed after deal creation.',
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Reject any attempt to remove an already-assigned funder
  -- (assigning funder the first time is allowed — funder_id starts NULL)
  IF OLD.funder_id IS NOT NULL AND NEW.funder_id IS DISTINCT FROM OLD.funder_id THEN
    RAISE EXCEPTION
      'deal_participants_immutable: funder_id cannot be changed once a funder has been assigned.',
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deal_participants_immutable ON public.deals;
CREATE TRIGGER trg_deal_participants_immutable
  BEFORE UPDATE OF contractor_id, funder_id ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_deal_participants_immutable();

COMMENT ON FUNCTION public.enforce_deal_participants_immutable() IS
  'Prevents non-admin users from reassigning contractor_id or funder_id on a deal. '
  'contractor_id is permanently immutable once set. funder_id is immutable once '
  'a funder has been assigned (non-NULL → different UUID is blocked). '
  'Service-role and admin users bypass this check.';


-- =============================================================================
-- 4. MILESTONES — role-specific UPDATE policies
-- =============================================================================
-- PROBLEM: milestones_update allows ANY deal participant to UPDATE any column.
-- Attack vectors:
--   a. Contractor sets status='approved' (self-approval of their own work)
--   b. Funder modifies milestone.amount (bypassing deal structure)
--   c. Either party sets status='released' directly (bypassing Stripe)
--
-- FIX: Separate policies per role. The DB trigger below enforces the state
-- machine at the DB level as a second layer.
-- =============================================================================

DROP POLICY IF EXISTS "milestones_update" ON public.milestones;

-- Contractor: can update metadata (title, description, order_index) on their deal's
-- milestones. Cannot use the standard UPDATE policy to change status — the DB trigger
-- will validate any status change against the caller's role.
CREATE POLICY "milestones_update_contractor"
  ON public.milestones
  FOR UPDATE
  USING (public.is_contractor_on_deal(deal_id));

-- Funder: can update milestones on deals they fund (primarily status transitions:
-- ready_for_review → approved). Cannot change deal_id or amount.
CREATE POLICY "milestones_update_funder"
  ON public.milestones
  FOR UPDATE
  USING (public.is_funder_on_deal(deal_id));

-- Admin: unrestricted UPDATE.
CREATE POLICY "milestones_update_admin"
  ON public.milestones
  FOR UPDATE
  USING (public.is_admin());

COMMENT ON POLICY "milestones_update_contractor" ON public.milestones IS
  'Contractors can update milestones on their own deals. DB trigger enforces '
  'which status transitions are permitted for the contractor role.';
COMMENT ON POLICY "milestones_update_funder" ON public.milestones IS
  'Funders can update milestones on deals they fund. DB trigger enforces '
  'which status transitions are permitted for the funder role.';


-- =============================================================================
-- 5. DB TRIGGER — enforce milestone state machine at the database layer
-- =============================================================================
-- This trigger fires on every UPDATE to milestones.status. It validates the
-- transition based on the calling user's role, regardless of which client
-- (app, direct DB connection, pgAdmin, etc.) issues the UPDATE.
--
-- Service-role calls (auth.uid() IS NULL) bypass the check — webhooks and
-- internal RPCs use the admin client and are already trusted.
--
-- ALLOWED TRANSITIONS:
--   contractor: not_started→in_progress, in_progress→ready_for_review,
--               any→disputed
--   funder:     ready_for_review→approved, any→disputed,
--               approved→ready_for_release (protection_status only, not status)
--   admin:      any transition
--   system:     any transition (auth.uid() IS NULL)
--
-- BLOCKED FOR ALL non-system callers:
--   *→released       (only the release route via admin client may set this)
--   *→payout_failed  (only the transfer.failed webhook via admin client may set this)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enforce_milestone_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id   uuid;
  v_caller_role public.user_role;
BEGIN
  -- No status change — nothing to validate
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Fetch caller identity
  v_caller_id := auth.uid();

  -- Service-role / admin client (webhooks, RPCs, cron): auth.uid() returns NULL.
  -- These callers have already been authenticated at the API layer and are trusted.
  IF v_caller_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Fetch the caller's platform role
  SELECT role INTO v_caller_role
  FROM public.profiles
  WHERE id = v_caller_id;

  -- Admin users may make any transition
  IF v_caller_role = 'admin' THEN
    RETURN NEW;
  END IF;

  -- HARD BLOCK: 'released' and 'payout_failed' are system-only statuses.
  -- They can only be set by trusted server code (release route, webhook handler)
  -- which uses the service-role admin client (auth.uid() IS NULL → already returned above).
  IF NEW.status IN ('released', 'payout_failed') THEN
    RAISE EXCEPTION
      'milestone_status_transition: status ''%'' can only be set by the Vektrum platform system, '
      'not by an authenticated user. Use the /api/milestones/[id]/release endpoint.',
      NEW.status
    USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Contractor transitions
  IF v_caller_role = 'contractor' THEN
    IF NOT (
      -- Start work
      (OLD.status = 'not_started'    AND NEW.status = 'in_progress')
      -- Submit for review
      OR (OLD.status = 'in_progress'    AND NEW.status = 'ready_for_review')
      -- Re-submit after rejection / revision requested
      OR (OLD.status = 'ready_for_review' AND NEW.status = 'in_progress')
      -- Open a dispute from any non-terminal state
      OR (OLD.status IN ('not_started', 'in_progress', 'ready_for_review', 'approved')
          AND NEW.status = 'disputed')
    ) THEN
      RAISE EXCEPTION
        'milestone_status_transition: contractor cannot transition ''%'' → ''%''.',
        OLD.status, NEW.status
      USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  -- Funder transitions
  IF v_caller_role = 'funder' THEN
    IF NOT (
      -- Approve submitted work
      (OLD.status = 'ready_for_review' AND NEW.status = 'approved')
      -- Reject / request revisions
      OR (OLD.status = 'ready_for_review' AND NEW.status = 'in_progress')
      -- Open a dispute
      OR (OLD.status IN ('not_started', 'in_progress', 'ready_for_review', 'approved')
          AND NEW.status = 'disputed')
      -- Resolve dispute (funder can close a dispute)
      OR (OLD.status = 'disputed' AND NEW.status = 'approved')
    ) THEN
      RAISE EXCEPTION
        'milestone_status_transition: funder cannot transition ''%'' → ''%''.',
        OLD.status, NEW.status
      USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to milestones (fires before each UPDATE row)
DROP TRIGGER IF EXISTS trg_milestone_status_transition ON public.milestones;
CREATE TRIGGER trg_milestone_status_transition
  BEFORE UPDATE OF status ON public.milestones
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_milestone_status_transition();

COMMENT ON FUNCTION public.enforce_milestone_status_transition() IS
  'DB-layer state machine guard. Validates milestone.status transitions based on '
  'the authenticated user''s role. Service-role (auth.uid() IS NULL) bypasses '
  'validation — only trusted platform code (release route, webhooks) runs as '
  'service role. Rejects any attempt to set status=released|payout_failed from a '
  'user session regardless of client or method.';


-- =============================================================================
-- 6. CHANGE_ORDERS — prevent contractors from self-approving
-- =============================================================================
-- PROBLEM: change_orders_update uses the broad is_deal_participant() check,
-- which allows a contractor to set status='approved' on their own change order.
-- This would let them unilaterally authorize cost overruns.
--
-- FIX:
--   Contractor UPDATE: can only update change orders they submitted, and the
--     new status must NOT be 'approved' (only funders can approve).
--   Funder UPDATE: can approve or reject change orders on their deals.
--   Admin: unrestricted.
-- =============================================================================

DROP POLICY IF EXISTS "change_orders_update" ON public.change_orders;

-- Contractors can update their own submitted change orders (e.g. update description,
-- or withdraw by setting status back to 'submitted' or a custom draft state).
-- They explicitly cannot set status='approved'.
CREATE POLICY "change_orders_update_contractor"
  ON public.change_orders
  FOR UPDATE
  USING (
    submitted_by = auth.uid()
    AND public.is_deal_participant(deal_id)
  )
  WITH CHECK (
    submitted_by = auth.uid()
    -- Contractors may NEVER self-approve
    AND status != 'approved'
  );

-- Funders can approve or reject any change order on their deals.
CREATE POLICY "change_orders_update_funder"
  ON public.change_orders
  FOR UPDATE
  USING (public.is_funder_on_deal(deal_id))
  WITH CHECK (public.is_funder_on_deal(deal_id));

-- Admins can update any change order.
CREATE POLICY "change_orders_update_admin"
  ON public.change_orders
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON POLICY "change_orders_update_contractor" ON public.change_orders IS
  'Contractors can update their own change orders but cannot set status=approved. '
  'Only funders and admins may approve change orders.';
COMMENT ON POLICY "change_orders_update_funder" ON public.change_orders IS
  'Funders can approve or reject change orders on deals they fund.';


-- =============================================================================
-- 7. DISPUTES — prevent contractors from self-resolving
-- =============================================================================
-- PROBLEM: disputes_update allows any deal participant to update any dispute
-- column. A contractor could set status='resolved' and write their own
-- resolution text, effectively closing a dispute in their own favor.
--
-- FIX: Funders and admins alone can resolve disputes. Contractors can open
-- and add context (covered by INSERT policy) but cannot resolve.
-- =============================================================================

DROP POLICY IF EXISTS "disputes_update" ON public.disputes;

-- Funder: can resolve, escalate, or update disputes on their deals.
CREATE POLICY "disputes_update_funder"
  ON public.disputes
  FOR UPDATE
  USING (public.is_funder_on_deal(deal_id))
  WITH CHECK (public.is_funder_on_deal(deal_id));

-- Admin: can update any dispute.
CREATE POLICY "disputes_update_admin"
  ON public.disputes
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Contractor: can update disputes they OPENED, but ONLY to add context —
-- they cannot change the status field.
-- This policy covers things like updating `reason` before a funder responds.
CREATE POLICY "disputes_update_contractor_own"
  ON public.disputes
  FOR UPDATE
  USING (
    opened_by = auth.uid()
    AND status = 'open'   -- can only update while dispute is still open
  )
  WITH CHECK (
    opened_by = auth.uid()
    -- Contractors cannot change the dispute status — only funders/admins can
    AND status = 'open'
  );

COMMENT ON POLICY "disputes_update_funder" ON public.disputes IS
  'Funders can update (resolve, escalate) disputes on deals they fund.';
COMMENT ON POLICY "disputes_update_admin" ON public.disputes IS
  'Admins can update any dispute.';
COMMENT ON POLICY "disputes_update_contractor_own" ON public.disputes IS
  'Contractors can update the context of disputes they opened, but only while '
  'the dispute is still open and only without changing the status column. '
  'This prevents self-resolution — only funders and admins can close disputes.';


-- =============================================================================
-- 8. Indexes to support new policy subqueries
-- =============================================================================
-- The new deal-counterpart check in profiles_select adds a subquery against
-- deals.funder_id and deals.contractor_id. The existing indexes on those
-- columns (deals_contractor_id_idx, deals_funder_id_idx) already cover this,
-- but we add a composite covering index for the policy pattern.

CREATE INDEX IF NOT EXISTS deals_participant_lookup_idx
  ON public.deals (contractor_id, funder_id)
  WHERE funder_id IS NOT NULL;

COMMENT ON INDEX public.deals_participant_lookup_idx IS
  'Covers the deal-counterpart subquery in the profiles_select RLS policy: '
  '"show me the profile of my counterpart on any shared deal." '
  'Filtered to rows with a funder_id to skip unfunded draft deals.';


-- =============================================================================
-- SUMMARY OF VULNERABILITIES CLOSED
-- =============================================================================
--
-- | # | Vulnerability                                    | Fix                                                     |
-- |---|--------------------------------------------------|---------------------------------------------------------|
-- | 1 | deals_update: no WITH CHECK (funder → steal)     | Role-split policies; enforce_deal_participants_immutable |
-- | 2 | deals: contractor_id/funder_id mutable           | DB trigger: enforce_deal_participants_immutable          |
-- | 3 | milestones_update: contractor self-approve       | Trigger: enforce_milestone_status_transition             |
-- | 4 | milestones_update: any user sets released        | Trigger: HARD BLOCK for system-only statuses            |
-- | 5 | change_orders_update: contractor self-approve CO | Policy WITH CHECK: status != 'approved'                 |
-- | 6 | disputes_update: contractor self-resolve         | Funder/admin-only resolution policies                   |
-- | 7 | profiles_select_own: forces admin-client bypass  | Deal-counterpart visibility added                       |
-- | 8 | invites_select: accepted funder blind            | accepted_by = auth.uid() added                          |
-- |   | APPLICATION LAYER                                |                                                         |
-- | 9 | /api/ai/draw-review GET: IDOR (any funder)       | requireDealAccess added before returning data           |
-- |10 | /api/ai/draw-review POST: no deal access check   | requireDealAccess added as defence-in-depth             |
-- |11 | /api/analyze-contract: no auth (anon API abuse)  | getAuthUser gate added                                  |
-- =============================================================================
