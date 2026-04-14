import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { AuthContext, Profile } from '@/lib/types'

/**
 * Server-side session helper for use in Server Components and layouts.
 *
 * Reads the Supabase auth session from cookies and returns the authenticated
 * user alongside their profile (which includes the role and onboarding state).
 *
 * Returns null if:
 *   - No valid session cookie is present.
 *   - The session has expired.
 *   - No matching profile row exists for the user.
 *
 * This function never throws — it returns null on any failure so that layouts
 * and pages can gracefully redirect to the login screen.
 */
export async function getSession(): Promise<AuthContext | null> {
  try {
    const supabase = createSupabaseServerClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return null
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
      return null
    }

    return {
      user: { id: user.id, email: user.email ?? '' },
      profile: profile as Profile,
    }
  } catch {
    // Never propagate — session failures are handled at the page/layout level
    return null
  }
}
