import { formatMoney } from '@/lib/utils'

interface CapitalSummaryProps {
  totalFunded: number
  totalReleased: number
}

export function CapitalSummary({ totalFunded, totalReleased }: CapitalSummaryProps) {
  const remaining = Math.max(0, totalFunded - totalReleased)
  const releasedPct = totalFunded > 0 ? (totalReleased / totalFunded) * 100 : 0
  const remainingPct = 100 - releasedPct

  return (
    <div className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-card p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/35 mb-4">
        Capital Summary
      </p>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
            Total Funded
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums text-vektrum-blue">
            {formatMoney(totalFunded)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
            Released
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums text-vektrum-green">
            {formatMoney(totalReleased)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
            Remaining
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums text-white">
            {formatMoney(remaining)}
          </p>
        </div>
      </div>

      {/* Stacked progress bar */}
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-white/[0.07]">
        {/* Released — green */}
        <div
          className="absolute left-0 top-0 h-full rounded-l-full bg-vektrum-green transition-all duration-500"
          style={{ width: `${Math.min(100, releasedPct)}%` }}
        />
        {/* Remaining — blue */}
        <div
          className="absolute top-0 h-full bg-vektrum-blue/40 transition-all duration-500"
          style={{
            left: `${Math.min(100, releasedPct)}%`,
            width: `${Math.min(100 - releasedPct, remainingPct)}%`,
          }}
        />
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-vektrum-green" />
          <span className="text-[11px] text-white/30">Released</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-vektrum-blue/40" />
          <span className="text-[11px] text-white/30">Remaining</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-white/[0.07] border border-white/[0.08]" />
          <span className="text-[11px] text-white/30">Unfunded</span>
        </div>
      </div>
    </div>
  )
}
