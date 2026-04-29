-- 20260429000001_sov.sql
--
-- Adds the Schedule of Values (SOV) foundation for deal-level construction
-- draw governance.
--
-- ─── BACKGROUND ──────────────────────────────────────────────────────────────
--
-- A Schedule of Values is the industry-standard AIA G702/G703 document that
-- lists every line item (trade, cost category, or deliverable) in a construction
-- contract, along with its allocated value and draw request amounts.
--
-- Institutional lenders require an SOV to:
--   1. Verify each draw request is tied to approved contract line items.
--   2. Track retainage and balance-to-finish per line item.
--   3. Confirm the total SOV matches the signed contract value.
--   4. Produce the AIA G702 Application for Payment automatically.
--
-- ─── PHASE 1 SCOPE ───────────────────────────────────────────────────────────
--
-- This migration adds the data model and RLS only. The release gate is NOT
-- changed — SOV is advisory in phase 1. Hard blockers will be added in a
-- future migration once the SOV workflow is validated.
--
-- ─── DATA MODEL ──────────────────────────────────────────────────────────────
--
-- sov_line_items         — one row per SOV line item on a deal
-- milestone_sov_links    — optional n:m link between milestones and SOV items
--                          (one milestone may draw against multiple line items)
--

-- ─── 1. sov_line_items ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sov_line_items (
  id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id                 uuid          NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  item_number             text,
  description             text          NOT NULL,
  scheduled_value         numeric(14,2) NOT NULL DEFAULT 0,
  approved_change_orders  numeric(14,2) NOT NULL DEFAULT 0,
  -- revised_value = scheduled_value + approved_change_orders (maintained by app on write)
  revised_value           numeric(14,2) NOT NULL DEFAULT 0,
  previous_released       numeric(14,2) NOT NULL DEFAULT 0,
  current_requested       numeric(14,2) NOT NULL DEFAULT 0,
  retainage_amount        numeric(14,2) NOT NULL DEFAULT 0,
  -- balance_to_finish = revised_value - previous_released - current_requested (maintained by app)
  balance_to_finish       numeric(14,2) NOT NULL DEFAULT 0,
  -- percent_complete = (previous_released + current_requested) / revised_value × 100 (when revised_value > 0)
  percent_complete        numeric(5,2)  NOT NULL DEFAULT 0,
  status                  text          NOT NULL DEFAULT 'draft',
  sort_order              integer       NOT NULL DEFAULT 0,
  created_by              uuid          REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by             uuid          REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at             timestamptz,
  created_at              timestamptz   NOT NULL DEFAULT now(),
  updated_at              timestamptz   NOT NULL DEFAULT now(),

  -- Non-negative value constraints
  CONSTRAINT sov_scheduled_value_nn     CHECK (scheduled_value >= 0),
  CONSTRAINT sov_approved_co_nn         CHECK (approved_change_orders >= 0),
  CONSTRAINT sov_revised_value_nn       CHECK (revised_value >= 0),
  CONSTRAINT sov_previous_released_nn   CHECK (previous_released >= 0),
  CONSTRAINT sov_current_requested_nn   CHECK (current_requested >= 0),
  CONSTRAINT sov_retainage_nn           CHECK (retainage_amount >= 0),
  CONSTRAINT sov_balance_to_finish_nn   CHECK (balance_to_finish >= 0),
  CONSTRAINT sov_percent_complete_range CHECK (percent_complete >= 0 AND percent_complete <= 100),
  CONSTRAINT sov_status_valid           CHECK (status IN ('draft', 'pending_review', 'approved', 'superseded'))
);

COMMENT ON TABLE public.sov_line_items IS
  'Schedule of Values line items for a deal. Each row represents one cost category '
  'or trade package. The sum of scheduled_value should equal deals.total_amount. '
  'Phase 1: advisory only — does not block release.';

COMMENT ON COLUMN public.sov_line_items.revised_value IS
  'scheduled_value + approved_change_orders. Maintained by the application on every '
  'write to scheduled_value or approved_change_orders.';

COMMENT ON COLUMN public.sov_line_items.balance_to_finish IS
  'revised_value - previous_released - current_requested. Maintained by the application.';

COMMENT ON COLUMN public.sov_line_items.percent_complete IS
  '(previous_released + current_requested) / revised_value × 100 when revised_value > 0; '
  'else 0. Maintained by the application. Capped at 100.';

COMMENT ON COLUMN public.sov_line_items.status IS
  'draft: created by contractor, not yet submitted. '
  'pending_review: submitted by contractor, awaiting funder/admin approval. '
  'approved: approved by funder or admin — values are locked. '
  'superseded: replaced by a change-order revision.';


-- ─── 2. Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS sov_line_items_deal_id_idx
  ON public.sov_line_items(deal_id);

CREATE INDEX IF NOT EXISTS sov_line_items_deal_sort_idx
  ON public.sov_line_items(deal_id, sort_order);

CREATE INDEX IF NOT EXISTS sov_line_items_status_idx
  ON public.sov_line_items(status);


-- ─── 3. updated_at trigger ────────────────────────────────────────────────────

CREATE TRIGGER trg_sov_line_items_updated_at
  BEFORE UPDATE ON public.sov_line_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ─── 4. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.sov_line_items ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "sov_admin_all" ON public.sov_line_items
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Deal participants: read
CREATE POLICY "sov_participant_select" ON public.sov_line_items
  FOR SELECT
  TO authenticated
  USING (public.is_deal_participant(deal_id) OR public.is_admin());

-- Contractor: insert draft items for their own deals
CREATE POLICY "sov_contractor_insert" ON public.sov_line_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.deals
      WHERE id = sov_line_items.deal_id
        AND contractor_id = auth.uid()
    )
  );

-- Contractor: update their own draft/pending items
CREATE POLICY "sov_contractor_update" ON public.sov_line_items
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR (
      EXISTS (
        SELECT 1 FROM public.deals
        WHERE id = sov_line_items.deal_id
          AND contractor_id = auth.uid()
      )
      AND status IN ('draft', 'pending_review')
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.deals
      WHERE id = sov_line_items.deal_id
        AND contractor_id = auth.uid()
    )
  );

-- Funder: update (approve/reject) pending items on their deals
CREATE POLICY "sov_funder_approve" ON public.sov_line_items
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.deals
      WHERE id = sov_line_items.deal_id
        AND funder_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.deals
      WHERE id = sov_line_items.deal_id
        AND funder_id = auth.uid()
    )
  );

-- No public access; no delete for non-admins (use 'superseded' status instead)
-- Admin delete is covered by sov_admin_all above.


-- ─── 5. milestone_sov_links ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.milestone_sov_links (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id      uuid          NOT NULL REFERENCES public.milestones(id) ON DELETE CASCADE,
  sov_line_item_id  uuid          NOT NULL REFERENCES public.sov_line_items(id) ON DELETE CASCADE,
  allocated_amount  numeric(14,2) NOT NULL DEFAULT 0,
  created_at        timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT milestone_sov_links_unique       UNIQUE (milestone_id, sov_line_item_id),
  CONSTRAINT milestone_sov_allocated_nn       CHECK (allocated_amount >= 0)
);

COMMENT ON TABLE public.milestone_sov_links IS
  'Links a milestone to one or more SOV line items, with an allocated draw amount. '
  'A milestone may span multiple SOV categories (e.g. framing + electrical rough-in). '
  'Phase 1: advisory only — does not block release.';

CREATE INDEX IF NOT EXISTS milestone_sov_links_milestone_idx
  ON public.milestone_sov_links(milestone_id);

CREATE INDEX IF NOT EXISTS milestone_sov_links_sov_item_idx
  ON public.milestone_sov_links(sov_line_item_id);


-- ─── 6. RLS for milestone_sov_links ──────────────────────────────────────────

ALTER TABLE public.milestone_sov_links ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "milestone_sov_admin_all" ON public.milestone_sov_links
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Deal participants: read (join through milestone → deal)
CREATE POLICY "milestone_sov_participant_select" ON public.milestone_sov_links
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.milestones m
      WHERE m.id = milestone_sov_links.milestone_id
        AND public.is_deal_participant(m.deal_id)
    )
  );

-- Contractor: insert links for milestones on their deals
CREATE POLICY "milestone_sov_contractor_insert" ON public.milestone_sov_links
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.milestones m
      JOIN public.deals d ON d.id = m.deal_id
      WHERE m.id = milestone_sov_links.milestone_id
        AND d.contractor_id = auth.uid()
    )
  );

-- Contractor: update links on their deals
CREATE POLICY "milestone_sov_contractor_update" ON public.milestone_sov_links
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.milestones m
      JOIN public.deals d ON d.id = m.deal_id
      WHERE m.id = milestone_sov_links.milestone_id
        AND d.contractor_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.milestones m
      JOIN public.deals d ON d.id = m.deal_id
      WHERE m.id = milestone_sov_links.milestone_id
        AND d.contractor_id = auth.uid()
    )
  );
