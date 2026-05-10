import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole, requireMFA, requireAdminAudit } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { POLICIES, checkRateLimit, rateLimitResponse, logRateLimitViolation } from '@/lib/engine/rate-limit'

export const dynamic = 'force-dynamic'

// ─── POST /api/admin/tokens/[jti]/revoke ─────────────────────────────────────
//
// Tier B step 2 — Admin token revocation endpoint.
//
// Revokes an active authorization token (status IN ('issued','delivered')).
// Terminal tokens (confirmed, failed, expired, revoked) cannot be re-revoked.
//
// Authentication: admin session with AAL2 MFA.
// Authorization: admin role only. Funders and partners cannot revoke tokens.
//
// Request body:
//   {
//     reason:               string   (required, ≥ 20 chars)
//     admin_justification:  string   (required, ≥ 20 chars — dual-write to admin_audit_log)
//   }
//
// Side effects:
//   - Sets authorization_tokens.status = 'revoked'
//   - Does NOT call cancel_release_reservation (admin must handle the reservation
//     separately via the deal management routes if needed)
//   - Writes a token_revoked audit row with token_hash
//   - Dual-writes admin_justification to admin_audit_log via requireAdminAudit
//
// Idempotency: if the token is already revoked, returns 200 with alreadyRevoked=true.

interface RevokeBody {
  reason?:               string
  admin_justification?:  string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jti: string }> },
) {
  const { jti } = await params

  // Rate limit: admin_write (fail-closed on error)
  const rl = await checkRateLimit(`admin-token-revoke:${jti}`, POLICIES.admin_write)
  if (!rl.allowed) {
    logRateLimitViolation(`admin-token-revoke:${jti}`, rl, {
      actorId: null, policyName: 'admin_write',
      entityType: 'authorization_token', entityId: jti,
    })
    return rateLimitResponse(rl, POLICIES.admin_write.description)
  }

  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext

  try { requireRole(profile, 'admin') } catch (err) { return err as NextResponse }

  const supabase = await createClient()
  try { await requireMFA(supabase, profile) } catch (err) { return err as NextResponse }

  let body: RevokeBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.reason || body.reason.trim().length < 20) {
    return NextResponse.json(
      { error: 'reason is required and must be at least 20 characters.' },
      { status: 400 },
    )
  }

  const adminJustification = (body.admin_justification ?? '').trim()
  if (!adminJustification) {
    return NextResponse.json(
      { error: 'admin_justification is required (at least 20 characters) for token revocation.' },
      { status: 400 },
    )
  }

  const admin = createSupabaseAdminClient()

  // Look up the token
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: token, error: fetchError } = await (admin as any)
    .from('authorization_tokens')
    .select('id, jti, status, token_hash, milestone_id, draw_request_id')
    .eq('jti', jti)
    .maybeSingle()

  if (fetchError || !token) {
    return NextResponse.json({ error: 'Token not found.', code: 'TOKEN_NOT_FOUND' }, { status: 404 })
  }

  // Idempotency: already revoked is a no-op
  if (token.status === 'revoked') {
    return NextResponse.json({ success: true, alreadyRevoked: true })
  }

  // Only active tokens can be revoked
  if (!['issued', 'delivered'].includes(token.status)) {
    return NextResponse.json(
      {
        error: `Token is in terminal state '${token.status}' and cannot be revoked.`,
        code:  'TOKEN_TERMINAL',
      },
      { status: 409 },
    )
  }

  // Atomic status update — conditional on still being active to prevent races
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (admin as any)
    .from('authorization_tokens')
    .update({ status: 'revoked' })
    .eq('jti', jti)
    .in('status', ['issued', 'delivered'])

  if (updateError) {
    return NextResponse.json(
      { error: `Failed to revoke token: ${updateError.message}` },
      { status: 500 },
    )
  }

  // Audit row
  await logAudit({
    entity_type: 'authorization_token',
    entity_id:   token.id,
    action:      'token_revoked',
    actor_id:    user.id,
    old_values:  { status: token.status },
    new_values:  { status: 'revoked' },
    metadata: {
      jti:             token.jti,
      token_hash:      token.token_hash,
      reason:          body.reason.trim(),
      milestone_id:    token.milestone_id,
      draw_request_id: token.draw_request_id,
    },
  })

  // Dual-write to admin audit log
  await requireAdminAudit(profile, user, adminJustification, {
    action:       'token_revoked',
    entityType:   'authorization_token',
    entityId:     token.id,
    systemSource: 'api/admin/tokens/[jti]/revoke',
    oldValues:    { status: token.status },
    newValues:    { status: 'revoked' },
    metadata: {
      jti:             token.jti,
      token_hash:      token.token_hash,
      reason:          body.reason!.trim(),
      milestone_id:    token.milestone_id,
      draw_request_id: token.draw_request_id,
    },
  })

  return NextResponse.json({ success: true, alreadyRevoked: false })
}
