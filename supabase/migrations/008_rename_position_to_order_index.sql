-- =============================================================================
-- Vektrum — Construction Milestone-Payment Governance Platform
-- Migration: 008_rename_position_to_order_index.sql
-- Applied: 2026-04-17
--
-- Renames milestones.position → milestones.order_index to match the
-- application code. The codebase (TypeScript types, Supabase queries, API
-- routes) already references "order_index" everywhere, but the column was
-- created as "position" in 001_schema.sql. This mismatch caused PostgREST
-- errors when ordering milestones, resulting in a 404 on the deal detail
-- page after deal creation.
--
-- PostgreSQL ALTER COLUMN RENAME automatically updates constraints and
-- indexes that reference the column.
-- =============================================================================

ALTER TABLE public.milestones RENAME COLUMN position TO order_index;

-- Update the unique constraint name to reflect the new column name
ALTER TABLE public.milestones RENAME CONSTRAINT milestones_position_unique TO milestones_order_index_unique;

-- Update the index name
ALTER INDEX milestones_deal_id_idx RENAME TO milestones_deal_id_order_index_idx;

-- Update the column comment
COMMENT ON COLUMN public.milestones.order_index IS 'Zero-based ordering integer within the deal. Unique per deal.';
