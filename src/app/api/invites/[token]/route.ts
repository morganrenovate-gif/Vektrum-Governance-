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
//   - We use three separate flat queries (invite → deal → profile) rather than a
//     nested/joined select. Nested relationship selects can fail if foreign-key hints
//     are ambiguous or if PostgREST relationship inference differs from expectations.
//     Flat queries are explicit, debuggable, and produce distinct error messages.
//   - We validate every field server-side before returning any preview data.
//   - We return only safe preview fields — no token, no billing data, no secrets.
//
// Error handling:
//   - Supabase query errors  → HTTP 500, reason: lookup_error (never collapsed to not_found)
//   - Valid query, null data → HTTP 404, reason: not_found
//   - Invalid invite state  → HTTP 404, reason: <specific code>
//
// Valid invite requirements:
//   - token matches a deal_invites row
//   - role = 'funder'
//   - status = 'pending'
//   - expires_at > now()
//   - accepted_at IS NULL
//   - accepted_by IS NULL
//
// Reason codes:
//   not_found        — token not in DB (or service not configured)
//   already_accepted — accepted_at or accepted_by is set
//   wrong_status     — status is not 'pending'
//   expired          — expires_at <= now()
//   missing_role     — role column is null (stale invite from older code path)
//   wrong_role       — role is set but is not 'funder'
//   lookup_error     — Supabase returned a query error (DB/config issue, not missing token)

function invalidResponse(reason: string, message: string): NextResponse {
  return NextResponse.json({ error: message, reason }, { status: 404 })
}

function lookupErrorResponse(message: string): NextResponse {
  return NextResponse.json({ error: message, reason: 'lookup_error' }, { status: 500 })
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

  // ── Query 1: Fetch invite row ─────────────────────────────────────────────────
  // Flat query only — no nested relationship selects. Nested selects can fail due
  // to ambiguous foreign-key hints or PostgREST relationship inference differences.
  const { data: invite, error: inviteError } = await admin
    .from('deal_invites')
    .select('id, deal_id, status, role, expires_at, invited_email, accepted_at, accepted_by')
    .eq('token', token)
    .maybeSingle()

  if (inviteError) {
    // Query error — this is NOT a missing token. Return 500 so the caller can
    // distinguish a DB/config problem from a genuinely invalid token.
    console.error('[invites/preview] invite lookup error:', {
      code: inviteError.code,
      message: inviteError.message,
      token_present: !!token,
      token_length: token.length,
      service_key_present: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    })
    return lookupErrorResponse(
      'Invite lookup failed. Please try again in a moment.',
    )
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

  // ── Query 2: Fetch deal ───────────────────────────────────────────────────────
  const { data: deal, error: dealError } = await admin
    .from('deals')
    .select('id, title, description, total_amount, status, contractor_id')
    .eq('id', invite.deal_id)
    .maybeSingle()

  if (dealError) {
    console.error('[invites/preview] deal lookup error:', {
      code: dealError.code,
      message: dealError.message,
      deal_id_present: !!invite.deal_id,
      service_key_present: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    })
    return lookupErrorResponse(
      'Deal lookup failed. Please try again in a moment.',
    )
  }

  if (!deal) {
    return invalidResponse('not_found', 'The deal associated with this invite could not be found.')
  }

  // ── Query 3: Fetch contractor profile ─────────────────────────────────────────
  // Profile is optional — if the lookup errors or returns null we fall back to a
  // generic name rather than failing the entire preview response.
  const { data: contractor, error: contractorError } = await admin
    .from('profiles')
    .select('full_name, company_name')
    .eq('id', deal.contractor_id)
    .maybeSingle()

  if (contractorError) {
    console.error('[invites/preview] contractor profile lookup error:', {
      code: contractorError.code,
      message: contractorError.message,
      service_key_present: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    })
    return lookupErrorResponse(
      'Contractor profile lookup failed. Please try again in a moment.',
    )
  }

  const contractorName =
    contractor?.company_name ?? contractor?.full_name ?? 'A contractor'

  // ── Build safe preview response ───────────────────────────────────────────────
  // Returning only fields needed for the accept page — no token, no billing data, no secrets.
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
      contractor_name: contractorName,
    },
  })
}
