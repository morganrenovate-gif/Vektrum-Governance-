'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Shield, AlertTriangle, CheckCircle2, Info, Loader2, RefreshCw } from 'lucide-react'

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
  /** When true, diagnostic error codes are shown (admins only). In dev mode they
   *  are always shown regardless of this prop. */
  isAdmin?: boolean
  onAssessmentComplete?: (assessment: DrawAssessment) => void
}

const riskColors = {
  low:      { text: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200'  },
  medium:   { text: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  high:     { text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  critical: { text: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200'    },
}

// Diagnostic codes are shown in development builds or to admins.
// `process.env.NODE_ENV` is inlined by the Next.js compiler — safe in client components.
const isDev = process.env.NODE_ENV !== 'production'

export function DrawReviewAgent({
  milestoneId,
  milestoneStatus,
  isAdmin = false,
  onAssessmentComplete,
}: DrawReviewAgentProps) {
  const [assessment, setAssessment] = useState<DrawAssessment | null>(null)
  const [isLoading, setIsLoading]   = useState(false)

  // ── POST error state ─────────────────────────────────────────────────────────
  const [error,     setError]     = useState<string | null>(null)
  /** Machine-readable error code from the API (e.g. AI_NOT_CONFIGURED). */
  const [errorCode, setErrorCode] = useState<string | null>(null)

  // ── GET (load) error state ───────────────────────────────────────────────────
  // Captured so admins/devs can see *why* the load failed instead of silently
  // degrading to "no assessment on file".
  const [loadError,     setLoadError]     = useState<string | null>(null)
  const [loadErrorCode, setLoadErrorCode] = useState<string | null>(null)

  const [initialLoad, setInitialLoad] = useState(true)

  // Show raw diagnostic codes in dev mode or to admins — never to regular users.
  const showDiagnostics = isDev || isAdmin

  // ── Fetch existing assessment on mount ───────────────────────────────────────
  useEffect(() => {
    const fetchExisting = async () => {
      try {
        const res = await fetch(`/api/ai/draw-review?milestoneId=${milestoneId}`)
        if (res.ok) {
          const data = await res.json()
          if (data.assessment) {
            setAssessment(data.assessment)
          }
        } else {
          // Previous code silently discarded non-OK GET responses, making it
          // impossible to distinguish "no assessment yet" from an auth or server
          // error.  We now capture the failure for diagnostic display.
          try {
            const errData = await res.json()
            setLoadError(errData.error ?? `HTTP ${res.status}`)
            setLoadErrorCode(errData.code ?? `HTTP_${res.status}`)
          } catch {
            setLoadError(`Failed to load assessment (HTTP ${res.status})`)
            setLoadErrorCode(`HTTP_${res.status}`)
          }
        }
      } catch {
        // Network-level error — degrade gracefully but capture the signal.
        setLoadError('Network error while loading assessment')
        setLoadErrorCode('NETWORK_ERROR')
      } finally {
        setInitialLoad(false)
      }
    }
    fetchExisting()
  }, [milestoneId])

  // ── Trigger a new review ─────────────────────────────────────────────────────
  const requestReview = async () => {
    setIsLoading(true)
    setError(null)
    setErrorCode(null)
    try {
      const res = await fetch('/api/ai/draw-review', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ milestoneId }),
      })
      if (!res.ok) {
        const data = await res.json()
        // Capture the machine-readable code before throwing so the catch block
        // can rely on errorCode state being set.
        setErrorCode(data.code ?? `HTTP_${res.status}`)
        throw new Error(data.error || 'Assessment failed')
      }
      const data: DrawAssessment = await res.json()
      setAssessment(data)
      // Clear any stale load error now that we have a fresh assessment.
      setLoadError(null)
      setLoadErrorCode(null)
      onAssessmentComplete?.(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Assessment failed')
    } finally {
      setIsLoading(false)
    }
  }

  // ── Render helpers ──────────────────────────────────────────────────────────

  /** Amber diagnostic chip — shown only when showDiagnostics is true. */
  function LoadDiagnostic() {
    if (!loadError || !showDiagnostics) return null
    return (
      <div className="mb-3 rounded-md border border-amber-500/20 bg-amber-500/[0.08] px-3 py-2">
        <div className="flex items-center gap-1.5 mb-0.5">
          <Info size={12} className="flex-shrink-0 text-amber-400" />
          <p className="text-[11px] font-semibold text-amber-400">Load diagnostic</p>
        </div>
        <p className="text-xs text-amber-300/80">{loadError}</p>
        {loadErrorCode && (
          <p className="mt-0.5 font-mono text-[10px] text-amber-400/60">code: {loadErrorCode}</p>
        )}
      </div>
    )
  }

  /** Red error block — always shown for the human message; code only in diagnostic mode. */
  function PostError() {
    if (!error) return null
    return (
      <div className="mb-3 rounded-md border border-red-500/20 bg-red-500/[0.08] px-3 py-2">
        <p className="text-xs text-red-400">{error}</p>
        {errorCode && showDiagnostics && (
          <p className="mt-0.5 font-mono text-[10px] text-red-400/60">code: {errorCode}</p>
        )}
      </div>
    )
  }

  // ── States ──────────────────────────────────────────────────────────────────

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

  if (isLoading) {
    return (
      <div className="rounded-lg border border-vektrum-blue/20 bg-vektrum-blue/10 p-5">
        <div className="flex items-center gap-2 mb-2">
          <Shield size={16} className="text-blue-400" />
          <h4 className="text-sm font-semibold text-white">AI Draw Review</h4>
        </div>
        <div className="flex items-center gap-2 text-sm text-white/55">
          <Loader2 size={14} className="animate-spin text-blue-400" />
          AI review in progress — analyzing this draw request...
        </div>
        <p className="mt-1 text-xs text-white/65">This usually takes 10–15 seconds.</p>
      </div>
    )
  }

  if (!assessment) {
    return (
      <div className="rounded-lg border border-white/[0.08] bg-surface-2 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Shield size={16} className="text-blue-400" />
          <h4 className="text-sm font-semibold text-white">AI Draw Review</h4>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-5 w-5 rounded-md border border-white/[0.08] flex items-center justify-center">
            <span className="text-xs text-white/65">–</span>
          </div>
          <div>
            <p className="text-sm text-white/55">No AI assessment on file</p>
            <p className="text-xs text-white/65">
              Request an AI-assisted draw review before this milestone can be released.
            </p>
          </div>
        </div>

        {/* Diagnostic: load error (admin/dev only) */}
        <LoadDiagnostic />

        {/* POST error */}
        <PostError />

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

  // ── Assessment complete ─────────────────────────────────────────────────────
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
          <Shield size={16} className="text-blue-400" />
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
          className="inline-flex items-center gap-1 text-xs text-white/75 hover:text-blue-300 transition-colors disabled:opacity-40"
        >
          <RefreshCw size={12} />
          Fresh Review
        </button>
      </div>

      {/* High / critical risk banner */}
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
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/65">Score</p>
          <p className="text-lg font-bold tabular-nums text-white">{assessment.score}/100</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/65">Risk</p>
          <span className={cn(
            'inline-block rounded px-2 py-0.5 text-xs font-bold uppercase',
            colors.bg, colors.text,
          )}>
            {assessment.risk_level}
          </span>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/65">Recommendation</p>
          <span className={cn(
            'inline-block rounded px-2 py-0.5 text-xs font-bold uppercase',
            assessment.recommendation === 'approve' ? 'bg-green-50 text-green-700' :
            assessment.recommendation === 'reject'  ? 'bg-red-50 text-red-700'    :
                                                      'bg-yellow-50 text-yellow-700',
          )}>
            {assessment.recommendation}
          </span>
        </div>
      </div>

      {/* Reasoning */}
      <div className="px-5 py-3 border-b border-white/[0.05]">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/65 mb-1">Reasoning</p>
        <p className="text-sm text-white/55">{assessment.reasoning}</p>
      </div>

      {/* Findings */}
      {assessment.findings.length > 0 && (
        <div className="px-5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/65 mb-2">Findings</p>
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

      {/* Error on "Fresh Review" attempt */}
      {error && (
        <div className="px-5 py-2 border-t border-white/[0.05]">
          <p className="text-xs text-red-400">{error}</p>
          {errorCode && showDiagnostics && (
            <p className="mt-0.5 font-mono text-[10px] text-red-400/60">code: {errorCode}</p>
          )}
        </div>
      )}
    </div>
  )
}
