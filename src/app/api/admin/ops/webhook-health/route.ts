import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/auth/middleware'
import { internalError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

// ─── GET /api/admin/ops/webhook-health ────────────────────────────────────────
//
// Returns webhook pipeline health signals:
//
//  1. stale_pending_transfers — releases with transfer_status='pending' that
//     were created over STALE_MINUTES ago. These are transfers Stripe accepted
//     but never confirmed (no transfer.created or account.updated fired).
//     If >1h old, something is wrong: Stripe is not delivering events.
//
//  2. last_webhook_received   — timestamp of the most recent audit_log entry
//     with action starting with 'stripe_' or 'webhook_'. Used to detect a
//     dead webhook feed (e.g. Stripe endpoint disabled / secret rotated).
//
//  3. recent_webhook_events   — last 20 webhook-related audit entries, so ops
//     can see the event sequence at a glance.
//
//  4. unconfirmed_transfers   — count of release rows where transfer_status is
//     still 'pending' regardless of age, for a quick count metric.
//
// Admin-only. Read-only.

const STALE_MINUTES = 60 // pending >1h = stale

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
  const staleCutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1000).toISOString()

  // ── 1. Stale pending transfers ────────────────────────────────────────────
  const { data: staleRows, error: staleError } = await adminClient
    .from('releases')
    .select(`
      id,
      milestone_id,
      deal_id,
      amount,
      stripe_transfer_id,
      transfer_status,
      created_at,
      released_at,
      milestones (
        id,
        title,
        deals (
          id,
          title,
          contractor:profiles!deals_contractor_id_fkey (
            id, full_name, company_name
          )
        )
      )
    `)
    .eq('transfer_status', 'pending')
    .lt('created_at', staleCutoff)
    .order('created_at', { ascending: true })
    .limit(50)

  if (staleError) {
    return internalError('Failed to fetch stale pending transfers.', staleError.message)
  }

  // ── 2. Total unconfirmed (any age) ────────────────────────────────────────
  const { count: unconfirmedCount } = await adminClient
    .from('releases')
    .select('id', { count: 'exact', head: true })
    .eq('transfer_status', 'pending')

  // ── 3. Last webhook received ──────────────────────────────────────────────
  // Look for the most recent audit_log entry triggered by a Stripe webhook
  // (action contains 'stripe_' or entity_type = 'webhook').
  const { data: lastWebhookRows } = await adminClient
    .from('audit_log')
    .select('id, action, created_at, metadata')
    .or("action.like.stripe_%,action.like.%webhook%,action.eq.transfer_confirmed,action.eq.transfer_failed")
    .order('created_at', { ascending: false })
    .limit(1)

  const lastWebhookAt = lastWebhookRows?.[0]?.created_at ?? null
  const minutesSinceLastWebhook = lastWebhookAt
    ? Math.round((Date.now() - new Date(lastWebhookAt).getTime()) / 60_000)
    : null

  // ── 4. Recent webhook-related audit events ────────────────────────────────
  const { data: recentWebhookRows } = await adminClient
    .from('audit_log')
    .select('id, action, entity_id, entity_type, created_at, metadata')
    .or("action.like.stripe_%,action.like.%webhook%,action.eq.transfer_confirmed,action.eq.transfer_failed,action.eq.milestone_payout_failed,action.eq.release_created")
    .order('created_at', { ascending: false })
    .limit(20)

  // ── Shape stale transfer rows ─────────────────────────────────────────────
  function minutesSince(iso: string): number {
    return Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  }

  type MilestoneJoin = {
    id: string
    title: string
    deals: {
      id: string
      title: string
      contractor: { id: string; full_name: string | null; company_name: string | null } | null
    } | null
  }

  const staleTransfers = (staleRows ?? []).map((r) => {
    const milestone = r.milestones as unknown as MilestoneJoin | null
    const deal = milestone?.deals ?? null
    const contractor = deal?.contractor ?? null
    return {
      release_id:          r.id,
      milestone_id:        r.milestone_id,
      deal_id:             r.deal_id,
      amount:              r.amount,
      stripe_transfer_id:  r.stripe_transfer_id,
      created_at:          r.created_at,
      minutes_pending:     minutesSince(r.created_at),
      milestone_title:     milestone?.title ?? null,
      deal_title:          deal?.title ?? null,
      contractor_name:     contractor?.full_name ?? contractor?.company_name ?? null,
    }
  })

  // ── Determine feed health ─────────────────────────────────────────────────
  // Signal levels:
  //   ok      — last webhook < 2h ago AND no stale transfers
  //   warning — last webhook 2-6h ago OR stale transfers exist
  //   critical — last webhook > 6h ago OR stale transfers > 30 min old
  const maxStaleMins = staleTransfers.reduce((m, r) => Math.max(m, r.minutes_pending), 0)

  let feedHealth: 'ok' | 'warning' | 'critical' = 'ok'

  if (
    (minutesSinceLastWebhook !== null && minutesSinceLastWebhook > 360) ||
    maxStaleMins > 30
  ) {
    feedHealth = 'critical'
  } else if (
    (minutesSinceLastWebhook !== null && minutesSinceLastWebhook > 120) ||
    staleTransfers.length > 0
  ) {
    feedHealth = 'warning'
  }

  return NextResponse.json({
    scanned_at:               new Date().toISOString(),
    stale_threshold_minutes:  STALE_MINUTES,

    // Feed health
    feed_health:              feedHealth,
    last_webhook_at:          lastWebhookAt,
    minutes_since_last_webhook: minutesSinceLastWebhook,

    // Stale pending transfers
    stale_count:              staleTransfers.length,
    stale_transfers:          staleTransfers,

    // Totals
    unconfirmed_total:        unconfirmedCount ?? 0,

    // Recent event log (for the timeline display)
    recent_events: (recentWebhookRows ?? []).map((e) => ({
      id:          e.id,
      action:      e.action,
      entity_id:   e.entity_id,
      entity_type: e.entity_type,
      created_at:  e.created_at,
      metadata:    e.metadata,
    })),
  })
}
