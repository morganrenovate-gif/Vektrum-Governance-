import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { getAuthUser, requireRole, requireMFA, extractAdminJustification, requireAdminAudit } from '@/lib/auth/middleware'
import { errorResponse, internalError, notFoundError } from '@/lib/errors'
import { POLICIES, checkRateLimit, rateLimitResponse, logRateLimitViolation } from '@/lib/engine/rate-limit'

export const dynamic = 'force-dynamic'

// ─── POST /api/admin/promote ─────────────────────────────────────────────────
//
// Promotes an existing user to admin role.
//
// INTENTIONALLY DISABLED BY DEFAULT.
//
// Admin creation is an owner-controlled operation and must not be available
// through normal dashboard flows. Granting admin access via a web UI exposes
// the platform to privilege-escalation attacks if an admin account is
// compromised. New admins should be created through a secured, owner-controlled
// process (CLI, Supabase dashboard with service-role credentials, or a
// dedicated owner-only provisioning flow).
//
// This route is kept in the codebase to preserve the audit infrastructure but
// is gated behind ADMIN_PROMOTION_ENABLED=true, which must be set explicitly
// in the environment. Never set this to true in production unless you have a
// specific, time-limited operational need and revert it immediately after.
//
// All existing security controls (admin role, MFA/AAL2, rate-limit, justification
// required, self-promotion blocked, dual audit write) remain active when the
// route is enabled, so the blast radius of a compromised admin session is
// still constrained.

export async function POST(request: NextRequest) {
  let authContext

  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext

  try {
    requireRole(profile, 'admin')
  } catch (err) {
    return err as NextResponse
  }

  const supabase = await createClient()
  try {
    await requireMFA(supabase, profile)
  } catch (err) {
    return err as NextResponse
  }

  // ── Env gate — disabled unless explicitly enabled ────────────────────────
  // Checked after auth/role/MFA so unauthenticated or unprivileged callers
  // receive the normal auth response rather than leaking feature state.
  if (process.env.ADMIN_PROMOTION_ENABLED !== 'true') {
    return NextResponse.json(
      { error: 'Admin promotion is disabled in this environment.' },
      { status: 403 }
    )
  }

  // ── Rate limit — admin write ───────────────────────────────────────────────
  {
    const rl = await checkRateLimit(`user:${user.id}:admin_write`, POLICIES.admin_write)
    if (!rl.allowed) {
      logRateLimitViolation(`user:${user.id}:admin_write`, rl, {
        actorId: user.id, policyName: 'admin_write',
        entityType: 'profile', entityId: user.id,
      })
      return rateLimitResponse(rl, POLICIES.admin_write.description)
    }
  }

  let body: { userId?: string; admin_justification?: string; authorization_reference?: string }

  try {
    body = await request.json()
  } catch {
    return errorResponse(
      400,
      'The request body could not be parsed as JSON. Ensure you are sending a valid JSON object with the required fields: userId, admin_justification.',
    )
  }

  // ── Admin justification (required) ─────────────────────────────────────────
  let justification: string
  try {
    justification = extractAdminJustification(request, body)
  } catch (err) {
    return err as NextResponse
  }

  if (!body.userId || typeof body.userId !== 'string' || body.userId.trim() === '') {
    return errorResponse(400, 'A userId is required. Provide the UUID of the user to promote.')
  }

  // Self-promotion guard
  if (body.userId === user.id) {
    return errorResponse(400, 'You cannot promote yourself. Ask another admin to perform this action.')
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null

  try {
    const adminClient = createSupabaseAdminClient()

    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id, role')
      .eq('id', body.userId)
      .single()

    if (!existingProfile) {
      return notFoundError(
        `No user found with ID ${body.userId}. Verify the user exists before attempting to promote them.`,
      )
    }

    const { data, error } = await adminClient
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', body.userId)
      .select('id')
      .single()

    if (error || !data) {
      return notFoundError(
        `No user found with ID ${body.userId}. Verify the user exists before attempting to promote them.`,
      )
    }

    // Dual-write to audit_log + admin_audit_log
    await requireAdminAudit(profile, user, justification, {
      action:                 'admin_role_granted',
      entityType:             'profile',
      entityId:               body.userId,
      systemSource:           'api/admin/promote',
      authorizationReference: body.authorization_reference ?? null,
      ipAddress:              ip,
      oldValues:              { role: existingProfile.role },
      newValues:              { role: 'admin' },
      metadata:               { promoted_by: user.id },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return internalError(
      'An unexpected error occurred while promoting the user. Please try again.',
      message,
    )
  }
}
