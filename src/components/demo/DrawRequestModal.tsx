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
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative max-w-md w-full mx-4 rounded-2xl bg-white shadow-2xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Submit Draw Request</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Milestone info */}
        <div className="rounded-lg bg-gray-50 px-4 py-3 mb-4">
          <p className="text-sm font-medium text-gray-700">{milestone.name}</p>
          <p className="text-lg font-bold text-blue-600 mt-1">{formatCurrency(milestone.amount)}</p>
        </div>

        {/* Checklist */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-green-700">
            <span className="text-green-600">✓</span> Inspection report attached
          </div>
          <div className="flex items-center gap-2 text-sm text-green-700">
            <span className="text-green-600">✓</span> Lien waiver uploaded
          </div>
          <div className="flex items-center gap-2 text-sm text-green-700">
            <span className="text-green-600">✓</span> Amount matches approved scope
          </div>
        </div>

        {/* Notes */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
          <textarea
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Add any notes for the funder..."
            rows={3}
          />
        </div>

        {/* Info note */}
        <p className="text-xs text-gray-400 mb-5">
          Your funder will be notified and Vektrum AI will review this draw request before approval.
        </p>

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
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-70 transition-colors"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Draw Request'}
          </button>
        </div>
      </div>
    </div>
  )
}
