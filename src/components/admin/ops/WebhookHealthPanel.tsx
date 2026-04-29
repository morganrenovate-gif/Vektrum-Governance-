'use client'

import { useState, useCallback } from 'react'
import {
  Activity, AlertTriangle, CheckCircle2, Loader2,
  RefreshCw, ShieldAlert, ShieldCheck, Wifi, WifiOff,
  Clock, FlaskConical,
} from 'lucide-react'
import { formatMoney } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StaleTransfer {
  release_id:         string
  milestone_id:       string
  deal_id:            string
  amount:             number
  stripe_transfer_id: string | null
  created_at:         string
  minutes_pending:    number
  milestone_title:    string | null
  deal_title:         string | null
  contractor_name:    string | null
}

export interface WebhookEvent {
  id:          string
  action:      string
  entity_id:   string
  entity_type: string
  created_at:  string
  metadata:    Record<string, unknown> | null
}

export interface WebhookHealthData {
  scanned_at:                   string
  stale_threshold_minutes:      number
  feed_health:                  'ok' | 'warning' | 'critical'
  last_webhook_at:              string | null
  minutes_since_last_webhook:   number | null
  stale_count:                  number
  stale_transfers:              StaleTransfer[]
  unconfirmed_total:            number
  recent_events:                WebhookEvent[]
  // stripe_mode: 'test' when using sk_test_ keys, 'live' otherwise.
  stripe_mode?:                 'test' | 'live'
}

interface WebhookHealthPanelProps {
  initialData: WebhookHealthData
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string | null): string {
  if (!iso) return 'never'
  const diffMs   = Date.now() - new Date(iso).getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  const diffHrs  = Math.floor(diffMins / 60)
  if (diffHrs  > 0)  return `${diffHrs}h ${diffMins % 60}m ago`
  if (diffMins > 0)  return `${diffMins}m ago`
  return 'just now'
}

function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    stripe_account_created:              'Stripe account created',
    stripe_account_link_generated:       'Onboarding link generated',
    stripe_account_conflict_attempted:   'Stripe conflict blocked',
    release_created:                     'Release initiated',
    transfer_confirmed:                  'Transfer confirmed',
    transfer_failed:                     'Transfer failed',
    milestone_payout_failed:             'Payout failed',
    admin_stripe_duplicate_scan:         'Admin scan',
  }
  return labels[action] ?? action.replace(/_/g, ' ')
}

function actionColor(action: string): string {
  if (action.includes('failed') || action.includes('conflict')) return 'text-red-400'
  if (action.includes('confirmed') || action.includes('created')) return 'text-emerald-400'
  if (action.includes('generated') || action.includes('link')) return 'text-blue-400'
  return 'text-white/75'
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function WebhookHealthPanel({ initialData }: WebhookHealthPanelProps) {
  const [data,       setData]       = useState(initialData)
  const [refreshing, setRefreshing] = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    setError(null)
    try {
      const res  = await fetch('/api/admin/ops/webhook-health')
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Refresh failed.'); return }
      setData(json)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setRefreshing(false)
    }
  }, [])

  const { feed_health, stale_count, unconfirmed_total, last_webhook_at,
          minutes_since_last_webhook, stale_transfers, recent_events } = data
  const isTestMode = data.stripe_mode === 'test'

  return (
    <div className="space-y-4" id="webhook-health">
      {/* ── Test-mode context banner ─────────────────────────────────── */}
      {isTestMode && (feed_health === 'warning' || feed_health === 'critical' || stale_count > 0) && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-blue-500/20 bg-blue-500/[0.06]">
          <FlaskConical size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[12px] font-semibold text-blue-300">Stripe test mode — webhook gaps expected</p>
            <p className="text-[11.5px] text-blue-300/70 leading-snug mt-0.5">
              Test-mode Stripe events are infrequent. Feed gaps and stale pending transfers
              are normal in test/demo usage with no active Stripe traffic.
              In production (<code className="font-mono text-blue-300/80">sk_live_</code>), feed silence requires investigation.
            </p>
          </div>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          {feed_health === 'critical' ? (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] font-semibold bg-red-500/10 border border-red-500/20 text-red-400 w-fit mb-2">
              <WifiOff size={12} />
              Webhook feed critical
            </div>
          ) : feed_health === 'warning' ? (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-400 w-fit mb-2">
              <AlertTriangle size={12} />
              Webhook feed degraded
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 w-fit mb-2">
              <Wifi size={12} />
              Webhook feed healthy
            </div>
          )}
          <p className="text-[11px] text-white/65">
            Last event: {relativeTime(last_webhook_at)}
            {unconfirmed_total > 0 && (
              <> · <span className="text-amber-400">{unconfirmed_total} unconfirmed transfer{unconfirmed_total !== 1 ? 's' : ''}</span></>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-xl border border-white/[0.16] bg-white/[0.05] px-3.5 py-2 text-[12px] font-medium text-white/85 hover:bg-white/[0.1] hover:text-white hover:border-white/[0.24] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue disabled:opacity-50 transition-all flex-shrink-0"
        >
          {refreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/[0.08] px-4 py-2.5 text-[12px] text-red-400">
          {error}
        </div>
      )}

      {/* ── Feed health summary strip ────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <MetricCard
          label="Last webhook"
          value={
            minutes_since_last_webhook !== null
              ? minutes_since_last_webhook < 60
                ? `${minutes_since_last_webhook}m ago`
                : `${Math.round(minutes_since_last_webhook / 60)}h ago`
              : 'Never'
          }
          warn={!last_webhook_at || (minutes_since_last_webhook ?? 999) > 120}
          critical={!last_webhook_at || (minutes_since_last_webhook ?? 999) > 360}
          icon={Clock}
        />
        <MetricCard
          label="Stale pending"
          value={`${stale_count} transfer${stale_count !== 1 ? 's' : ''}`}
          warn={stale_count > 0}
          critical={stale_count > 5}
          icon={AlertTriangle}
        />
        <MetricCard
          label="Unconfirmed (total)"
          value={`${unconfirmed_total} pending`}
          warn={unconfirmed_total > 0}
          critical={unconfirmed_total > 10}
          icon={Activity}
        />
      </div>

      {/* ── Stale transfers ──────────────────────────────────────────── */}
      {stale_transfers.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-surface-2 shadow-card overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert size={13} className="text-amber-400" />
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/65">
                Stale Pending ({stale_count})
              </p>
            </div>
            <p className="text-[11px] text-white/65">
              Pending &gt;{data.stale_threshold_minutes}m — Stripe not confirming
              {isTestMode && ' · test rail'}
            </p>
          </div>
          <ul className="divide-y divide-white/[0.04]">
            {stale_transfers.map((t) => (
              <li key={t.release_id} className="px-5 py-3.5 flex items-center gap-4">
                <div className="flex-shrink-0">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    t.minutes_pending > 360
                      ? 'bg-red-500/15 border border-red-500/25 text-red-400'
                      : 'bg-amber-500/15 border border-amber-500/25 text-amber-400'
                  }`}>
                    <Clock size={9} />{t.minutes_pending}m
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-white truncate">
                    {t.milestone_title ?? t.release_id.slice(0, 12) + '…'}
                  </p>
                  <p className="text-[11px] text-white/70 truncate mt-0.5">
                    {t.deal_title ?? 'Unknown deal'}
                    {t.contractor_name ? ` · ${t.contractor_name}` : ''}
                  </p>
                  {t.stripe_transfer_id && (
                    <p className="text-[11px] font-mono text-white/65 mt-0.5 truncate">
                      {t.stripe_transfer_id}
                    </p>
                  )}
                </div>

                <p className="text-[13px] font-mono text-white/85 flex-shrink-0">
                  {formatMoney(t.amount)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Recent event log ────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-2">
          <Activity size={13} className="text-white/65" />
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/65">
            Recent Webhook Events
          </p>
        </div>

        {recent_events.length === 0 ? (
          <div className="px-5 py-6 text-center">
            <p className="text-[12px] text-white/70">No recent webhook events recorded.</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.04]">
            {recent_events.map((e) => (
              <li key={e.id} className="px-5 py-2.5 flex items-center gap-4">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  e.action.includes('failed') || e.action.includes('conflict')
                    ? 'bg-red-400'
                    : e.action.includes('confirmed') || e.action.includes('created')
                      ? 'bg-emerald-400'
                      : 'bg-white/20'
                }`} />

                <p className={`text-[12px] font-medium flex-1 min-w-0 truncate ${actionColor(e.action)}`}>
                  {actionLabel(e.action)}
                </p>

                <p className="text-[11px] font-mono text-white/65 flex-shrink-0 truncate max-w-[180px]">
                  {e.entity_id.slice(0, 12)}…
                </p>

                <p className="text-[11px] text-white/65 flex-shrink-0 tabular-nums">
                  {relativeTime(e.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Dead feed alert ──────────────────────────────────────────── */}
      {feed_health === 'critical' && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/[0.06] px-5 py-4">
          <div className="flex items-start gap-3">
            <ShieldAlert size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-semibold text-red-300">Action required</p>
              <p className="text-[12px] text-red-300 mt-1 leading-relaxed">
                The Stripe webhook feed appears dead or severely delayed. Check the Stripe Dashboard
                under Developers → Webhooks to confirm the endpoint is active and the signing secret
                matches <code className="font-mono bg-red-500/10 px-1 rounded">STRIPE_WEBHOOK_SECRET</code>.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Metric card ──────────────────────────────────────────────────────────────

function MetricCard({
  label, value, warn, critical, icon: Icon,
}: {
  label: string; value: string; warn: boolean; critical: boolean; icon: React.ElementType
}) {
  const color = critical
    ? 'border-red-500/20 bg-red-500/[0.06]'
    : warn
      ? 'border-amber-500/20 bg-amber-500/[0.06]'
      : 'border-white/[0.08] bg-white/[0.03]'

  const valueColor = critical
    ? 'text-red-400'
    : warn
      ? 'text-amber-400'
      : 'text-white'

  const iconEl = critical
    ? <Icon size={14} className="text-red-400" />
    : warn
      ? <Icon size={14} className="text-amber-400" />
      : <Icon size={14} className="text-white/65" />

  return (
    <div className={`rounded-xl border ${color} px-4 py-3`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/65">{label}</p>
        {iconEl}
      </div>
      <p className={`text-[16px] font-semibold tabular-nums ${valueColor}`}>{value}</p>
    </div>
  )
}
