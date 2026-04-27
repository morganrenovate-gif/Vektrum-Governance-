import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole, requireMFA } from '@/lib/auth/middleware'
import { validateProductionEnv } from '@/lib/env/validate-production-env'

export const dynamic = 'force-dynamic'

// ─── GET /api/admin/env-health ───────────────────────────────────────────────
//
// Diagnostic endpoint for production-environment configuration.
//
// Returns a structured report describing which critical variables are present,
// which are missing, and which (if set) are malformed. Variable VALUES are
// never returned — only presence flags and length, plus actionable error
// messages keyed by variable name.
//
// Auth: admin role + AAL2 (MFA). Same gate as other /api/admin/* routes.
//
// Why an admin-gated route rather than a public health check:
//   The presence/length pattern of certain variables (e.g. STRIPE_SECRET_KEY
//   prefix, SUPABASE_SERVICE_ROLE_KEY length) is a partial information leak.
//   Restricting to admin+MFA matches the threat model used by the rest of
//   /api/admin/* and keeps the report off the public surface.

export async function GET(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────
  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  try {
    requireRole(authContext.profile, 'admin')
  } catch (err) {
    return err as NextResponse
  }

  try {
    requireMFA(authContext)
  } catch (err) {
    return err as NextResponse
  }

  // ── Run the validator ───────────────────────────────────────────────────
  const report = validateProductionEnv()

  // Status code mirrors report.ok so curl callers and dashboards can branch
  // on the HTTP status without parsing the body.
  return NextResponse.json(report, { status: report.ok ? 200 : 500 })
}
