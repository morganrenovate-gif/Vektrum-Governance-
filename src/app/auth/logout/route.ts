import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/', request.url))
}
