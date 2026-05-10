import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { requirePartnerAuth } from '@/lib/auth/partner'
import { POLICIES, checkRateLimit, rateLimitResponse, logRateLimitViolation } from '@/lib/engine/rate-limit'

export const dynamic = 'force-dynamic'

// ─── GET /api/partner/tokens/[jti] ───────────────────────────────────────────
//
// Tier B step 2 — Token introspect endpoint.
//
// Partners call this to verify that a token they received from Vektrum is
// still active and has not been expired, confirmed, failed, or revoked.
//
// Authentication: Authorization: Bearer <partner_api_key>
//
// Authorization: the partner may only introspect tokens for releases on deals
// assigned to their partner_id. Cross-partner introspection is rejected with 403.
//
// Response:
//   {
//     jti:            string
//     status:         'issued'|'delivered'|'confirmed'|'failed'|'expired'|'revoked'
//     milestone_id:   string
//     rail_scope:     string
//     amount_vector:  object[]
//     total_amount:   number
//     currency:       string
//     policy_version: string
//     signature_alg:  string
//     not_before:     string (ISO-8601)
//     expires_at:     string (ISO-8601)
//     created_at:     string (ISO-8601)
//   }

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jti: string }> },
) {
  const { jti } = await params

  // Rate limit: partner_api scope
  const rl = await checkRateLimit(`partner-introspect:${jti}`, POLICIES.partner_api)
  if (!rl.allowed) {
    logRateLimitViolation(`partner-introspect:${jti}`, rl, {
      actorId: null, policyName: 'partner_api',
      entityType: 'authorization_token', entityId: jti,
    })
    return rateLimitResponse(rl, POLICIES.partner_api.description)
  }

  let partnerCtx
  try {
    partnerCtx = await requirePartnerAuth(request)
  } catch (err) {
    return err as NextResponse
  }

  const admin = createSupabaseAdminClient()

  // Look up the token by JTI
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: token, error } = await (admin as any)
    .from('authorization_tokens')
    .select(
      'jti, status, milestone_id, rail_scope, amount_vector, total_amount, currency, ' +
      'policy_version, signature_alg, not_before, expires_at, created_at, ' +
      'deal_id:draw_request_id',
    )
    .eq('jti', jti)
    .maybeSingle()

  if (error || !token) {
    return NextResponse.json({ error: 'Token not found.', code: 'TOKEN_NOT_FOUND' }, { status: 404 })
  }

  // Partner scope check — verify the deal belongs to this partner
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: deal } = await (admin as any)
    .from('deals')
    .select('id, partner_id')
    .eq('id', token.deal_id)
    .maybeSingle()

  if (!deal) {
    return NextResponse.json({ error: 'Token not found.', code: 'TOKEN_NOT_FOUND' }, { status: 404 })
  }

  if (deal.partner_id !== partnerCtx.partnerId) {
    return NextResponse.json(
      { error: 'You are not authorized to introspect this token.', code: 'FORBIDDEN' },
      { status: 403 },
    )
  }

  return NextResponse.json({
    jti:            token.jti,
    status:         token.status,
    milestone_id:   token.milestone_id,
    rail_scope:     token.rail_scope,
    amount_vector:  token.amount_vector,
    total_amount:   token.total_amount,
    currency:       token.currency,
    policy_version: token.policy_version,
    signature_alg:  token.signature_alg,
    not_before:     token.not_before,
    expires_at:     token.expires_at,
    created_at:     token.created_at,
  })
}
