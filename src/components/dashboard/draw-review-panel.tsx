import Link from 'next/link'
import { CheckCircle2, AlertCircle, Clock, ArrowRight, Zap } from 'lucide-react'
import type { Deal, Milestone } from '@/lib/types'
import { formatMoney } from '@/lib/utils'
import { RiskScoreBadge, computeRiskLevel } from './risk-score-badge'

interface DrawReviewPanelProps {
  deals: (Deal & { milestones?: Milestone[] })[]
  /** When true, skips the outer card wrapper — caller provides the container */
  embedded?: boolean
}

export function DrawReviewPanel({ deals, embedded = false }: DrawReviewPanelProps) {
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

  const emptyContent = (
    <div className="flex items-center gap-2 rounded-lg bg-vektrum-surface-alt px-4 py-3">
      <CheckCircle2 size={15} className="text-vektrum-green flex-shrink-0" />
      <p className="text-[13px] text-vektrum-muted">No milestones pending funder review.</p>
    </div>
  )

  const itemsContent = (
    <>
      {/* Sub-header with count + AI badge (only when has items) */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] text-vektrum-faint">
          {reviewItems.length} milestone{reviewItems.length !== 1 ? 's' : ''} awaiting funder review
        </p>
        <span className="inline-flex items-center gap-1 rounded-full border border-vektrum-amber-border bg-vektrum-amber-bg px-2.5 py-1 text-[10px] font-medium text-vektrum-amber">
          <Zap size={10} />
          AI-assisted review
        </span>
      </div>
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
    </>
  )

  if (reviewItems.length === 0) {
    if (embedded) return emptyContent
    return (
      <div className="rounded-xl border border-vektrum-border bg-vektrum-surface p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-vektrum-blue/10">
            <Clock size={15} className="text-vektrum-blue" />
          </div>
          <h3 className="text-[14px] font-semibold text-vektrum-text">Draw Review Status</h3>
        </div>
        {emptyContent}
      </div>
    )
  }

  if (embedded) return itemsContent

  return (
    <div className="rounded-xl border border-vektrum-border bg-vektrum-surface p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-vektrum-amber-bg">
            <Clock size={15} className="text-vektrum-amber" />
          </div>
          <h3 className="text-[14px] font-semibold text-vektrum-text">Draw Review Status</h3>
        </div>
      </div>
      {itemsContent}
    </div>
  )
}
