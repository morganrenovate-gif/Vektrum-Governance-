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
    <div className="rounded-xl border border-vektrum-border bg-vektrum-surface p-6">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-vektrum-faint mb-4">
        Capital Summary
      </p>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">
            Total Funded
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums text-vektrum-blue">
            {formatMoney(totalFunded)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">
            Released
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums text-vektrum-green">
            {formatMoney(totalReleased)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">
            Remaining
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums text-vektrum-text">
            {formatMoney(remaining)}
          </p>
        </div>
      </div>

      {/* Stacked progress bar */}
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-vektrum-surface-alt">
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
          <span className="text-[11px] text-vektrum-faint">Released</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-vektrum-blue/40" />
          <span className="text-[11px] text-vektrum-faint">Remaining</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-vektrum-surface-alt border border-vektrum-border" />
          <span className="text-[11px] text-vektrum-faint">Unfunded</span>
        </div>
      </div>
    </div>
  )
}
