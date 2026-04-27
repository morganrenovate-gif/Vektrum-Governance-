import { NextRequest, NextResponse } from 'next/server'
import { runReconciliation }          from '@/lib/engine/reconciliation'
import { sendSlackAlert }             from '@/lib/engine/alerts'
import { sendAdminAlert }             from '@/lib/engine/notifications'
import { createSupabaseAdminClient }  from '@/lib/supabase/admin'
import { logAudit }                   from '@/lib/engine/audit'
import { POLICIES, checkRateLimit, rateLimitResponse, logRateLimitViolation, getRequestIp } from '@/lib/engine/rate-limit'

export const dynamic = 'force-dynamic'

// ─── POST /api/cron/reconcile ─────────────────────────────────────────────────
//
// Vercel Cron endpoint — Stripe ↔ DB reconciliation job.
// Schedule: every hour (configured in vercel.json).
// Requires Vercel Pro plan for sub-daily cron frequency.
//
// Security: Vercel automatically sets "Authorization: Bearer {CRON_SECRET}"
// when invoking cron routes. Any other caller must present the same token.
//
// Behaviour per run:
//   1. Detect and fix stuck runs from the previous invocation.
//   2. Run all reconciliation passes with RECONCILIATION_LOOKBACK_HOURS window.
//   3. Alert on NEW findings (first detected this run — created_at >= runStart).
//   4. Escalate unresolved critical issues older than 1 hour (SLA enforcement).

export async function GET(request: NextRequest) {
  return handler(request)
}

export async function POST(request: NextRequest) {
  return handler(request)
}

// ─── Thresholds ───────────────────────────────────────────────────────────────

/** A run is considered "stuck" if it has been in status='running' for more than this many ms. */
const STUCK_RUN_THRESHOLD_MS = 2 * 60 * 60 * 1_000 // 2 hours

/** A critical issue is "overdue" (SLA breach) if it has been open for more than this many ms. */
const SLA_CRITICAL_THRESHOLD_MS = 1 * 60 * 60 * 1_000 // 1 hour

// ─── Handler ──────────────────────────────────────────────────────────────────

async function handler(request: NextRequest): Promise<NextResponse> {
  // ── Authenticate ────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    const token      = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token || token !== cronSecret) {
      console.warn('[cron/reconcile] Unauthorized request — bad or missing CRON_SECRET')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else if (process.env.NODE_ENV === 'production') {
    console.error('[cron/reconcile] CRON_SECRET is not set — refusing to run in production')
    return NextResponse.json(
      { error: 'CRON_SECRET environment variable is not configured.' },
      { status: 500 },
    )
  }

  // ── Rate limit — cron endpoint (secondary defence) ────────────────────────
  // CRON_SECRET is the primary protection. This cap prevents repeated manual
  // runs from saturating the reconciliation engine (which issues many DB queries).
  {
    const ip = getRequestIp(request)
    const rl = await checkRateLimit(`ip:${ip}:cron`, POLICIES.cron)
    if (!rl.allowed) {
      logRateLimitViolation(`ip:${ip}:cron`, rl, {
        actorId: null, policyName: 'cron',
        entityType: 'cron', entityId: 'reconcile',
      })
      return rateLimitResponse(rl, POLICIES.cron.description)
    }
  }

  const runStart = new Date()
  console.log('[cron/reconcile] Starting reconciliation run at', runStart.toISOString())

  const admin = createSupabaseAdminClient()

  // ── 1. Detect and fix stuck runs ───────────────────────────────────────────
  await detectAndFixStuckRuns(admin, runStart)

  // ── 2. Run reconciliation passes ───────────────────────────────────────────
  const lookbackHours = process.env.RECONCILIATION_LOOKBACK_HOURS
    ? parseInt(process.env.RECONCILIATION_LOOKBACK_HOURS, 10)
    : 72
  const effectiveLookbackHours = isFinite(lookbackHours) ? lookbackHours : 72

  // Audit: cron run started — system actor, no PII / secrets / headers in
  // metadata. The runId is generated inside runReconciliation, so the
  // started event uses 'reconcile' as a stable correlation key; the
  // completed/failed events carry the actual runId.
  await logAudit({
    entity_type:   'reconciliation_run',
    entity_id:     'reconcile',
    action:        'cron_reconcile_started',
    actor_id:      null,
    actor_role:    'system',
    system_source: 'api/cron/reconcile',
    metadata: {
      route:          '/api/cron/reconcile',
      started_at:     runStart.toISOString(),
      lookback_hours: effectiveLookbackHours,
      triggered_by:   'cron',
    },
  })

  const result = await runReconciliation({
    windowHours: effectiveLookbackHours,
    triggeredBy: 'cron',
  })

  const durationMs      = Date.now() - runStart.getTime()
  const durationSeconds = durationMs / 1000

  if (result.status === 'failed') {
    console.error(
      `[cron/reconcile] Run ${result.runId} FAILED after ${durationSeconds.toFixed(1)}s:`,
      result.error,
    )

    // Audit: cron run failed. The error_summary is the FIRST LINE of
    // result.error only and is truncated to 500 chars — never a full stack
    // trace, never an Error object. result.error is already considered safe
    // for outbound Slack/email alerts above.
    await logAudit({
      entity_type:   'reconciliation_run',
      entity_id:     result.runId ?? 'reconcile',
      action:        'cron_reconcile_failed',
      actor_id:      null,
      actor_role:    'system',
      system_source: 'api/cron/reconcile',
      metadata: {
        route:         '/api/cron/reconcile',
        run_id:        result.runId ?? null,
        duration_ms:   durationMs,
        error_summary: ((result.error ?? 'unknown')
          .split('\n')[0] ?? 'unknown')
          .slice(0, 500),
      },
    })

    // Alert on run failure
    await Promise.allSettled([
      sendSlackAlert({
        severity:    'critical',
        title:       'Reconciliation run failed',
        description: result.error ?? 'Unknown error — check server logs.',
        metadata:    { run_id: result.runId, duration_s: durationSeconds.toFixed(1) },
      }),
      sendAdminAlert({
        severity:    'critical',
        title:       'Reconciliation run failed',
        description: result.error ?? 'Unknown error — check server logs.',
        metadata:    { run_id: result.runId, duration_s: durationSeconds.toFixed(1) },
        batchKey:    'reconciliation_run_failed',
      }),
    ])

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

  // Audit: cron run completed. Only counts + duration + run_id are recorded.
  // No request headers, no CRON_SECRET, no environment vars.
  await logAudit({
    entity_type:   'reconciliation_run',
    entity_id:     result.runId,
    action:        'cron_reconcile_completed',
    actor_id:      null,
    actor_role:    'system',
    system_source: 'api/cron/reconcile',
    metadata: {
      route:             '/api/cron/reconcile',
      run_id:            result.runId,
      duration_ms:       durationMs,
      releases_checked:  result.releasesChecked,
      transfers_checked: result.transfersChecked,
      deals_checked:     result.dealsChecked,
      issues_found:      result.issuesFound,
    },
  })

  // ── 3. Alert on NEW findings ───────────────────────────────────────────────
  //
  // A finding is "new" if it was first detected in this run:
  //   created_at >= runStart (upserts preserve the original created_at, so only
  //   first-detection rows satisfy this condition).
  if (result.issuesFound > 0) {
    await alertNewFindings(admin, result.runId, runStart)
  }

  // ── 4. SLA escalation — unresolved critical issues ─────────────────────────
  await escalateOverdueCriticals(admin)

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

// ─── Stuck-run detection ──────────────────────────────────────────────────────

async function detectAndFixStuckRuns(
  admin:    ReturnType<typeof createSupabaseAdminClient>,
  now:      Date,
): Promise<void> {
  const twoHoursAgo = new Date(now.getTime() - STUCK_RUN_THRESHOLD_MS).toISOString()

  const { data: stuckRuns, error } = await admin
    .from('reconciliation_runs')
    .select('id, created_at, triggered_by')
    .eq('status', 'running')
    .lt('created_at', twoHoursAgo)

  if (error) {
    console.error('[cron/reconcile] Failed to query for stuck runs:', error.message)
    return
  }

  if (!stuckRuns || stuckRuns.length === 0) return

  for (const run of stuckRuns) {
    console.warn(
      `[cron/reconcile] Marking stuck run ${run.id} as failed ` +
      `(started ${run.created_at}, triggered_by: ${run.triggered_by})`,
    )

    await admin
      .from('reconciliation_runs')
      .update({
        status:          'failed',
        completed_at:    now.toISOString(),
        error_message:   'Run exceeded 2-hour timeout — forcibly marked failed by subsequent cron invocation.',
      })
      .eq('id', run.id)
      .eq('status', 'running') // guard: don't overwrite if another process already resolved it

    await Promise.allSettled([
      sendSlackAlert({
        severity:    'critical',
        title:       `Stuck reconciliation run detected`,
        description: `Run ${run.id} was still in status 'running' after 2+ hours. It has been marked failed.`,
        metadata:    {
          run_id:       run.id,
          started_at:   run.created_at,
          triggered_by: run.triggered_by,
        },
      }),
      sendAdminAlert({
        severity:    'critical',
        title:       `Stuck reconciliation run: ${run.id}`,
        description: `Run ${run.id} was still in status 'running' after 2+ hours and has been marked failed.`,
        metadata:    {
          run_id:       run.id,
          started_at:   run.created_at,
          triggered_by: run.triggered_by,
        },
        batchKey:    'stuck_reconciliation_run',
      }),
    ])
  }
}

// ─── New-finding alerting ─────────────────────────────────────────────────────

async function alertNewFindings(
  admin:    ReturnType<typeof createSupabaseAdminClient>,
  runId:    string,
  runStart: Date,
): Promise<void> {
  // Fetch issues that were first detected in this run.
  // Upsert logic preserves the original `created_at` on re-detection, so
  // `created_at >= runStart` reliably identifies new (not re-detected) issues.
  const { data: newIssues, error } = await admin
    .from('reconciliation_issues')
    .select('id, issue_type, severity, deal_id, milestone_id, description, created_at')
    .eq('run_id', runId)
    .gte('created_at', runStart.toISOString())
    .in('severity', ['critical', 'high'])  // only actionable severities
    .in('status', ['open', 'acknowledged'])
    .order('severity', { ascending: true }) // critical first

  if (error) {
    console.error('[cron/reconcile] Failed to fetch new findings:', error.message)
    return
  }

  if (!newIssues || newIssues.length === 0) {
    console.log('[cron/reconcile] No new high/critical findings this run.')
    return
  }

  console.warn(`[cron/reconcile] ${newIssues.length} new finding(s) detected.`)

  for (const issue of newIssues) {
    const isCritical = issue.severity === 'critical'
    const title      = `${isCritical ? 'Critical' : 'Warning'}: ${issue.issue_type} detected`
    const entityId   = issue.deal_id ?? undefined

    await Promise.allSettled([
      sendSlackAlert({
        severity:    isCritical ? 'critical' : 'warning',
        title,
        description: issue.description,
        entityId,
        metadata: {
          issue_type:   issue.issue_type,
          severity:     issue.severity,
          deal_id:      issue.deal_id ?? '—',
          milestone_id: issue.milestone_id ?? '—',
          detected_at:  issue.created_at,
          run_id:       runId,
        },
      }),
      sendAdminAlert({
        severity:    isCritical ? 'critical' : 'warning',
        title,
        description: issue.description,
        metadata: {
          issue_type:   issue.issue_type,
          deal_id:      issue.deal_id ?? '—',
          milestone_id: issue.milestone_id ?? '—',
          detected_at:  issue.created_at,
        },
        // Warning batching key is keyed by issue_type so one warning per type per hour
        batchKey:    issue.issue_type,
      }),
    ])
  }
}

// ─── SLA escalation ───────────────────────────────────────────────────────────

async function escalateOverdueCriticals(
  admin: ReturnType<typeof createSupabaseAdminClient>,
): Promise<void> {
  const oneHourAgo = new Date(Date.now() - SLA_CRITICAL_THRESHOLD_MS).toISOString()

  const { data: overdueIssues, error } = await admin
    .from('reconciliation_issues')
    .select('id, issue_type, deal_id, milestone_id, description, created_at')
    .eq('severity', 'critical')
    .in('status', ['open', 'acknowledged'])
    .lt('created_at', oneHourAgo)

  if (error) {
    console.error('[cron/reconcile] Failed to query for overdue critical issues:', error.message)
    return
  }

  if (!overdueIssues || overdueIssues.length === 0) return

  console.warn(`[cron/reconcile] ${overdueIssues.length} overdue critical issue(s) — escalating.`)

  for (const issue of overdueIssues) {
    const ageMinutes = Math.round(
      (Date.now() - new Date(issue.created_at).getTime()) / 60_000,
    )
    const entityLabel = issue.deal_id ?? issue.milestone_id ?? issue.id
    const title       = `UNRESOLVED CRITICAL: ${issue.issue_type} for ${entityLabel}`

    await Promise.allSettled([
      sendSlackAlert({
        severity:    'critical',
        title,
        description:
          `This critical reconciliation issue has been open for ${ageMinutes} minutes without resolution. ` +
          issue.description,
        entityId:    issue.deal_id ?? undefined,
        metadata: {
          issue_type:  issue.issue_type,
          open_for:    `${ageMinutes} minutes`,
          deal_id:     issue.deal_id ?? '—',
          created_at:  issue.created_at,
        },
      }),
      sendAdminAlert({
        severity:    'critical',
        title,
        description:
          `Critical issue open for ${ageMinutes} minutes. Immediate attention required. ` +
          issue.description,
        metadata: {
          issue_type:  issue.issue_type,
          open_for:    `${ageMinutes} minutes`,
          deal_id:     issue.deal_id ?? '—',
          created_at:  issue.created_at,
        },
        // Each overdue issue gets its own escalation email (no batching for SLA escalations)
        batchKey:    `sla_escalation:${issue.id}`,
      }),
    ])
  }
}
