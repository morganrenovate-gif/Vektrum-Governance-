'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  AlertTriangle, Bell, CheckCircle2, ExternalLink,
  Loader2, RefreshCw, ShieldAlert, ShieldCheck,
  Zap, DollarSign, Wifi, MessageSquare,
} from 'lucide-react'
import type { OpsAlert } from '@/app/api/admin/ops/alerts/route'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AlertsFeedData {
  scanned_at:     string
  total:          number
  critical_count: number
  high_count:     number
  alerts:         OpsAlert[]
  summary: {
    clean:           boolean
    needs_attention: boolean
  }
}

interface AlertsFeedProps {
  initialData:  AlertsFeedData
  /** Auto-refresh interval in seconds. Default: 30. Set to 0 to disable. */
  pollInterval?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diffMs   = Date.now() - new Date(iso).getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  const diffHrs  = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHrs  / 24)
  if (diffDays > 0)  return `${diffDays}d ago`
  if (diffHrs  > 0)  return `${diffHrs}h ago`
  if (diffMins > 0)  return `${diffMins}m ago`
  return 'just now'
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  release:          DollarSign,
  payout:           DollarSign,
  webhook:          Wifi,
  stripe:           Zap,
  reconciliation:   AlertTriangle,
  dispute:          MessageSquare,
}

const CATEGORY_LABELS: Record<string, string> = {
  release:          'Release',
  payout:           'Payout',
  webhook:          'Webhook',
  stripe:           'Stripe',
  reconciliation:   'Recon',
  dispute:          'Dispute',
}

function severityStyles(severity: string): { badge: string; row: string; dot: string } {
  switch (severity) {
    case 'critical': return {
      badge: 'bg-red-500/15 border border-red-500/25 text-red-400',
      row:   'border-l-2 border-l-red-500/40',
      dot:   'bg-red-400',
    }
    case 'high': return {
      badge: 'bg-amber-500/15 border border-amber-500/25 text-amber-400',
      row:   'border-l-2 border-l-amber-500/40',
      dot:   'bg-amber-400',
    }
    case 'medium': return {
      badge: 'bg-blue-500/15 border border-blue-500/25 text-blue-400',
      row:   'border-l-2 border-l-blue-500/40',
      dot:   'bg-blue-400',
    }
    default: return {
      badge: 'bg-white/10 border border-white/[0.16] text-white/75',
      row:   'border-l-2 border-l-white/[0.16]',
      dot:   'bg-white/60',
    }
  }
}

// ─── Alert row ────────────────────────────────────────────────────────────────

function AlertRow({ alert }: { alert: OpsAlert }) {
  const { badge, row, dot } = severityStyles(alert.severity)
  const CategoryIcon = CATEGORY_ICONS[alert.category] ?? Bell
  const catLabel     = CATEGORY_LABELS[alert.category] ?? alert.category

  return (
    <li className={`flex items-start gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors ${row}`}>
      {/* Severity dot */}
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${dot}`} />

      {/* Category badge */}
      <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${badge}`}>
        <CategoryIcon size={9} />{catLabel}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-white leading-snug">
          {alert.title}
        </p>
        <p className="text-[11px] text-white/75 mt-0.5 leading-relaxed line-clamp-2">
          {alert.description}
        </p>
      </div>

      {/* Meta */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <p className="text-[11px] text-white/65 tabular-nums whitespace-nowrap">
          {relativeTime(alert.detected_at)}
        </p>
        <Link
          href={alert.action_url}
          className="flex items-center gap-1 text-[10px] text-vektrum-blue hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue rounded transition-colors"
        >
          View <ExternalLink size={9} />
        </Link>
      </div>
    </li>
  )
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low'

function FilterBar({
  active,
  onChange,
  counts,
}: {
  active: SeverityFilter
  onChange: (f: SeverityFilter) => void
  counts: Record<string, number>
}) {
  const filters: { key: SeverityFilter; label: string }[] = [
    { key: 'all',      label: `All (${counts.all ?? 0})` },
    { key: 'critical', label: `Critical (${counts.critical ?? 0})` },
    { key: 'high',     label: `High (${counts.high ?? 0})` },
    { key: 'medium',   label: `Medium (${counts.medium ?? 0})` },
  ]

  return (
    <div className="flex gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] p-1 w-fit">
      {filters.map((f) => (
        <button
          key={f.key}
          type="button"
          onClick={() => onChange(f.key)}
          className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue ${
            active === f.key
              ? f.key === 'critical'
                ? 'bg-red-500/15 text-red-400'
                : f.key === 'high'
                  ? 'bg-amber-500/15 text-amber-400'
                  : 'bg-white/[0.1] text-white'
              : 'text-white/80 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AlertsFeed({ initialData, pollInterval = 30 }: AlertsFeedProps) {
  const [data,       setData]       = useState(initialData)
  const [refreshing, setRefreshing] = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [filter,     setFilter]     = useState<SeverityFilter>('all')
  const [lastRefresh, setLastRefresh] = useState(Date.now())

  // ── Auto-poll ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!pollInterval) return
    const id = setInterval(() => {
      fetch('/api/admin/ops/alerts')
        .then((r) => r.json())
        .then((json) => {
          setData(json)
          setLastRefresh(Date.now())
        })
        .catch(() => {/* silent — manual refresh still works */})
    }, pollInterval * 1000)
    return () => clearInterval(id)
  }, [pollInterval])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    setError(null)
    try {
      const res  = await fetch('/api/admin/ops/alerts')
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Refresh failed.'); return }
      setData(json)
      setLastRefresh(Date.now())
    } catch {
      setError('Network error.')
    } finally {
      setRefreshing(false)
    }
  }, [])

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = filter === 'all'
    ? data.alerts
    : data.alerts.filter((a) => a.severity === filter)

  const counts: Record<string, number> = {
    all:      data.total,
    critical: data.critical_count,
    high:     data.high_count,
    medium:   data.alerts.filter((a) => a.severity === 'medium').length,
  }

  const secsSinceRefresh = Math.round((Date.now() - lastRefresh) / 1000)

  return (
    <div className="space-y-4" id="alerts">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          {data.summary.clean ? (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 w-fit mb-2">
              <ShieldCheck size={12} />All clear
            </div>
          ) : data.critical_count > 0 ? (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] font-semibold bg-red-500/10 border border-red-500/20 text-red-400 w-fit mb-2">
              <ShieldAlert size={12} />
              {data.critical_count} critical · {data.total} total
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-400 w-fit mb-2">
              <AlertTriangle size={12} />
              {data.total} alert{data.total !== 1 ? 's' : ''}
            </div>
          )}
          <p className="text-[11px] text-white/65">
            {pollInterval
              ? `Auto-refreshes every ${pollInterval}s · updated ${secsSinceRefresh}s ago`
              : `Scanned ${relativeTime(data.scanned_at)}`
            }
          </p>
        </div>

        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-xl border border-white/[0.16] bg-white/[0.07] px-3.5 py-2 text-[12px] font-medium text-white/90 hover:bg-white/[0.12] hover:text-white hover:border-white/[0.24] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue disabled:opacity-40 transition-all flex-shrink-0"
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

      {/* ── Filter bar ──────────────────────────────────────────────── */}
      {data.total > 0 && (
        <FilterBar active={filter} onChange={setFilter} counts={counts} />
      )}

      {/* ── Alert list ──────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-surface-2 px-5 py-8 text-center">
          <CheckCircle2 size={20} className="text-emerald-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-white/90">
            {data.total === 0 ? 'No active alerts' : `No ${filter} alerts`}
          </p>
          <p className="text-[12px] text-white/70 mt-1">
            {data.total === 0
              ? 'All systems operating normally.'
              : `${data.total} alert${data.total !== 1 ? 's' : ''} in other categories.`
            }
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/65">
              Active Alerts ({filtered.length}{filter !== 'all' ? ` of ${data.total}` : ''})
            </p>
            <p className="text-[11px] text-white/65">Sorted by severity</p>
          </div>
          <ul className="divide-y divide-white/[0.04]">
            {filtered.map((alert) => <AlertRow key={alert.id} alert={alert} />)}
          </ul>
        </div>
      )}
    </div>
  )
}
