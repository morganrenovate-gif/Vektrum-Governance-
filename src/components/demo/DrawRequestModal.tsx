'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'

interface DrawRequestModalProps {
  open: boolean
  milestone: { name: string; amount: number }
  onConfirm: () => void
  onClose: () => void
}

export function DrawRequestModal({ open, milestone, onConfirm, onClose }: DrawRequestModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!open) return null

  function handleSubmit() {
    setIsSubmitting(true)
    setTimeout(() => {
      setIsSubmitting(false)
      onConfirm()
    }, 800)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      {/* Modal */}
      <div className="relative max-w-md w-full mx-4 rounded-2xl bg-surface-2 border border-white/[0.08] shadow-2xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white">Submit Draw Request</h2>
          <button type="button" onClick={onClose} className="text-white/35 hover:text-white/60 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Milestone info */}
        <div className="rounded-lg bg-surface-3 border border-white/[0.06] px-4 py-3 mb-4">
          <p className="text-sm font-medium text-white/80">{milestone.name}</p>
          <p className="text-lg font-bold text-vektrum-blue mt-1">{formatCurrency(milestone.amount)}</p>
        </div>

        {/* Checklist */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <span className="text-emerald-400">✓</span> Inspection report attached
          </div>
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <span className="text-emerald-400">✓</span> Lien waiver uploaded
          </div>
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <span className="text-emerald-400">✓</span> Amount matches approved scope
          </div>
        </div>

        {/* Notes */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-white/60 mb-1">Notes (optional)</label>
          <textarea
            className="w-full rounded-lg border border-white/[0.12] bg-surface-3 px-3 py-2 text-sm text-white/80 placeholder-white/25 focus:border-vektrum-blue/50 focus:outline-none focus:ring-1 focus:ring-vektrum-blue/30"
            placeholder="Add any notes for the funder..."
            rows={3}
          />
        </div>

        {/* Info note */}
        <p className="text-xs text-white/40 mb-5">
          Your funder will be notified and Vektrum AI will review this draw request before approval.
        </p>

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
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 rounded-lg bg-vektrum-blue px-4 py-2 text-sm font-semibold text-white hover:bg-vektrum-blue-hover disabled:opacity-70 transition-colors"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Draw Request'}
          </button>
        </div>
      </div>
    </div>
  )
}
