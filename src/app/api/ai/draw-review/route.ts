export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole, requireDealAccess } from '@/lib/auth/middleware'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/engine/audit'
import { notFoundError } from '@/lib/errors'
import {
  ProviderChain,
  ProviderChainError,
  type DrawReviewContext,
} from '@/lib/engine/ai-provider'
import { POLICIES, checkRateLimit, rateLimitResponse, logRateLimitViolation } from '@/lib/engine/rate-limit'

// ─── GET /api/ai/draw-review?milestoneId=xxx ────────────────────────────────
// Returns the most recent AI draw review assessment for a milestone.
//
// SECURITY: Verifies deal access before returning assessment data — prevents
// IDOR where any funder could read AI assessments for milestones on deals
// they do not participate in.

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const milestoneId = searchParams.get('milestoneId')
  if (!milestoneId) return NextResponse.json({ error: 'milestoneId required', code: 'MISSING_MILESTONE_ID' }, { status: 400 })

  let authContext
  try {
    authContext = await getAuthUser(req)
  } catch (err) {
    return err as NextResponse
  }

  // Only funder or admin can view AI assessments
  try {
    requireRole(authContext.profile, 'funder', 'admin')
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext
  const supabase = await createClient()

  // ── Resolve milestone → deal, then verify access ────────────────────────
  // This prevents IDOR: any funder could otherwise supply arbitrary milestoneIds
  // and read AI assessments for deals they have no stake in.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: milestone } = await (supabase as any)
    .from('milestones')
    .select('id, deal_id')
    .eq('id', milestoneId)
    .maybeSingle()

  if (!milestone) {
    // Return 404 rather than 403 to avoid leaking whether the milestone exists
    return notFoundError(`Milestone ${milestoneId} not found.`)
  }

  try {
    await requireDealAccess(supabase, milestone.deal_id, user.id, profile.role)
  } catch (err) {
    return err as NextResponse
  }

  // Cast action filter to bypass strict AuditAction enum — ai_draw_review is a custom action
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: reviews } = await (supabase as any)
    .from('audit_log')
    .select('id, created_at, metadata')
    .eq('entity_type', 'milestone')
    .eq('entity_id', milestoneId)
    .eq('action', 'ai_draw_review')
    .order('created_at', { ascending: false })
    .limit(1)

  const typedReviews = reviews as { id: string; created_at: string; metadata: Record<string, unknown> | null }[] | null

  if (!typedReviews || typedReviews.length === 0) {
    return NextResponse.json({ assessment: null })
  }

  const r = typedReviews[0]
  return NextResponse.json({
    assessment: {
      assessment_id:  r.id,
      risk_level:     r.metadata?.risk_level,
      score:          r.metadata?.score,
      findings:       r.metadata?.findings ?? [],
      recommendation: r.metadata?.recommendation,
      reasoning:      r.metadata?.reasoning,
      reviewed_at:    r.created_at,
      provider_used:  r.metadata?.provider_used ?? null,
      is_fallback:    r.metadata?.is_fallback    ?? false,
    },
  })
}

// ─── POST /api/ai/draw-review ─────────────────────────────────────────────────
// Triggers an AI review of a milestone draw request via the provider chain:
//   Perplexity sonar-pro → Anthropic claude-sonnet-4-20250514 → OpenAI gpt-4o
//
// SECURITY: Explicitly verifies deal access before reading milestone data or
// calling the AI service.

export async function POST(req: NextRequest) {
  let authContext
  try {
    authContext = await getAuthUser(req)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext

  // Funder, contractor, and admin can request AI reviews
  try {
    requireRole(profile, 'contractor', 'funder', 'admin')
  } catch (err) {
    return err as NextResponse
  }

  // ── Rate limit — AI draw review ────────────────────────────────────────────
  {
    const rl = await checkRateLimit(`user:${user.id}:ai_draw_review`, POLICIES.ai_draw_review)
    if (!rl.allowed) {
      logRateLimitViolation(`user:${user.id}:ai_draw_review`, rl, {
        actorId: user.id, policyName: 'ai_draw_review',
        entityType: 'milestone', entityId: 'unknown',
      })
      return rateLimitResponse(rl, POLICIES.ai_draw_review.description)
    }
  }

  const { milestoneId }: { milestoneId: string } = await req.json()
  if (!milestoneId) return NextResponse.json({ error: 'milestoneId required', code: 'MISSING_MILESTONE_ID' }, { status: 400 })

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Fetch milestone — RLS ensures this returns null if the user has no access
  const { data: milestone } = await db
    .from('milestones')
    .select('id, title, description, amount, status, deal_id')
    .eq('id', milestoneId)
    .single() as {
      data: {
        id: string; title: string; description: string | null
        amount: number; status: string; deal_id: string
      } | null
    }

  if (!milestone) {
    return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
  }

  // ── Explicit deal access check ────────────────────────────────────────────
  try {
    await requireDealAccess(supabase, milestone.deal_id, user.id, profile.role)
  } catch (err) {
    return err as NextResponse
  }

  // Fetch deal
  const { data: deal } = await db
    .from('deals')
    .select('id, title, description, status, total_amount, funder_id, contractor_id')
    .eq('id', milestone.deal_id)
    .single() as {
      data: {
        id: string; title: string; description: string | null
        status: string; total_amount: number
        funder_id: string | null; contractor_id: string
      } | null
    }

  if (!deal) {
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
  }

  // Fetch documents for this milestone
  const { data: documents } = await db
    .from('milestone_documents')
    .select('id, file_url, file_type, created_at')
    .eq('milestone_id', milestoneId)
    .order('created_at', { ascending: false })
    .limit(10) as {
      data: { id: string; file_url: string; file_type: string | null; created_at: string }[] | null
    }

  // ── Build context for the provider chain ─────────────────────────────────
  const ctx: DrawReviewContext = {
    milestoneId,
    dealId: milestone.deal_id,
    milestone: {
      title:       milestone.title,
      description: milestone.description,
      amount:      milestone.amount,
      status:      milestone.status,
    },
    deal: {
      title:        deal.title,
      description:  deal.description,
      status:       deal.status,
      total_amount: deal.total_amount,
    },
    documents: documents ?? [],
  }

  // ── Call the provider chain ───────────────────────────────────────────────
  // Attempts Perplexity first, then Anthropic, then OpenAI.
  // Returns 503 if all providers fail.
  let assessment
  try {
    const chain = new ProviderChain()
    assessment = await chain.reviewDraw(ctx)
  } catch (err) {
    if (err instanceof ProviderChainError) {
      console.error('[draw-review] All AI providers failed:', err.providerErrors)
      return NextResponse.json(
        {
          error:           'AI draw review is temporarily unavailable — all providers failed. Please try again later or contact support.',
          code:            'AI_ALL_PROVIDERS_FAILED',
          provider_errors: err.providerErrors,
        },
        { status: 503 },
      )
    }
    // Unexpected error
    console.error('[draw-review] Unexpected error in provider chain:', err)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.', code: 'AI_INTERNAL_ERROR' },
      { status: 500 },
    )
  }

  // ── Persist to audit_log ──────────────────────────────────────────────────
  await logAudit({
    entity_type: 'milestone',
    entity_id:   milestoneId,
    action:      'ai_draw_review',
    actor_id:    user.id,
    metadata:    {
      risk_level:        assessment.risk_level,
      score:             assessment.score,
      recommendation:    assessment.recommendation,
      findings:          assessment.findings,
      reasoning:         assessment.reasoning,
      // Provider tracking fields
      provider_used:     assessment.provider_used,
      model:             assessment.model,
      is_fallback:       assessment.is_fallback,
      // Legacy field kept for backward-compat with existing audit UI rows
      ...(assessment.is_fallback ? {} : { raw_model: 'sonar-pro' }),
      documents_reviewed: documents?.length ?? 0,
    },
  })

  return NextResponse.json({
    assessment_id:  `${milestoneId}-${Date.now()}`,
    risk_level:     assessment.risk_level,
    score:          assessment.score,
    findings:       assessment.findings,
    recommendation: assessment.recommendation,
    reasoning:      assessment.reasoning,
    reviewed_at:    new Date().toISOString(),
    provider_used:  assessment.provider_used,
    is_fallback:    assessment.is_fallback,
    model:          assessment.model,
  })
}
