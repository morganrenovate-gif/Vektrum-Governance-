'use client'

import { useState } from 'react'
import { X, CheckCircle2 } from 'lucide-react'

interface ResolveDisputeModalProps {
  open: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ResolveDisputeModal({ open, onConfirm, onClose }: ResolveDisputeModalProps) {
  const [phase, setPhase] = useState<'idle' | 'loading' | 'success'>('idle')
  const [resolution, setResolution] = useState('reject')

  if (!open) return null

  function handleResolve() {
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

  const resolutionOptions = [
    { value: 'reject', label: 'Reject Claim', desc: "Funder's position upheld. $487,000 returned to funded balance." },
    { value: 'partial', label: 'Partial Release', desc: 'Negotiate a partial amount.' },
    { value: 'full', label: 'Full Release', desc: 'Release full disputed amount to contractor.' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative max-w-md w-full mx-4 rounded-2xl bg-white shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Resolve Dispute — HVAC Equipment Procurement</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {phase === 'success' ? (
          <div className="text-center py-8">
            <CheckCircle2 size={48} className="text-green-500 mx-auto mb-3" />
            <p className="text-lg font-semibold text-gray-800">Dispute Resolved.</p>
            <p className="text-sm text-gray-600 mt-1">
              Harbor Logistics Center — HVAC milestone marked as rejected.
            </p>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 mb-5">
              <p className="text-sm font-medium text-red-700">
                $487,000 disputed &middot; 3 days ago &middot; Priority 1
              </p>
            </div>

            {/* Resolution options */}
            <div className="space-y-2 mb-4">
              {resolutionOptions.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    resolution === opt.value ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="resolution"
                    value={opt.value}
                    checked={resolution === opt.value}
                    onChange={() => setResolution(opt.value)}
                    className="mt-0.5 accent-red-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>

            {/* Reason textarea */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Rejection Reason</label>
              <textarea
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                rows={3}
                defaultValue="Invoice amount does not reconcile with change order CO-004. The $487,000 overage was not pre-approved. Contractor must resubmit with revised scope documentation."
              />
            </div>

            {/* Notify checkbox */}
            <label className="flex items-center gap-2 text-sm text-gray-600 mb-5">
              <input type="checkbox" checked disabled className="accent-red-600" />
              Notify both parties via email
            </label>

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
                onClick={handleResolve}
                disabled={phase === 'loading'}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-70 transition-colors"
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
