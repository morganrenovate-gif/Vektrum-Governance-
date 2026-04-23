import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/middleware'
import { getReceiptByReleaseId, markReceiptEmailSent } from '@/lib/engine/receipts'
import { notifyTransactionReceipt } from '@/lib/engine/notifications'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { notFoundError, internalError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

// ─── POST /api/releases/[releaseId]/receipt/resend ────────────────────────────
// Re-sends the transaction receipt email to the contractor and funder.
//
// Access: deal participants (contractor or funder) or admin.
// Use case: compliance handoff — funder wants to re-send receipt to their team.
//
// Rate limiting: not currently enforced server-side; UI button is sufficient
// for the expected use pattern (occasional compliance re-send).

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ releaseId: string }> },
) {
  const { releaseId } = await params

  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext

  // ── Fetch receipt ────────────────────────────────────────────────────────────
  const receipt = await getReceiptByReleaseId(releaseId)

  if (!receipt) {
    return notFoundError(`No receipt found for release ${releaseId}.`)
  }

  // ── Access check ────────────────────────────────────────────────────────────
  const isAdmin       = profile.role === 'admin'
  const isParticipant = receipt.contractor_id === user.id || receipt.funder_id === user.id

  if (!isAdmin && !isParticipant) {
    return NextResponse.json(
      { error: 'You do not have access to this receipt.' },
      { status: 403 },
    )
  }

  // ── Do not resend for failed/reversed receipts ───────────────────────────────
  // A failed receipt is informational — the transfer did not complete.
  // The payout failure notification already covers this case.
  if (receipt.status === 'failed' || receipt.status === 'reversed') {
    return NextResponse.json(
      { error: `Cannot resend a receipt with status '${receipt.status}'. The transfer did not complete.` },
      { status: 422 },
    )
  }

  // ── Fetch emails ─────────────────────────────────────────────────────────────
  const adminClient = createSupabaseAdminClient()

  const [contractorResult, funderResult] = await Promise.allSettled([
    adminClient.auth.admin.getUserById(receipt.contractor_id),
    adminClient.auth.admin.getUserById(receipt.funder_id),
  ])

  const contractorEmail =
    contractorResult.status === 'fulfilled'
      ? (contractorResult.value.data?.user?.email ?? '')
      : ''

  const funderEmail =
    funderResult.status === 'fulfilled'
      ? (funderResult.value.data?.user?.email ?? '')
      : ''

  if (!contractorEmail || !funderEmail) {
    return internalError(
      'Could not retrieve email addresses for one or both deal participants. ' +
        'Receipt was not resent.',
    )
  }

  // ── Send ─────────────────────────────────────────────────────────────────────
  await notifyTransactionReceipt(
    {
      receiptId:        receipt.id,
      receiptNumber:    receipt.receipt_number,
      milestoneTitle:   receipt.milestone_title,
      dealTitle:        receipt.deal_title,
      dealId:           receipt.deal_id,
      grossAmount:      receipt.gross_amount,
      feeAmount:        receipt.fee_amount,
      feeBps:           receipt.fee_rate_bps,
      totalCharged:     receipt.total_charged,
      stripeTransferId: receipt.stripe_transfer_id,
      releasedAt:       receipt.released_at,
      contractorName:   receipt.contractor_name,
      funderName:       receipt.funder_name,
    },
    contractorEmail,
    funderEmail,
  )

  await markReceiptEmailSent(receipt.id)

  return NextResponse.json({
    success:       true,
    receipt_id:    receipt.id,
    receipt_number: receipt.receipt_number,
    sent_to:       [contractorEmail, funderEmail],
  })
}
