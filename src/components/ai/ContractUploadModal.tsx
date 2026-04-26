'use client'

import { useRef, useState } from 'react'
import { Upload, X, FileText, AlertCircle } from 'lucide-react'
import type { ContractAnalysisResult, DealMetadata } from '@/lib/actions/analyze-contract'

export type { ContractAnalysisResult, DealMetadata }

type Props = {
  metadata: DealMetadata
  onSuccess: (result: ContractAnalysisResult) => void
  onClose: () => void
}

type UploadState = 'idle' | 'selected' | 'analyzing' | 'error'

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

    try {
      const formData = new FormData()
      formData.append('contract', file)
      formData.append('metadata', JSON.stringify(metadata))

      const res = await fetch('/api/analyze-contract', {
        method: 'POST',
        body: formData,
      })

      const result = await res.json()

      if (!res.ok || !result.success) {
        setState('error')
        setError(result.error || 'Analysis failed. Please try again.')
        return
      }

      onSuccess(result.data)
    } catch (err) {
      console.error('[ContractUploadModal] analyze failed:', err)
      setState('error')
      setError('Analysis failed. Please try again or enter milestones manually.')
    }
  }

  const fileSizeMB = file ? (file.size / 1024 / 1024).toFixed(1) : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && state !== 'analyzing') onClose()
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/[0.08] bg-surface-2 shadow-feature">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <div>
            <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-300">
              AI Contract Import
            </p>
            <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-white">
              Upload construction contract
            </h2>
          </div>

          {state !== 'analyzing' && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-1.5 text-white/65 transition-colors hover:bg-white/[0.06] hover:text-white/70"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="space-y-4 p-6">
          {state === 'analyzing' ? (
            // ── Analyzing state ──────────────────────────────────────────────
            <div className="flex flex-col items-center justify-center space-y-5 py-10">
              <div className="relative">
                <div className="h-12 w-12 animate-spin rounded-full border-2 border-vektrum-blue/20 border-t-vektrum-blue" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <FileText size={16} className="text-blue-400" />
                </div>
              </div>

              <div className="text-center">
                <p className="text-[14px] font-semibold text-white">
                  Analyzing your contract…
                </p>
                <p className="mt-1 text-[12px] text-white/75">
                  Extracting milestones, conditions, and retainage terms
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* ── Drop zone ─────────────────────────────────────────────── */}
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 transition-all ${
                  dragOver
                    ? 'border-vektrum-blue bg-vektrum-blue/[0.08]'
                    : state === 'selected'
                      ? 'border-vektrum-blue/40 bg-vektrum-blue/[0.04]'
                      : 'border-white/[0.1] hover:border-vektrum-blue/40 hover:bg-white/[0.03]'
                }`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleFile(f)
                  }}
                />

                {state === 'selected' && file ? (
                  <>
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-vektrum-blue/15">
                      <FileText size={20} className="text-blue-400" />
                    </div>
                    <p className="text-[14px] font-semibold text-white">{file.name}</p>
                    <p className="mt-0.5 text-[12px] text-white/75">{fileSizeMB} MB · PDF</p>
                    <p className="mt-2 text-[11px] text-white/65">
                      Click to choose a different file
                    </p>
                  </>
                ) : (
                  <>
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.08]">
                      <Upload size={20} className="text-white/65" />
                    </div>
                    <p className="text-[14px] font-semibold text-white/80">
                      Drop contract PDF here
                    </p>
                    <p className="mt-1 text-[12px] text-white/75">
                      or click to browse · PDF only · max 20MB
                    </p>
                  </>
                )}
              </div>

              {/* ── Error ─────────────────────────────────────────────────── */}
              {error && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/[0.07] px-4 py-3">
                  <AlertCircle size={14} className="mt-0.5 flex-shrink-0 text-red-400" />
                  <div>
                    <p className="text-[13px] text-red-400">{error}</p>
                    {state === 'error' && (
                      <button
                        type="button"
                        onClick={() => {
                          setState('idle')
                          setFile(null)
                          setError(null)
                        }}
                        className="mt-1 text-[12px] text-red-400/60 underline hover:text-red-400 transition-colors"
                      >
                        Try again or enter milestones manually
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ── What gets extracted ────────────────────────────────────── */}
              <div className="space-y-1 rounded-xl border border-white/[0.06] bg-surface-3 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/65">
                  What gets extracted
                </p>
                {[
                  'Project phases and payment amounts',
                  'Completion conditions per phase',
                  'Retainage terms and lien waiver requirements',
                  'Change order provisions',
                ].map((item) => (
                  <p key={item} className="text-[12px] text-white/50">
                    · {item}
                  </p>
                ))}
                <p className="pt-1 text-[11px] text-white/65">
                  Contract text is processed and discarded. Only the milestone structure is saved.
                </p>
              </div>

              {/* ── Actions ───────────────────────────────────────────────── */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={state !== 'selected'}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-vektrum-blue px-5 py-3 text-[14px] font-semibold text-white shadow-lg shadow-vektrum-blue/25 transition-all hover:bg-vektrum-blue-hover disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <FileText size={14} />
                  Analyze contract
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-3 text-[14px] font-semibold text-white/60 transition-all hover:bg-white/[0.07] hover:text-white"
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
