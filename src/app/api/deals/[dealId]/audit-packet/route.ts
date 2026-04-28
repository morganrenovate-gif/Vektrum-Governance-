import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireDealAccess } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { forbiddenError, notFoundError, internalError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

// ─── GET /api/deals/[dealId]/audit-packet ─────────────────────────────────────
//
// Returns a complete deal closeout / audit packet as JSON.
//
// ACCESS:
//   Funder of the deal or platform admin only. Contractors are blocked —
//   the packet includes internal governance commentary and billing details.
//
// SECTIONS (14):
//   1.  packet_metadata       — when generated, by whom, packet version
//   2.  deal_summary          — deal financials, rail, status, partner
//   3.  milestones            — all milestones with status, amounts, retainage
//   4.  releases              — all releases with rail, execution status, amounts
//   5.  billing_records       — all billing ledger entries
//   6.  transaction_receipts  — all confirmed-release receipts
//   7.  contracts             — active and historical contracts
//   8.  lien_waivers          — all lien waiver records
//   9.  change_orders         — all change orders across milestones
//   10. milestone_documents   — all uploaded evidence documents
//   11. retainage_releases    — all retainage release records
//   12. reconciliation_issues — open or resolved issues flagged by the reconciliation engine
//   13. audit_log             — full append-only, hash-chained event log
//   14. closeout_summary      — computed financial totals, completeness flags, disclaimer
//
// SECURITY:
//   - Never returns raw partner credentials or any service-role secret.
//   - The partner row (if present) is projected to { id, name } only.
//   - Read-only: no INSERT, UPDATE, DELETE, or UPSERT operations.
//   - Export is itself logged to audit_log (actors cannot silently extract packets).
//
// AUDIT DISCLAIMER:
//   The audit_log section is tamper-evident (each row carries a SHA-256 row_hash
//   and a cumulative chain_hash). Tamper-evidence depends on hash integrity across
//   the chain; verification requires recomputing hashes against the canonical payload.
//   database write access.

const PACKET_VERSION = '1.0'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> },
): Promise<NextResponse> {
  const { dealId } = await params

  // ── Auth ──────────────────────────────────────────────────────────────────
  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext

  // Contractors may not export the packet — it contains billing/governance details.
  if (profile.role === 'contractor') {
    return forbiddenError(
      'Deal audit packets are available to the deal funder and platform administrators only.',
    )
  }

  const supabase = await createClient()

  try {
    await requireDealAccess(supabase, dealId, user.id, profile.role)
  } catch (err) {
    return err as NextResponse
  }

  const admin = createSupabaseAdminClient()
  const generatedAt = new Date().toISOString()

  // ── Parallel fetch — most sections do not depend on each other ────────────
  const [
    dealResult,
    milestonesResult,
    releasesResult,
    billingResult,
    receiptsResult,
    contractsResult,
    lienWaiversResult,
    changeOrdersResult,
    documentsResult,
    retainageReleasesResult,
    reconIssuesResult,
    auditLogResult,
  ] = await Promise.all([
    // 1. Deal
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from('deals')
      .select(
        'id, title, status, execution_rail, total_amount, funded_amount, ' +
        'released_amount, fee_amount, reserved_amount, retainage_percentage, ' +
        'retainage_held, retainage_released, billing_rate_bps, lien_waiver_required, ' +
        'contractor_id, funder_id, partner_id, created_at, updated_at, ' +
        'partner:partners!deals_partner_id_fkey ( id, name )',
      )
      .eq('id', dealId)
      .single(),

    // 2. Milestones
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from('milestones')
      .select(
        'id, title, description, amount, retainage_amount, status, ' +
        'protection_status, execution_rail, sequence_order, is_sequential, ' +
        'created_at, updated_at',
      )
      .eq('deal_id', dealId)
      .order('sequence_order', { ascending: true }),

    // 3. Releases
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from('releases')
      .select(
        'id, milestone_id, status, execution_rail, execution_status, ' +
        'gross_amount, fee_amount, retainage_amount, net_amount, ' +
        'external_payment_method, external_payment_reference, external_executed_at, ' +
        'external_execution_notes, stripe_transfer_id, confirmed_at, created_at, updated_at',
      )
      .eq('deal_id', dealId)
      .order('created_at', { ascending: true }),

    // 4. Billing records
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from('billing_records')
      .select(
        'id, milestone_id, gross_amount, fee_amount, retainage_amount, ' +
        'net_amount, billing_rate_bps, transfer_status, stripe_transfer_id, created_at',
      )
      .eq('deal_id', dealId)
      .order('created_at', { ascending: true }),

    // 5. Transaction receipts — joined through releases
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from('transaction_receipts')
      .select(
        'id, release_id, receipt_number, amount, fee_amount, net_amount, ' +
        'payment_method, recipient_name, issued_at, created_at',
      )
      .eq('deal_id', dealId)
      .order('issued_at', { ascending: true }),

    // 6. Contracts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from('contracts')
      .select(
        'id, status, docusign_envelope_id, funder_signed_at, contractor_signed_at, ' +
        'voided_at, created_at',
      )
      .eq('deal_id', dealId)
      .order('created_at', { ascending: true }),

    // 7. Lien waivers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from('lien_waivers')
      .select(
        'id, milestone_id, waiver_type, status, file_url, ' +
        'requested_at, uploaded_at, approved_at, rejected_at, rejection_reason, created_at',
      )
      .eq('deal_id', dealId)
      .order('created_at', { ascending: true }),

    // 8. Change orders
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from('change_orders')
      .select(
        'id, milestone_id, amount, description, status, ' +
        'submitted_by, approved_by, approved_at, rejection_reason, created_at',
      )
      .eq('deal_id', dealId)
      .order('created_at', { ascending: true }),

    // 9. Milestone documents
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from('milestone_documents')
      .select(
        'id, milestone_id, uploaded_by, file_url, file_type, description, created_at',
      )
      .eq('deal_id', dealId)
      .order('created_at', { ascending: true }),

    // 10. Retainage releases
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from('retainage_releases')
      .select(
        'id, amount, stripe_transfer_id, idempotency_key, created_at',
      )
      .eq('deal_id', dealId)
      .order('created_at', { ascending: true }),

    // 11. Reconciliation issues
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from('reconciliation_issues')
      .select(
        'id, issue_type, severity, status, description, affected_entity_type, ' +
        'affected_entity_id, detected_at, resolved_at, created_at',
      )
      .eq('deal_id', dealId)
      .order('detected_at', { ascending: true }),

    // 12. Audit log — full chain, ordered by event_sequence for chain verification
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from('audit_log')
      .select(
        'id, event_sequence, created_at, entity_type, entity_id, action, ' +
        'actor_name, actor_role, actor_email, system_source, ' +
        'old_values, new_values, metadata, row_hash, chain_hash',
      )
      .eq('entity_id', dealId)
      .order('event_sequence', { ascending: true }),
  ])

  // Deal must exist (already checked via requireDealAccess, but verify the fetch)
  if (dealResult.error || !dealResult.data) {
    return notFoundError(`Deal ${dealId} was not found.`)
  }

  // Non-critical section failures are tolerated — log and continue with null
  if (
    milestonesResult.error || releasesResult.error || billingResult.error ||
    receiptsResult.error || contractsResult.error || lienWaiversResult.error ||
    changeOrdersResult.error || documentsResult.error || retainageReleasesResult.error ||
    reconIssuesResult.error || auditLogResult.error
  ) {
    const sectionErrors = [
      milestonesResult.error         && `milestones: ${milestonesResult.error.message}`,
      releasesResult.error            && `releases: ${releasesResult.error.message}`,
      billingResult.error             && `billing_records: ${billingResult.error.message}`,
      receiptsResult.error            && `transaction_receipts: ${receiptsResult.error.message}`,
      contractsResult.error           && `contracts: ${contractsResult.error.message}`,
      lienWaiversResult.error         && `lien_waivers: ${lienWaiversResult.error.message}`,
      changeOrdersResult.error        && `change_orders: ${changeOrdersResult.error.message}`,
      documentsResult.error           && `milestone_documents: ${documentsResult.error.message}`,
      retainageReleasesResult.error   && `retainage_releases: ${retainageReleasesResult.error.message}`,
      reconIssuesResult.error         && `reconciliation_issues: ${reconIssuesResult.error.message}`,
      auditLogResult.error            && `audit_log: ${auditLogResult.error.message}`,
    ].filter(Boolean)

    // audit_log failure is fatal — it is the core of the packet
    if (auditLogResult.error) {
      return internalError('Failed to retrieve audit log for deal.', auditLogResult.error.message)
    }

    console.warn('[audit-packet] Non-fatal section fetch errors:', sectionErrors)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deal = dealResult.data as any
  const milestones            = (milestonesResult.data          ?? []) as unknown[]
  const releases              = (releasesResult.data            ?? []) as unknown[]
  const billingRecords        = (billingResult.data             ?? []) as unknown[]
  const receipts              = (receiptsResult.data            ?? []) as unknown[]
  const contracts             = (contractsResult.data           ?? []) as unknown[]
  const lienWaivers           = (lienWaiversResult.data         ?? []) as unknown[]
  const changeOrders          = (changeOrdersResult.data        ?? []) as unknown[]
  const documents             = (documentsResult.data           ?? []) as unknown[]
  const retainageReleases     = (retainageReleasesResult.data   ?? []) as unknown[]
  const reconIssues           = (reconIssuesResult.data         ?? []) as unknown[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const auditRows             = (auditLogResult.data            ?? []) as any[]

  // ── Compute closeout summary ───────────────────────────────────────────────
  const totalGross      = (billingRecords as any[]).reduce((s, r) => s + (r.gross_amount ?? 0), 0)
  const totalFees       = (billingRecords as any[]).reduce((s, r) => s + (r.fee_amount ?? 0), 0)
  const totalRetainage  = (billingRecords as any[]).reduce((s, r) => s + (r.retainage_amount ?? 0), 0)
  const totalNet        = (billingRecords as any[]).reduce((s, r) => s + (r.net_amount ?? 0), 0)
  const totalRetainageReleased = (retainageReleases as any[]).reduce((s, r) => s + (r.amount ?? 0), 0)

  const milestonesArr   = milestones as any[]
  const releasesArr     = releases as any[]
  const reconIssuesArr  = reconIssues as any[]
  const contractsArr    = contracts as any[]
  const lienWaiversArr  = lienWaivers as any[]

  const milestonesTotal       = milestonesArr.length
  const milestonesReleased    = milestonesArr.filter((m) => m.status === 'released').length
  const milestonesApproved    = milestonesArr.filter((m) => m.status === 'approved').length
  const releasesPending       = releasesArr.filter((r) => r.status === 'pending').length
  const releasesConfirmed     = releasesArr.filter((r) => r.status === 'confirmed').length

  const hasSignedContract = contractsArr.some(
    (c) => c.status === 'active' && !c.voided_at,
  )
  const allLienWaiversApproved = lienWaiversArr.length > 0
    ? lienWaiversArr.every((w) => w.status === 'approved')
    : null  // null means no waivers required/requested

  const openReconIssues   = reconIssuesArr.filter((i) => i.status !== 'resolved').length
  const auditChainLength  = auditRows.length
  const lastChainHash     = auditRows.length > 0
    ? (auditRows[auditRows.length - 1]?.chain_hash ?? null)
    : null

  const closeoutSummary = {
    financial: {
      funded_amount:         deal.funded_amount         ?? 0,
      total_gross_released:  totalGross,
      total_fees_charged:    totalFees,
      total_retainage_held:  totalRetainage,
      total_retainage_released: totalRetainageReleased,
      total_net_to_contractor: totalNet,
      retainage_balance_remaining: (deal.retainage_held ?? 0) - totalRetainageReleased,
    },
    milestones: {
      total:    milestonesTotal,
      released: milestonesReleased,
      approved: milestonesApproved,
      pending:  milestonesTotal - milestonesReleased - milestonesApproved,
    },
    releases: {
      confirmed: releasesConfirmed,
      pending:   releasesPending,
      total:     releasesArr.length,
    },
    governance: {
      has_signed_contract:       hasSignedContract,
      all_lien_waivers_approved: allLienWaiversApproved,
      open_reconciliation_issues: openReconIssues,
    },
    audit_chain: {
      event_count:    auditChainLength,
      last_chain_hash: lastChainHash,
    },
    disclaimer:
      'The audit_log section is tamper-evident: each row carries a SHA-256 row_hash ' +
      'and a cumulative chain_hash over all prior rows. Tamper-evidence can be verified ' +
      'by recomputing hashes against the canonical payload. It is not cryptographically ' +
      'not cryptographically guaranteed against an attacker with direct database write access. ' +
      'Vektrum does not hold or custody funds; payment execution occurs through ' +
      'the Stripe Connect rail or the customer\'s existing payment process.',
  }

  // ── Log the export ────────────────────────────────────────────────────────
  logAudit({
    entity_type:   'deal',
    entity_id:     dealId,
    action:        'audit_packet_exported',
    actor_id:      user.id,
    actor_role:    profile.role,
    system_source: 'api/deals/audit-packet',
    metadata: {
      deal_title:          deal.title,
      audit_row_count:     auditChainLength,
      milestone_count:     milestonesTotal,
      release_count:       releasesArr.length,
      packet_version:      PACKET_VERSION,
    },
  }).catch((err) => console.warn('[audit-packet] Failed to log export event:', err))

  // ── Build and return the packet ────────────────────────────────────────────
  const packet = {
    packet_metadata: {
      packet_version:  PACKET_VERSION,
      generated_at:    generatedAt,
      generated_by:    user.id,
      generated_role:  profile.role,
      deal_id:         dealId,
      source:          'Vektrum Governance Platform',
    },

    deal_summary: {
      id:                    deal.id,
      title:                 deal.title,
      status:                deal.status,
      execution_rail:        deal.execution_rail,
      total_amount:          deal.total_amount,
      funded_amount:         deal.funded_amount,
      released_amount:       deal.released_amount,
      fee_amount:            deal.fee_amount,
      reserved_amount:       deal.reserved_amount,
      retainage_percentage:  deal.retainage_percentage,
      retainage_held:        deal.retainage_held,
      retainage_released:    deal.retainage_released,
      billing_rate_bps:      deal.billing_rate_bps,
      lien_waiver_required:  deal.lien_waiver_required,
      // Partner: projected to id+name only — no credentials, no webhook URLs
      partner:               deal.partner
        ? { id: deal.partner.id, name: deal.partner.name }
        : null,
      created_at:            deal.created_at,
      updated_at:            deal.updated_at,
    },

    milestones,
    releases,
    billing_records:       billingRecords,
    transaction_receipts:  receipts,
    contracts,
    lien_waivers:          lienWaivers,
    change_orders:         changeOrders,
    milestone_documents:   documents,
    retainage_releases:    retainageReleases,
    reconciliation_issues: reconIssues,
    audit_log:             auditRows,

    closeout_summary: closeoutSummary,
  }

  const safeTitle = (deal.title ?? dealId)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 40)

  const filename = `audit-packet-${safeTitle}-${new Date().toISOString().slice(0, 10)}.json`

  return new NextResponse(JSON.stringify(packet, null, 2), {
    status: 200,
    headers: {
      'Content-Type':           'application/json; charset=utf-8',
      'Content-Disposition':    `attachment; filename="${filename}"`,
      'Cache-Control':          'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
