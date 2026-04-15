import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { internalError, notFoundError } from '@/lib/errors'

// ─── GET /api/invites/[token] ─────────────────────────────────────────────────
// Public endpoint — no auth required.
// Returns deal preview for the invite accept page.
//
// Security: The token itself is the secret. Without the token, the deal is
// not accessible. We return only the fields needed for the accept page preview —
// no sensitive financial data or participant IDs.
//
// Returns 404 for: invalid token, accepted invite, revoked invite, expired invite.
// This prevents token enumeration (attacker can't tell WHY a token fails).

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  if (!token || typeof token !== 'string') {
    return notFoundError('This invite link is invalid or has expired.')
  }

  const admin = createSupabaseAdminClient()

  // Fetch invite + deal preview in one query
  const { data: invite, error } = await admin
    .from('deal_invites')
    .select(
      `
      id,
      status,
      expires_at,
      invited_email,
      deal:deals (
        id,
        title,
        description,
        total_amount,
        status,
        contractor:profiles!deals_contractor_id_fkey (
          full_name,
          company_name
        )
      )
    `,
    )
    .eq('token', token)
    .single()

  if (error || !invite) {
    return notFoundError('This invite link is invalid or has expired.')
  }

  // Validate lifecycle state — all failures return the same 404 to prevent enumeration
  if (invite.status !== 'pending') {
    return notFoundError('This invite link is invalid or has expired.')
  }

  const expiresAt = new Date(invite.expires_at)
  if (expiresAt <= new Date()) {
    // Mark as expired in the background (fire-and-forget)
    admin
      .from('deal_invites')
      .update({ status: 'expired' })
      .eq('id', invite.id)
      .then(() => {})

    return notFoundError('This invite link is invalid or has expired.')
  }

  // Return only the preview data needed for the accept page
  type DealPreview = {
    id: string
    title: string
    description: string | null
    total_amount: number
    status: string
    contractor: { full_name: string; company_name: string | null } | { full_name: string; company_name: string | null }[] | null
  }
  const deal = invite.deal as unknown as DealPreview
  const contractorData = Array.isArray(deal.contractor) ? deal.contractor[0] ?? null : deal.contractor

  return NextResponse.json({
    invite: {
      id: invite.id,
      status: invite.status,
      expires_at: invite.expires_at,
      invited_email: invite.invited_email,
    },
    deal: {
      id: deal.id,
      title: deal.title,
      description: deal.description,
      total_amount: deal.total_amount,
      status: deal.status,
      contractor_name:
        contractorData?.company_name ?? contractorData?.full_name ?? 'A contractor',
    },
  })
}
