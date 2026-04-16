export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/types'

/**
 * POST /api/assistant
 *
 * Receives a command from the AI assistant panel and returns a structured
 * response. All read/write operations go through this route — no component
 * ever queries the DB directly.
 *
 * Body shape:
 *   { command: string, context?: { dealId?: string, milestoneId?: string }, confirm?: boolean }
 *
 * Response shape:
 *   { reply: string, suggestions: string[], requiresConfirmation?: boolean }
 *
 * Write actions require { confirm: true } in the body before they execute.
 * Powered by Perplexity Sonar AI.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 },
      )
    }

    // Fetch caller profile for role-awareness
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rawProfile } = await (supabase as any)
      .from('profiles')
      .select('id, role, full_name')
      .eq('id', user.id)
      .single()

    const profile = rawProfile as Pick<Profile, 'id' | 'role' | 'full_name'> | null

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found.' },
        { status: 404 },
      )
    }

    const body = await req.json().catch(() => ({}))
    const command: string = typeof body.command === 'string' ? body.command.trim() : ''

    if (!command) {
      return NextResponse.json(
        { error: 'A command is required.' },
        { status: 400 },
      )
    }

    // ── Role-aware suggested commands ──────────────────────────────────────────
    const contractorSuggestions = [
      'Show my milestones ready for review',
      'Check my Stripe payout status',
      'Summarize open change orders',
      'List deals with pending approvals',
    ]
    const funderSuggestions = [
      'Show deals requiring action',
      'Check release readiness for a deal',
      'Summarize active disputes',
      "Review this week's milestone approvals",
    ]
    const suggestions =
      profile.role === 'contractor' ? contractorSuggestions : funderSuggestions

    // ── Perplexity Sonar AI ────────────────────────────────────────────────────
    const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY
    if (!PERPLEXITY_API_KEY) {
      return NextResponse.json(
        { error: 'AI service unavailable' },
        { status: 503 },
      )
    }

    const systemPrompt =
      'You are the Vektrum AI Assistant — helping construction project funders, contractors, and deal managers understand their projects, navigate the platform, and make informed decisions about milestone management and fund governance. ' +
      `The current user is a ${profile.role}${profile.full_name ? ` named ${profile.full_name}` : ''}. ` +
      'Keep responses concise and actionable. Use plain language.'

    const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: command },
        ],
        temperature: 0.5,
        max_tokens: 512,
      }),
    })

    if (!perplexityResponse.ok) {
      console.error('[api/assistant] Perplexity API error:', await perplexityResponse.text())
      return NextResponse.json({
        reply:
          'AI assistant encountered an error processing your request. Please try again.',
        suggestions,
        requiresConfirmation: false,
      })
    }

    const perplexityData = await perplexityResponse.json()
    const reply: string = perplexityData.choices?.[0]?.message?.content ?? 'No response from AI.'

    return NextResponse.json({
      reply,
      suggestions,
      requiresConfirmation: false,
    })
  } catch (err) {
    console.error('[api/assistant] unexpected error:', err)
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 },
    )
  }
}
