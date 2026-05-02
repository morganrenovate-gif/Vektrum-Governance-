/**
 * POST /api/deals/[dealId]/release-rules/generate-from-contract
 *
 * Funder/admin-only. Takes a fully-signed contract, extracts its text, asks
 * Perplexity to draft SOV + retainage + release-condition + evidence rules,
 * and stores the result as a DRAFT row in contract_release_rule_drafts.
 *
 * HARD GUARANTEES:
 *   - Output is never marked approved. status='draft' on insert.
 *   - Never authorizes release.
 *   - Never moves money.
 *   - Never imports Stripe, Stripe transfers, or release-execution code.
 *   - Never modifies SOV, milestones, deal funded/released amounts.
 *   - Never lowers funder_authorization_required (product invariant).
 *   - PERPLEXITY_API_KEY is read from process.env (server-only).
 *
 * Idempotency:
 *   - The contract_release_rule_drafts table has a partial unique index on
 *     (contract_id) WHERE status IN ('draft','reviewed') so only ONE active
 *     draft can exist per contract. A second POST while a draft exists
 *     returns 409 with the existing draft id.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { getAuthUser, requireDealAccess } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { extractSignedContractText } from '@/lib/engine/contract-text'
import { generateDraftReleaseRules } from '@/lib/engine/contract-release-rules'
import { internalError, notFoundError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

// Don't let the function silently die on long Perplexity calls.
export const maxDuration = 60

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await params

  // ── 1. Auth ────────────────────────────────────────────────────────────
  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }
  const { user, profile } = authContext

  // Funder/admin only. Contractor cannot generate or approve release rules
  // in this pass — even if they're a deal participant.
  if (profile.role !== 'funder' && profile.role !== 'admin') {
    return NextResponse.json(
      {
        error:
          'Only funders or platform admins can generate draft release rules. ' +
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

  // ── 2. Fetch contract + sov-approved gate ─────────────────────────────
  const admin = createSupabaseAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: contract, error: contractErr } = await (admin as any)
    .from('contracts')
    .select('id, deal_id, status, storage_path, signed_storage_path, funder_signed_at, contractor_signed_at')
    .eq('deal_id', dealId)
    .maybeSingle()

  if (contractErr) {
    return internalError('Failed to fetch contract record.', contractErr.message)
  }
  if (!contract) {
    return notFoundError(`No contract has been uploaded for deal ${dealId}.`)
  }
  if (contract.status === 'voided') {
    return NextResponse.json(
      { error: 'This contract has been voided. Upload a new contract before generating release rules.' },
      { status: 409 },
    )
  }

  // Hard precondition — both timestamps OR contract.status === 'signed'.
  // The timestamps are the ground truth (see signed-contract-to-sov pass).
  const fullySigned =
    !!contract.funder_signed_at && !!contract.contractor_signed_at
  if (!fullySigned) {
    return NextResponse.json(
      {
        error:
          'The contract must be fully signed by both parties before draft release rules can be generated.',
      },
      { status: 409 },
    )
  }

  // Idempotency — refuse if an active draft already exists.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingDraft } = await (admin as any)
    .from('contract_release_rule_drafts')
    .select('id, status, created_at')
    .eq('contract_id', contract.id)
    .in('status', ['draft', 'reviewed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingDraft) {
    return NextResponse.json(
      {
        error: 'A draft release-rules record already exists for this contract. Review or discard it before generating a new one.',
        existing_draft_id:     existingDraft.id,
        existing_draft_status: existingDraft.status,
      },
      { status: 409 },
    )
  }

  // Refuse if approved SOV exists — at that point the human has already
  // authored the release rules. No silent overwrite.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: approvedSov } = await (admin as any)
    .from('sov_line_items')
    .select('id')
    .eq('deal_id', dealId)
    .eq('status', 'approved')
    .limit(1)
    .maybeSingle()

  if (approvedSov) {
    return NextResponse.json(
      { error: 'An approved SOV already exists. Draft release-rule generation is disabled to avoid overwriting human-approved rules.' },
      { status: 409 },
    )
  }

  // ── 3. Fetch deal metadata (best-effort) ──────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: deal } = await (admin as any)
    .from('deals')
    .select('id, title, total_amount')
    .eq('id', dealId)
    .single()

  // ── 4. Extract contract text ──────────────────────────────────────────
  const extraction = await extractSignedContractText(contract)
  if (!extraction.ok) {
    console.warn('[release-rules] extraction failed', {
      deal_id:     dealId,
      contract_id: contract.id,
      reason:      extraction.reason,
    })
    return NextResponse.json({ error: extraction.error }, { status: 422 })
  }

  // ── 5. Call Perplexity ────────────────────────────────────────────────
  const result = await generateDraftReleaseRules({
    dealTitle:        deal?.title ?? null,
    contractFileName: extraction.sourcePath.split('/').pop() ?? null,
    contractTotal:    typeof deal?.total_amount === 'number' ? deal.total_amount : null,
    contractText:     extraction.text,
  })
  if (!result.ok) {
    const status =
      result.reason === 'config'              ? 503 :
      result.reason === 'unreadable_contract' ? 422 :
      result.reason === 'invalid_json'        ? 502 :
      result.reason === 'upstream'            ? 502 : 500
    console.error('[release-rules] generation failed', {
      deal_id:     dealId,
      contract_id: contract.id,
      reason:      result.reason,
    })
    return NextResponse.json({ error: result.error }, { status })
  }

  // ── 6. Persist as DRAFT — never approved ──────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error: insertErr } = await (admin as any)
    .from('contract_release_rule_drafts')
    .insert({
      deal_id:      dealId,
      contract_id:  contract.id,
      generated_by: user.id,
      status:       'draft',
      source:       result.source,
      payload:      result.draft,
      warnings:     result.draft.warnings,
    })
    .select('id, status, created_at')
    .single()

  if (insertErr || !inserted) {
    console.error('[release-rules] insert failed', { error: insertErr?.message })
    return internalError('Could not save the draft release rules. Please try again.', insertErr?.message)
  }

  // ── 7. Audit ──────────────────────────────────────────────────────────
  await logAudit({
    entity_type:   'contract',
    entity_id:     contract.id,
    action:        'contract_release_rules_draft_generated',
    actor_id:      user.id,
    actor_role:    profile.role,
    system_source: 'api/deals/release-rules/generate-from-contract',
    metadata: {
      deal_id:           dealId,
      draft_id:          inserted.id,
      source:            result.source,
      line_item_count:   result.draft.sov_line_items.length,
      warnings_count:    result.draft.warnings.length,
      assumptions_count: result.draft.assumptions.length,
      total_amount:      result.lineItemsTotal,
      contract_total:    deal?.total_amount ?? null,
    },
  })

  // 200 + the draft record so the UI can immediately show "Review required."
  return NextResponse.json({
    ok:                true,
    draft_id:          inserted.id,
    status:            inserted.status,         // always 'draft'
    line_item_count:   result.draft.sov_line_items.length,
    warnings_count:    result.draft.warnings.length,
    assumptions_count: result.draft.assumptions.length,
    review_required:   true,
  })
}
