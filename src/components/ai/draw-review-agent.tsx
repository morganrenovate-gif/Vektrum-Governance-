'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Shield, AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react'

interface DrawAssessment {
  assessment_id: string
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  score: number
  findings: string[]
  recommendation: 'approve' | 'hold' | 'reject'
  reasoning: string
  reviewed_at: string
}

interface DrawReviewAgentProps {
  milestoneId: string
  milestoneStatus: string
  onAssessmentComplete?: (assessment: DrawAssessment) => void
}

const riskColors = {
  low: { text: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
  medium: { text: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  high: { text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  critical: { text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
}

export function DrawReviewAgent({
  milestoneId,
  milestoneStatus,
  onAssessmentComplete,
}: DrawReviewAgentProps) {
  const [assessment, setAssessment] = useState<DrawAssessment | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [initialLoad, setInitialLoad] = useState(true)

  // Fetch existing assessment on mount
  useEffect(() => {
    const fetchExisting = async () => {
      try {
        const res = await fetch(`/api/ai/draw-review?milestoneId=${milestoneId}`)
        if (res.ok) {
          const data = await res.json()
          if (data.assessment) {
            setAssessment(data.assessment)
          }
        }
      } catch {
        // Silently fail — component will show "no assessment" state
      } finally {
        setInitialLoad(false)
      }
    }
    fetchExisting()
  }, [milestoneId])

  const requestReview = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/draw-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ milestoneId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Assessment failed')
      }
      const data: DrawAssessment = await res.json()
      setAssessment(data)
      onAssessmentComplete?.(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Assessment failed')
    } finally {
      setIsLoading(false)
    }
  }

  if (initialLoad) {
    return (
      <div className="rounded-lg border border-white/[0.08] bg-surface-2 p-4">
        <div className="flex items-center gap-2 text-sm text-white/55">
          <Loader2 size={14} className="animate-spin" />
          Loading AI assessment...
        </div>
      </div>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-lg border border-vektrum-blue/20 bg-vektrum-blue/10 p-5">
        <div className="flex items-center gap-2 mb-2">
          <Shield size={16} className="text-vektrum-blue" />
          <h4 className="text-sm font-semibold text-white">AI Draw Review</h4>
        </div>
        <div className="flex items-center gap-2 text-sm text-white/55">
          <Loader2 size={14} className="animate-spin text-vektrum-blue" />
          Perplexity AI is analyzing this draw request...
        </div>
        <p className="mt-1 text-xs text-white/30">This usually takes 10-15 seconds.</p>
      </div>
    )
  }

  // No assessment yet
  if (!assessment) {
    return (
      <div className="rounded-lg border border-white/[0.08] bg-surface-2 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Shield size={16} className="text-vektrum-blue" />
          <h4 className="text-sm font-semibold text-white">AI Draw Review</h4>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-5 w-5 rounded-md border border-white/[0.08] flex items-center justify-center">
            <span className="text-xs text-white/30">-</span>
          </div>
          <div>
            <p className="text-sm text-white/55">No AI assessment on file</p>
            <p className="text-xs text-white/30">
              Request a Perplexity AI review before this milestone can be released.
            </p>
          </div>
        </div>
        {error && (
          <div className="mb-3 rounded-md border border-red-500/20 bg-red-500/[0.08] px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}
        <button
          type="button"
          onClick={requestReview}
          disabled={isLoading}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-4 py-2',
            'bg-vektrum-blue text-white text-sm font-semibold',
            'hover:bg-vektrum-blue-hover transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          <Shield size={14} />
          Request AI Review
        </button>
      </div>
    )
  }

  // Assessment complete
  const isHighRisk = assessment.risk_level === 'high' || assessment.risk_level === 'critical'
  const colors = riskColors[assessment.risk_level]

  return (
    <div className={cn(
      'rounded-lg border bg-surface-2 overflow-hidden',
      isHighRisk ? 'border-red-500/20' : 'border-white/[0.08]',
    )}>
      {/* Header */}
      <div className="px-5 py-3 border-b border-white/[0.05] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-vektrum-blue" />
          <h4 className="text-sm font-semibold text-white">AI Draw Review</h4>
          <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
            <CheckCircle2 size={12} />
            Reviewed
          </span>
        </div>
        <button
          type="button"
          onClick={requestReview}
          disabled={isLoading}
          className="inline-flex items-center gap-1 text-xs text-white/55 hover:text-vektrum-blue transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} />
          Fresh Review
        </button>
      </div>

      {/* High/Critical risk banner */}
      {isHighRisk && (
        <div className={cn('px-5 py-2 flex items-center gap-2', colors.bg)}>
          <AlertTriangle size={14} className={colors.text} />
          <p className={cn('text-xs font-semibold', colors.text)}>
            Release is blocked until risk is addressed or admin overrides.
          </p>
        </div>
      )}

      {/* Score row */}
      <div className="px-5 py-3 flex flex-wrap items-center gap-4 border-b border-white/[0.05]">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Score</p>
          <p className="text-lg font-bold tabular-nums text-white">{assessment.score}/100</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Risk</p>
          <span className={cn(
            'inline-block rounded px-2 py-0.5 text-xs font-bold uppercase',
            colors.bg, colors.text,
          )}>
            {assessment.risk_level}
          </span>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Recommendation</p>
          <span className={cn(
            'inline-block rounded px-2 py-0.5 text-xs font-bold uppercase',
            assessment.recommendation === 'approve' ? 'bg-green-50 text-green-700' :
            assessment.recommendation === 'reject' ? 'bg-red-50 text-red-700' :
            'bg-yellow-50 text-yellow-700',
          )}>
            {assessment.recommendation}
          </span>
        </div>
      </div>

      {/* Reasoning */}
      <div className="px-5 py-3 border-b border-white/[0.05]">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-1">Reasoning</p>
        <p className="text-sm text-white/55">{assessment.reasoning}</p>
      </div>

      {/* Findings */}
      {assessment.findings.length > 0 && (
        <div className="px-5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-2">Findings</p>
          <ul className="space-y-1.5">
            {assessment.findings.map((finding, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-white/55">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-white/55" aria-hidden="true" />
                {finding}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Error feedback */}
      {error && (
        <div className="px-5 py-2 border-t border-white/[0.05]">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}
    </div>
  )
}
