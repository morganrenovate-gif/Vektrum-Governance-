// Advisor 6 (Attorney): Every dispute viewed by an admin is an auditable event.
// The view itself is logged at the page level via server-side access.
// This component is display-only — no mutation actions here.
// Advisor 10 (Adversarial): No admin action buttons that touch money. Link to deal only.

import Link from 'next/link'
import { AlertTriangle, Clock, DollarSign, CheckCircle2 } from 'lucide-react'
import { formatMoney } from '@/lib/utils'

interface DisputeRow {
  id: string
  amount_in_dispute: number
  reason: string
  status: string
  opened_at: string
  opened_by: string
  deal_id: string
  milestone_id: string
  deals:      { id: string; title: string } | { id: string; title: string }[] | null
  milestones: { id: string; title: string } | { id: string; title: string }[] | null
}

interface DisputeQueueProps {
  disputes: DisputeRow[]
}

function daysOpen(openedAt: string): number {
  return Math.floor((Date.now() - new Date(openedAt).getTime()) / (1000 * 60 * 60 * 24))
}

export function DisputeQueue({ disputes }: DisputeQueueProps) {
  if (disputes.length === 0) {
    return (
      <div className="rounded-xl border border-vektrum-border bg-vektrum-surface px-6 py-10 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-vektrum-green-bg">
          <CheckCircle2 size={18} className="text-vektrum-green" aria-hidden="true" />
        </div>
        <p className="text-sm font-medium text-vektrum-text">No open disputes</p>
        <p className="mt-1 text-[12px] text-vektrum-muted">All milestone disputes have been resolved.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-vektrum-border bg-vektrum-surface overflow-hidden shadow-sm">
      {/* Table header */}
      <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-vektrum-border-subtle bg-vektrum-bg">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">Deal / Milestone</p>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">Amount</p>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">Days Open</p>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">Status</p>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">Action</p>
      </div>

      {/* Rows */}
      <div className="divide-y divide-vektrum-border-subtle">
        {disputes.map((dispute) => {
          const days = daysOpen(dispute.opened_at)
          const isUrgent = days >= 7
          return (
            <div
              key={dispute.id}
              className="flex flex-col gap-3 sm:grid sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-center gap-4 px-5 py-4 hover:bg-vektrum-bg transition-colors"
            >
              {/* Deal / Milestone */}
              <div className="flex items-start gap-2.5">
                <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg mt-0.5 ${isUrgent ? 'bg-vektrum-red-bg' : 'bg-vektrum-amber-bg'}`}>
                  <AlertTriangle size={13} className={isUrgent ? 'text-vektrum-red' : 'text-vektrum-amber'} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-vektrum-text truncate">
                    {Array.isArray(dispute.deals)
                      ? (dispute.deals[0]?.title ?? 'Unknown deal')
                      : (dispute.deals?.title ?? 'Unknown deal')}
                  </p>
                  <p className="text-[11px] text-vektrum-muted truncate mt-0.5">
                    Milestone: {Array.isArray(dispute.milestones)
                      ? (dispute.milestones[0]?.title ?? 'Unknown milestone')
                      : (dispute.milestones?.title ?? 'Unknown milestone')}
                  </p>
                  <p className="text-[11px] text-vektrum-faint truncate mt-0.5 sm:hidden">
                    {dispute.reason.length > 80 ? dispute.reason.slice(0, 80) + '…' : dispute.reason}
                  </p>
                </div>
              </div>

              {/* Amount */}
              <div className="flex items-center gap-1.5">
                <DollarSign size={12} className="text-vektrum-faint flex-shrink-0" aria-hidden="true" />
                <span className="text-[13px] font-semibold tabular-nums text-vektrum-text">
                  {formatMoney(dispute.amount_in_dispute)}
                </span>
              </div>

              {/* Days open */}
              <div className="flex items-center gap-1.5">
                <Clock size={12} className={isUrgent ? 'text-vektrum-red' : 'text-vektrum-muted'} aria-hidden="true" />
                <span className={`text-[13px] font-semibold ${isUrgent ? 'text-vektrum-red' : 'text-vektrum-text'}`}>
                  {days}d
                </span>
                {isUrgent && (
                  <span className="text-[10px] font-semibold text-vektrum-red">URGENT</span>
                )}
              </div>

              {/* Status badge */}
              <div>
                <span className="inline-flex rounded-full border border-vektrum-amber-border bg-vektrum-amber-bg px-2.5 py-0.5 text-[10px] font-semibold text-vektrum-amber capitalize">
                  {dispute.status}
                </span>
              </div>

              {/* View deal link */}
              <Link
                href={`/dashboard/deals/${dispute.deal_id}`}
                className="inline-flex items-center gap-1 rounded-lg border border-vektrum-border bg-vektrum-surface px-3 py-1.5 text-[12px] font-medium text-vektrum-muted hover:bg-vektrum-surface-alt hover:text-vektrum-text transition-all whitespace-nowrap"
              >
                View deal
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}
