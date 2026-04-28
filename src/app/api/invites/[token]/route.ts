import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { internalError, notFoundError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

// ─── GET /api/invites/[token] ─────────────────────────────────────────────────
// Public endpoint — no auth required.
// Returns deal preview for the invite accept page.
//
// Security: The token itself is the secret. Without the token, the deal is
// not accessible. We return only the fields needed for the accept page preview —
// no sensitive financial data or participant IDs.
//
// Returns 404 for: invalid token, accepted invite, expired invite.
// This prevents token enumeration (attacker can't tell WHY a token fails).
//
// Valid invite: token matches, status = 'pending', expires_at > now(),
//               accepted_at IS NULL, accepted_by IS NULL.

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  if (!token || typeof token !== 'string') {
    return notFoundError('This invite link is invalid or has expired.')
  }

  const admin = createSupabaseAdminClient()

  // Fetch invite + deal preview in one query.
  // Filter accepted_at IS NULL in the query itself for defense-in-depth:
  // even if status is somehow wrong, an invite with accepted_at set is invalid.
  const { data: invite, error } = await admin
    .from('deal_invites')
    .select(
      `
      id,
      status,
      role,
      expires_at,
      invited_email,
      accepted_at,
      accepted_by,
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
    .is('accepted_at', null)
    .is('accepted_by', null)
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

  // Validate role — every funder invite must have role = 'funder'.
  // A null role means the invite was created by an older code path that did not
  // persist the role. This is a data integrity issue, not a security issue, so
  // we return a distinct machine-readable reason so the UI can show a helpful
  // message rather than a generic error. The HTTP status is still 404 so token
  // existence is not revealed to an attacker who doesn't already have the token.
  if (!invite.role) {
    return NextResponse.json(
      {
        error: 'This invite link is incomplete — it is missing the intended role. Ask the contractor to generate a new invite link.',
        reason: 'missing_role',
      },
      { status: 404 },
    )
  }

  if (invite.role !== 'funder') {
    return NextResponse.json(
      {
        error: 'This invite link is not intended for a funder account.',
        reason: 'wrong_role',
      },
      { status: 404 },
    )
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
      role: invite.role,
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
