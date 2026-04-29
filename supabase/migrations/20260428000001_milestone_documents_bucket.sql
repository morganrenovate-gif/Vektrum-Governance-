-- 20260428000001_milestone_documents_bucket.sql
--
-- Creates the Supabase Storage bucket for contractor-uploaded milestone evidence
-- files (photos, PDFs, documents).
--
-- WHY THIS IS NEEDED
-- ------------------
-- The upload route at POST /api/milestones/[milestoneId]/documents/upload calls
-- adminClient.storage.from('milestone-documents').upload(...) and then
-- adminClient.storage.from('milestone-documents').getPublicUrl(...) to build the
-- file_url stored in milestone_documents.file_url.
--
-- Without this bucket, every upload attempt returns a Supabase Storage 404
-- ("resource not found") causing HTTP 500 from the API.
--
-- WHY PUBLIC: TRUE
-- ----------------
-- The upload route uses getPublicUrl() to generate the file_url stored in
-- milestone_documents. getPublicUrl only produces a working URL for public
-- buckets. Evidence files are appropriate for public access because:
--   1. Storage paths include a UUID prefix:
--      {dealId}/{milestoneId}/{uuid}/{filename}
--      making paths effectively unguessable.
--   2. All uploads go through the server-side route (admin client), which
--      performs auth, role, and milestone-ownership checks before writing.
--   3. Both contractor and funder need read access to view evidence files.
--
-- SECURITY MODEL
-- --------------
-- Write (upload): server-side only via service-role key — bypasses storage RLS.
--   The API route enforces: getAuthUser → requireRole(contractor/admin) →
--   requireDealAccess → milestone ownership check → status check → then uploads.
-- Read: public URL with UUID path — accessible to anyone with the URL.
--   In practice, URLs are only surfaced to authenticated deal participants
--   via the milestone_documents table (RLS: is_deal_participant or is_admin).
--
-- This is the same pattern used by Supabase's own storage docs for
-- "protected public" files: server-enforced write + UUID-obscured public read.
--
-- ALLOWED TYPES: PDF, PNG, JPEG — matches the route-level validation at
-- /api/milestones/[milestoneId]/documents/upload/route.ts (lines 99-105).
-- SIZE LIMIT: 20 MB — matches the route-level check (lines 107-109).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'milestone-documents',
  'milestone-documents',
  true,          -- public so getPublicUrl() produces working URLs
  20971520,      -- 20 MB file size limit
  ARRAY['application/pdf', 'image/png', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;
