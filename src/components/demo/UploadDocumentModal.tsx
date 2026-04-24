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
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div className="relative max-w-md w-full mx-4 rounded-2xl bg-surface-2 border border-white/[0.08] shadow-2xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white">Upload Supporting Document</h2>
          <button type="button" onClick={onClose} className="text-white/65 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Drop zone */}
        <div className="border-2 border-dashed border-white/[0.15] rounded-xl p-8 text-center mb-5">
          <UploadCloud size={36} className="text-white/75 mx-auto mb-3" />
          <p className="text-sm font-medium text-white/70">Drag &amp; drop files here, or click to browse</p>
          <p className="text-xs text-white/75 mt-1">Supported: PDF, JPEG, PNG — max 25MB</p>
        </div>

        {/* Recently uploaded */}
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/75 mb-2">Recently uploaded</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
              Inspection_Report_April28.pdf
            </div>
            <div className="flex items-center gap-2 text-sm text-white/70">
              <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
              Lien_Waiver_WebbConstruction.pdf
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-lg bg-vektrum-blue px-4 py-2 text-sm font-semibold text-white hover:bg-vektrum-blue-hover transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  )
}
