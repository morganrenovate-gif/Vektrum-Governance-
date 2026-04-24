'use client'

import { useState } from 'react'
import { X, CheckCircle2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'

interface FundDealModalProps {
  open: boolean
  onConfirm: () => void
  onClose: () => void
}

export function FundDealModal({ open, onConfirm, onClose }: FundDealModalProps) {
  const [phase, setPhase] = useState<'idle' | 'loading' | 'success'>('idle')

  if (!open) return null

  function handleConfirm() {
    setPhase('loading')
    setTimeout(() => {
      setPhase('success')
      onConfirm()
      setTimeout(() => {
        setPhase('idle')
        onClose()
      }, 2000)
    }, 800)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div className="relative max-w-md w-full mx-4 rounded-2xl bg-surface-2 border border-white/[0.08] shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white">Fund New Deal</h2>
          <button type="button" onClick={onClose} className="text-white/65 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {phase === 'success' ? (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/[0.08] border-2 border-emerald-500/25 mb-3">
              <CheckCircle2 size={28} className="text-emerald-400" />
            </div>
            <p className="text-lg font-semibold text-emerald-400">Funding Confirmed!</p>
            <p className="text-sm text-white/55 mt-1">
              {formatCurrency(4_750_000)} committed to Westside Medical Office Campus.
            </p>
          </div>
        ) : (
          <>
            {/* Funder */}
            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase tracking-wide text-white/70 mb-1">Funder</label>
              <div className="rounded-lg bg-surface-3 border border-white/[0.08] px-4 py-3 text-sm text-white/70">
                Sarah Chen — Meridian Capital Partners
              </div>
            </div>

            {/* Deal */}
            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase tracking-wide text-white/70 mb-1">Deal</label>
              <div className="rounded-lg bg-surface-3 border border-white/[0.08] px-4 py-3 text-sm text-white/70 cursor-not-allowed">
                Westside Medical Office Campus — {formatCurrency(4_750_000)}
              </div>
            </div>

            {/* Amount */}
            <div className="mb-5">
              <label className="block text-xs font-semibold uppercase tracking-wide text-white/70 mb-1">Amount</label>
              <p className="text-2xl font-bold text-vektrum-blue">{formatCurrency(4_750_000)}</p>
            </div>

            {/* Checkboxes */}
            <div className="space-y-2 mb-5">
              <label className="flex items-center gap-2 text-sm text-white/60">
                <input type="checkbox" checked disabled className="accent-vektrum-blue" />
                Funding terms acknowledged and accepted
              </label>
              <label className="flex items-center gap-2 text-sm text-white/60">
                <input type="checkbox" checked disabled className="accent-vektrum-blue" />
                Project Trust Account authorization confirmed
              </label>
              <label className="flex items-center gap-2 text-sm text-white/60">
                <input type="checkbox" checked disabled className="accent-vektrum-blue" />
                Milestone release conditions reviewed
              </label>
            </div>

            {/* Info box */}
            <div className="rounded-lg bg-vektrum-blue/[0.08] border border-vektrum-blue/20 px-4 py-3 mb-5">
              <p className="text-xs text-white/65 leading-relaxed">
                Funds will be held in a Vektrum Project Trust Account and released only when milestone conditions are met and AI review passes.
              </p>
            </div>

            {/* Footer */}
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
                onClick={handleConfirm}
                disabled={phase === 'loading'}
                className="flex-1 rounded-lg bg-vektrum-blue px-4 py-2 text-sm font-semibold text-white hover:bg-vektrum-blue-hover disabled:opacity-70 transition-colors"
              >
                {phase === 'loading' ? 'Processing...' : 'Confirm Funding'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
