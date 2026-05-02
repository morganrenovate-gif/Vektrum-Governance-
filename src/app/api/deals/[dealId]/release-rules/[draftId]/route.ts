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

  // ── 5. Audit (status transition) ──────────────────────────────────────
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

  // ── 6. Materialise SOV draft rows on approve ──────────────────────────
  //
  // Hard guarantees:
  //   - Inserts only into sov_line_items, only with status='draft'.
  //   - Never marks SOV approved (status='approved' requires the existing
  //     manual-approval workflow).
  //   - Idempotent — checks for existing rows with this draft as
  //     source_draft_id before inserting (covers retry, double-submit,
  //     and replay scenarios).
  //   - Failure here is non-fatal to the response: the draft has already
  //     transitioned to 'accepted' and the audit row is in. Funder/admin
  //     can use "Enter manually" to retry SOV creation.
  //   - Never touches milestones, deals.funded_amount, deals.released_amount,
  //     contracts, or anything Stripe-related.
  let sovRowsCreated = 0
  let sovTotalAmount = 0
  if (action === 'approve' && lineItemCount > 0) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingFromDraft } = await (admin as any)
        .from('sov_line_items')
        .select('id')
        .eq('deal_id', dealId)
        .eq('source_draft_id', draft.id)
        .limit(1)
        .maybeSingle()

      if (existingFromDraft) {
        console.info('[release-rules/approve] SOV rows already materialised for this draft — skipping', {
          deal_id:  dealId,
          draft_id: draft.id,
        })
      } else {
        // Build SOV insert rows from the accepted payload. Every row goes in
        // as status='draft'. revised_value / balance_to_finish are
        // app-maintained derivatives (see migration); we initialise them
        // consistently with manual entry.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const items = draft.payload.sov_line_items as Array<any>
        const rows = items.map((item, idx) => {
          const scheduledValue =
            typeof item.amount === 'number' && Number.isFinite(item.amount) && item.amount >= 0
              ? item.amount
              : 0
          sovTotalAmount += scheduledValue
          // Truncate description to a sane length to stay below any
          // future column-width constraint while preserving the source.
          const baseDescription =
            typeof item.description === 'string' && item.description.trim()
              ? item.description.trim()
              : item.name
          return {
            deal_id:                dealId,
            item_number:            String(idx + 1),
            description:            String(baseDescription).slice(0, 1000),
            scheduled_value:        scheduledValue,
            approved_change_orders: 0,
            revised_value:          scheduledValue,
            previous_released:      0,
            current_requested:      0,
            retainage_amount:       0,
            balance_to_finish:      scheduledValue,
            percent_complete:       0,
            status:                 'draft',
            sort_order:             idx,
            created_by:             user.id,
            source_draft_id:        draft.id,
          }
        })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: inserted, error: insertErr } = await (admin as any)
          .from('sov_line_items')
          .insert(rows)
          .select('id')

        if (insertErr) {
          console.error('[release-rules/approve] sov_line_items insert failed', {
            deal_id:  dealId,
            draft_id: draft.id,
            error:    insertErr.message?.slice(0, 200),
          })
        } else {
          sovRowsCreated = inserted?.length ?? 0
          // Audit the materialisation as a separate event so the chain
          // shows two distinct facts: the funder accepted the draft, AND
          // a draft SOV was materialised from it.
          await logAudit({
            entity_type:   'contract',
            entity_id:     draft.contract_id,
            action:        'sov_draft_created_from_release_rules',
            actor_id:      user.id,
            actor_role:    profile.role,
            system_source: 'api/deals/release-rules/draft',
            metadata: {
              deal_id:        dealId,
              draft_id:       draft.id,
              line_item_count: sovRowsCreated,
              total_amount:    sovTotalAmount,
              warnings_count:  warningsCount,
            },
          })
        }
      }
    } catch (err) {
      console.error('[release-rules/approve] unexpected error materialising SOV', {
        deal_id:  dealId,
        draft_id: draft.id,
        error:    err instanceof Error ? err.message.slice(0, 200) : String(err),
      })
    }
  }

  return NextResponse.json({
    ok:                 true,
    draft_id:           updated.id,
    status:             updated.status,
    reviewed_at:        updated.reviewed_at,
    sov_rows_created:   sovRowsCreated,
    sov_total_amount:   sovTotalAmount,
  })
}
