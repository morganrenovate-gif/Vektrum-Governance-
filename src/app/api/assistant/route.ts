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
 * Current implementation: structured "Coming soon" responses until LLM is wired.
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

    // ── Coming-soon response ────────────────────────────────────────────────────
    // Full LLM integration will be wired here. The response shape is final.
    return NextResponse.json({
      reply:
        'AI assistant is coming soon. Your command has been received. ' +
        'Full draw review analysis, dispute risk flagging, and milestone intelligence ' +
        'will be available in the next release.',
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
