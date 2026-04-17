'use client'

import { X, UploadCloud, CheckCircle2 } from 'lucide-react'

interface UploadDocumentModalProps {
  open: boolean
  onClose: () => void
}

export function UploadDocumentModal({ open, onClose }: UploadDocumentModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative max-w-md w-full mx-4 rounded-2xl bg-white shadow-2xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Upload Supporting Document</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Drop zone */}
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center mb-5">
          <UploadCloud size={36} className="text-gray-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700">Drag &amp; drop files here, or click to browse</p>
          <p className="text-xs text-gray-400 mt-1">Supported: PDF, JPEG, PNG — max 25MB</p>
        </div>

        {/* Recently uploaded */}
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Recently uploaded</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
              Inspection_Report_April28.pdf
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
              Lien_Waiver_WebbConstruction.pdf
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  )
}
