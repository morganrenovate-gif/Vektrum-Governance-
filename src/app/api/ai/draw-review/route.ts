export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/auth/middleware'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/engine/audit'

// ─── GET /api/ai/draw-review?milestoneId=xxx ────────────────────────────────
// Returns the most recent AI draw review assessment for a milestone.

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

  const supabase = await createClient()

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

export async function POST(req: NextRequest) {
  let authContext
  try {
    authContext = await getAuthUser(req)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext

  // Only funder or admin can request AI reviews
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

  // Fetch milestone
  const { data: milestone } = await db
    .from('milestones')
    .select('id, title, description, amount, status, deal_id')
    .eq('id', milestoneId)
    .single() as { data: { id: string; title: string; description: string | null; amount: number; status: string; deal_id: string } | null }

  if (!milestone) {
    return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
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

  // Call Perplexity Sonar API
  const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY
  if (!PERPLEXITY_API_KEY) {
    return NextResponse.json({ error: 'Perplexity API not configured' }, { status: 503 })
  }

  const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
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

  if (!perplexityResponse.ok) {
    const errorText = await perplexityResponse.text()
    console.error('Perplexity API error:', errorText)
    return NextResponse.json({ error: 'AI assessment service unavailable' }, { status: 502 })
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
