'use client'

import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'

interface AiReviewModalProps {
  open: boolean
  onClose: () => void
  milestoneContext?: { name: string; amount: number } | null
}

export function AiReviewModal({ open, onClose, milestoneContext }: AiReviewModalProps) {
  const [phase, setPhase] = useState<'loading' | 'complete'>('loading')
  const [step1, setStep1] = useState(false)
  const [step2, setStep2] = useState(false)
  const [step3, setStep3] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!open) {
      setPhase('loading')
      setStep1(false)
      setStep2(false)
      setStep3(false)
      setProgress(0)
      return
    }

    const t1 = setTimeout(() => setStep1(true), 400)
    const t2 = setTimeout(() => setStep2(true), 800)
    const t3 = setTimeout(() => setStep3(true), 1200)
    const tComplete = setTimeout(() => setPhase('complete'), 1800)

    // Progress bar animation
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 100
        return prev + 100 / 18 // ~18 steps in 1800ms
      })
    }, 100)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(tComplete)
      clearInterval(interval)
    }
  }, [open])

  if (!open) return null

  const milestoneName = milestoneContext?.name ?? 'MEP Rough-In'
  const milestoneAmount = milestoneContext?.amount ?? 680_000
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(milestoneAmount)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div className="relative max-w-md w-full mx-4 rounded-2xl bg-surface-2 border border-white/[0.08] shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white">AI Draw Review</h2>
          <button type="button" onClick={onClose} className="text-white/35 hover:text-white/60 transition-colors">
            <X size={20} />
          </button>
        </div>

        {phase === 'loading' ? (
          <div className="py-8 text-center">
            <Loader2 size={40} className="text-vektrum-blue mx-auto mb-4 animate-spin" />
            <p className="text-sm font-medium text-white/70 mb-4">Vektrum AI is reviewing draw request...</p>
            <div className="space-y-2 text-left max-w-xs mx-auto mb-6">
              {step1 && (
                <p className="text-xs text-white/60 animate-fade-in">• Analyzing invoice documentation...</p>
              )}
              {step2 && (
                <p className="text-xs text-white/60 animate-fade-in">• Cross-referencing against approved scope...</p>
              )}
              {step3 && (
                <p className="text-xs text-white/60 animate-fade-in">• Generating risk assessment...</p>
              )}
            </div>
            <div className="h-2 rounded-full bg-surface-3 overflow-hidden max-w-xs mx-auto">
              <div
                className="h-full rounded-full bg-vektrum-blue transition-all duration-100"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>
        ) : (
          <div>
            <p className="text-xs text-white/45 mb-3">
              Milestone: {milestoneName} — {formattedAmount}
            </p>

            {/* Score / Risk / Result row */}
            <div className="grid grid-cols-3 gap-4 mb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-white/40">Score</p>
                <p className="text-3xl font-bold text-vektrum-blue">82/100</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-white/40">Risk</p>
                <span className="inline-flex items-center rounded-full bg-emerald-500/[0.12] border border-emerald-500/20 text-emerald-400 px-3 py-1 text-sm font-medium mt-1">
                  Low
                </span>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-white/40">Result</p>
                <p className="text-lg font-semibold text-emerald-400 mt-1">✓ Pass</p>
              </div>
            </div>

            {/* Findings */}
            <div className="mb-5">
              <p className="text-sm font-semibold text-white mb-2">Findings</p>
              <div className="space-y-2">
                <p className="text-sm text-emerald-400">✓ Invoice amount ({formattedAmount}) matches approved scope</p>
                <p className="text-sm text-emerald-400">✓ MEP inspection report dated April 28, 2026 attached</p>
                <p className="text-sm text-emerald-400">✓ Lien waiver from Webb Construction Group on file</p>
                <p className="text-sm text-emerald-400">✓ No open disputes on this milestone or deal</p>
                <p className="text-sm text-amber-400">⚠ Rough-in completion estimated at 94% per inspection (minor punch-list items remain — not release-blocking)</p>
              </div>
            </div>

            {/* Recommendation */}
            <div className="rounded-lg bg-surface-3 border border-white/[0.06] px-4 py-3 mb-5">
              <p className="text-sm font-semibold text-white mb-1">Recommendation</p>
              <p className="text-sm text-white/65 leading-relaxed">
                Approve this draw request. All primary conditions are satisfied. The 6% punch-list items
                are documented and non-blocking per standard MEP inspection protocol. Suggest funder review
                and approve within 48 hours.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg border border-white/[0.12] bg-surface-3 px-4 py-2 text-sm font-medium text-white/60 hover:bg-white/[0.06] transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
