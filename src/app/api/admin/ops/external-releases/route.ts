import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser, requireRole, requireMFA } from '@/lib/auth/middleware'
import { internalError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

// ─── GET /api/admin/ops/external-releases ────────────────────────────────────
//
// Returns external-rail release hygiene signals for the ops dashboard:
//
//   1. awaiting_confirmation — releases with execution_rail='external_manual'
//      and execution_status='pending'. Ordered by age descending.
//
//   2. overdue — subset of awaiting_confirmation where age exceeds the SLA
//      (default 72 h; override via ?sla_hours=N).
//
//   3. confirmed_missing_reference — confirmed external releases with no
//      external_payment_reference. Hard evidence gap.
//
//   4. confirmed_missing_proof — confirmed external releases with no
//      proof_of_payment_document_id. Soft evidence gap (ops-coachable).
//
// Admin-only, MFA-required, read-only.

const DEFAULT_SLA_HOURS = 72

export async function GET(request: NextRequest) {
  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  try {
    requireRole(authContext.profile, 'admin')
  } catch (err) {
    return err as NextResponse
  }

  const supabase = await createClient()
  try {
    await requireMFA(supabase, authContext.profile)
  } catch (err) {
    return err as NextResponse
  }

  const url = new URL(request.url)
  const slaHours = Math.max(
    1,
    parseInt(url.searchParams.get('sla_hours') ?? String(DEFAULT_SLA_HOURS), 10) || DEFAULT_SLA_HOURS,
  )
  const overdueCutoff = Date.now() - slaHours * 3_600_000

  const admin = createSupabaseAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows, error } = await (admin as any)
    .from('releases')
    .select(
      `id, milestone_id, deal_id, amount, created_at,
       execution_rail, execution_status,
       external_payment_method, external_payment_reference,
       external_executed_at, external_executed_by,
       external_execution_notes, proof_of_payment_document_id,
       milestones:milestones!releases_milestone_id_fkey ( id, title ),
       deals:deals!releases_deal_id_fkey (
         id, title,
         contractor:profiles!deals_contractor_id_fkey ( id, full_name, company_name ),
         funder:profiles!deals_funder_id_fkey         ( id, full_name, company_name )
       )`,
    )
    .eq('execution_rail', 'external_manual')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    return internalError('Failed to fetch external releases.', error.message)
  }

  type JoinedRow = {
    id: string
    milestone_id: string
    deal_id: string
    amount: number
    created_at: string
    execution_rail: string
    execution_status: string | null
    external_payment_method: string | null
    external_payment_reference: string | null
    external_executed_at: string | null
    external_executed_by: string | null
    external_execution_notes: string | null
    proof_of_payment_document_id: string | null
    milestones: { id: string; title: string } | null
    deals: {
      id: string
      title: string
      contractor: { id: string; full_name: string | null; company_name: string | null } | null
      funder:     { id: string; full_name: string | null; company_name: string | null } | null
    } | null
  }

  const partyName = (p: { full_name: string | null; company_name: string | null } | null) =>
    p?.full_name ?? p?.company_name ?? 'Unknown'

  const hoursSince = (iso: string | null): number | null =>
    iso ? Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000) : null

  const shape = (r: JoinedRow) => ({
    release_id:       r.id,
    milestone_id:     r.milestone_id,
    milestone_title:  r.milestones?.title ?? 'Unknown milestone',
    deal_id:          r.deal_id,
    deal_title:       r.deals?.title ?? 'Unknown deal',
    amount:           Number(r.amount),
    created_at:       r.created_at,
    age_hours:        hoursSince(r.created_at),
    execution_status: r.execution_status,
    payment_method:   r.external_payment_method,
    payment_reference:r.external_payment_reference,
    executed_at:      r.external_executed_at,
    executed_by:      r.external_executed_by,
    proof_document_id:r.proof_of_payment_document_id,
    contractor_name:  partyName(r.deals?.contractor ?? null),
    funder_name:      partyName(r.deals?.funder ?? null),
  })

  const all = (rows ?? []) as JoinedRow[]

  const awaitingConfirmation = all.filter(r => r.execution_status === 'pending').map(shape)
  const overdue = awaitingConfirmation.filter(
    r => r.age_hours !== null && r.age_hours >= slaHours,
  )
  const confirmedMissingReference = all
    .filter(r => r.execution_status === 'confirmed' && !r.external_payment_reference)
    .map(shape)
  const confirmedMissingProof = all
    .filter(r => r.execution_status === 'confirmed' && !r.proof_of_payment_document_id)
    .map(shape)
  const failed = all.filter(r => r.execution_status === 'failed').map(shape)

  // Back-sanity: any external row with stripe_transfer_id would be a CHECK
  // constraint violation. Expose as its own bucket for visibility.
  const railMismatches = all
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter(r => (r as any).stripe_transfer_id)
    .map(shape)

  return NextResponse.json({
    scanned_at: new Date().toISOString(),
    sla_hours:  slaHours,
    counts: {
      awaiting_confirmation:       awaitingConfirmation.length,
      overdue:                     overdue.length,
      confirmed_missing_reference: confirmedMissingReference.length,
      confirmed_missing_proof:     confirmedMissingProof.length,
      failed:                      failed.length,
      rail_mismatches:             railMismatches.length,
    },
    awaiting_confirmation:       awaitingConfirmation,
    overdue,
    confirmed_missing_reference: confirmedMissingReference,
    confirmed_missing_proof:     confirmedMissingProof,
    failed,
    rail_mismatches:             railMismatches,
  })
}
