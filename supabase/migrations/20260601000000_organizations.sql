-- =============================================================================
-- 20260601000000_organizations.sql
-- Phase 1 (policy-engine foundation) — lender ORGANIZATION ownership model.
--
-- ADDITIVE AND SAFE FOR EXISTING ROWS. This migration introduces a real
-- organization/membership model so a future versioned release policy can be
-- OWNED by a lender organization. It DOES NOT rewire deal authorization:
-- deals.funder_id -> profiles(id) remains the authoritative funder link and is
-- untouched. A nullable deals.lender_org_id is added for future policy
-- ownership only; it is NOT read by validateRelease() or any release path in
-- Phase 1.
--
-- No organization is auto-created and no profile is auto-migrated: existing
-- funder authorization is preserved exactly. Backfill of lender_org_id is
-- intentionally deferred (see NOTE at the end) because current data does not
-- unambiguously identify lender organizations.
--
-- NOTE: authored in an environment without a database; NOT YET APPLIED or
-- executed. RLS/immutability behaviour is covered by written tests that must be
-- run against a real Postgres before deployment.
-- =============================================================================

-- ─── Enums ───────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.organization_type AS ENUM ('lender', 'platform', 'partner', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- Membership roles inside an organization. These are ORG-scoped and are NOT
  -- the same as the platform-wide profiles.role. They never grant release
  -- authorization by themselves.
  CREATE TYPE public.organization_member_role AS ENUM ('owner', 'admin', 'member', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── organizations ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organizations (
  id           uuid                      PRIMARY KEY DEFAULT gen_random_uuid(),
  org_type     public.organization_type  NOT NULL,
  name         text                      NOT NULL,
  -- Optional human-facing external reference; never used for authorization.
  slug         text,
  created_by   uuid                      REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz               NOT NULL DEFAULT now(),
  updated_at   timestamptz               NOT NULL DEFAULT now(),
  CONSTRAINT organizations_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT organizations_slug_unique UNIQUE (slug)
);

COMMENT ON TABLE public.organizations IS
  'Lender/partner/platform organizations. Phase 1 foundation for future release-policy ownership. Not read by the release gate.';

-- ─── organization_memberships ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organization_memberships (
  id               uuid                             PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid                             NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id          uuid                             NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_role      public.organization_member_role  NOT NULL DEFAULT 'member',
  created_at       timestamptz                      NOT NULL DEFAULT now(),
  -- One membership row per (org, user). Prevents duplicate/privilege stacking.
  CONSTRAINT organization_memberships_unique UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS organization_memberships_user_idx ON public.organization_memberships (user_id);
CREATE INDEX IF NOT EXISTS organization_memberships_org_idx  ON public.organization_memberships (organization_id);

COMMENT ON TABLE public.organization_memberships IS
  'Explicit, role-based membership of a user in an organization. Writes are service-role / SECURITY DEFINER only — a user cannot self-insert a membership or self-promote (RLS denies authenticated writes).';

-- updated_at stamp on organizations (reuses the shared trigger fn from 001_schema).
DROP TRIGGER IF EXISTS trg_organizations_updated_at ON public.organizations;
CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── deals linkage (nullable, additive, NOT read by the gate) ─────────────────
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS lender_org_id uuid
    REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS deals_lender_org_id_idx
  ON public.deals (lender_org_id) WHERE lender_org_id IS NOT NULL;

COMMENT ON COLUMN public.deals.lender_org_id IS
  'FUTURE policy ownership only. Nullable; NOT read by validateRelease() or any release path in Phase 1. deals.funder_id remains the authoritative funder link.';

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.organizations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;

-- Members may read their own organizations. All writes go through the admin
-- (service-role) client or a future SECURITY DEFINER invite/admin RPC.
CREATE POLICY organizations_select_member ON public.organizations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_memberships m
      WHERE m.organization_id = organizations.id AND m.user_id = auth.uid()
    )
  );

-- A user may read the membership rows of organizations they belong to (so they
-- can see co-members), but may NOT write any membership row.
CREATE POLICY organization_memberships_select_member ON public.organization_memberships
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_memberships self
      WHERE self.organization_id = organization_memberships.organization_id
        AND self.user_id = auth.uid()
    )
  );

-- Explicitly DENY all authenticated writes (no self-insert, no self-promote,
-- no self-join). Service role bypasses RLS for controlled server-side writes;
-- a future invite flow will be a SECURITY DEFINER function that validates the
-- inviter's authority before inserting a membership.
CREATE POLICY organization_memberships_no_client_write ON public.organization_memberships
  FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY organizations_no_client_write ON public.organizations
  FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

-- =============================================================================
-- NOTE — DEFERRED BACKFILL (requires product/legal decision; see §17 of audit)
-- lender_org_id is intentionally left NULL for all existing deals. Current data
-- (deals.funder_id -> profiles, deals.partner_id -> partners) does not
-- unambiguously identify a lender ORGANIZATION, and auto-creating one org per
-- funder profile could misattribute ownership. A follow-up migration should:
--   1. Create organizations from an authoritative lender source (or admin tool).
--   2. Create explicit memberships.
--   3. Set deals.lender_org_id via a deterministic, idempotent rule.
-- Until then, NULL lender_org_id = "unassigned; manual reconciliation required".
-- =============================================================================
