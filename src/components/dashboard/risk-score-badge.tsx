import type { Milestone } from '@/lib/types'

type RiskLevel = 'low' | 'medium' | 'high'

/**
 * Computes a dispute risk level from existing milestone and deal data.
 * Pure computation — no API calls.
 *
 * low    — no open change orders, protection_status is funded or ready_for_release
 * medium — change orders submitted or protection_status is pending
 * high   — milestone has a dispute (protection_status = 'funded' + status = disputed pattern)
 *          or caller explicitly passes isDisputed = true
 */
export function computeRiskLevel(
  milestone: Pick<Milestone, 'status' | 'protection_status'>,
  hasOpenChangeOrders = false,
  isDisputed = false,
): RiskLevel {
  if (isDisputed) return 'high'
  if (hasOpenChangeOrders) return 'medium'
  if (milestone.protection_status === 'pending') return 'medium'
  return 'low'
}

interface RiskScoreBadgeProps {
  level: RiskLevel
  showLabel?: boolean
}

const CONFIG: Record<RiskLevel, { label: string; color: string; dot: string }> = {
  low: {
    label: 'Low risk',
    color: 'bg-vektrum-green-bg text-vektrum-score-low border-vektrum-green-border',
    dot: 'bg-vektrum-score-low',
  },
  medium: {
    label: 'Medium risk',
    color: 'bg-vektrum-amber-bg text-vektrum-score-med border-vektrum-amber-border',
    dot: 'bg-vektrum-score-med',
  },
  high: {
    label: 'High risk',
    color: 'bg-vektrum-red-bg text-vektrum-score-high border-vektrum-red-border',
    dot: 'bg-vektrum-score-high',
  },
}

export function RiskScoreBadge({ level, showLabel = true }: RiskScoreBadgeProps) {
  const cfg = CONFIG[level]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${cfg.color}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {showLabel && cfg.label}
    </span>
  )
}
