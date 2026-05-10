-- =============================================================================
-- 20260510000003_fix_reconciliation_insert_rls.sql
-- Restrict reconciliation table writes to service role only.
--
-- ROOT CAUSE
-- ----------
-- Migration 012_reconciliation.sql defined admin-only RLS policies using
-- FOR ALL WITH CHECK (public.is_admin()), which permits authenticated admins
-- to INSERT, UPDATE, and DELETE reconciliation records directly via the
-- Supabase browser SDK (anon key + session cookie).
--
-- Reconciliation records are written exclusively by the server-side cron job
-- via createSupabaseAdminClient() (service role), which bypasses RLS. There is
-- no legitimate reason for an authenticated admin to INSERT these records
-- directly — doing so could introduce fabricated reconciliation data.
--
-- SOLUTION
-- --------
-- Replace each FOR ALL policy with:
--   - A SELECT-only policy for authenticated admins (read for the dashboard)
--   - An explicit INSERT/UPDATE/DELETE deny (WITH CHECK (false)) for authenticated
--     users so the browser SDK cannot write these tables
--
-- Service role bypasses RLS entirely and continues to write via the cron engine.
-- =============================================================================

-- ── reconciliation_runs ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "reconciliation_runs_admin_only" ON public.reconciliation_runs;

-- Admins can read reconciliation run history for the dashboard
CREATE POLICY "reconciliation_runs_select_admin"
  ON public.reconciliation_runs
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- No authenticated user (including admins) may INSERT/UPDATE/DELETE via browser SDK
CREATE POLICY "reconciliation_runs_write_deny"
  ON public.reconciliation_runs
  FOR ALL
  TO authenticated
  WITH CHECK (false);


-- ── reconciliation_issues ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "reconciliation_issues_admin_only" ON public.reconciliation_issues;

-- Admins can read reconciliation issues for the dashboard
CREATE POLICY "reconciliation_issues_select_admin"
  ON public.reconciliation_issues
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- No authenticated user (including admins) may INSERT/UPDATE/DELETE via browser SDK
CREATE POLICY "reconciliation_issues_write_deny"
  ON public.reconciliation_issues
  FOR ALL
  TO authenticated
  WITH CHECK (false);


-- =============================================================================
-- SUMMARY
-- =============================================================================
-- Policies changed:
--   reconciliation_runs: FOR ALL is_admin() → SELECT-only + write deny
--   reconciliation_issues: FOR ALL is_admin() → SELECT-only + write deny
--
-- Service role (createSupabaseAdminClient) bypasses RLS and continues to
-- write these tables from the reconciliation cron engine unchanged.
--
-- No table schema changes. No trigger changes. No function changes.
-- =============================================================================
