import Link from 'next/link'
import { CheckCircle2, AlertCircle, Clock, ArrowRight, Zap } from 'lucide-react'
import type { Deal, Milestone } from '@/lib/types'
import { formatMoney } from '@/lib/utils'
import { RiskScoreBadge, computeRiskLevel } from './risk-score-badge'

interface DrawReviewPanelProps {
  deals: (Deal & { milestones?: Milestone[] })[]
}

export function DrawReviewPanel({ deals }: DrawReviewPanelProps) {
  // Collect all milestones at ready_for_review across all deals
  type ReviewItem = {
    milestone: Milestone
    deal: Deal
    dealTitle: string
  }

  const reviewItems: ReviewItem[] = deals.flatMap((deal) =>
    (deal.milestones ?? [])
      .filter((m) => m.status === 'ready_for_review')
      .map((m) => ({ milestone: m, deal, dealTitle: deal.title })),
  )

  if (reviewItems.length === 0) {
    return (
      <div className="rounded-xl border border-vektrum-border bg-vektrum-surface p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-vektrum-blue/10">
            <Clock size={15} className="text-vektrum-blue" />
          </div>
          <h3 className="text-[14px] font-semibold text-vektrum-text">Draw Review Status</h3>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-vektrum-surface-alt px-4 py-3">
          <CheckCircle2 size={15} className="text-vektrum-green flex-shrink-0" />
          <p className="text-[13px] text-vektrum-muted">No milestones pending funder review.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-vektrum-border bg-vektrum-surface p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-vektrum-amber-bg">
            <Clock size={15} className="text-vektrum-amber" />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-vektrum-text">Draw Review Status</h3>
            <p className="text-[11px] text-vektrum-faint">
              {reviewItems.length} milestone{reviewItems.length !== 1 ? 's' : ''} awaiting funder review
            </p>
          </div>
        </div>
        {/* AI Pre-clearance coming soon badge */}
        <span className="inline-flex items-center gap-1 rounded-full border border-vektrum-amber-border bg-vektrum-amber-bg px-2.5 py-1 text-[10px] font-medium text-vektrum-amber">
          <Zap size={10} />
          AI review coming soon
        </span>
      </div>

      {/* Items */}
      <div className="space-y-3">
        {reviewItems.map(({ milestone, deal }) => {
          const riskLevel = computeRiskLevel(milestone)
          return (
            <Link
              key={milestone.id}
              href={`/dashboard/deals/${deal.id}`}
              className="block group"
            >
              <div className="flex items-center justify-between gap-3 rounded-lg border border-vektrum-border bg-vektrum-surface-alt px-4 py-3 group-hover:border-vektrum-blue/40 transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <AlertCircle size={12} className="flex-shrink-0 text-vektrum-amber" />
                    <span className="text-[13px] font-medium text-vektrum-text truncate">
                      {milestone.title}
                    </span>
                  </div>
                  <p className="text-[11px] text-vektrum-faint truncate">{deal.title}</p>
                </div>
                <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                  <span className="text-[12px] font-semibold tabular-nums text-vektrum-text">
                    {formatMoney(milestone.amount)}
                  </span>
                  <RiskScoreBadge level={riskLevel} />
                </div>
                <ArrowRight size={14} className="flex-shrink-0 text-vektrum-faint group-hover:text-vektrum-blue transition-colors" />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
