'use client'

import { useState } from 'react'
import { X, CheckCircle2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'

export type DisputeResolution = 'reject' | 'partial' | 'full'

interface ResolveDisputeModalProps {
  open:           boolean
  disputedAmount: number
  /**
   * Fired when the funder confirms the resolution (while the success screen
   * is showing). Includes:
   *  - resolution:     the outcome type chosen by the funder
   *  - partialAmount:  only present for 'partial' resolution
   *  - notifyParties:  whether the funder checked "Notify both parties"
   *
   * All three values are demo-only — no real email or audit call is made.
   */
  onConfirm:      (resolution: DisputeResolution, partialAmount: number | undefined, notifyParties: boolean) => void
  onClose:        () => void
}

export function ResolveDisputeModal({
  open,
  disputedAmount,
  onConfirm,
  onClose,
}: ResolveDisputeModalProps) {
  const [phase, setPhase]                 = useState<'idle' | 'loading' | 'success'>('idle')
  const [resolution, setResolution]       = useState<DisputeResolution>('reject')
  const [partialInput, setPartialInput]   = useState('')
  const [partialError, setPartialError]   = useState('')
  const [notifyParties, setNotifyParties] = useState(true)
  const [successMsg, setSuccessMsg]       = useState('')
  const [notifyMsg, setNotifyMsg]         = useState('')

  if (!open) return null

  function handleResolve() {
    let resolvedPartialAmount: number | undefined

    if (resolution === 'partial') {
      const parsed = parseFloat(partialInput.replace(/,/g, ''))
      if (!partialInput.trim() || isNaN(parsed) || parsed <= 0) {
        setPartialError('Enter a release amount greater than $0.')
        return
      }
      if (parsed > disputedAmount) {
        setPartialError(
          `Amount cannot exceed the disputed amount of ${formatCurrency(disputedAmount)}.`,
        )
        return
      }
      setPartialError('')
      resolvedPartialAmount = parsed
    }

    // Build resolution-specific success message
    let msg: string
    if (resolution === 'reject') {
      msg = `Claim rejected — ${formatCurrency(disputedAmount)} returned to funded balance.`
    } else if (resolution === 'full') {
      msg = `${formatCurrency(disputedAmount)} released to contractor. Dispute resolved.`
    } else {
      const remaining = disputedAmount - resolvedPartialAmount!
      msg = `${formatCurrency(resolvedPartialAmount!)} released to contractor. ${formatCurrency(remaining)} remaining held under dispute.`
    }

    const notify = notifyParties
      ? 'Demo notification queued for contractor and funder. No real email was sent.'
      : 'No notification sent in demo mode.'

    setSuccessMsg(msg)
    setNotifyMsg(notify)
    setPhase('loading')

    setTimeout(() => {
      setPhase('success')
      onConfirm(resolution, resolvedPartialAmount, notifyParties)
      setTimeout(() => {
        setPhase('idle')
        onClose()
      }, 2500)
    }, 800)
  }

  const resolutionOptions: { value: DisputeResolution; label: string; desc: string }[] = [
    {
      value: 'reject',
      label: 'Reject Claim',
      desc:  `Funder's position upheld. ${formatCurrency(disputedAmount)} returned to funded balance.`,
    },
    {
      value: 'partial',
      label: 'Partial Release',
      desc:  'Negotiate a partial payment to the contractor.',
    },
    {
      value: 'full',
      label: 'Full Release',
      desc:  `Release the full ${formatCurrency(disputedAmount)} disputed amount to contractor.`,
    },
  ]

  const textareaLabel =
    resolution === 'reject' ? 'Rejection Reason'
    : resolution === 'full' ? 'Resolution Notes'
    : 'Partial Release Notes'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div className="relative max-w-md w-full mx-4 rounded-2xl bg-surface-2 border border-white/[0.08] shadow-2xl p-6 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white">Resolve Dispute — HVAC Equipment Procurement</h2>
          <button type="button" onClick={onClose} className="text-white/65 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {phase === 'success' ? (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/[0.08] border-2 border-emerald-500/25 mb-3">
              <CheckCircle2 size={28} className="text-emerald-400" />
            </div>
            <p className="text-lg font-semibold text-white">Dispute Resolved.</p>
            <p className="text-sm text-white/55 mt-1">{successMsg}</p>
            <p className="text-xs text-white/40 mt-3 italic">{notifyMsg}</p>
          </div>
        ) : (
          <>
            {/* Summary banner */}
            <div className="rounded-lg bg-red-500/[0.08] border border-red-500/20 px-4 py-3 mb-5">
              <p className="text-sm font-medium text-red-400">
                {formatCurrency(disputedAmount)} disputed &middot; 3 days ago &middot; Priority 1
              </p>
            </div>

            {/* Resolution options */}
            <div className="space-y-2 mb-4">
              {resolutionOptions.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    resolution === opt.value
                      ? 'border-red-500/30 bg-red-500/[0.06]'
                      : 'border-white/[0.08] hover:bg-white/[0.03]'
                  }`}
                >
                  <input
                    type="radio"
                    name="resolution"
                    value={opt.value}
                    checked={resolution === opt.value}
                    onChange={() => {
                      setResolution(opt.value)
                      setPartialError('')
                    }}
                    className="mt-0.5 accent-red-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-white">{opt.label}</p>
                    <p className="text-xs text-white/75 mt-0.5">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>

            {/* Partial amount input — only shown when resolution === 'partial' */}
            {resolution === 'partial' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-white/60 mb-1">
                  Release Amount{' '}
                  <span className="text-white/40">(max {formatCurrency(disputedAmount)})</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/55 text-sm">$</span>
                  <input
                    type="number"
                    min={1}
                    max={disputedAmount}
                    step={1}
                    value={partialInput}
                    onChange={(e) => {
                      setPartialInput(e.target.value)
                      setPartialError('')
                    }}
                    placeholder="0"
                    className="w-full rounded-lg border border-white/[0.12] bg-surface-3 pl-7 pr-3 py-2 text-sm text-white/70 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/30"
                  />
                </div>
                {partialError && (
                  <p className="text-xs text-red-400 mt-1">{partialError}</p>
                )}
              </div>
            )}

            {/* Notes textarea */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-white/60 mb-1">{textareaLabel}</label>
              <textarea
                className="w-full rounded-lg border border-white/[0.12] bg-surface-3 px-3 py-2 text-sm text-white/70 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/30"
                rows={3}
                defaultValue="Invoice amount does not reconcile with change order CO-004. The $487,000 overage was not pre-approved. Contractor must resubmit with revised scope documentation."
              />
            </div>

            {/* Notify checkbox — interactive */}
            <label className="flex items-center gap-2 text-sm text-white/55 mb-5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={notifyParties}
                onChange={(e) => setNotifyParties(e.target.checked)}
                className="accent-red-500"
              />
              Notify both parties via email
            </label>

            {/* Footer buttons */}
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-white/[0.12] bg-surface-3 px-4 py-2 text-sm font-medium text-white/60 hover:bg-white/[0.06] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResolve}
                disabled={phase === 'loading'}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-70 transition-colors"
              >
                {phase === 'loading' ? 'Resolving...' : 'Resolve Dispute'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
