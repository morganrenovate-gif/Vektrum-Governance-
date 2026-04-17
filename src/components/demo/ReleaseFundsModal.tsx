'use client'

import { useState } from 'react'
import { X, CheckCircle2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'

interface ReleaseFundsModalProps {
  open: boolean
  milestone: { name: string; amount: number }
  onConfirm: () => void
  onClose: () => void
}

export function ReleaseFundsModal({ open, milestone, onConfirm, onClose }: ReleaseFundsModalProps) {
  const [phase, setPhase] = useState<'idle' | 'loading' | 'success'>('idle')

  if (!open) return null

  function handleRelease() {
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

  const conditions = [
    'Milestone approved by funder (Sarah Chen — April 3, 2025)',
    'AI draw review completed — score 87/100, low risk',
    'No open disputes on this milestone',
    'Lien waiver on file',
    'Inspection report attached',
    'Contractor Stripe account verified',
    `Funded balance sufficient (${formatCurrency(milestone.amount)} available)`,
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative max-w-md w-full mx-4 rounded-2xl bg-white shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Release Funds — 7-Condition Gate</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {phase === 'success' ? (
          <div className="text-center py-8">
            <CheckCircle2 size={48} className="text-green-500 mx-auto mb-3" />
            <p className="text-lg font-semibold text-green-700">Funds Released!</p>
            <p className="text-sm text-gray-600 mt-1">
              {formatCurrency(milestone.amount)} sent to Marcus Webb.
            </p>
          </div>
        ) : (
          <>
            {/* 7 conditions */}
            <div className="space-y-2.5 mb-5">
              {conditions.map((c, i) => (
                <div key={i} className="flex items-start gap-2.5 text-sm">
                  <span className="text-green-600 font-semibold flex-shrink-0">{i + 1}.</span>
                  <span className="text-green-600 flex-shrink-0">✓</span>
                  <span className="text-gray-700">{c}</span>
                </div>
              ))}
            </div>

            {/* Green callout */}
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 mb-5">
              <p className="text-sm font-medium text-green-700">
                All 7 conditions satisfied. Funds are ready to release.
              </p>
            </div>

            {/* Amount & recipient */}
            <div className="mb-5">
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(milestone.amount)}</p>
              <p className="text-sm text-gray-600 mt-1">To: Marcus Webb — Webb Construction Group</p>
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
                onClick={handleRelease}
                disabled={phase === 'loading'}
                className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-70 transition-colors"
              >
                {phase === 'loading' ? 'Releasing...' : `Release ${formatCurrency(milestone.amount)}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
