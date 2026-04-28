import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// ─── GET /api/invites/[token] ─────────────────────────────────────────────────
// Public endpoint — no auth required.
// Returns deal preview for the invite accept page.
//
// Security model:
//   - The token itself is the secret. Without the token, the deal is not accessible.
//   - We MUST use the service-role admin client (createSupabaseAdminClient) to bypass
//     RLS on deal_invites. The table's RLS policies restrict SELECT to authenticated
//     users only — unauthenticated reads via the anon key will return 0 rows even
//     for valid tokens, causing a false "not found" response.
//   - We validate every field server-side before returning any preview data.
//   - We return only safe preview fields — no token, no billing data, no secrets.
//
// Valid invite requirements:
//   - token matches a deal_invites row
//   - role = 'funder'
//   - status = 'pending'
//   - expires_at > now()
//   - accepted_at IS NULL
//   - accepted_by IS NULL
//
// All invalid states return HTTP 404 with a machine-readable `reason` field.
// Using 404 (rather than distinct status codes) prevents token enumeration:
// an attacker who doesn't have the token can't determine why a lookup failed.
// The `reason` field is only useful if you already possess the token.
//
// Reason codes:
//   not_found       — token not in DB (or service not configured)
//   already_accepted — accepted_at or accepted_by is set
//   wrong_status    — status is not 'pending'
//   expired         — expires_at <= now()
//   missing_role    — role column is null (stale invite from older code path)
//   wrong_role      — role is set but is not 'funder'

function invalidResponse(reason: string, message: string): NextResponse {
  return NextResponse.json({ error: message, reason }, { status: 404 })
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  if (!token || typeof token !== 'string') {
    return invalidResponse('not_found', 'This invite link is invalid or has expired.')
  }

  // ── Guard: service role key must be set ──────────────────────────────────────
  // Without this, createSupabaseAdminClient creates an unauthorized client whose
  // queries are blocked by RLS, silently returning "not found" for valid tokens.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[invites/preview] SUPABASE_SERVICE_ROLE_KEY is not set — admin lookup impossible')
    return NextResponse.json(
      { error: 'Invite service is temporarily unavailable. Please try again in a moment.' },
      { status: 503 },
    )
  }

  const admin = createSupabaseAdminClient()

  // ── Fetch the invite row — use maybeSingle() to distinguish "not found" from errors ──
  // We do NOT filter accepted_at/accepted_by in the query so we can return distinct
  // reason codes for each failure mode rather than collapsing everything to not_found.
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
    .maybeSingle()

  if (error) {
    // Query failed — likely a DB connectivity issue. Log for ops visibility but
    // return not_found to prevent leaking server error details to clients.
    console.error('[invites/preview] DB query error for invite lookup:', error.message, error.code)
    return invalidResponse('not_found', 'This invite link is invalid or has expired.')
  }

  if (!invite) {
    return invalidResponse('not_found', 'This invite link is invalid or has expired.')
  }

  // ── Validate: not already accepted ───────────────────────────────────────────
  if (invite.accepted_at !== null || invite.accepted_by !== null) {
    return invalidResponse(
      'already_accepted',
      'This invite link has already been used. Each invite link can only be accepted once.',
    )
  }

  // ── Validate: status ──────────────────────────────────────────────────────────
  if (invite.status !== 'pending') {
    return invalidResponse(
      'wrong_status',
      'This invite link is no longer active. Ask the contractor to generate a new invite link.',
    )
  }

  // ── Validate: expiry ─────────────────────────────────────────────────────────
  const expiresAt = new Date(invite.expires_at)
  if (expiresAt <= new Date()) {
    // Mark as expired in the background (fire-and-forget — must not delay the response)
    admin
      .from('deal_invites')
      .update({ status: 'expired' })
      .eq('id', invite.id)
      .then(() => {})

    return invalidResponse(
      'expired',
      'This invite link has expired. Ask the contractor to generate a new invite link.',
    )
  }

  // ── Validate: role ────────────────────────────────────────────────────────────
  if (!invite.role) {
    return invalidResponse(
      'missing_role',
      'This invite link is incomplete — it is missing the intended role. Ask the contractor to generate a new invite link.',
    )
  }

  if (invite.role !== 'funder') {
    return invalidResponse(
      'wrong_role',
      'This invite link is not intended for a funder account. Ensure you are using the correct link.',
    )
  }

  // ── Build safe preview response ───────────────────────────────────────────────
  // Returning only fields needed for the accept page — no token, no billing data, no secrets.
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
