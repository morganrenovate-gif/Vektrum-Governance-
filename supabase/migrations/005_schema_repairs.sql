-- =============================================================================
-- Vektrum — Construction Milestone-Payment Governance Platform
-- Migration: 005_schema_repairs.sql
-- Applied: 2026-04-16
--
-- Repairs two schema deviations from the canonical handoff spec:
--
--   1. Add 'disputed' to milestone_status enum
--      The state machine (lib/engine/state-machine.ts) requires 'disputed'
--      as a valid milestone state. The original migration omitted it.
--
--   2. Remove email column from profiles
--      Per spec: email lives exclusively in auth.users. The profiles table
--      must never have an email column. A manual column addition caused drift.
--
--   3. Fix handle_new_user trigger
--      Updated to not reference profiles.email so new signups continue to
--      work correctly after the column is dropped.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add 'disputed' to milestone_status enum
-- ---------------------------------------------------------------------------
ALTER TYPE public.milestone_status ADD VALUE IF NOT EXISTS 'disputed';

-- ---------------------------------------------------------------------------
-- 2. Fix handle_new_user trigger — remove email from INSERT
-- Must run before DROP COLUMN so the function no longer references it.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::public.user_role,
      'contractor'::public.user_role
    )
  );
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Automatically creates a public.profiles row when a new auth.users row is inserted.
   Email is intentionally excluded — it lives in auth.users only.';

-- ---------------------------------------------------------------------------
-- 3. Drop the email column from profiles
-- Safe now that the trigger no longer references it.
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;
