import { ShieldCheck, ShieldAlert, ShieldQuestion, AlertOctagon } from 'lucide-react'
import type { AuditChainHealthRow } from '@/lib/engine/audit-chain-health'

// ─── AuditChainHealthBadge ──────────────────────────────────────────────────
//
// Read-only display of the most recent verify_audit_chain() result.
// Rendered inside the admin Stripe Reconciliation section.
//
// Shows:
//   - last checked time (relative + absolute)
//   - pass / fail / error / never-checked status
//   - rows checked + invalid count
//   - first broken event_sequence (if any) for ops to investigate
//
// Hash values are intentionally NOT shown: they are low-signal for human
// readers and easy to leak via screenshots. Operators can pull the full
// verifier output via the admin RPC if needed.

export interface AuditChainHealthBadgeProps {
  latest: AuditChainHealthRow | null
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const ms   = Date.now() - then
  if (!Number.isFinite(ms) || ms < 0) return 'just now'
  const m = Math.floor(ms / 60_000)
  if (m < 1)    return 'just now'
  if (m < 60)   return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24)   return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export function AuditChainHealthBadge({ latest }: AuditChainHealthBadgeProps) {
  // Never-checked state — chain has no recorded verification yet.
  if (!latest) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 shadow-card">
        <div className="flex items-start gap-3">
          <ShieldQuestion className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" aria-hidden />
          <div className="space-y-1">
            <div className="text-sm font-semibold text-white">Audit chain — never checked</div>
            <div className="text-xs text-white/70">
              No verification has been recorded yet. The daily cron will run at 02:00 UTC,
              or trigger one manually via <span className="font-mono">POST /api/admin/audit-chain-health</span>.
            </div>
          </div>
        </div>
      </div>
    )
  }

  const { status, checked_at, rows_checked, rows_invalid,
          first_broken_event_sequence, duration_ms, error_message,
          triggered_by } = latest

  const tone =
    status === 'healthy' ? {
      border: 'border-emerald-500/30',
      bg:     'bg-emerald-500/5',
      icon:   <ShieldCheck  className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" aria-hidden />,
      label:  'Healthy',
    }
    : status === 'broken' ? {
      border: 'border-rose-500/40',
      bg:     'bg-rose-500/5',
      icon:   <ShieldAlert  className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" aria-hidden />,
      label:  'BROKEN',
    }
    : {
      border: 'border-amber-500/40',
      bg:     'bg-amber-500/5',
      icon:   <AlertOctagon className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" aria-hidden />,
      label:  'Verifier error',
    }

  return (
    <div className={`rounded-xl border ${tone.border} ${tone.bg} p-4 shadow-card`}>
      <div className="flex items-start gap-3">
        {tone.icon}
        <div className="space-y-1 flex-1">
          <div className="text-sm font-semibold text-white">
            Audit chain — {tone.label}
          </div>
          <div className="text-xs text-white/70">
            Checked {relativeTime(checked_at)} ({new Date(checked_at).toISOString()})
            {' · '}{rows_checked.toLocaleString()} rows
            {' · '}{duration_ms} ms
            {' · '}via {triggered_by === 'cron' ? 'cron' : 'admin manual'}
          </div>

          {status === 'broken' && (
            <div className="text-xs text-rose-300 pt-1">
              <span className="font-semibold">{rows_invalid}</span> row{rows_invalid === 1 ? '' : 's'} failed
              {first_broken_event_sequence !== null && (
                <> · first at event_sequence <span className="font-mono">{first_broken_event_sequence}</span></>
              )}
              . Audit logs are tamper-evident, append-only, and hash-chained — investigate
              the audit_log row at this event_sequence.
            </div>
          )}

          {status === 'error' && error_message && (
            <div className="text-xs text-amber-300 pt-1">
              Verifier error: <span className="font-mono">{error_message}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
