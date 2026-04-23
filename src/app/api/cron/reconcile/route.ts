import { NextRequest, NextResponse } from 'next/server'
import { runReconciliation } from '@/lib/engine/reconciliation'

export const dynamic = 'force-dynamic'

// ─── POST /api/cron/reconcile ─────────────────────────────────────────────────
//
// Vercel Cron endpoint. Runs the Stripe ↔ DB reconciliation job.
// Schedule: daily at 02:00 UTC (configured in vercel.json).
// Note: Vercel Hobby plan permits at most one execution per day per cron job.
//
// Security: Vercel automatically adds "Authorization: Bearer {CRON_SECRET}"
// when invoking cron routes. Any other caller must present the same token.
//
// Also accepts POST for manual testing. The /api/admin/reconciliation route
// is the human-facing trigger — this route is infrastructure-only.

export async function GET(request: NextRequest) {
  return handler(request)
}

export async function POST(request: NextRequest) {
  return handler(request)
}

async function handler(request: NextRequest): Promise<NextResponse> {
  // ── Authenticate ──────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    const token      = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token || token !== cronSecret) {
      console.warn('[cron/reconcile] Unauthorized request — bad or missing CRON_SECRET')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else if (process.env.NODE_ENV === 'production') {
    // CRON_SECRET must be set in production
    console.error('[cron/reconcile] CRON_SECRET is not set — refusing to run in production')
    return NextResponse.json(
      { error: 'CRON_SECRET environment variable is not configured.' },
      { status: 500 },
    )
  }

  const startTime = Date.now()
  console.log('[cron/reconcile] Starting reconciliation run')

  const result = await runReconciliation({
    windowDays:  7,
    triggeredBy: 'cron',
  })

  const durationSeconds = (Date.now() - startTime) / 1000

  if (result.status === 'failed') {
    console.error(
      `[cron/reconcile] Run ${result.runId} FAILED after ${durationSeconds.toFixed(1)}s:`,
      result.error,
    )
    return NextResponse.json(
      {
        success:  false,
        run_id:   result.runId,
        error:    result.error,
        duration: durationSeconds,
      },
      { status: 500 },
    )
  }

  console.log(
    `[cron/reconcile] Run ${result.runId} completed in ${durationSeconds.toFixed(1)}s. ` +
    `Checked: ${result.releasesChecked} releases, ${result.transfersChecked} transfers, ` +
    `${result.dealsChecked} deals. Issues found: ${result.issuesFound}.`,
  )

  if (result.issuesFound > 0) {
    console.warn(
      `[cron/reconcile] ⚠️ ${result.issuesFound} reconciliation issue(s) detected. ` +
      'Review at /dashboard/admin.',
    )
  }

  return NextResponse.json({
    success:           true,
    run_id:            result.runId,
    releases_checked:  result.releasesChecked,
    transfers_checked: result.transfersChecked,
    deals_checked:     result.dealsChecked,
    issues_found:      result.issuesFound,
    duration_seconds:  durationSeconds,
  })
}
