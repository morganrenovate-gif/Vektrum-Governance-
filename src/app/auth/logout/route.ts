import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/engine/audit'

export const dynamic = 'force-dynamic'

// ─── GET /auth/logout ─────────────────────────────────────────────────────────
//
// Signs the current user out by clearing the Supabase session cookie, then
// redirects to the marketing home page.
//
// This route exists so that <a href="/auth/logout"> links in server components
// (where client-side supabase.auth.signOut() is not callable) resolve to a real
// destination rather than a 404.
//
// Interactive UIs (user-menu.tsx, mobile-nav.tsx) call supabase.auth.signOut()
// directly via the browser client — they do not use this route.

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  // Capture user identity BEFORE signOut so the audit row can carry actor_id.
  // If no user is authenticated, the route still redirects cleanly — there is
  // nothing meaningful to audit for an anonymous request to logout.
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // Audit metadata is intentionally minimal: no cookies, tokens, headers,
    // session IDs, or auth payloads. The actor_id alone is sufficient for an
    // investigator to correlate this event with the auth_signin trail.
    await logAudit({
      entity_type:   'profile',
      entity_id:     user.id,
      action:        'auth_logout',
      actor_id:      user.id,
      actor_email:   user.email ?? null,
      system_source: 'auth/logout',
      metadata: {
        route: '/auth/logout',
      },
    })
  }

  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/', request.url))
}
