'use client'

import { useRef, useState } from 'react'
import { Upload, X, FileText, AlertCircle } from 'lucide-react'
import { analyzeContract } from '@/lib/actions/analyze-contract'
import type { ContractAnalysisResult, DealMetadata } from '@/lib/actions/analyze-contract'

// ── Types ─────────────────────────────────────────────────────────────────────

export type { ContractAnalysisResult, DealMetadata }

type Props = {
  metadata: DealMetadata
  onSuccess: (result: ContractAnalysisResult) => void
  onClose: () => void
}

type UploadState = 'idle' | 'selected' | 'analyzing' | 'error'

// ── Component ─────────────────────────────────────────────────────────────────

export function ContractUploadModal({ metadata, onSuccess, onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<UploadState>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  function handleFile(f: File) {
    if (f.type !== 'application/pdf') {
      setError('Only PDF files are supported.')
      return
    }
    if (f.size > 20 * 1024 * 1024) {
      setError('File must be under 20MB.')
      return
    }
    setError(null)
    setFile(f)
    setState('selected')
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  async function handleAnalyze() {
    if (!file) return
    setState('analyzing')
    setError(null)

    const formData = new FormData()
    formData.append('contract', file)
    formData.append('metadata', JSON.stringify(metadata))

    const result = await analyzeContract(formData)

    if (result.success) {
      onSuccess(result.data)
    } else {
      setState('error')
      setError(result.error)
    }
  }

  const fileSizeMB = file ? (file.size / 1024 / 1024).toFixed(1) : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget && state !== 'analyzing') onClose() }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-vektrum-border bg-vektrum-surface shadow-2xl shadow-black/40 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-vektrum-border">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-vektrum-blue mb-0.5">
              AI Contract Import
            </p>
            <h2 className="text-[16px] font-semibold text-vektrum-text tracking-[-0.01em]">
              Upload construction contract
            </h2>
          </div>
          {state !== 'analyzing' && (
            <button onClick={onClose} className="text-vektrum-faint hover:text-vektrum-text transition-colors">
              <X size={18} />
            </button>
          )}
        </div>

        <div className="p-6 space-y-4">

          {state === 'analyzing' ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-4">
              <div className="relative">
                <div className="h-12 w-12 rounded-full border-2 border-vektrum-blue/20 border-t-vektrum-blue animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <FileText size={16} className="text-vektrum-blue" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-[14px] font-semibold text-vektrum-text">
                  Perplexity Computer is reading your contract...
                </p>
                <p className="text-[12px] text-vektrum-muted mt-1">
                  Extracting milestones, conditions, and retainage terms
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 cursor-pointer transition-all ${
                  dragOver
                    ? 'border-vektrum-blue bg-vektrum-blue/5'
                    : state === 'selected'
                    ? 'border-vektrum-blue/40 bg-vektrum-blue/[0.03]'
                    : 'border-vektrum-border hover:border-vektrum-blue/40 hover:bg-vektrum-surface-alt'
                }`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                />
                {state === 'selected' && file ? (
                  <>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-vektrum-blue/10 mb-3">
                      <FileText size={20} className="text-vektrum-blue" />
                    </div>
                    <p className="text-[14px] font-semibold text-vektrum-text">{file.name}</p>
                    <p className="text-[12px] text-vektrum-muted mt-0.5">{fileSizeMB} MB · PDF</p>
                    <p className="text-[11px] text-vektrum-faint mt-2">Click to choose a different file</p>
                  </>
                ) : (
                  <>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-vektrum-surface-alt mb-3">
                      <Upload size={20} className="text-vektrum-faint" />
                    </div>
                    <p className="text-[14px] font-semibold text-vektrum-text">Drop contract PDF here</p>
                    <p className="text-[12px] text-vektrum-muted mt-1">or click to browse · PDF only · max 20MB</p>
                  </>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
                  <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[13px] text-red-400">{error}</p>
                    {state === 'error' && (
                      <button
                        onClick={() => { setState('idle'); setFile(null); setError(null) }}
                        className="text-[12px] text-red-400/70 hover:text-red-400 mt-1 underline"
                      >
                        Try again or enter milestones manually
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-vektrum-border/50 bg-vektrum-bg px-4 py-3 space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-vektrum-faint">
                  What gets extracted
                </p>
                {[
                  'Project phases and payment amounts',
                  'Completion conditions per phase',
                  'Retainage terms and lien waiver requirements',
                  'Change order provisions',
                ].map((item) => (
                  <p key={item} className="text-[12px] text-vektrum-muted">· {item}</p>
                ))}
                <p className="text-[11px] text-vektrum-faint pt-1">
                  Contract text is processed and discarded. Only the milestone structure is saved.
                </p>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleAnalyze}
                  disabled={state !== 'selected'}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-vektrum-blue px-5 py-3 text-[14px] font-semibold text-white shadow-lg shadow-vektrum-blue/25 hover:bg-vektrum-blue-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <FileText size={14} />
                  Analyze contract
                </button>
                <button
                  onClick={onClose}
                  className="rounded-xl border border-vektrum-border px-4 py-3 text-[14px] font-semibold text-vektrum-muted hover:bg-vektrum-surface-alt transition-all"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
