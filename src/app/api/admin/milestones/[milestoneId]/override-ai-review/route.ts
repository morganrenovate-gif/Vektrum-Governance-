export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getAuthUser,
  requireRole,
  requireMFA,
  extractAdminJustification,
} from '@/lib/auth/middleware'
import { logAdminAudit } from '@/lib/engine/audit'
import { errorResponse, notFoundError } from '@/lib/errors'

// ─── POST /api/admin/milestones/[milestoneId]/override-ai-review ─────────────
//
// Creates an admin AI-review override that satisfies checkAiPrecondition() for
// a configurable TTL (default 4 hours; controlled by AI_ADMIN_OVERRIDE_TTL_HOURS).
//
// PURPOSE: Emergency measure when all AI providers are unavailable and a release
// is time-critical. Requires admin role + AAL2 MFA + written justification.
//
// RESTRICTIONS:
//   - Cannot be used to override a critical-risk AI assessment. Only for cases
//     where the AI service itself is unavailable.
//   - override_risk_level must be 'low', 'medium', or 'high' — never 'critical'.
//   - Justification must be ≥ 20 characters.
//
// AUDIT: Writes to both audit_log AND admin_audit_log (dual-write via
// logAdminAudit). The entry is visually flagged in the audit UI via
// metadata.override = true.
//
// BODY:
//   {
//     justification:      string   // ≥ 20 chars — why AI is unavailable
//     override_risk_level: 'low' | 'medium' | 'high'
//   }
//
// RESPONSE:
//   201 { success, override_risk_level, expires_at, ttl_hours, message }

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ milestoneId: string }> },
) {
  const { milestoneId } = await params

  // ── Auth ──────────────────────────────────────────────────────────────────
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

  // AAL2 MFA required for all admin override actions
  const supabase = await createClient()
  try {
    await requireMFA(supabase, profile)
  } catch (err) {
    return err as NextResponse
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return errorResponse(
      400,
      'Request body must be valid JSON with fields: justification, override_risk_level.',
    )
  }

  // ── Validate override_risk_level ──────────────────────────────────────────
  const VALID_LEVELS = ['low', 'medium', 'high'] as const
  const overrideRiskLevel = body.override_risk_level

  if (
    typeof overrideRiskLevel !== 'string' ||
    !(VALID_LEVELS as readonly string[]).includes(overrideRiskLevel)
  ) {
    return errorResponse(
      400,
      "override_risk_level is required and must be 'low', 'medium', or 'high'. " +
        "Critical risk cannot be overridden by an admin — it requires a full investigation " +
        'and resolution before release. Admin overrides are only for AI service unavailability.',
    )
  }

  // ── Justification — accepts both 'justification' and 'admin_justification' ─
  // extractAdminJustification looks for X-Admin-Justification header or
  // admin_justification body field. We normalize here to support both.
  const bodyForExtract: Record<string, unknown> = {
    ...body,
    admin_justification: body.admin_justification ?? body.justification,
  }

  let justification: string
  try {
    justification = extractAdminJustification(request, bodyForExtract)
  } catch (err) {
    return err as NextResponse
  }

  // ── Verify milestone exists ───────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: milestone } = await (supabase as any)
    .from('milestones')
    .select('id, deal_id, title, status')
    .eq('id', milestoneId)
    .maybeSingle() as {
      data: { id: string; deal_id: string; title: string; status: string } | null
    }

  if (!milestone) {
    return notFoundError(`Milestone ${milestoneId} not found.`)
  }

  // ── Block override when a recent critical AI assessment exists ────────────
  // The override cannot be used to sidestep a critical-risk finding — only to
  // bypass unavailability. If there is a non-expired critical review, the admin
  // must resolve the underlying issue first.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: recentReviews } = await (supabase as any)
    .from('audit_log')
    .select('created_at, metadata')
    .eq('entity_type', 'milestone')
    .eq('entity_id', milestoneId)
    .eq('action', 'ai_draw_review')
    .order('created_at', { ascending: false })
    .limit(1) as {
      data: { created_at: string; metadata: Record<string, unknown> | null }[] | null
    }

  const latestReview = recentReviews?.[0] ?? null

  if (latestReview) {
    const reviewAgeMs      = Date.now() - new Date(latestReview.created_at).getTime()
    const fortyEightHoursMs = 48 * 60 * 60 * 1000
    const riskLevel         = latestReview.metadata?.risk_level

    if (reviewAgeMs <= fortyEightHoursMs && riskLevel === 'critical') {
      return errorResponse(
        409,
        'Cannot override a critical-risk AI assessment. ' +
          'The most recent AI review flagged this milestone as critical risk, which requires ' +
          'a full admin investigation and documented resolution before any release can proceed. ' +
          'Admin overrides are only available when the AI service itself is unavailable.',
      )
    }
  }

  // ── Calculate TTL ─────────────────────────────────────────────────────────
  const ttlHours = Math.max(
    1,
    parseInt(process.env.AI_ADMIN_OVERRIDE_TTL_HOURS ?? '4', 10),
  )
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString()

  const clientIp =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    null

  // ── Dual-write: audit_log + admin_audit_log ───────────────────────────────
  // logAdminAudit writes to both tables in one call (fire-and-forget, never throws).
  await logAdminAudit({
    entity_type:         'milestone',
    entity_id:           milestoneId,
    action:              'ai_review_admin_override',
    actor_id:            user.id,
    actor_role:          'admin',
    actor_email:         user.email,
    system_source:       'api/admin/milestones/override-ai-review',
    ip_address:          clientIp,
    admin_justification: justification,
    metadata: {
      // Sentinel checked by checkAiPrecondition() and the audit UI
      override:             true,
      override_risk_level:  overrideRiskLevel,
      ttl_hours:            ttlHours,
      expires_at:           expiresAt,
      // Snapshot context for auditors
      milestone_title:      milestone.title,
      milestone_status:     milestone.status,
      deal_id:              milestone.deal_id,
    },
  })

  return NextResponse.json(
    {
      success:             true,
      override_risk_level: overrideRiskLevel,
      expires_at:          expiresAt,
      ttl_hours:           ttlHours,
      message:
        `Admin AI-review override applied for milestone ${milestoneId}. ` +
        `The AI precondition will be treated as satisfied for ${ttlHours} hour${ttlHours !== 1 ? 's' : ''} ` +
        `(until ${expiresAt} UTC). This override is logged in the admin audit trail.`,
    },
    { status: 201 },
  )
}
