-- Phase 1A repair: keep the encrypted credential record server-only while
-- retaining non-secret connection and selected-project metadata.
ALTER TABLE public.procore_connections
  ADD COLUMN IF NOT EXISTS procore_company_id text,
  ADD COLUMN IF NOT EXISTS selected_project_id text,
  ADD COLUMN IF NOT EXISTS selected_project_name text,
  ADD COLUMN IF NOT EXISTS last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_sync_status text,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS reconnect_required boolean NOT NULL DEFAULT false;

ALTER TABLE public.procore_connections
  ADD CONSTRAINT procore_connections_sync_status_chk
  CHECK (last_sync_status IS NULL OR last_sync_status IN ('success', 'failed', 'not_started'));
