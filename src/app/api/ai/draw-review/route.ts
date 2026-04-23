export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole, requireDealAccess } from '@/lib/auth/middleware'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/engine/audit'
import { notFoundError } from '@/lib/errors'
export const runtime = "nodejs";

// ─── GET /api/ai/draw-review?milestoneId=xxx ────────────────────────────────
// Returns the most recent AI draw review assessment for a milestone.
//
// SECURITY: Verifies deal access before returning assessment data — prevents
// IDOR where any funder could read AI assessments for milestones on deals
// they do not participate in.

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const milestoneId = searchParams.get('milestoneId')
  if (!milestoneId) return NextResponse.json({ error: 'milestoneId required' }, { status: 400 })

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
      assessment_id: r.id,
      risk_level: r.metadata?.risk_level,
      score: r.metadata?.score,
      findings: r.metadata?.findings ?? [],
      recommendation: r.metadata?.recommendation,
      reasoning: r.metadata?.reasoning,
      reviewed_at: r.created_at,
    }
  })
}

// ─── POST /api/ai/draw-review ────────────────────────────────────────────────
// Triggers a new Perplexity Sonar AI review of a milestone draw request.
//
// SECURITY: Explicitly verifies deal access before reading milestone data or
// calling the AI service. Although Supabase RLS would block the milestone
// SELECT for non-participants, explicit verification at the route layer ensures
// defence-in-depth and makes the access check visible in code review.

export async function POST(req: NextRequest) {
  let authContext
  try {
    authContext = await getAuthUser(req)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext

  // Funder, contractor, and admin can request AI reviews
  // (contractors need to see their own assessments; funders initiate release flow)
  try {
    requireRole(profile, 'contractor', 'funder', 'admin')
  } catch (err) {
    return err as NextResponse
  }

  const { milestoneId }: { milestoneId: string } = await req.json()
  if (!milestoneId) return NextResponse.json({ error: 'milestoneId required' }, { status: 400 })

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Fetch milestone — RLS ensures this returns null if the user has no access
  const { data: milestone } = await db
    .from('milestones')
    .select('id, title, description, amount, status, deal_id')
    .eq('id', milestoneId)
    .single() as { data: { id: string; title: string; description: string | null; amount: number; status: string; deal_id: string } | null }

  if (!milestone) {
    return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
  }

  // ── Explicit deal access check ────────────────────────────────────────────
  // Belt-and-suspenders: verify deal participation at the application layer.
  // RLS on milestones/deals already protects the DB reads above, but this
  // makes the access boundary explicit and guards against future RLS changes.
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
    .single() as { data: { id: string; title: string; description: string | null; status: string; total_amount: number; funder_id: string | null; contractor_id: string } | null }

  if (!deal) {
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
  }

  // Fetch documents for this milestone
  const { data: documents } = await db
    .from('milestone_documents')
    .select('id, file_url, file_type, created_at')
    .eq('milestone_id', milestoneId)
    .order('created_at', { ascending: false })
    .limit(10) as { data: { id: string; file_url: string; file_type: string | null; created_at: string }[] | null }

  // Build Perplexity Sonar prompt
  const systemPrompt = `You are an AI financial risk analyst for Vektrum, a construction payment governance platform. Your role is to evaluate milestone draw requests and assess whether fund release is appropriate. You must be rigorous, objective, and protect all parties from fraud, premature payment, and documentation gaps.`

  const userPrompt = `Analyze this construction milestone draw request:

DEAL CONTEXT:
- Deal: ${deal.title}
- Description: ${deal.description}
- Total Amount: $${deal.total_amount?.toLocaleString()}
- Deal Status: ${deal.status}

MILESTONE:
- Title: ${milestone.title}
- Description: ${milestone.description}
- Draw Amount: $${milestone.amount?.toLocaleString()}
- Current Status: ${milestone.status}

SUBMITTED DOCUMENTS (${documents?.length ?? 0} files):
${documents?.map(d => `- ${d.file_url} (${d.file_type}, submitted ${d.created_at})`).join('\n') || 'No documents submitted'}

ASSESSMENT REQUIRED:
Provide a structured JSON assessment with these exact fields:
{
  "risk_level": "low" | "medium" | "high" | "critical",
  "score": <integer 0-100, where 100 = fully safe to release>,
  "findings": [<array of specific observations, each a complete sentence>],
  "recommendation": "approve" | "hold" | "reject",
  "reasoning": "<2-4 sentence executive summary of your assessment>"
}

Risk criteria:
- critical: fraud indicators, zero documentation, amount inconsistency, or policy violation
- high: missing key documents, status mismatch, or significant concerns
- medium: minor gaps, could proceed with caution
- low: well-documented, appropriate amount, clear completion evidence

Respond ONLY with the JSON object. No markdown, no commentary.`

  // ── Call Perplexity Sonar API ────────────────────────────────────────────────
  const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY

  // Diagnostic: log key presence (never the value) and route context
  console.info('[draw-review] diagnostics:', {
    route: 'POST /api/ai/draw-review',
    perplexityKeyPresent: !!PERPLEXITY_API_KEY,
    milestoneId,
    dealId: milestone.deal_id,
  })

  // Error type 1: missing env var
  if (!PERPLEXITY_API_KEY) {
    console.error('[draw-review] PERPLEXITY_API_KEY not set — add it to .env.local and Vercel env vars')
    return NextResponse.json(
      { error: 'AI draw review is temporarily unavailable.', code: 'AI_NOT_CONFIGURED' },
      { status: 503 },
    )
  }

  let perplexityResponse: Response
  try {
    perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 1024,
      })
    })
  } catch (fetchErr) {
    // Error type 6: network / provider unreachable
    console.error('[draw-review] Perplexity fetch failed (network error):', fetchErr)
    return NextResponse.json(
      { error: 'Could not reach the AI service. Please try again.', code: 'AI_NETWORK_ERROR' },
      { status: 502 },
    )
  }

  if (!perplexityResponse.ok) {
    const errorText = await perplexityResponse.text()
    console.error('[draw-review] Perplexity API error:', perplexityResponse.status, errorText)

    // Error type 2: invalid key / unauthorized
    if (perplexityResponse.status === 401 || perplexityResponse.status === 403) {
      return NextResponse.json(
        { error: 'AI service authentication failed. Check the API key configuration.', code: 'AI_AUTH_FAILED' },
        { status: 502 },
      )
    }

    // 429 rate limit
    if (perplexityResponse.status === 429) {
      return NextResponse.json(
        { error: 'AI service rate limit reached. Please try again in a moment.', code: 'AI_RATE_LIMITED' },
        { status: 429 },
      )
    }

    // Error type 6: other provider error
    return NextResponse.json(
      { error: 'AI assessment service unavailable.', code: 'AI_PROVIDER_ERROR' },
      { status: 502 },
    )
  }

  const perplexityData = await perplexityResponse.json()
  const rawContent: string = perplexityData.choices?.[0]?.message?.content ?? ''

  // Parse the assessment
  let assessment: {
    risk_level: 'low' | 'medium' | 'high' | 'critical'
    score: number
    findings: string[]
    recommendation: 'approve' | 'hold' | 'reject'
    reasoning: string
  }

  try {
    const cleaned = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    assessment = JSON.parse(cleaned)
  } catch {
    assessment = {
      risk_level: 'high',
      score: 40,
      findings: ['AI response could not be parsed — manual review required', rawContent.slice(0, 500)],
      recommendation: 'hold',
      reasoning: 'Automated assessment encountered a parsing error. A human reviewer should evaluate this draw request.'
    }
  }

  // Persist to audit_log
  await logAudit({
    entity_type: 'milestone',
    entity_id: milestoneId,
    action: 'ai_draw_review',
    actor_id: user.id,
    metadata: {
      risk_level: assessment.risk_level,
      score: assessment.score,
      recommendation: assessment.recommendation,
      findings: assessment.findings,
      reasoning: assessment.reasoning,
      model: 'sonar-pro',
      raw_response: rawContent,
      documents_reviewed: documents?.length ?? 0,
    }
  })

  return NextResponse.json({
    assessment_id: `${milestoneId}-${Date.now()}`,
    risk_level: assessment.risk_level,
    score: assessment.score,
    findings: assessment.findings,
    recommendation: assessment.recommendation,
    reasoning: assessment.reasoning,
    reviewed_at: new Date().toISOString(),
  })
}
