import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { getAuthUser, requireRole, requireMFA, extractAdminJustification } from '@/lib/auth/middleware'
import { runReconciliation } from '@/lib/engine/reconciliation'
import { logAdminAudit } from '@/lib/engine/audit'
import { internalError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

// ─── GET /api/admin/reconciliation ────────────────────────────────────────────
//
// Returns open reconciliation issues and the last run summary.
// Admin only.
//
// Query params:
//   status   — filter by status (default: 'open'). Use 'all' for no filter.
//   severity — filter by severity (critical | high | medium | low)
//   limit    — max rows (default 50, max 200)
//   offset   — pagination offset (default 0)

export async function GET(request: NextRequest) {
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

  const supabase = await createClient()
  try {
    await requireMFA(supabase, authContext.profile)
  } catch (err) {
    return err as NextResponse
  }

  const { searchParams } = request.nextUrl
  const status   = searchParams.get('status')   ?? 'open'
  const severity = searchParams.get('severity')
  const limit    = Math.min(parseInt(searchParams.get('limit')  ?? '50', 10), 200)
  const offset   = parseInt(searchParams.get('offset') ?? '0', 10)

  const admin = createSupabaseAdminClient()

  // ── Fetch issues ──────────────────────────────────────────────────────────
  let query = admin
    .from('reconciliation_issues')
    .select(`
      id, run_id, issue_type, severity, status,
      deal_id, milestone_id, release_id, stripe_transfer_id,
      expected_amount, actual_amount,
      description, auto_fixable, dedup_key,
      resolution_note, resolution_action, resolved_at, resolved_by,
      created_at, updated_at
    `, { count: 'exact' })
    .order('severity', { ascending: true })  // critical first
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status !== 'all') {
    query = query.eq('status', status)
  }
  if (severity) {
    query = query.eq('severity', severity)
  }

  const { data: issues, error: issuesError, count } = await query

  if (issuesError) {
    return internalError('Failed to fetch reconciliation issues.', issuesError.message)
  }

  // ── Fetch last run ─────────────────────────────────────────────────────────
  const { data: lastRun } = await admin
    .from('reconciliation_runs')
    .select('id, status, started_at, completed_at, releases_checked, transfers_checked, deals_checked, issues_found, error_message, triggered_by')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // ── Health summary ─────────────────────────────────────────────────────────
  const { data: health } = await admin
    .from('reconciliation_issues')
    .select('severity, status')
    .eq('status', 'open')

  const openCritical = (health ?? []).filter(h => h.severity === 'critical').length
  const openHigh     = (health ?? []).filter(h => h.severity === 'high').length
  const openTotal    = (health ?? []).length

  return NextResponse.json({
    issues:   issues ?? [],
    total:    count  ?? 0,
    last_run: lastRun ?? null,
    health: {
      open_critical: openCritical,
      open_high:     openHigh,
      open_total:    openTotal,
    },
  })
}


// ─── POST /api/admin/reconciliation ───────────────────────────────────────────
//
// Manually triggers a reconciliation run. Admin only.
//
// Body (optional):
//   { window_days?: number }  — how many days back to check (default 30 for manual)

export async function POST(request: NextRequest) {
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

  const supabase = await createClient()
  try {
    await requireMFA(supabase, authContext.profile)
  } catch (err) {
    return err as NextResponse
  }

  const { user } = authContext

  let windowDays = 30
  let justification = ''
  let authorizationRef: string | null = null

  try {
    const body = await request.json() as {
      window_days?: number
      admin_justification?: string
      authorization_reference?: string
    }
    if (body.window_days && typeof body.window_days === 'number') {
      windowDays = Math.min(Math.max(body.window_days, 1), 90)
    }
    // Extract justification from parsed body (header fallback handled below)
    if (typeof body.admin_justification === 'string') justification = body.admin_justification
    if (typeof body.authorization_reference === 'string') authorizationRef = body.authorization_reference
  } catch { /* no body, use defaults */ }

  // Header takes precedence over body
  const headerJustification = request.headers.get('x-admin-justification')?.trim()
  if (headerJustification) justification = headerJustification

  // Validate justification
  try {
    extractAdminJustification(request, { admin_justification: justification })
  } catch (err) {
    return err as NextResponse
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null

  // Create the run record first so we can return the run_id immediately
  const admin = createSupabaseAdminClient()
  const windowEnd   = new Date()
  const windowStart = new Date(windowEnd.getTime() - windowDays * 86_400_000)

  const { data: run, error: runCreateError } = await admin
    .from('reconciliation_runs')
    .insert({
      window_start: windowStart.toISOString(),
      window_end:   windowEnd.toISOString(),
      triggered_by: `manual:${user.id}`,
      status:       'running',
    })
    .select('id')
    .single()

  if (runCreateError || !run) {
    return internalError('Failed to create reconciliation run.', runCreateError?.message)
  }

  // Run synchronously — for most platforms this completes in < 15s.
  // For very large transfer histories, consider moving to a background task.
  const result = await runReconciliation({
    windowDays,
    triggeredBy: `manual:${user.id}`,
    runId:       run.id,
  })

  // Dual-write to audit_log + admin_audit_log.
  // Awaited directly so both writes complete before the response is returned —
  // requireAdminAudit fires logAdminAudit as fire-and-forget which risks
  // abandonment in serverless runtimes before the response flushes.
  await logAdminAudit({
    entity_type:             'reconciliation_run',
    entity_id:               run.id,
    action:                  'manual_reconciliation_run',
    actor_id:                user.id,
    actor_role:              authContext.profile.role,
    actor_email:             user.email,
    system_source:           'api/admin/reconciliation',
    ip_address:              ip,
    admin_justification:     justification.trim(),
    authorization_reference: authorizationRef,
    new_values: {
      run_id:      result.runId,
      status:      result.status,
      window_days: windowDays,
    },
    metadata: {
      releases_checked:  result.releasesChecked,
      transfers_checked: result.transfersChecked,
      deals_checked:     result.dealsChecked,
      issues_found:      result.issuesFound,
      duration_ms:       result.durationMs,
      triggered_by:      `manual:${user.id}`,
    },
  })

  return NextResponse.json({
    run_id:            result.runId,
    status:            result.status,
    releases_checked:  result.releasesChecked,
    transfers_checked: result.transfersChecked,
    deals_checked:     result.dealsChecked,
    issues_found:      result.issuesFound,
    duration_ms:       result.durationMs,
    error:             result.error ?? null,
  }, { status: result.status === 'failed' ? 500 : 200 })
}
