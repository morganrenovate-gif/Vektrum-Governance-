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
  const [step4, setStep4] = useState(false)
  const [step5, setStep5] = useState(false)
  const [step6, setStep6] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!open) {
      setPhase('loading')
      setStep1(false)
      setStep2(false)
      setStep3(false)
      setStep4(false)
      setStep5(false)
      setStep6(false)
      setProgress(0)
      return
    }

    const t1 = setTimeout(() => setStep1(true), 300)
    const t2 = setTimeout(() => setStep2(true), 650)
    const t3 = setTimeout(() => setStep3(true), 1000)
    const t4 = setTimeout(() => setStep4(true), 1350)
    const t5 = setTimeout(() => setStep5(true), 1700)
    const t6 = setTimeout(() => setStep6(true), 2050)
    const tComplete = setTimeout(() => setPhase('complete'), 2500)

    // Progress bar animation
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 100
        return prev + 100 / 25 // ~25 steps in 2500ms
      })
    }, 100)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
      clearTimeout(t5)
      clearTimeout(t6)
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
          <button type="button" onClick={onClose} className="text-white/65 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {phase === 'loading' ? (
          <div className="py-8 text-center">
            <Loader2 size={40} className="text-vektrum-blue mx-auto mb-4 animate-spin" />
            <p className="text-sm font-medium text-white/70 mb-4">Vektrum AI is running draw precondition analysis...</p>
            <div className="space-y-2 text-left max-w-xs mx-auto mb-6">
              {step1 && (
                <p className="text-xs text-white/60 animate-fade-in">• Parsing invoice and supporting documents...</p>
              )}
              {step2 && (
                <p className="text-xs text-white/60 animate-fade-in">• Cross-referencing against approved schedule of values...</p>
              )}
              {step3 && (
                <p className="text-xs text-white/60 animate-fade-in">• Validating inspection and lien-waiver evidence...</p>
              )}
              {step4 && (
                <p className="text-xs text-white/60 animate-fade-in">• Reconciling change orders and retainage math...</p>
              )}
              {step5 && (
                <p className="text-xs text-white/60 animate-fade-in">• Comparing against contractor draw-velocity history...</p>
              )}
              {step6 && (
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
            <p className="text-xs text-white/75 mb-1">
              Milestone: {milestoneName} — {formattedAmount}
            </p>
            <p className="text-[11px] text-white/55 mb-4 leading-relaxed">
              Precondition layer. Runs before the 10-condition release gate.
              AI informs; the gate decides.
            </p>

            {/* Score / Risk / Result row */}
            <div className="grid grid-cols-3 gap-4 mb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Score</p>
                <p className="text-3xl font-bold text-vektrum-blue">82/100</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Risk</p>
                <span className="inline-flex items-center rounded-full bg-emerald-500/[0.12] border border-emerald-500/20 text-emerald-400 px-3 py-1 text-sm font-medium mt-1">
                  Low
                </span>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Result</p>
                <p className="text-lg font-semibold text-emerald-400 mt-1">✓ Pass</p>
              </div>
            </div>

            {/* Findings */}
            <div className="mb-5">
              <p className="text-sm font-semibold text-white mb-2">
                Findings <span className="text-[11px] font-normal text-white/55">— 11 checks</span>
              </p>
              <div className="space-y-1.5">
                <p className="text-sm text-emerald-400">✓ Invoice amount ({formattedAmount}) matches approved scope of values</p>
                <p className="text-sm text-emerald-400">✓ MEP inspection report dated April 28, 2026 attached and within 14-day window</p>
                <p className="text-sm text-emerald-400">✓ Conditional lien waiver from Webb Construction Group on file (CA Civil Code §8132 form)</p>
                <p className="text-sm text-emerald-400">✓ Sub-tier lien waivers collected for 3 of 3 disclosed subcontractors</p>
                <p className="text-sm text-emerald-400">✓ No open disputes on this milestone or deal</p>
                <p className="text-sm text-emerald-400">✓ Change orders reconciled — CO-001 and CO-002 both approved and reflected in draw</p>
                <p className="text-sm text-emerald-400">✓ Retainage calculation correct — 10% withheld ({new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(milestoneAmount * 0.10)})</p>
                <p className="text-sm text-emerald-400">✓ Draw velocity consistent with contractor's 14-deal history on platform</p>
                <p className="text-sm text-emerald-400">✓ Document authenticity verified — no metadata anomalies on 6 attachments</p>
                <p className="text-sm text-emerald-400">✓ Photographic evidence (22 site photos) timestamped within submission window</p>
                <p className="text-sm text-amber-400">⚠ Rough-in completion estimated at 94% per inspection (punch-list items remain — not release-blocking, flagged for funder awareness)</p>
              </div>
            </div>

            {/* Recommendation */}
            <div className="rounded-lg bg-surface-3 border border-white/[0.06] px-4 py-3 mb-3">
              <p className="text-sm font-semibold text-white mb-1">Recommendation</p>
              <p className="text-sm text-white/65 leading-relaxed">
                Precondition clears the AI risk threshold (below critical). All primary evidence
                is valid; the 6% punch-list gap is documented and non-blocking per standard MEP
                inspection protocol. Suggested for funder review and approval.
              </p>
            </div>

            {/* Precondition vs gate reminder */}
            <p className="text-[11px] text-white/50 leading-relaxed mb-5">
              This assessment is one of two independent layers. The 10-condition release gate
              evaluates separately at release time — a passing AI assessment does not bypass
              gate conditions.
            </p>

            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg border border-white/[0.14] bg-white/[0.06] px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/[0.10] hover:text-white transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
