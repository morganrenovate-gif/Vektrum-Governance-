import { formatMoney } from '@/lib/utils'
import type { Deal } from '@/lib/types'

interface PortfolioRiskChartProps {
  deals: Deal[]
}

export function PortfolioRiskChart({ deals }: PortfolioRiskChartProps) {
  if (deals.length === 0) return null

  // Only show deals that have been funded
  const fundedDeals = deals.filter((d) => d.funded_amount > 0)
  if (fundedDeals.length === 0) return null

  return (
    <div className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-card p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/35 mb-5">
        Portfolio Capital Deployment
      </p>

      <div className="space-y-3">
        {fundedDeals.map((deal) => {
          const releasedPct =
            deal.funded_amount > 0
              ? Math.min(100, (deal.released_amount / deal.funded_amount) * 100)
              : 0
          const remainingPct = 100 - releasedPct

          return (
            <div key={deal.id}>
              {/* Label row */}
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[12px] font-medium text-white truncate max-w-[60%]">
                  {deal.title}
                </span>
                <span className="text-[11px] font-semibold tabular-nums text-white/45 flex-shrink-0">
                  {formatMoney(deal.funded_amount)}
                </span>
              </div>

              {/* Stacked bar */}
              <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                {/* Released — green */}
                <div
                  className="absolute left-0 top-0 h-full bg-vektrum-green transition-all duration-500"
                  style={{ width: `${releasedPct}%` }}
                />
                {/* Remaining — blue/40 */}
                <div
                  className="absolute top-0 h-full bg-vektrum-blue/30 transition-all duration-500"
                  style={{
                    left: `${releasedPct}%`,
                    width: `${remainingPct}%`,
                  }}
                />
              </div>

              {/* Sub-label */}
              <div className="mt-1 flex justify-between text-[10px] text-white/30">
                <span>{formatMoney(deal.released_amount)} released</span>
                <span>
                  {formatMoney(Math.max(0, deal.funded_amount - deal.released_amount))} remaining
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 pt-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-3 rounded-sm bg-vektrum-green" />
          <span className="text-[10px] text-white/30">Released</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-3 rounded-sm bg-vektrum-blue/30" />
          <span className="text-[10px] text-white/30">Funded, not released</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-3 rounded-sm bg-white/[0.06] border border-white/[0.08]" />
          <span className="text-[10px] text-white/30">Unfunded</span>
        </div>
      </div>
    </div>
  )
}
