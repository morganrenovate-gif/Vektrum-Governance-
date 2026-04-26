'use client'

import { useState, useTransition } from 'react'
import {
  AlertTriangle, CheckCircle2, Clock, Loader2,
  RefreshCw, Wrench, XCircle, Eye, ChevronDown, ChevronRight,
  ShieldAlert, ShieldCheck,
} from 'lucide-react'
import { formatMoney } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReconciliationIssue {
  id:                string
  run_id:            string
  issue_type:        string
  severity:          string
  status:            string
  deal_id:           string | null
  milestone_id:      string | null
  release_id:        string | null
  stripe_transfer_id: string | null
  expected_amount:   number | null
  actual_amount:     number | null
  description:       string
  auto_fixable:      boolean
  resolution_note:   string | null
  resolution_action: string | null
  resolved_at:       string | null
  created_at:        string
  updated_at:        string
}

export interface ReconciliationRun {
  id:                string
  status:            string
  started_at:        string
  completed_at:      string | null
  releases_checked:  number
  transfers_checked: number
  deals_checked:     number
  issues_found:      number
  error_message:     string | null
  triggered_by:      string
}

export interface ReconciliationHealth {
  open_critical: number
  open_high:     number
  open_total:    number
}

interface ReconciliationPanelProps {
  initialIssues:  ReconciliationIssue[]
  initialTotal:   number
  lastRun:        ReconciliationRun | null
  health:         ReconciliationHealth
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0, high: 1, medium: 2, low: 3,
}

function severityBadge(severity: string) {
  switch (severity) {
    case 'critical': return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/25 text-red-400">
        <ShieldAlert size={9} />Critical
      </span>
    )
    case 'high': return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400">
        <AlertTriangle size={9} />High
      </span>
    )
    case 'medium': return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/25 text-blue-400">
        <Clock size={9} />Medium
      </span>
    )
    default: return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 border border-white/[0.16] text-white/75">
        Low
      </span>
    )
  }
}

const ISSUE_TYPE_LABEL: Record<string, string> = {
  orphaned_transfer:         'Orphaned Transfer',
  missing_stripe_id:         'Missing Stripe ID',
  amount_mismatch:           'Amount Mismatch',
  ledger_drift:              'Ledger Drift',
  stripe_transfer_not_found: 'Transfer Not Found',
  missing_billing_record:    'Missing Fee Record',
  fee_ledger_drift:          'Fee Ledger Drift',
  metadata_mismatch:         'Metadata Mismatch',
}

function relativeTime(iso: string): string {
  const diffMs   = Date.now() - new Date(iso).getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  const diffHrs  = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHrs / 24)
  if (diffDays > 0)  return `${diffDays}d ago`
  if (diffHrs  > 0)  return `${diffHrs}h ago`
  if (diffMins > 0)  return `${diffMins}m ago`
  return 'just now'
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function ReconciliationPanel({
  initialIssues,
  initialTotal,
  lastRun,
  health,
}: ReconciliationPanelProps) {
  const [issues,     setIssues]     = useState<ReconciliationIssue[]>(initialIssues)
  const [total,      setTotal]      = useState(initialTotal)
  const [lastRunObj, setLastRunObj] = useState<ReconciliationRun | null>(lastRun)
  const [healthObj,  setHealthObj]  = useState(health)
  const [running,    setRunning]    = useState(false)
  const [runError,   setRunError]   = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [,           startTransition] = useTransition()

  // ── Trigger manual run ────────────────────────────────────────────────────
  async function handleRunNow() {
    setRunning(true)
    setRunError(null)
    try {
      const res = await fetch('/api/admin/reconciliation', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ window_days: 30 }),
      })
      const json = await res.json()
      if (!res.ok) {
        setRunError(json.error ?? 'Reconciliation run failed.')
      } else {
        // Refresh the issue list
        await refreshIssues()
        setLastRunObj(prev => prev ? { ...prev, ...json, status: json.status } : null)
      }
    } catch {
      setRunError('Network error. Please try again.')
    } finally {
      setRunning(false)
    }
  }

  // ── Refresh issues from API ───────────────────────────────────────────────
  async function refreshIssues() {
    const res = await fetch('/api/admin/reconciliation?status=open&limit=50')
    if (!res.ok) return
    const json = await res.json()
    setIssues(json.issues ?? [])
    setTotal(json.total  ?? 0)
    setHealthObj(json.health ?? healthObj)
    if (json.last_run) setLastRunObj(json.last_run)
  }

  // ── Apply action ──────────────────────────────────────────────────────────
  async function handleAction(
    issueId: string,
    action:  'acknowledge' | 'false_positive' | 'resolve' | 'auto_fix',
    note?:   string,
  ) {
    const res = await fetch(`/api/admin/reconciliation/${issueId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action, note }),
    })
    if (res.ok) {
      startTransition(() => {
        setIssues(prev => prev.filter(i => i.id !== issueId))
        setTotal(prev => Math.max(0, prev - 1))
        if (action === 'auto_fix' || action === 'resolve') {
          setHealthObj(prev => ({
            ...prev,
            open_total:    Math.max(0, prev.open_total    - 1),
            open_critical: issues.find(i => i.id === issueId)?.severity === 'critical'
              ? Math.max(0, prev.open_critical - 1) : prev.open_critical,
            open_high:     issues.find(i => i.id === issueId)?.severity === 'high'
              ? Math.max(0, prev.open_high - 1)     : prev.open_high,
          }))
        }
      })
    }
  }

  const sortedIssues = [...issues].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3),
  )

  const hasCritical = healthObj.open_critical > 0
  const hasIssues   = healthObj.open_total > 0

  return (
    <div className="space-y-4">
      {/* ── Header + run button ───────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          {/* Health badge */}
          {hasCritical ? (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] font-semibold bg-red-500/10 border border-red-500/20 text-red-400 w-fit mb-2">
              <ShieldAlert size={12} />
              {healthObj.open_critical} critical · {healthObj.open_total} total open
            </div>
          ) : hasIssues ? (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-400 w-fit mb-2">
              <AlertTriangle size={12} />
              {healthObj.open_high} high · {healthObj.open_total} total open
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 w-fit mb-2">
              <ShieldCheck size={12} />
              No open issues
            </div>
          )}

          {/* Last run metadata */}
          {lastRunObj && (
            <p className="text-[11px] text-white/65">
              Last run {relativeTime(lastRunObj.started_at)}
              {lastRunObj.status === 'completed' && (
                <> · checked {lastRunObj.releases_checked} releases,&nbsp;
                {lastRunObj.transfers_checked} transfers,&nbsp;
                {lastRunObj.deals_checked} deals</>
              )}
              {lastRunObj.status === 'failed' && (
                <span className="text-red-400"> · FAILED: {lastRunObj.error_message}</span>
              )}
            </p>
          )}
          {!lastRunObj && (
            <p className="text-[11px] text-white/65">No reconciliation runs yet</p>
          )}
        </div>

        <button
          type="button"
          onClick={handleRunNow}
          disabled={running}
          className="flex items-center gap-2 rounded-xl border border-white/[0.16] bg-white/[0.05] px-3.5 py-2 text-[12px] font-medium text-white/85 hover:bg-white/[0.1] hover:text-white hover:border-white/[0.24] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue disabled:opacity-50 transition-all flex-shrink-0"
        >
          {running
            ? <Loader2 size={12} className="animate-spin" />
            : <RefreshCw size={12} />
          }
          {running ? 'Running…' : 'Run Now'}
        </button>
      </div>

      {runError && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/[0.08] px-4 py-2.5 text-[12px] text-red-400">
          {runError}
        </div>
      )}

      {/* ── Issue list ────────────────────────────────────────────── */}
      {sortedIssues.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-surface-2 px-5 py-8 text-center">
          <ShieldCheck size={20} className="text-emerald-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-white/85">All clear</p>
          <p className="text-[12px] text-white/70 mt-1">
            No open reconciliation issues. Stripe and database are consistent.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/65">
              Open Issues ({total})
            </p>
            <p className="text-[11px] text-white/65">Sorted by severity</p>
          </div>

          <ul className="divide-y divide-white/[0.04]">
            {sortedIssues.map(issue => (
              <IssueRow
                key={issue.id}
                issue={issue}
                expanded={expandedId === issue.id}
                onToggle={() => setExpandedId(expandedId === issue.id ? null : issue.id)}
                onAction={handleAction}
              />
            ))}
          </ul>

          {total > sortedIssues.length && (
            <div className="px-5 py-3 border-t border-white/[0.06] text-[12px] text-white/70">
              Showing {sortedIssues.length} of {total} issues.
              {' '}<a href="/dashboard/audit" className="text-blue-300 hover:text-blue-200 hover:underline">View all in audit log →</a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Issue Row ────────────────────────────────────────────────────────────────

function IssueRow({
  issue,
  expanded,
  onToggle,
  onAction,
}: {
  issue:    ReconciliationIssue
  expanded: boolean
  onToggle: () => void
  onAction: (id: string, action: 'acknowledge' | 'false_positive' | 'resolve' | 'auto_fix', note?: string) => Promise<void>
}) {
  const [loading,  setLoading]  = useState<string | null>(null)
  const [noteMode, setNoteMode] = useState<'resolve' | 'false_positive' | null>(null)
  const [note,     setNote]     = useState('')

  async function act(action: 'acknowledge' | 'false_positive' | 'resolve' | 'auto_fix', noteText?: string) {
    setLoading(action)
    try {
      await onAction(issue.id, action, noteText)
    } finally {
      setLoading(null)
      setNoteMode(null)
      setNote('')
    }
  }

  const typeLabel = ISSUE_TYPE_LABEL[issue.issue_type] ?? issue.issue_type

  return (
    <li className="hover:bg-white/[0.02] transition-colors">
      {/* ── Summary row ─────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-4 px-5 py-3.5 cursor-pointer"
        onClick={onToggle}
      >
        {expanded
          ? <ChevronDown size={13} className="text-white/65 flex-shrink-0" />
          : <ChevronRight size={13} className="text-white/65 flex-shrink-0" />
        }

        <div className="flex-shrink-0">{severityBadge(issue.severity)}</div>

        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-white truncate">
            {typeLabel}
          </p>
          <p className="text-[11px] text-white/70 truncate mt-0.5">
            {issue.description.slice(0, 120)}{issue.description.length > 120 ? '…' : ''}
          </p>
        </div>

        {/* Amount delta */}
        {issue.expected_amount !== null && issue.actual_amount !== null && (
          <div className="flex-shrink-0 text-right">
            <p className="text-[11px] font-mono text-red-400">
              Δ {formatMoney(Math.abs(issue.expected_amount - issue.actual_amount))}
            </p>
          </div>
        )}

        <p className="text-[11px] text-white/65 flex-shrink-0 tabular-nums">
          {relativeTime(issue.created_at)}
        </p>
      </div>

      {/* ── Expanded detail ──────────────────────────────────────────── */}
      {expanded && (
        <div className="px-5 pb-4 pt-0 border-t border-white/[0.04] bg-white/[0.02]">
          {/* Evidence */}
          <div className="mt-3 space-y-2.5">
            <DetailRow label="Issue type"  value={typeLabel} mono />
            <DetailRow label="Severity"    value={issue.severity} />
            {issue.deal_id          && <DetailRow label="Deal ID"       value={issue.deal_id}          mono truncate />}
            {issue.milestone_id     && <DetailRow label="Milestone ID"  value={issue.milestone_id}     mono truncate />}
            {issue.release_id       && <DetailRow label="Release ID"    value={issue.release_id}       mono truncate />}
            {issue.stripe_transfer_id && <DetailRow label="Stripe TXN"  value={issue.stripe_transfer_id} mono truncate />}
            {issue.expected_amount !== null && (
              <DetailRow label="Expected" value={formatMoney(issue.expected_amount)} />
            )}
            {issue.actual_amount !== null && (
              <DetailRow label="Actual"   value={formatMoney(issue.actual_amount)}   />
            )}
            <DetailRow label="Detected"  value={new Date(issue.created_at).toLocaleString()} />
          </div>

          {/* Full description */}
          <p className="mt-3 text-[12px] text-white/80 leading-relaxed rounded-lg bg-white/[0.03] border border-white/[0.1] px-3 py-2.5">
            {issue.description}
          </p>

          {/* Note input (resolve / false_positive) */}
          {noteMode && (
            <div className="mt-3 space-y-2">
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder={
                  noteMode === 'resolve'
                    ? 'Describe what was done to fix this issue…'
                    : 'Why is this a false positive?'
                }
                rows={2}
                className="w-full rounded-lg border border-white/[0.14] bg-white/[0.05] px-3 py-2 text-[12px] text-white placeholder:text-white/55 focus:outline-none focus:ring-2 focus:ring-vektrum-blue/50 focus:border-vektrum-blue resize-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => act(noteMode, note)}
                  disabled={!note.trim() || !!loading}
                  className="rounded-lg bg-white/[0.08] border border-white/[0.16] px-3 py-1.5 text-[12px] font-medium text-white/90 hover:bg-white/[0.12] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue disabled:opacity-40 transition-colors"
                >
                  {loading === noteMode ? <Loader2 size={11} className="animate-spin inline mr-1" /> : null}
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => { setNoteMode(null); setNote('') }}
                  className="rounded-lg border border-white/[0.16] bg-white/[0.04] px-3 py-1.5 text-[12px] text-white/85 hover:text-white hover:border-white/[0.24] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {!noteMode && (
            <div className="mt-3 flex flex-wrap gap-2">
              {issue.status === 'open' && (
                <ActionButton
                  icon={Eye}
                  label="Acknowledge"
                  loading={loading === 'acknowledge'}
                  onClick={() => act('acknowledge')}
                  variant="muted"
                />
              )}

              {issue.auto_fixable && (
                <ActionButton
                  icon={Wrench}
                  label="Auto-Fix"
                  loading={loading === 'auto_fix'}
                  onClick={() => act('auto_fix')}
                  variant="green"
                />
              )}

              <ActionButton
                icon={CheckCircle2}
                label="Mark Resolved"
                loading={loading === 'resolve'}
                onClick={() => setNoteMode('resolve')}
                variant="blue"
              />

              <ActionButton
                icon={XCircle}
                label="False Positive"
                loading={loading === 'false_positive'}
                onClick={() => setNoteMode('false_positive')}
                variant="muted"
              />
            </div>
          )}
        </div>
      )}
    </li>
  )
}

// ─── Small helpers ─────────────────────────────────────────────────────────

function DetailRow({ label, value, mono, truncate }: { label: string; value: string; mono?: boolean; truncate?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/65 w-24 flex-shrink-0 pt-0.5">{label}</p>
      <p className={`text-[12px] text-white/85 ${mono ? 'font-mono' : ''} ${truncate ? 'truncate max-w-xs' : ''}`}>
        {value}
      </p>
    </div>
  )
}

function ActionButton({
  icon: Icon, label, loading, onClick, variant,
}: {
  icon: React.ElementType
  label: string
  loading: boolean
  onClick: () => void
  variant: 'muted' | 'green' | 'blue' | 'red'
}) {
  const colors = {
    muted:  'border-white/[0.16] bg-white/[0.05] text-white/85 hover:text-white hover:bg-white/[0.1] hover:border-white/[0.24]',
    green:  'border-emerald-500/30 bg-emerald-500/[0.1] text-emerald-400 hover:bg-emerald-500/[0.16]',
    blue:   'border-vektrum-blue/40 bg-vektrum-blue/[0.12] text-blue-300 hover:bg-vektrum-blue/[0.20]',
    red:    'border-red-500/30 bg-red-500/[0.1] text-red-400 hover:bg-red-500/[0.16]',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue disabled:opacity-50 ${colors[variant]}`}
    >
      {loading
        ? <Loader2 size={11} className="animate-spin" />
        : <Icon size={11} />
      }
      {label}
    </button>
  )
}
