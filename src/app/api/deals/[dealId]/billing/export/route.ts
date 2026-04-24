import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { getAuthUser, requireDealAccess } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { errorResponse, notFoundError } from '@/lib/errors'

export const dynamic = 'force-dynamic'


// ─── GET /api/deals/[dealId]/billing/export ───────────────────────────────────
//
// Exports billing records for a deal as CSV or JSON.
//
// Query params:
//   format  = csv | json   (default: csv)
//
// CSV columns:
//   deal_id, milestone_title, gross_amount, fee_amount, retainage_amount,
//   net_amount, billing_rate_bps, transfer_status, stripe_transfer_id, created_at
//
// Access: Funder of the deal, or admin. Contractors cannot export billing data.
// Audit: Every download is logged as billing_export_downloaded.

interface BillingRecord {
  id:                  string
  deal_id:             string
  milestone_id:        string | null
  gross_amount:        number
  fee_amount:          number
  retainage_amount:    number | null
  net_amount:          number
  billing_rate_bps:    number
  transfer_status:     string | null
  stripe_transfer_id:  string | null
  created_at:          string
  milestone:           { title: string } | null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await params

  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext

  // Only funders and admins can download billing data
  if (profile.role !== 'funder' && profile.role !== 'admin') {
    return errorResponse(403, 'Only the deal funder or an admin may export billing records.')
  }

  const adminClient = createSupabaseAdminClient()

  // ── Deal access check ─────────────────────────────────────────────────────
  const { data: deal, error: dealError } = await adminClient
    .from('deals')
    .select('id, title, funder_id, status, billing_rate_bps')
    .eq('id', dealId)
    .single()

  if (dealError || !deal) {
    return notFoundError(`Deal ${dealId} was not found.`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  try {
    await requireDealAccess(adminClient as any, dealId, user.id, profile.role)
  } catch (err) {
    return err as NextResponse
  }

  // ── Parse query params ────────────────────────────────────────────────────
  const format = (request.nextUrl.searchParams.get('format') ?? 'csv').toLowerCase()
  if (format !== 'csv' && format !== 'json') {
    return errorResponse(400, "Invalid format. Use format=csv or format=json.")
  }

  // ── Fetch billing records ─────────────────────────────────────────────────
  const { data: records, error: recordsError } = await adminClient
    .from('billing_records')
    .select(
      'id, deal_id, milestone_id, gross_amount, fee_amount, retainage_amount, ' +
      'net_amount, billing_rate_bps, transfer_status, stripe_transfer_id, created_at, ' +
      'milestone:milestones!billing_records_milestone_id_fkey(title)'
    )
    .eq('deal_id', dealId)
    .order('created_at', { ascending: true })

  if (recordsError) {
    return errorResponse(500, 'Failed to fetch billing records. Please try again.')
  }

  const billingRecords = (records ?? []) as unknown as BillingRecord[]

  // ── Audit log ─────────────────────────────────────────────────────────────
  await logAudit({
    entity_type: 'deal',
    entity_id:   dealId,
    action:      'billing_export_downloaded',
    actor_id:    user.id,
    actor_role:  profile.role,
    old_values:  null,
    new_values:  null,
    metadata: {
      format,
      record_count:    billingRecords.length,
      deal_title:      deal.title,
      billing_rate_bps: deal.billing_rate_bps,
    },
  })

  // ── Build response ────────────────────────────────────────────────────────

  const safeTitle = (deal.title ?? dealId)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 40)

  if (format === 'json') {
    // Return normalized JSON array — strip internal Supabase join shape
    const payload = billingRecords.map((r) => ({
      id:                 r.id,
      deal_id:            r.deal_id,
      milestone_id:       r.milestone_id,
      milestone_title:    r.milestone?.title ?? null,
      gross_amount:       r.gross_amount,
      fee_amount:         r.fee_amount,
      retainage_amount:   r.retainage_amount ?? 0,
      net_amount:         r.net_amount,
      billing_rate_bps:   r.billing_rate_bps,
      transfer_status:    r.transfer_status,
      stripe_transfer_id: r.stripe_transfer_id,
      created_at:         r.created_at,
    }))

    return new NextResponse(JSON.stringify({ deal_id: dealId, records: payload }), {
      status:  200,
      headers: {
        'Content-Type':        'application/json',
        'Content-Disposition': `attachment; filename="billing-${safeTitle}.json"`,
        'Cache-Control':       'no-store',
      },
    })
  }

  // ── CSV ───────────────────────────────────────────────────────────────────

  const CSV_HEADERS = [
    'id',
    'deal_id',
    'milestone_id',
    'milestone_title',
    'gross_amount',
    'fee_amount',
    'retainage_amount',
    'net_amount',
    'billing_rate_bps',
    'transfer_status',
    'stripe_transfer_id',
    'created_at',
  ]

  function escapeCSV(value: string | number | null | undefined): string {
    if (value == null) return ''
    const str = String(value)
    // Wrap in quotes if the value contains commas, quotes, or newlines
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const rows: string[] = [
    CSV_HEADERS.join(','),
    ...billingRecords.map((r) =>
      [
        r.id,
        r.deal_id,
        r.milestone_id ?? '',
        r.milestone?.title ?? '',
        r.gross_amount,
        r.fee_amount,
        r.retainage_amount ?? 0,
        r.net_amount,
        r.billing_rate_bps,
        r.transfer_status ?? '',
        r.stripe_transfer_id ?? '',
        r.created_at,
      ]
        .map(escapeCSV)
        .join(','),
    ),
  ]

  const csv = rows.join('\r\n')

  return new NextResponse(csv, {
    status:  200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="billing-${safeTitle}.csv"`,
      'Cache-Control':       'no-store',
      // Hint actual byte length so browsers show accurate progress
      'Content-Length':      String(Buffer.byteLength(csv, 'utf8')),
    },
  })
}
