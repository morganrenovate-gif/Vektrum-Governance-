import Link from 'next/link'
import { Shield } from 'lucide-react'

// ── Mock audit log (15 entries, newest first) ────────────────────────────────

const MOCK_AUDIT = [
  { id: '1', action: 'milestone_released', entity: 'milestone / Framing & Structural (Riverside Mixed-Use)', actor: 'Sarah Chen', time: '2h ago' },
  { id: '2', action: 'ai_draw_review', entity: 'milestone / Framing & Structural (Riverside Mixed-Use)', actor: 'system', time: '2h 5m ago', detail: 'score: 87' },
  { id: '3', action: 'milestone_approved', entity: 'milestone / Framing & Structural (Riverside Mixed-Use)', actor: 'Sarah Chen', time: '2h 10m ago' },
  { id: '4', action: 'milestone_transition', entity: 'milestone / MEP Rough-In (Riverside Mixed-Use)', actor: 'Marcus Webb', time: '3h ago', detail: 'in_progress → ready_for_review' },
  { id: '5', action: 'ai_draw_review', entity: 'milestone / Building Envelope (Harbor Logistics)', actor: 'system', time: '1d ago', detail: 'score: 92' },
  { id: '6', action: 'milestone_approved', entity: 'milestone / Building Envelope (Harbor Logistics)', actor: 'Sarah Chen', time: '1d ago' },
  { id: '7', action: 'dispute_resolved', entity: 'dispute / Riverside Mixed-Use Milestone 2', actor: 'admin', time: '3d ago' },
  { id: '8', action: 'dispute_opened', entity: 'dispute / Riverside Mixed-Use Milestone 2', actor: 'Sarah Chen', time: '5d ago' },
  { id: '9', action: 'release_blocked', entity: 'milestone / Framing & Structural (Riverside Mixed-Use)', actor: 'system', time: '5d ago', detail: 'condition_failed: open_dispute' },
  { id: '10', action: 'milestone_released', entity: 'milestone / Concrete Sub-grade (Harbor Logistics)', actor: 'Sarah Chen', time: '7d ago' },
  { id: '11', action: 'milestone_released', entity: 'milestone / Site Preparation (Harbor Logistics)', actor: 'Sarah Chen', time: '14d ago' },
  { id: '12', action: 'milestone_released', entity: 'milestone / Foundation & Site Prep (Riverside Mixed-Use)', actor: 'Sarah Chen', time: '45d ago' },
  { id: '13', action: 'deal_funded', entity: 'deal / Westside Medical Office Campus', actor: 'Sarah Chen', time: '30d ago' },
  { id: '14', action: 'deal_funded', entity: 'deal / Riverside Mixed-Use Development', actor: 'Sarah Chen', time: '90d ago' },
  { id: '15', action: 'deal_funded', entity: 'deal / Harbor Logistics Center', actor: 'Sarah Chen', time: '180d ago' },
]

function actionColor(action: string) {
  if (action.includes('released') || action.includes('funded')) return 'text-vektrum-green'
  if (action.includes('blocked') || action === 'dispute_opened') return 'text-vektrum-amber'
  if (action.includes('ai_draw_review')) return 'text-vektrum-blue'
  return 'text-vektrum-muted'
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DemoAuditPage() {
  return (
    <div className="page-container section space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-vektrum-blue-subtle">
          <Shield size={18} className="text-vektrum-blue" aria-hidden="true" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-vektrum-text">
            Audit Log
          </h1>
          <p className="text-sm text-vektrum-muted">
            All platform events — newest first &middot; 15 demo entries
          </p>
        </div>
      </div>

      {/* Back link */}
      <Link
        href="/demo-live/admin"
        className="inline-flex items-center gap-1 text-[13px] text-vektrum-muted hover:text-vektrum-blue transition-colors"
      >
        &larr; Back to admin dashboard
      </Link>

      {/* Audit table */}
      <div className="rounded-xl border border-vektrum-border bg-vektrum-surface shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-vektrum-border bg-vektrum-surface-alt">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-vektrum-muted">
                  Timestamp
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-vektrum-muted">
                  Action
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-vektrum-muted">
                  Entity
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-vektrum-muted">
                  Actor
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-vektrum-muted">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-vektrum-border-subtle">
              {MOCK_AUDIT.map((entry) => (
                <tr key={entry.id} className="hover:bg-vektrum-surface-alt transition-colors">
                  <td className="whitespace-nowrap px-4 py-3 font-mono tabular-nums text-xs text-vektrum-muted">
                    {entry.time}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                      entry.action.includes('released') || entry.action.includes('funded')
                        ? 'bg-vektrum-green-bg text-vektrum-green border-vektrum-green-border'
                        : entry.action.includes('blocked') || entry.action === 'dispute_opened'
                        ? 'bg-vektrum-amber-bg text-vektrum-amber border-vektrum-amber-border'
                        : entry.action.includes('ai_draw_review')
                        ? 'bg-vektrum-blue-subtle text-vektrum-blue border-vektrum-blue-border'
                        : entry.action.includes('dispute_resolved')
                        ? 'bg-vektrum-green-bg text-vektrum-green border-vektrum-green-border'
                        : 'bg-vektrum-surface-alt text-vektrum-muted border-vektrum-border'
                    }`}>
                      {entry.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-vektrum-text max-w-[280px] truncate">
                    {entry.entity}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-vektrum-muted">
                    {entry.actor === 'system' ? (
                      <span className="text-vektrum-faint">System</span>
                    ) : entry.actor}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-vektrum-faint">
                    {entry.detail ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
