-- ─── Migration: Sequential Milestone Enforcement ──────────────────────────────
--
-- Adds two capabilities:
--
-- 1. Deal-level sequential release enforcement
--    deals.sequential_release_required = true  →  milestone N cannot be released
--    until all milestones with order_index < N are in 'released' status.
--    Required by institutional lenders. Defaults to false (backward-compatible).
--
-- 2. Explicit milestone prerequisites (deal-level flag independent)
--    milestone_prerequisites rows express arbitrary "release A before B" rules.
--    These are enforced regardless of sequential_release_required.
--
-- 3. Helper function check_prerequisite_milestones(p_milestone_id)
--    Returns TRUE when every explicit prerequisite for the given milestone
--    has status = 'released'. Used by the application release-gate layer as a
--    quick DB-side pre-flight; the authoritative check lives in validateRelease().

-- ─── 1. deals.sequential_release_required ────────────────────────────────────

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS sequential_release_required boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN deals.sequential_release_required IS
  'When true, milestones must be released in ascending order_index order. '
  'Milestone N is blocked until all milestones with order_index < N are released. '
  'Required for institutional lender compliance. Defaults to false.';

-- ─── 2. milestone_prerequisites table ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS milestone_prerequisites (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id             uuid        NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  prerequisite_milestone_id uuid       NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  created_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT milestone_prerequisites_unique
    UNIQUE (milestone_id, prerequisite_milestone_id),

  -- Prevent self-referencing prerequisites
  CONSTRAINT milestone_prerequisites_no_self_ref
    CHECK (milestone_id != prerequisite_milestone_id)
);

COMMENT ON TABLE milestone_prerequisites IS
  'Explicit release prerequisites between milestones. '
  'milestone_id cannot be released until prerequisite_milestone_id is released. '
  'Enforced by validateRelease() regardless of deals.sequential_release_required.';

COMMENT ON COLUMN milestone_prerequisites.milestone_id IS
  'The milestone being blocked — cannot be released until the prerequisite is released.';

COMMENT ON COLUMN milestone_prerequisites.prerequisite_milestone_id IS
  'The milestone that must be in released status before milestone_id can be released.';

-- ─── 3. RLS for milestone_prerequisites ──────────────────────────────────────

ALTER TABLE milestone_prerequisites ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY "milestone_prerequisites_admin_all"
  ON milestone_prerequisites
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Deal participants (contractor + funder): read-only
CREATE POLICY "milestone_prerequisites_participant_select"
  ON milestone_prerequisites
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM milestones m
      JOIN deals d ON d.id = m.deal_id
      WHERE m.id = milestone_prerequisites.milestone_id
        AND (
          d.contractor_id = auth.uid()
          OR d.funder_id   = auth.uid()
        )
    )
  );

-- ─── 4. Indexes ───────────────────────────────────────────────────────────────

-- Forward lookup: "what must be released before milestone X?"
CREATE INDEX IF NOT EXISTS idx_milestone_prerequisites_milestone_id
  ON milestone_prerequisites (milestone_id);

-- Reverse lookup: "what milestones does milestone Y unblock?"
CREATE INDEX IF NOT EXISTS idx_milestone_prerequisites_prerequisite_id
  ON milestone_prerequisites (prerequisite_milestone_id);

-- ─── 5. Helper function ───────────────────────────────────────────────────────
--
-- check_prerequisite_milestones(p_milestone_id uuid) → boolean
--
-- Returns TRUE  when all explicit prerequisites for p_milestone_id are released.
-- Returns TRUE  when no explicit prerequisites exist (no rows in the table).
-- Returns FALSE when at least one prerequisite is not yet in 'released' status.
--
-- SECURITY DEFINER: Runs as the function owner (postgres), bypassing RLS.
-- This allows the function to be called from any context (including anon if
-- needed), trusting that callers already verified milestone access.
-- The function is STABLE — it reads but does not modify data.

CREATE OR REPLACE FUNCTION check_prerequisite_milestones(p_milestone_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM milestone_prerequisites mp
    JOIN milestones m ON m.id = mp.prerequisite_milestone_id
    WHERE mp.milestone_id = p_milestone_id
      AND m.status != 'released'
  );
$$;

COMMENT ON FUNCTION check_prerequisite_milestones(uuid) IS
  'Returns true when every explicit prerequisite milestone for p_milestone_id '
  'has status = released, or when no prerequisites exist. '
  'Does NOT check the deal-level sequential_release_required flag — that check '
  'is performed by validateRelease() in the application layer.';

-- ─── 6. Audit-log action registration ────────────────────────────────────────
-- No schema change needed — audit_log.action is free-text. The new actions
-- introduced by this migration are documented here for reference:
--
--   'sequential_release_blocked'   — logged by validateRelease() when a milestone
--                                    is blocked by sequential ordering or an
--                                    explicit prerequisite.
--   (No INSERT-time trigger — the app layer handles logging.)
