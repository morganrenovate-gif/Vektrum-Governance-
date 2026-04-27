import { NextRequest, NextResponse } from 'next/server'
import { runAndRecordAuditChainHealth } from '@/lib/engine/audit-chain-health'
import { logAudit } from '@/lib/engine/audit'
import { POLICIES, checkRateLimit, rateLimitResponse, logRateLimitViolation, getRequestIp } from '@/lib/engine/rate-limit'

export const dynamic = 'force-dynamic'

// ─── /api/cron/audit-chain-health ────────────────────────────────────────────
//
// Daily Vercel cron — runs verify_audit_chain() across the entire audit_log
// and records the result in public.audit_chain_health.
//
// Schedule: 02:00 UTC daily (vercel.json).
//
// Auth: CRON_SECRET Bearer (same pattern as /api/cron/reconcile).
//
// This route NEVER mutates audit_log. It only reads via the verifier RPC and
// inserts a single summary row in audit_chain_health. The result is NEVER
// exposed publicly — the response body contains counts only and HTTP status
// reflects whether the chain is healthy. The richer data is admin-only via
// /api/admin/audit-chain-health.

export async function GET(request: NextRequest)  { return handler(request) }
export async function POST(request: NextRequest) { return handler(request) }

async function handler(request: NextRequest): Promise<NextResponse> {
  // ── Authenticate ──────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    const token      = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token || token !== cronSecret) {
      console.warn('[cron/audit-chain-health] Unauthorized request')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else if (process.env.NODE_ENV === 'production') {
    console.error('[cron/audit-chain-health] CRON_SECRET unset — refusing to run in production')
    return NextResponse.json(
      { error: 'CRON_SECRET environment variable is not configured.' },
      { status: 500 },
    )
  }

  // ── Rate limit (secondary defence — primary is CRON_SECRET) ───────────────
  {
    const ip = getRequestIp(request)
    const rl = await checkRateLimit(`ip:${ip}:cron`, POLICIES.cron)
    if (!rl.allowed) {
      logRateLimitViolation(`ip:${ip}:cron`, rl, {
        actorId: null, policyName: 'cron',
        entityType: 'cron', entityId: 'audit-chain-health',
      })
      return rateLimitResponse(rl, POLICIES.cron.description)
    }
  }

  const startedAt = new Date()

  // Audit: started. Counts/status are recorded by the runner; this event
  // simply records that a verification was attempted.
  await logAudit({
    entity_type:   'audit_chain_health',
    entity_id:     'global',
    action:        'audit_chain_verification_started',
    actor_id:      null,
    actor_role:    'system',
    system_source: 'api/cron/audit-chain-health',
    metadata:      {
      route:        '/api/cron/audit-chain-health',
      started_at:   startedAt.toISOString(),
      triggered_by: 'cron',
    },
  })

  const result = await runAndRecordAuditChainHealth('cron')

  // Audit: completed. Only safe counts / status are logged — never hash
  // values or row payloads.
  await logAudit({
    entity_type:   'audit_chain_health',
    entity_id:     result.recordedAs ?? 'global',
    action:        result.status === 'broken'
      ? 'audit_chain_verification_broken'
      : result.status === 'error'
      ? 'audit_chain_verification_failed'
      : 'audit_chain_verification_passed',
    actor_id:      null,
    actor_role:    'system',
    system_source: 'api/cron/audit-chain-health',
    metadata:      {
      route:        '/api/cron/audit-chain-health',
      status:       result.status,
      rows_checked: result.rowsChecked,
      rows_invalid: result.rowsInvalid,
      duration_ms:  result.durationMs,
      // Only the FIRST broken event_sequence is logged (no hash values, no
      // payload). Operators pivot from this to the audit_log row directly.
      first_broken_event_sequence: result.firstBrokenEventSequence,
    },
  })

  // Public response is intentionally minimal. Status code mirrors result.status
  // so Vercel cron retries on actual failure (not on chain-broken, which is a
  // healthy-runner / unhealthy-data scenario).
  const httpStatus = result.status === 'error' ? 500 : 200
  return NextResponse.json(
    {
      status:        result.status,
      rows_checked:  result.rowsChecked,
      rows_invalid:  result.rowsInvalid,
      duration_ms:   result.durationMs,
    },
    { status: httpStatus },
  )
}
