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
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative max-w-md w-full mx-4 rounded-2xl bg-white shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Fund New Deal</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {phase === 'success' ? (
          <div className="text-center py-8">
            <CheckCircle2 size={48} className="text-green-500 mx-auto mb-3" />
            <p className="text-lg font-semibold text-green-700">Funding Confirmed!</p>
            <p className="text-sm text-gray-600 mt-1">
              {formatCurrency(4_750_000)} committed to Westside Medical Office Campus.
            </p>
          </div>
        ) : (
          <>
            {/* Funder */}
            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Funder</label>
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-700">
                Sarah Chen — Meridian Capital Partners
              </div>
            </div>

            {/* Deal */}
            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Deal</label>
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-700 cursor-not-allowed">
                Westside Medical Office Campus — {formatCurrency(4_750_000)}
              </div>
            </div>

            {/* Amount */}
            <div className="mb-5">
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Amount</label>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(4_750_000)}</p>
            </div>

            {/* Checkboxes */}
            <div className="space-y-2 mb-5">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked disabled className="accent-blue-600" />
                Funding terms acknowledged and accepted
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked disabled className="accent-blue-600" />
                Project Trust Account authorization confirmed
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked disabled className="accent-blue-600" />
                Milestone release conditions reviewed
              </label>
            </div>

            {/* Info box */}
            <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 mb-5">
              <p className="text-xs text-blue-700 leading-relaxed">
                Funds will be held in a Vektrum Project Trust Account and released only when milestone conditions are met and AI review passes.
              </p>
            </div>

            {/* Footer */}
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={phase === 'loading'}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-70 transition-colors"
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
