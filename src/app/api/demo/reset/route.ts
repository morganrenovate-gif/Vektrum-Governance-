import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/demo/reset
 *
 * Signals a demo environment reset. Since demo state is currently frontend-only
 * (React component state from hardcoded constants), this route has no side
 * effects — it validates the request and returns success so the client can
 * navigate to a clean entry point.
 *
 * Auth gate: requires any authenticated session. Anonymous callers receive 401
 * so that unauthenticated actors cannot probe the endpoint or spam reset signals
 * to disrupt active demo sessions. Consistent with the admin/promote pattern
 * (auth checked before env gate so feature state is not leaked to anon callers).
 *
 * Safety gate: blocked in production unless DEMO_RESET_ENABLED=true is set.
 * This prevents accidental exposure if the route is ever extended to operate
 * on real data.
 */
export async function POST(request: NextRequest) {
  // ── Auth guard — any authenticated session ─────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 },
    )
  }

  // ── Env gate — blocked in production unless explicitly enabled ─────────────
  const isProduction    = process.env.NODE_ENV === 'production'
  const demoResetEnabled = process.env.DEMO_RESET_ENABLED === 'true'

  if (isProduction && !demoResetEnabled) {
    return NextResponse.json(
      { error: 'Demo reset is not available in this environment.' },
      { status: 403 },
    )
  }

  return NextResponse.json({
    ok: true,
    message: 'Demo reset acknowledged. All frontend state will be cleared on navigation.',
    scope: 'frontend_state_only',
  })
}
