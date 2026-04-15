'use client'

import { useEffect, useState } from 'react'

interface ReadinessGaugeProps {
  dealId: string
  /** If true, shows a loading skeleton instead of fetching */
  preview?: boolean
}

interface ReadinessData {
  score: number
  breakdown: { label: string; points: number; max: number }[]
}

// ── SVG circular gauge ────────────────────────────────────────────────────────

function CircularGauge({ score }: { score: number }) {
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (score / 100) * circumference

  const color =
    score >= 75
      ? '#1A7A4A' // vektrum-green
      : score >= 40
        ? '#9A5A0A' // vektrum-amber
        : '#B01C1C' // vektrum-red

  return (
    <div className="relative flex h-[88px] w-[88px] items-center justify-center">
      <svg
        width="88"
        height="88"
        viewBox="0 0 88 88"
        className="-rotate-90"
        aria-hidden="true"
      >
        {/* Track */}
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-vektrum-border"
        />
        {/* Progress */}
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
        />
      </svg>
      {/* Score label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-xl font-bold tabular-nums leading-none"
          style={{ color }}
        >
          {score}
        </span>
        <span className="text-[9px] text-vektrum-faint uppercase tracking-wider">/ 100</span>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ReadinessGauge({ dealId, preview = false }: ReadinessGaugeProps) {
  const [data, setData] = useState<ReadinessData | null>(null)
  const [loading, setLoading] = useState(!preview)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (preview) return
    fetch(`/api/deals/${dealId}/readiness`)
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.score === 'number') setData(d)
        else setError(true)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [dealId, preview])

  if (loading) {
    return (
      <div className="flex items-center gap-4">
        <div className="h-[88px] w-[88px] animate-pulse rounded-full bg-vektrum-surface-alt" />
        <div className="flex-1 space-y-2">
          <div className="h-2.5 w-24 animate-pulse rounded bg-vektrum-surface-alt" />
          <div className="h-2 w-16 animate-pulse rounded bg-vektrum-surface-alt" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-vektrum-surface-alt px-4 py-3">
        <span className="text-[12px] text-vektrum-faint">
          Readiness score unavailable
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4">
      <CircularGauge score={data.score} />
      <div className="flex-1 space-y-1.5">
        <p className="text-[13px] font-semibold text-vektrum-text">Release Readiness</p>
        {data.breakdown.map((b) => (
          <div key={b.label} className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-vektrum-faint truncate">{b.label}</span>
            <span className="text-[11px] font-medium tabular-nums text-vektrum-muted flex-shrink-0">
              {b.points}/{b.max}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
