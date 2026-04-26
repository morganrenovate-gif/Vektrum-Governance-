'use client'

import { useState, useCallback, useTransition } from 'react'
import {
  AlertTriangle, CheckCircle2, Clock, Loader2,
  RefreshCw, RotateCcw, ChevronDown, ChevronRight,
  ShieldAlert, ShieldCheck, DollarSign,
} from 'lucide-react'
import { formatMoney } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StuckRelease {
  milestone_id:     string
  milestone_title:  string
  amount:           number
  approved_at:      string | null
  hours_stuck:      number | null
  deal_id:          string
  deal_title:       string
  deal_status:      string | null
  contractor_id:    string | null
  contractor_name:  string
  funder_id:        string | null
  funder_name:      string
}

export interface FailedPayout {
  milestone_id:           string
  milestone_title:        string
  amount:                 number
  payout_failure_count:   number
  last_payout_failure_at: string | null
  hours_since_failure:    number | null
  deal_id:                string
  deal_title:             string
  contractor_name:        string
  funder_name:            string
  release_id:             string | null
  stripe_transfer_id:     string | null
  transfer_status:        string | null
  failure_code:           string | null
  failure_message:        string | null
  failed_at:              string | null
}

interface ReleaseHealthData {
  scanned_at:             string
  stuck_threshold_hours:  number
  stuck_count:            number
  failed_count:           number
  stuck_releases:         StuckRelease[]
  failed_payouts:         FailedPayout[]
}

interface ReleaseHealthPanelProps {
  initialData: ReleaseHealthData
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string | null): string {
  if (!iso) return 'unknown'
  const diffMs   = Date.now() - new Date(iso).getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  const diffHrs  = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHrs  / 24)
  if (diffDays > 0)  return `${diffDays}d ago`
  if (diffHrs  > 0)  return `${diffHrs}h ago`
  if (diffMins > 0)  return `${diffMins}m ago`
  return 'just now'
}

function StuckBadge({ hours }: { hours: number | null }) {
  const h = hours ?? 0
  if (h >= 24) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/25 text-red-400">
      <ShieldAlert size={9} />{h}h stuck
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400">
      <Clock size={9} />{h}h stuck
    </span>
  )
}

function FailureBadge({ count }: { count: number }) {
  if (count >= 3) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/25 text-red-400">
      <ShieldAlert size={9} />{count}× failed
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400">
      <AlertTriangle size={9} />Failed
    </span>
  )
}

// ─── Stuck release row ────────────────────────────────────────────────────────

function StuckRow({ item }: { item: StuckRelease }) {
  const [expanded, setExpanded] = useState(false)
  const isHighValue = item.amount >= 1_000_000 // $10k in cents

  return (
    <li className="hover:bg-white/[0.02] transition-colors">
      <div
        className="flex items-center gap-4 px-5 py-3.5 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded
          ? <ChevronDown size={13} className="text-white/65 flex-shrink-0" />
          : <ChevronRight size={13} className="text-white/65 flex-shrink-0" />
        }

        <StuckBadge hours={item.hours_stuck} />

        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-white truncate">
            {item.milestone_title}
          </p>
          <p className="text-[11px] text-white/70 truncate mt-0.5">
            {item.deal_title} · {item.contractor_name}
          </p>
        </div>

        {isHighValue && (
          <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/25 text-purple-400">
            <DollarSign size={9} className="inline mr-0.5" />High value
          </span>
        )}

        <p className="text-[13px] font-mono text-white/85 flex-shrink-0">
          {formatMoney(item.amount)}
        </p>

        <p className="text-[11px] text-white/65 flex-shrink-0 tabular-nums">
          approved {relativeTime(item.approved_at)}
        </p>
      </div>

      {expanded && (
        <div className="px-5 pb-4 pt-2 border-t border-white/[0.04] bg-white/[0.02] space-y-2">
          <Detail label="Milestone ID"   value={item.milestone_id}   mono />
          <Detail label="Deal"           value={`${item.deal_title} (${item.deal_id.slice(0, 8)}…)`} />
          <Detail label="Deal status"    value={item.deal_status ?? '—'} />
          <Detail label="Contractor"     value={item.contractor_name} />
          <Detail label="Funder"         value={item.funder_name} />
          <Detail label="Amount"         value={formatMoney(item.amount)} />
          <Detail label="Approved at"    value={item.approved_at ? new Date(item.approved_at).toLocaleString() : '—'} />
        </div>
      )}
    </li>
  )
}

// ─── Failed payout row ────────────────────────────────────────────────────────

function FailedRow({
  item,
  onRetry,
}: {
  item: FailedPayout
  onRetry: (milestoneId: string) => Promise<void>
}) {
  const [expanded,  setExpanded]  = useState(false)
  const [retrying,  setRetrying]  = useState(false)
  const [retryMsg,  setRetryMsg]  = useState<string | null>(null)
  const [, startTransition] = useTransition()

  async function handleRetry() {
    setRetrying(true)
    setRetryMsg(null)
    try {
      await onRetry(item.milestone_id)
      startTransition(() => setRetryMsg('Reset to approved — funder can re-trigger release.'))
    } catch (err: unknown) {
      setRetryMsg(err instanceof Error ? err.message : 'Retry failed.')
    } finally {
      setRetrying(false)
    }
  }

  return (
    <li className="hover:bg-white/[0.02] transition-colors">
      <div
        className="flex items-center gap-4 px-5 py-3.5 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded
          ? <ChevronDown size={13} className="text-white/65 flex-shrink-0" />
          : <ChevronRight size={13} className="text-white/65 flex-shrink-0" />
        }

        <FailureBadge count={item.payout_failure_count} />

        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-white truncate">
            {item.milestone_title}
          </p>
          <p className="text-[11px] text-white/70 truncate mt-0.5">
            {item.deal_title} · Contractor: {item.contractor_name}
          </p>
          {item.failure_code && (
            <p className="text-[11px] font-mono text-red-400/70 mt-0.5 truncate">
              {item.failure_code}{item.failure_message ? ` — ${item.failure_message}` : ''}
            </p>
          )}
        </div>

        <p className="text-[13px] font-mono text-white/85 flex-shrink-0">
          {formatMoney(item.amount)}
        </p>

        <p className="text-[11px] text-white/65 flex-shrink-0 tabular-nums">
          {relativeTime(item.last_payout_failure_at)}
        </p>
      </div>

      {expanded && (
        <div className="px-5 pb-4 pt-2 border-t border-white/[0.04] bg-white/[0.02] space-y-2">
          <Detail label="Milestone ID"      value={item.milestone_id}                       mono />
          {item.release_id && (
            <Detail label="Release ID"      value={item.release_id}                         mono />
          )}
          {item.stripe_transfer_id && (
            <Detail label="Stripe transfer" value={item.stripe_transfer_id}                 mono />
          )}
          <Detail label="Failure code"      value={item.failure_code ?? '—'}               mono />
          <Detail label="Failure message"   value={item.failure_message ?? '—'} />
          <Detail label="Failed at"         value={item.failed_at ? new Date(item.failed_at).toLocaleString() : '—'} />
          <Detail label="Failure count"     value={String(item.payout_failure_count)} />
          <Detail label="Deal"              value={`${item.deal_title} (${item.deal_id.slice(0, 8)}…)`} />
          <Detail label="Contractor"        value={item.contractor_name} />
          <Detail label="Funder"            value={item.funder_name} />

          {retryMsg && (
            <p className={`text-[12px] mt-2 px-3 py-2 rounded-lg border ${
              retryMsg.includes('failed') || retryMsg.includes('error')
                ? 'border-red-500/20 bg-red-500/[0.08] text-red-400'
                : 'border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-400'
            }`}>
              {retryMsg}
            </p>
          )}

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleRetry() }}
            disabled={retrying}
            className="mt-2 flex items-center gap-1.5 rounded-lg border border-vektrum-blue/40 bg-vektrum-blue/[0.10] px-3 py-1.5 text-[12px] font-medium text-blue-300 hover:bg-vektrum-blue/[0.18] disabled:opacity-50 transition-colors"
          >
            {retrying
              ? <Loader2 size={11} className="animate-spin" />
              : <RotateCcw size={11} />
            }
            {retrying ? 'Resetting…' : 'Reset to Approved'}
          </button>
        </div>
      )}
    </li>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function ReleaseHealthPanel({ initialData }: ReleaseHealthPanelProps) {
  const [data,       setData]       = useState(initialData)
  const [refreshing, setRefreshing] = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [tab,        setTab]        = useState<'stuck' | 'failed'>('stuck')

  // ── Refresh ───────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    setRefreshing(true)
    setError(null)
    try {
      const res  = await fetch('/api/admin/ops/release-health')
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Refresh failed.'); return }
      setData(json)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setRefreshing(false)
    }
  }, [])

  // ── Retry payout ──────────────────────────────────────────────────────────
  const retryPayout = useCallback(async (milestoneId: string) => {
    const res  = await fetch(`/api/milestones/${milestoneId}/release/retry`, { method: 'POST' })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Retry failed.')
    // Optimistically remove from failed list and refresh
    setData((prev) => ({
      ...prev,
      failed_payouts: prev.failed_payouts.filter((p) => p.milestone_id !== milestoneId),
      failed_count:   Math.max(0, prev.failed_count - 1),
    }))
  }, [])

  const totalIssues  = data.stuck_count + data.failed_count
  const hasIssues    = totalIssues > 0
  const hasCritical  = data.failed_count > 0 || (data.stuck_releases?.some((r) => (r.hours_stuck ?? 0) >= 24) ?? false)

  return (
    <div className="space-y-4" id="release-health">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          {hasCritical ? (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] font-semibold bg-red-500/10 border border-red-500/20 text-red-400 w-fit mb-2">
              <ShieldAlert size={12} />
              {data.failed_count} failed · {data.stuck_count} stuck
            </div>
          ) : hasIssues ? (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-400 w-fit mb-2">
              <AlertTriangle size={12} />
              {totalIssues} release issue{totalIssues !== 1 ? 's' : ''} need attention
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 w-fit mb-2">
              <ShieldCheck size={12} />
              All releases healthy
            </div>
          )}
          <p className="text-[11px] text-white/65">
            Scanned {relativeTime(data.scanned_at)} · threshold: {data.stuck_threshold_hours}h
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

      {/* ── Tab switcher ────────────────────────────────────────────── */}
      {hasIssues && (
        <div className="flex gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] p-1 w-fit">
          <TabBtn active={tab === 'stuck'} onClick={() => setTab('stuck')}
            label={`Stuck (${data.stuck_count})`} />
          <TabBtn active={tab === 'failed'} onClick={() => setTab('failed')}
            label={`Failed payouts (${data.failed_count})`} warning={data.failed_count > 0} />
        </div>
      )}

      {/* ── Lists ───────────────────────────────────────────────────── */}
      {!hasIssues ? (
        <div className="rounded-xl border border-white/[0.06] bg-surface-2 px-5 py-8 text-center">
          <CheckCircle2 size={20} className="text-emerald-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-white/90">Release pipeline healthy</p>
          <p className="text-[12px] text-white/70 mt-1">
            No stuck approvals or failed payouts.
          </p>
        </div>
      ) : tab === 'stuck' ? (
        data.stuck_releases.length === 0 ? (
          <EmptyState label="No stuck releases" />
        ) : (
          <div className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden">
            <ListHeader title={`Stuck Approvals (${data.stuck_count})`} subtitle={`>${data.stuck_threshold_hours}h since approval`} />
            <ul className="divide-y divide-white/[0.04]">
              {data.stuck_releases.map((r) => <StuckRow key={r.milestone_id} item={r} />)}
            </ul>
          </div>
        )
      ) : (
        data.failed_payouts.length === 0 ? (
          <EmptyState label="No failed payouts" />
        ) : (
          <div className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden">
            <ListHeader title={`Failed Payouts (${data.failed_count})`} subtitle="Stripe transfer failure · contractor not paid" />
            <ul className="divide-y divide-white/[0.04]">
              {data.failed_payouts.map((r) => (
                <FailedRow key={r.milestone_id} item={r} onRetry={retryPayout} />
              ))}
            </ul>
          </div>
        )
      )}
    </div>
  )
}

// ─── Micro-components ─────────────────────────────────────────────────────────

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/65 w-28 flex-shrink-0 pt-0.5">{label}</p>
      <p className={`text-[12px] text-white/85 break-all ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  )
}

function TabBtn({
  active, onClick, label, warning,
}: {
  active: boolean; onClick: () => void; label: string; warning?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue ${
        active
          ? warning
            ? 'bg-red-500/15 text-red-400 border border-red-500/20'
            : 'bg-white/[0.1] text-white'
          : 'text-white/75 hover:text-white hover:bg-white/[0.04]'
      }`}
    >
      {label}
    </button>
  )
}

function ListHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-white/65">{title}</p>
      <p className="text-[11px] text-white/65">{subtitle}</p>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-surface-2 px-5 py-6 text-center">
      <CheckCircle2 size={16} className="text-emerald-400 mx-auto mb-1.5" />
      <p className="text-[13px] text-white/80">{label}</p>
    </div>
  )
}
