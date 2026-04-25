import { NextResponse } from 'next/server'
import { createClient, createSupabaseAdminClient } from '@/lib/supabase/server'
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

    // Use the admin client for this write so it runs as service role (auth.uid() IS NULL).
    // onboarding_complete is a platform-managed field protected by
    // trg_enforce_profile_platform_fields — session-client writes are blocked.
    // The admin client bypasses that trigger while still scoping the update to
    // the authenticated user's own profile row via .eq('id', user.id).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminClient = createSupabaseAdminClient()
    const { error: updateError } = await (adminClient as any)
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
