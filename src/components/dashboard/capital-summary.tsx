import { formatMoney } from '@/lib/utils'

interface CapitalSummaryProps {
  totalFunded: number
  totalReleased: number
  /** Sum of facility_total across all deals with governance fee model data. */
  totalFacility?: number
  /** Sum of governance_fee_total across all deals with governance fee model data. */
  totalGovernanceFees?: number
}

export function CapitalSummary({ totalFunded, totalReleased, totalFacility, totalGovernanceFees }: CapitalSummaryProps) {
  const remaining = Math.max(0, totalFunded - totalReleased)
  const releasedPct = totalFunded > 0 ? (totalReleased / totalFunded) * 100 : 0
  const remainingPct = 100 - releasedPct
  const hasGovernance = totalFacility != null && totalFacility > 0 && totalGovernanceFees != null

  return (
    <div className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-card p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/65 mb-4">
        Capital Summary
      </p>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/65">
            Total Funded
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums text-vektrum-blue">
            {formatMoney(totalFunded)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/65">
            Released
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums text-emerald-400">
            {formatMoney(totalReleased)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/65">
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
          <span className="text-[11px] text-white/70">Released</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-vektrum-blue/40" />
          <span className="text-[11px] text-white/70">Remaining</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-white/[0.07] border border-white/[0.08]" />
          <span className="text-[11px] text-white/70">Unfunded</span>
        </div>
      </div>

      {/* ── Governance fee summary (shown only for governance-model deals) ────── */}
      {hasGovernance && (
        <div className="mt-5 pt-4 border-t border-white/[0.06]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/65 mb-3">
            Facility Breakdown
          </p>
          <div className="flex items-center justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-white/55">Total Facility Size</span>
                <span className="text-[13px] font-semibold tabular-nums text-white">
                  {formatMoney(totalFacility!)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-white/55">Governance Layer</span>
                <span className="text-[13px] font-medium tabular-nums text-vektrum-amber">
                  +{formatMoney(totalGovernanceFees!)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
