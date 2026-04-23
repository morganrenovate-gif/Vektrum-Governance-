import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/auth/middleware'
import { internalError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

// ─── GET /api/admin/ops/alerts ────────────────────────────────────────────────
//
// Aggregates all active operational alerts into a single priority-sorted feed.
// Each alert has:
//   - id          unique string key
//   - severity    'critical' | 'high' | 'medium' | 'low'
//   - category    'release' | 'payout' | 'webhook' | 'stripe' | 'reconciliation'
//   - title       short human headline
//   - description detail sentence
//   - entity_type 'milestone' | 'deal' | 'release' | 'profile'
//   - entity_id   UUID of the relevant entity
//   - detected_at ISO timestamp
//   - action_url  relative path to the relevant dashboard section
//   - metadata    freeform context (amount, names, etc.)
//
// Signals aggregated:
//   1. Milestones stuck in 'approved' > 4h                 → high
//   2. Milestones stuck in 'approved' > 24h                → critical
//   3. Milestones with status='payout_failed'              → critical
//   4. Releases pending > 1h (stale webhook signal)        → high
//   5. No webhook events in > 6h                           → critical
//   6. No webhook events in 2-6h                           → warning (medium)
//   7. Stripe account conflicts attempted (last 24h)       → high
//   8. Deals in 'disputed' status                          → medium
//   9. High-value stuck releases (amount > $10k)           → critical override
//  10. Repeated payout failures (failure_count >= 3)       → critical
//
// Admin-only. Read-only. All signals are computed, not persisted.

const STUCK_HIGH_HOURS     = 4
const STUCK_CRITICAL_HOURS = 24
const HIGH_VALUE_THRESHOLD = 10_000_00  // in cents: $10,000
const REPEAT_FAILURE_THRESHOLD = 3

export interface OpsAlert {
  id:          string
  severity:    'critical' | 'high' | 'medium' | 'low'
  category:    'release' | 'payout' | 'webhook' | 'stripe' | 'reconciliation' | 'dispute'
  title:       string
  description: string
  entity_type: string
  entity_id:   string
  detected_at: string
  action_url:  string
  metadata:    Record<string, unknown>
}

export async function GET(request: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────────────
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

  const adminClient = createSupabaseAdminClient()
  const alerts: OpsAlert[] = []
  const now = Date.now()

  const stuckHighCutoff     = new Date(now - STUCK_HIGH_HOURS * 3_600_000).toISOString()
  const stuckCriticalCutoff = new Date(now - STUCK_CRITICAL_HOURS * 3_600_000).toISOString()

  // ── Signal 1 & 2: Stuck approved milestones ───────────────────────────────
  const { data: stuckMilestones, error: stuckError } = await adminClient
    .from('milestones')
    .select(`
      id, title, amount, approved_at, updated_at, deal_id,
      deals ( id, title,
        contractor:profiles!deals_contractor_id_fkey ( full_name, company_name )
      )
    `)
    .eq('status', 'approved')
    .or(`approved_at.lt.${stuckHighCutoff},and(approved_at.is.null,updated_at.lt.${stuckHighCutoff})`)
    .order('approved_at', { ascending: true, nullsFirst: false })
    .limit(50)

  if (stuckError) {
    return internalError('Failed to fetch stuck milestones.', stuckError.message)
  }

  for (const m of stuckMilestones ?? []) {
    const approvedAt = m.approved_at ?? m.updated_at
    const hoursSince = approvedAt
      ? Math.round((now - new Date(approvedAt).getTime()) / 3_600_000)
      : STUCK_HIGH_HOURS

    const deal = m.deals as unknown as {
      id: string; title: string;
      contractor: { full_name: string | null; company_name: string | null } | null
    } | null

    // Escalate to critical if stuck > 24h OR high value
    const isHighValue  = m.amount >= HIGH_VALUE_THRESHOLD
    const isCritical   = hoursSince >= STUCK_CRITICAL_HOURS || (isHighValue && hoursSince >= STUCK_HIGH_HOURS)
    const severity     = isCritical ? 'critical' : 'high'

    alerts.push({
      id:          `stuck_${m.id}`,
      severity,
      category:    'release',
      title:       `Stuck release${isHighValue ? ' (high value)' : ''}: ${m.title}`,
      description: `Milestone approved ${hoursSince}h ago but not yet released. ` +
                   `Deal: "${deal?.title ?? 'Unknown'}". ` +
                   `Contractor: ${deal?.contractor?.full_name ?? deal?.contractor?.company_name ?? 'Unknown'}.`,
      entity_type: 'milestone',
      entity_id:   m.id,
      detected_at: approvedAt ?? new Date().toISOString(),
      action_url:  `/dashboard/admin/ops#release-health`,
      metadata:    {
        amount:        m.amount,
        hours_stuck:   hoursSince,
        deal_id:       deal?.id ?? m.deal_id,
        deal_title:    deal?.title,
        high_value:    isHighValue,
      },
    })
  }

  // ── Signal 3 & 10: Failed payouts ─────────────────────────────────────────
  const { data: failedMilestones, error: failedError } = await adminClient
    .from('milestones')
    .select(`
      id, title, amount, last_payout_failure_at,
      payout_failure_count,
      deal_id,
      deals ( id, title,
        contractor:profiles!deals_contractor_id_fkey ( full_name, company_name )
      )
    `)
    .eq('status', 'payout_failed')
    .order('last_payout_failure_at', { ascending: false, nullsFirst: false })
    .limit(50)

  if (failedError) {
    return internalError('Failed to fetch failed payouts.', failedError.message)
  }

  for (const m of failedMilestones ?? []) {
    const failureCount = (m as { payout_failure_count?: number }).payout_failure_count ?? 0
    const failedAt     = (m as { last_payout_failure_at?: string | null }).last_payout_failure_at

    const deal = m.deals as unknown as {
      id: string; title: string;
      contractor: { full_name: string | null; company_name: string | null } | null
    } | null

    const isRepeated  = failureCount >= REPEAT_FAILURE_THRESHOLD
    const isHighValue = m.amount >= HIGH_VALUE_THRESHOLD
    const severity: OpsAlert['severity'] =
      isRepeated || isHighValue ? 'critical' : 'high'

    alerts.push({
      id:          `payout_failed_${m.id}`,
      severity,
      category:    'payout',
      title:       `Payout failed${isRepeated ? ` (${failureCount}× attempts)` : ''}: ${m.title}`,
      description: `Stripe transfer failed for milestone "${m.title}" on deal "${deal?.title ?? 'Unknown'}". ` +
                   `${failureCount} failure${failureCount !== 1 ? 's' : ''}. Contractor payout blocked.`,
      entity_type: 'milestone',
      entity_id:   m.id,
      detected_at: failedAt ?? new Date().toISOString(),
      action_url:  `/dashboard/admin/ops#failed-payouts`,
      metadata:    {
        amount:               m.amount,
        failure_count:        failureCount,
        last_failure_at:      failedAt,
        deal_id:              deal?.id ?? m.deal_id,
        deal_title:           deal?.title,
        high_value:           isHighValue,
        repeated_failure:     isRepeated,
      },
    })
  }

  // ── Signal 4: Stale pending transfers (>1h) ────────────────────────────────
  const staleCutoff = new Date(now - 60 * 60_000).toISOString()
  const { data: staleReleases } = await adminClient
    .from('releases')
    .select('id, milestone_id, deal_id, amount, stripe_transfer_id, created_at')
    .eq('transfer_status', 'pending')
    .lt('created_at', staleCutoff)
    .order('created_at', { ascending: true })
    .limit(20)

  for (const r of staleReleases ?? []) {
    const mins = Math.round((now - new Date(r.created_at).getTime()) / 60_000)
    alerts.push({
      id:          `stale_transfer_${r.id}`,
      severity:    mins > 360 ? 'critical' : 'high',
      category:    'webhook',
      title:       `Transfer unconfirmed: ${mins}m`,
      description: `Release ${r.id.slice(0, 8)}… has been in 'pending' state for ${mins} minutes. ` +
                   `Stripe has not delivered a transfer.created or account.updated event.`,
      entity_type: 'release',
      entity_id:   r.id,
      detected_at: r.created_at,
      action_url:  `/dashboard/admin/ops#webhook-health`,
      metadata:    {
        amount:              r.amount,
        stripe_transfer_id:  r.stripe_transfer_id,
        minutes_pending:     mins,
        deal_id:             r.deal_id,
        milestone_id:        r.milestone_id,
      },
    })
  }

  // ── Signal 5 & 6: Webhook feed health ─────────────────────────────────────
  const { data: lastWebhookRows } = await adminClient
    .from('audit_log')
    .select('id, action, created_at')
    .or('action.like.stripe_%,action.eq.transfer_confirmed,action.eq.transfer_failed,action.eq.release_created')
    .order('created_at', { ascending: false })
    .limit(1)

  if (lastWebhookRows) {
    const lastAt = lastWebhookRows[0]?.created_at ?? null
    if (!lastAt) {
      alerts.push({
        id:          'webhook_feed_no_events',
        severity:    'critical',
        category:    'webhook',
        title:       'No Stripe webhook events ever received',
        description: 'No Stripe webhook events have been recorded in audit_log. ' +
                     'The webhook endpoint may not be configured in the Stripe dashboard.',
        entity_type: 'system',
        entity_id:   'webhook_feed',
        detected_at: new Date().toISOString(),
        action_url:  `/dashboard/admin/ops#webhook-health`,
        metadata:    {},
      })
    } else {
      const minsSince = Math.round((now - new Date(lastAt).getTime()) / 60_000)
      if (minsSince > 360) {
        alerts.push({
          id:          'webhook_feed_dead',
          severity:    'critical',
          category:    'webhook',
          title:       `Webhook feed silent for ${Math.round(minsSince / 60)}h`,
          description: `Last Stripe webhook event was ${minsSince} minutes ago. ` +
                       `The webhook endpoint may be disabled, misconfigured, or the signing secret rotated.`,
          entity_type: 'system',
          entity_id:   'webhook_feed',
          detected_at: lastAt,
          action_url:  `/dashboard/admin/ops#webhook-health`,
          metadata:    { minutes_since_last_webhook: minsSince, last_webhook_at: lastAt },
        })
      } else if (minsSince > 120) {
        alerts.push({
          id:          'webhook_feed_stale',
          severity:    'medium',
          category:    'webhook',
          title:       `Webhook feed quiet for ${minsSince}m`,
          description: `No Stripe webhook events in the past ${minsSince} minutes. ` +
                       `May be normal during low traffic, but worth monitoring.`,
          entity_type: 'system',
          entity_id:   'webhook_feed',
          detected_at: lastAt,
          action_url:  `/dashboard/admin/ops#webhook-health`,
          metadata:    { minutes_since_last_webhook: minsSince, last_webhook_at: lastAt },
        })
      }
    }
  }

  // ── Signal 7: Stripe account conflicts (last 24h) ─────────────────────────
  const conflictWindow = new Date(now - 24 * 3_600_000).toISOString()
  const { data: conflictRows } = await adminClient
    .from('audit_log')
    .select('id, entity_id, actor_id, metadata, created_at')
    .eq('action', 'stripe_account_conflict_attempted')
    .gte('created_at', conflictWindow)
    .order('created_at', { ascending: false })
    .limit(10)

  for (const c of conflictRows ?? []) {
    const meta = c.metadata as Record<string, unknown> | null
    alerts.push({
      id:          `stripe_conflict_${c.id}`,
      severity:    'high',
      category:    'stripe',
      title:       'Stripe account conflict attempted',
      description: `A user attempted to link a Stripe account already owned by another profile. ` +
                   `Conflicting account: ${(meta?.conflicting_stripe_account_id as string) ?? 'unknown'}. ` +
                   `Existing owner: ${(meta?.existing_profile_id as string) ?? 'unknown'}.`,
      entity_type: 'profile',
      entity_id:   c.entity_id,
      detected_at: c.created_at,
      action_url:  `/dashboard/admin/ops#stripe-conflicts`,
      metadata:    meta ?? {},
    })
  }

  // ── Signal 8: Active disputes ─────────────────────────────────────────────
  const { data: activeDisputes } = await adminClient
    .from('disputes')
    .select(`
      id, reason, created_at, deal_id,
      milestones ( id, title, amount,
        deals ( id, title )
      )
    `)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(20)

  for (const d of activeDisputes ?? []) {
    const milestone = d.milestones as unknown as {
      id: string; title: string; amount: number;
      deals: { id: string; title: string } | null
    } | null
    const deal = milestone?.deals ?? null

    alerts.push({
      id:          `dispute_${d.id}`,
      severity:    'medium',
      category:    'dispute',
      title:       `Open dispute: ${milestone?.title ?? 'Milestone'}`,
      description: `Active dispute on milestone "${milestone?.title ?? 'unknown'}" ` +
                   `for deal "${deal?.title ?? 'unknown'}". Reason: ${d.reason ?? 'not specified'}.`,
      entity_type: 'dispute',
      entity_id:   d.id,
      detected_at: d.created_at,
      action_url:  `/dashboard/admin#disputes`,
      metadata:    {
        deal_id:      deal?.id ?? d.deal_id,
        deal_title:   deal?.title,
        milestone_id: milestone?.id,
        amount:       milestone?.amount,
        reason:       d.reason,
      },
    })
  }

  // ── Sort alerts by severity + detected_at ─────────────────────────────────
  const SEVERITY_ORDER: Record<string, number> = {
    critical: 0, high: 1, medium: 2, low: 3,
  }

  const sorted = [...alerts].sort((a, b) => {
    const sev = (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3)
    if (sev !== 0) return sev
    return new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime()
  })

  const criticalCount = sorted.filter((a) => a.severity === 'critical').length
  const highCount     = sorted.filter((a) => a.severity === 'high').length

  return NextResponse.json({
    scanned_at:      new Date().toISOString(),
    total:           sorted.length,
    critical_count:  criticalCount,
    high_count:      highCount,
    alerts:          sorted,
    summary: {
      clean:           sorted.length === 0,
      needs_attention: criticalCount > 0 || highCount > 0,
    },
  })
}
