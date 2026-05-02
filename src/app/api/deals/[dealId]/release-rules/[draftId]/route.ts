/**
 * PATCH /api/deals/[dealId]/release-rules/[draftId]
 *
 * Funder/admin-only. Transitions a contract_release_rule_drafts row from
 *   draft → accepted   (body { action: 'approve', reviewer_notes? })
 *   draft → discarded  (body { action: 'discard', reviewer_notes? })
 *
 * HARD GUARANTEES (test-pinned):
 *   - Never authorizes release.
 *   - Never moves money / creates Stripe transfers.
 *   - Never inserts SOV line items, never marks SOV approved, never writes
 *     to milestones, deals.funded_amount, deals.released_amount.
 *   - "Accepted" means the funder has reviewed and accepted the DRAFT —
 *     not that the SOV is approved or that release readiness has been
 *     established. The deterministic release gate and funder authorization
 *     still control release. The funder must still create + approve SOV
 *     line items via the existing manual flow.
 *   - Discard preserves the row (status='discarded') so audit history is
 *     intact. We never DELETE.
 *
 * Idempotency:
 *   - Re-submitting an already-accepted draft returns 409 with the existing
 *     status. No silent overwrite.
 *   - Re-discarding an already-discarded draft returns 409 with the
 *     existing status.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { getAuthUser, requireDealAccess } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { internalError, notFoundError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

type DraftAction = 'approve' | 'discard'

const VALID_ACTIONS: DraftAction[] = ['approve', 'discard']

const ACCEPTED_STATUS    = 'accepted'
const DISCARDED_STATUS   = 'discarded'

const ACTION_TO_STATUS: Record<DraftAction, 'accepted' | 'discarded'> = {
  approve: ACCEPTED_STATUS,
  discard: DISCARDED_STATUS,
}

const ACTION_TO_AUDIT: Record<DraftAction, string> = {
  approve: 'contract_release_rules_draft_approved',
  discard: 'contract_release_rules_draft_discarded',
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string; draftId: string }> },
) {
  const { dealId, draftId } = await params

  // ── 1. Auth ────────────────────────────────────────────────────────────
  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }
  const { user, profile } = authContext

  // Funder/admin only — contractor cannot approve or discard.
  if (profile.role !== 'funder' && profile.role !== 'admin') {
    return NextResponse.json(
      {
        error:
          'Only funders or platform admins can approve or discard draft release rules. ' +
          'Contractors do not author release governance.',
      },
      { status: 403 },
    )
  }

  const supabase = await createClient()
  try {
    await requireDealAccess(supabase, dealId, user.id, profile.role)
  } catch (err) {
    return err as NextResponse
  }

  // ── 2. Parse body ──────────────────────────────────────────────────────
  let body: { action?: string; reviewer_notes?: string }
  try {
    body = (await request.json()) as { action?: string; reviewer_notes?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }
  const action = body.action as DraftAction | undefined
  if (!action || !VALID_ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: `"action" must be one of: ${VALID_ACTIONS.join(', ')}` },
      { status: 400 },
    )
  }

  const reviewerNotes =
    typeof body.reviewer_notes === 'string'
      ? body.reviewer_notes.slice(0, 2000)
      : null

  // ── 3. Fetch the draft and verify scope ───────────────────────────────
  const admin = createSupabaseAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: draft, error: draftErr } = await (admin as any)
    .from('contract_release_rule_drafts')
    .select('id, deal_id, contract_id, status, payload, warnings')
    .eq('id', draftId)
    .maybeSingle()

  if (draftErr) {
    return internalError('Failed to fetch draft release-rules row.', draftErr.message)
  }
  if (!draft || draft.deal_id !== dealId) {
    return notFoundError(`No draft release-rules record was found for deal ${dealId}.`)
  }

  // Idempotency — refuse re-transition out of a terminal state.
  if (draft.status === ACCEPTED_STATUS || draft.status === DISCARDED_STATUS) {
    return NextResponse.json(
      {
        error: `This draft has already been ${draft.status}. No further transitions are allowed.`,
        existing_status: draft.status,
      },
      { status: 409 },
    )
  }

  // ── 4. Apply transition (status + reviewer fields only) ───────────────
  const newStatus = ACTION_TO_STATUS[action]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error: updateErr } = await (admin as any)
    .from('contract_release_rule_drafts')
    .update({
      status:         newStatus,
      reviewer_notes: reviewerNotes,
      reviewed_by:    user.id,
      reviewed_at:    new Date().toISOString(),
      updated_at:     new Date().toISOString(),
    })
    .eq('id', draft.id)
    .select('id, status, reviewed_by, reviewed_at')
    .single()

  if (updateErr || !updated) {
    return internalError('Could not record the draft review action.', updateErr?.message)
  }

  // ── 5. Audit ──────────────────────────────────────────────────────────
  const lineItemCount =
    Array.isArray(draft.payload?.sov_line_items)
      ? draft.payload.sov_line_items.length
      : 0
  const warningsCount =
    Array.isArray(draft.warnings) ? draft.warnings.length : 0

  await logAudit({
    entity_type:   'contract',
    entity_id:     draft.contract_id,
    action:        ACTION_TO_AUDIT[action],
    actor_id:      user.id,
    actor_role:    profile.role,
    system_source: 'api/deals/release-rules/draft',
    old_values:    { status: draft.status },
    new_values:    { status: newStatus },
    metadata: {
      deal_id:           dealId,
      draft_id:          draft.id,
      line_item_count:   lineItemCount,
      warnings_count:    warningsCount,
      has_reviewer_notes: !!reviewerNotes,
    },
  })

  return NextResponse.json({
    ok:           true,
    draft_id:     updated.id,
    status:       updated.status,
    reviewed_at:  updated.reviewed_at,
  })
}
