'use client'

import { useState, useEffect, useRef } from 'react'
import { X, CheckCircle2, AlertTriangle, Loader2, ShieldCheck, ArrowLeft } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import { calculateFee } from '@/lib/engine/billing'

interface ReleaseFundsModalProps {
  open: boolean
  milestone: { name: string; amount: number }
  /** Deal's billing rate in basis points (100 | 70 | 65). Defaults to 100. */
  billingRateBps?: number
  approvalDate?: string
  onConfirm: () => void
  onClose: () => void
}

type Phase = 'review' | 'confirm' | 'loading' | 'success'

function generateRefId(): string {
  return `VKT-${Date.now().toString(36).toUpperCase().slice(-8)}`
}

function formatTimestamp(date: Date): string {
  return date.toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function ReleaseFundsModal({
  open,
  milestone,
  billingRateBps = 100,
  approvalDate,
  onConfirm,
  onClose,
}: ReleaseFundsModalProps) {
  const fee = calculateFee(milestone.amount, billingRateBps)
  const [phase, setPhase] = useState<Phase>('review')
  const [releaseTimestamp, setReleaseTimestamp] = useState<string>('')
  const [refId] = useState<string>(() => generateRefId())
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Reset to review phase whenever modal opens
  useEffect(() => {
    if (open) {
      setPhase('review')
    }
  }, [open])

  // On confirm phase mount, move initial focus to Cancel — not the release button
  useEffect(() => {
    if (phase === 'confirm') {
      cancelRef.current?.focus()
    }
  }, [phase])

  if (!open) return null

  function handleProceedToConfirm() {
    setPhase('confirm')
  }

  function handleRelease() {
    setPhase('loading')
    setTimeout(() => {
      setReleaseTimestamp(formatTimestamp(new Date()))
      setPhase('success')
      onConfirm()
    }, 1200)
  }

  function handleClose() {
    // Only allow close from review or success — not mid-flow
    if (phase === 'review' || phase === 'success') {
      onClose()
    }
  }

  const conditions = [
    `Milestone approved by funder (Sarah Chen${approvalDate ? ` — ${approvalDate}` : ''})`,
    'Milestone cleared for release (protection status: ready_for_release)',
    `Funded balance covers this disbursement (${formatCurrency(fee.totalDebit)} required incl. fee)`,
    'Contractor Stripe payouts enabled',
    'Contractor onboarding complete',
    'No prior release on this milestone',
    'No pending change orders',
    'Signed contract on file for this deal',
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="release-modal-title"
    >
      <div className="absolute inset-0 bg-black/60" onClick={handleClose} />

      <div className="relative max-w-md w-full mx-4 rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* ── Phase: REVIEW ─────────────────────────────────────────── */}
        {phase === 'review' && (
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 id="release-modal-title" className="text-lg font-semibold text-gray-900">
                Release Funds — 8-Condition Gate
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors rounded-lg p-1"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* 8 conditions */}
            <div className="space-y-2.5 mb-5">
              {conditions.map((c, i) => (
                <div key={i} className="flex items-start gap-2.5 text-sm">
                  <span className="text-green-600 font-semibold flex-shrink-0 tabular-nums w-4">
                    {i + 1}.
                  </span>
                  <CheckCircle2 size={14} className="text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700 leading-snug">{c}</span>
                </div>
              ))}
            </div>

            {/* All-clear callout */}
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 mb-5">
              <div className="flex items-center gap-2">
                <ShieldCheck size={15} className="text-green-600 flex-shrink-0" />
                <p className="text-sm font-medium text-green-700">
                  All 8 conditions satisfied. Ready to release.
                </p>
              </div>
            </div>

            {/* Amount & recipient */}
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 mb-5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
                Transfer
              </p>
              <p className="text-2xl font-bold text-gray-900 tabular-nums">
                {formatCurrency(milestone.amount)}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">
                {milestone.name} → Marcus Webb — Webb Construction Group
              </p>
              <div className="mt-2.5 pt-2.5 border-t border-gray-200 flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  + {fee.rateLabel} platform fee
                </p>
                <p className="text-xs font-medium text-gray-500 tabular-nums">
                  {formatCurrency(fee.feeAmount)}
                </p>
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs font-semibold text-gray-500">Total deducted from balance</p>
                <p className="text-xs font-semibold text-gray-700 tabular-nums">
                  {formatCurrency(fee.totalDebit)}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProceedToConfirm}
                className="flex-1 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ── Phase: CONFIRM ────────────────────────────────────────── */}
        {phase === 'confirm' && (
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 id="release-modal-title" className="text-lg font-semibold text-gray-900">
                Confirm Release
              </h2>
              {/* No close button on confirm — must choose Back or Confirm */}
            </div>

            {/* Irreversibility warning — top of decision screen */}
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3.5 mb-5">
              <div className="flex items-start gap-2.5">
                <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    This action is permanent and cannot be undone
                  </p>
                  <p className="text-sm text-amber-700 mt-0.5 leading-relaxed">
                    Once confirmed, funds will be transferred immediately via Stripe Connect and
                    cannot be recalled.
                  </p>
                </div>
              </div>
            </div>

            {/* Transfer detail block */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 divide-y divide-gray-100 mb-5 overflow-hidden">
              <div className="px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                  Milestone
                </p>
                <p className="text-sm font-medium text-gray-800 mt-0.5">{milestone.name}</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                  Recipient
                </p>
                <p className="text-sm font-medium text-gray-800 mt-0.5">
                  Marcus Webb — Webb Construction Group
                </p>
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                  Contractor payout
                </p>
                <p className="text-sm font-semibold text-gray-800 tabular-nums">
                  {formatCurrency(fee.grossAmount)}
                </p>
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                  Platform fee ({fee.rateLabel})
                </p>
                <p className="text-sm font-medium text-gray-500 tabular-nums">
                  + {formatCurrency(fee.feeAmount)}
                </p>
              </div>
              <div className="px-4 py-3 flex items-center justify-between bg-gray-100">
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-600">
                  Total deducted
                </p>
                <p className="text-base font-bold text-gray-900 tabular-nums">
                  {formatCurrency(fee.totalDebit)}
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                  Transfer method
                </p>
                <p className="text-sm font-medium text-gray-800 mt-0.5">
                  Stripe Connect — instant payout
                </p>
              </div>
            </div>

            {/* Footer — Cancel gets initial focus, not the release button */}
            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <button
                ref={cancelRef}
                type="button"
                onClick={() => setPhase('review')}
                className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5"
              >
                <ArrowLeft size={13} />
                Go Back
              </button>
              <button
                type="button"
                onClick={handleRelease}
                className="flex-1 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 active:bg-green-800 transition-colors"
              >
                Release {formatCurrency(fee.grossAmount)}
              </button>
            </div>

            {/* Fine print below buttons */}
            <p className="text-center text-[11px] text-gray-400 mt-3 leading-relaxed">
              By confirming you authorize this transfer under the terms of the Vektrum Project Trust Agreement.
            </p>
          </div>
        )}

        {/* ── Phase: LOADING ────────────────────────────────────────── */}
        {phase === 'loading' && (
          <div className="p-6 text-center py-14">
            <Loader2 size={36} className="text-green-500 mx-auto mb-4 animate-spin" />
            <p className="text-base font-semibold text-gray-800">Processing transfer...</p>
            <p className="text-sm text-gray-400 mt-1">
              Initiating Stripe Connect payout to Marcus Webb
            </p>
          </div>
        )}

        {/* ── Phase: SUCCESS ────────────────────────────────────────── */}
        {phase === 'success' && (
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 id="release-modal-title" className="text-lg font-semibold text-gray-900">
                Transfer Complete
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors rounded-lg p-1"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Success icon + amount */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-50 border-2 border-green-200 mb-3">
                <CheckCircle2 size={28} className="text-green-500" />
              </div>
              <p className="text-3xl font-bold text-gray-900 tabular-nums">
                {formatCurrency(fee.grossAmount)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                sent to Marcus Webb
              </p>
            </div>

            {/* Receipt block */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 divide-y divide-gray-100 mb-5 overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                  Milestone
                </p>
                <p className="text-sm font-medium text-gray-800 text-right">{milestone.name}</p>
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                  Recipient
                </p>
                <p className="text-sm font-medium text-gray-800 text-right">
                  Marcus Webb
                </p>
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                  Contractor payout
                </p>
                <p className="text-sm font-semibold text-gray-800 tabular-nums text-right">
                  {formatCurrency(fee.grossAmount)}
                </p>
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                  Platform fee ({fee.rateLabel})
                </p>
                <p className="text-sm font-medium text-gray-500 tabular-nums text-right">
                  {formatCurrency(fee.feeAmount)}
                </p>
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                  Total charged
                </p>
                <p className="text-sm font-semibold text-gray-800 tabular-nums text-right">
                  {formatCurrency(fee.totalDebit)}
                </p>
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                  Timestamp
                </p>
                <p className="text-sm font-medium text-gray-800 text-right tabular-nums">
                  {releaseTimestamp}
                </p>
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                  Reference ID
                </p>
                <p className="text-sm font-mono font-medium text-gray-800 tracking-wide">
                  {refId}
                </p>
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                  Transfer via
                </p>
                <p className="text-sm font-medium text-gray-800">Stripe Connect</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
