import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth/middleware'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/engine/audit'
import { conflictError, errorResponse, internalError, notFoundError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

// ─── POST /api/invites/[token]/accept ─────────────────────────────────────────
// Authenticated funders (or users without a role yet) accept an invite.
//
// This is the most security-critical route in the invite flow.
//
// Security checks (in order):
//   1. Caller must be authenticated
//   2. Caller must have role = 'funder' (contractors may not fund their own deals)
//   3. Token must exist, be pending, and not expired
//   4. Deal must still be in 'draft' status with no funder assigned
//   5. Caller must not be the contractor on this deal (belt-and-suspenders)
//
// On success (atomic transaction via admin client):
//   1. deal.funder_id = user.id (assigns the funder)
//   2. deal_invites.status = 'accepted', accepted_by = user.id, accepted_at = now()
//   3. Audit log entry written
//
// Returns: { deal_id } — client redirects to /dashboard/deals/[deal_id]

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  // ── 1. Auth ────────────────────────────────────────────────────────────────
  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext

  // ── 2. Role check — funders only ───────────────────────────────────────────
  try {
    requireRole(profile, 'funder')
  } catch {
    return errorResponse(
      403,
      'Only users with the Funder role can accept deal invitations. ' +
      'If you are a funder, ensure your account was registered with the correct role.',
    )
  }

  if (!token || typeof token !== 'string') {
    return notFoundError('This invite link is invalid or has already been used.')
  }

  const admin = createSupabaseAdminClient()

  // ── 3. Fetch and validate invite ───────────────────────────────────────────
  // Select role, accepted_at, and accepted_by for defense-in-depth validation.
  // We do NOT filter accepted_at/accepted_by in the query so we can return
  // distinct, actionable errors for each failure mode.
  const { data: invite, error: inviteError } = await admin
    .from('deal_invites')
    .select('id, deal_id, invited_by, status, role, expires_at, accepted_at, accepted_by')
    .eq('token', token)
    .maybeSingle()

  if (inviteError) {
    console.error('[invites/accept] DB query error:', inviteError.message)
    return notFoundError('This invite link is invalid or has already been used.')
  }

  if (!invite) {
    return notFoundError('This invite link is invalid or has already been used.')
  }

  // ── Defense-in-depth: already accepted ────────────────────────────────────
  if (invite.accepted_at !== null || invite.accepted_by !== null) {
    return errorResponse(
      409,
      'This invite link has already been used. Each invite link can only be accepted once.',
    )
  }

  if (invite.status !== 'pending') {
    return notFoundError('This invite link is no longer active. Ask the contractor to generate a new invite link.')
  }

  const expiresAt = new Date(invite.expires_at)
  if (expiresAt <= new Date()) {
    // Mark as expired (fire-and-forget — must not delay the response)
    admin
      .from('deal_invites')
      .update({ status: 'expired' })
      .eq('id', invite.id)
      .then(() => {})

    return notFoundError('This invite link has expired. Ask the contractor to generate a new one.')
  }

  // ── Defense-in-depth: role validation ─────────────────────────────────────
  // Ensures the invite was created with role='funder' — stale invites from
  // older code paths may have role=null, which must never be accepted.
  if (!invite.role) {
    return errorResponse(
      400,
      'This invite link is incomplete — it is missing the intended role. Ask the contractor to generate a new invite link.',
    )
  }

  if (invite.role !== 'funder') {
    return errorResponse(
      403,
      'This invite link is not intended for a funder account. Ensure you are using the correct link.',
    )
  }

  // ── 4. Fetch deal and verify it can still accept a funder ─────────────────
  const { data: deal, error: dealError } = await admin
    .from('deals')
    .select('id, title, status, contractor_id, funder_id')
    .eq('id', invite.deal_id)
    .single()

  if (dealError || !deal) {
    return notFoundError('The deal associated with this invite could not be found.')
  }

  if (deal.funder_id) {
    // Deal already has a funder — mark invite as accepted to clean up
    await admin
      .from('deal_invites')
      .update({ status: 'accepted', accepted_by: user.id, accepted_at: new Date().toISOString() })
      .eq('id', invite.id)

    return conflictError(
      'This deal already has a funder assigned. It is no longer available for new funders.',
    )
  }

  if (deal.status !== 'draft') {
    return errorResponse(
      400,
      `This deal is no longer accepting funders (current status: ${deal.status}).`,
    )
  }

  // ── 5. Prevent self-funding ────────────────────────────────────────────────
  if (deal.contractor_id === user.id) {
    return errorResponse(
      403,
      'You cannot fund your own deal. The contractor and funder must be different users.',
    )
  }

  // ── 6. Atomic assignment ───────────────────────────────────────────────────
  // Step A: assign funder to deal
  // .is('funder_id', null) ensures atomicity — if another funder accepted between
  // our validation check and this update, the update will match 0 rows and fail
  const { data: updatedRows, error: dealUpdateError } = await admin
    .from('deals')
    .update({ funder_id: user.id })
    .eq('id', invite.deal_id)
    .is('funder_id', null)
    .select('id')

  if (dealUpdateError) {
    return internalError(
      'Failed to assign you as funder. Please try again.',
      dealUpdateError.message,
    )
  }

  if (!updatedRows || updatedRows.length === 0) {
    return conflictError(
      'Another funder accepted this deal just before you. The deal is no longer available.',
    )
  }

  // Step B: mark invite as accepted
  const { error: inviteUpdateError } = await admin
    .from('deal_invites')
    .update({
      status: 'accepted',
      accepted_by: user.id,
      accepted_at: new Date().toISOString(),
    })
    .eq('id', invite.id)

  if (inviteUpdateError) {
    // Deal assignment already happened — log the inconsistency but don't fail
    console.error('[invites/accept] Failed to mark invite as accepted:', inviteUpdateError.message)
  }

  // Step C: Audit log
  await logAudit({
    entity_type: 'deal',
    entity_id: invite.deal_id,
    action: 'funder_assigned',
    actor_id: user.id,
    actor_role: 'funder',
    old_values: { funder_id: null },
    new_values: {
      funder_id: user.id,
      invite_id: invite.id,
      funder_name: profile.full_name,
    },
  })

  return NextResponse.json(
    {
      deal_id: invite.deal_id,
      message: `You have been assigned as the funder for "${deal.title}". Redirecting to your deal room.`,
    },
    { status: 200 },
  )
}
