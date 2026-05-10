-- =============================================================================
-- 20260510000002_fix_contracts_insert_rls.sql
-- Tighten contracts_insert_contractor RLS policy to contractor-only writes.
--
-- ROOT CAUSE
-- ----------
-- Migration 011_contracts.sql defined contracts_insert_contractor with:
--
--   WITH CHECK (public.is_deal_participant(deal_id))
--
-- is_deal_participant() returns TRUE for both contractors AND funders.
-- This means a funder using the Supabase browser SDK (anon key + session)
-- could INSERT a fabricated contract record on any deal they fund.
--
-- SOLUTION
-- --------
-- Replace WITH CHECK with a subquery that verifies the authenticated user
-- is specifically the contractor on the deal — not merely a participant.
--
-- The SELECT policy (contracts_select) is unchanged and continues to allow
-- both parties (contractor, funder, admin) to read contracts.
--
-- Service-role writes (DocuSign webhook via createSupabaseAdminClient) bypass
-- RLS entirely and are unaffected by this change.
-- =============================================================================

-- Drop the overly broad INSERT policy
DROP POLICY IF EXISTS "contracts_insert_contractor" ON public.contracts;

-- Replacement: only the deal's contractor may insert a contract
CREATE POLICY "contracts_insert_contractor"
  ON public.contracts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   public.deals
      WHERE  id            = deal_id
        AND  contractor_id = auth.uid()
    )
  );

-- =============================================================================
-- SUMMARY
-- =============================================================================
-- Policy changed: contracts_insert_contractor (INSERT, authenticated)
--   Before: WITH CHECK (public.is_deal_participant(deal_id))   ← allows funders
--   After:  WITH CHECK (deals.contractor_id = auth.uid())      ← contractor only
--
-- No table schema changes. No trigger changes. No SELECT policy changes.
-- No service-role behavior changes (service role bypasses RLS).
-- =============================================================================
