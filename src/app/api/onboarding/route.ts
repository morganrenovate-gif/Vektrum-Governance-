import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/types'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/onboarding
 * Sets onboarding_complete = true on the caller's profile.
 * One-way gate — this route never sets it back to false.
 * Auth-gated: requires valid Supabase session.
 */
export async function PATCH() {
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

    // Cast to any to bypass broken database.ts type conflict (pre-existing in repo)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('profiles')
      .update({ onboarding_complete: true, updated_at: new Date().toISOString() })
      .eq('id', user.id)

    if (updateError) {
      console.error('[api/onboarding] update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update onboarding status. Please try again.' },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[api/onboarding] unexpected error:', err)
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 },
    )
  }
}
