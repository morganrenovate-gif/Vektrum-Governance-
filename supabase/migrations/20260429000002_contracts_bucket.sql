-- 20260429000002_contracts_bucket.sql
--
-- Creates the Supabase Storage bucket for contractor-uploaded contract PDFs.
--
-- WHY THIS IS NEEDED
-- ------------------
-- Migration 011_contracts.sql documents the bucket requirement in a comment
-- ("NOTE: Create the 'contracts' bucket in Supabase Storage before deploying")
-- but never actually creates it. The upload route at
-- POST /api/deals/[dealId]/contracts calls:
--   adminClient.storage.from('contracts').upload(...)
-- Without this bucket, every upload attempt returns a Supabase Storage 404
-- ("resource not found") causing HTTP 500 from the API.
--
-- WHY PUBLIC: FALSE (PRIVATE BUCKET)
-- ------------------------------------
-- Contract PDFs contain sensitive legal and financial terms. They must not
-- be accessible via a public URL. The upload route and signed-URL route both
-- use the admin client (service-role key) and generate short-lived signed URLs
-- on demand — authenticated deal participants only.
--
-- SECURITY MODEL
-- --------------
-- Write (upload): server-side only via service-role key — bypasses storage RLS.
--   The API route enforces: getAuthUser → role check (contractor/admin) →
--   requireDealAccess → contractor ownership check → then uploads.
-- Read: short-lived signed URLs generated server-side via admin client.
--   Only deal participants (contractor + funder) and admins may request them.
--
-- ALLOWED TYPES: PDF only — contracts must be PDF documents.
--   Matches route-level validation in
--   /api/deals/[dealId]/contracts/route.ts.
-- SIZE LIMIT: 20 MB — matches the route-level check in the same file.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contracts',
  'contracts',
  false,          -- private: signed URLs required, no public read
  20971520,       -- 20 MB file size limit (20 * 1024 * 1024 bytes)
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;
