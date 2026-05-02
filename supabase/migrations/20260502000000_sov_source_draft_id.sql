-- ──────────────────────────────────────────────────────────────────────────
-- sov_line_items.source_draft_id
--
-- Tracks the contract_release_rule_drafts row that produced an SOV line
-- item, when one was materialised from an AI-extracted draft. NULL for any
-- row created via the manual SOV-entry flow.
--
-- Required so the release-rules approve action (PATCH /api/deals/{deal}/
-- release-rules/{draft}) can:
--   1. Idempotently re-run — a duplicate approve should not insert the
--      same line items twice.
--   2. Audit the provenance of every SOV row back to the source draft.
--
-- Hard guarantees preserved:
--   - status default remains 'draft' (CHECK ('draft','pending_review',
--     'approved','superseded')). No change to release-gate semantics.
--   - manual SOV entries continue to work unchanged (NULL source_draft_id).
--   - ON DELETE SET NULL: discarding a draft does not delete the SOV rows
--     it produced; the connection just becomes an orphan reference.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.sov_line_items
  ADD COLUMN IF NOT EXISTS source_draft_id uuid
    REFERENCES public.contract_release_rule_drafts(id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS sov_line_items_source_draft_id_idx
  ON public.sov_line_items (source_draft_id)
  WHERE source_draft_id IS NOT NULL;
