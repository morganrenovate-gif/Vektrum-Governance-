'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileText, CheckCircle2, AlertCircle } from 'lucide-react'
import { CONTRACT_PICKER_EVENT } from './upload-contract-trigger'

// ─── ContractUploadSection ────────────────────────────────────────────────────
//
// Client component that renders a PDF upload form for the deal contract.
// Mounted at id="contract-upload" so "Upload Contract" trigger buttons can
// scroll here and dispatch CONTRACT_PICKER_EVENT to open the file picker.
//
// Props:
//   dealId  — the deal to attach the contract to
//
// Access: rendered only when !hasContract && role === 'contractor' | 'admin'.
// The parent (deal page) controls the render condition; this component does
// not re-check role — it trusts the caller.

interface ContractUploadSectionProps {
  dealId: string
}

type UploadState = 'idle' | 'uploading' | 'success' | 'error'

const MAX_FILE_BYTES = 20 * 1024 * 1024   // 20 MB

export function ContractUploadSection({ dealId }: ContractUploadSectionProps) {
  const router    = useRouter()
  const inputRef  = useRef<HTMLInputElement>(null)

  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null)
  const [fileName,    setFileName]    = useState<string | null>(null)

  // Listen for CONTRACT_PICKER_EVENT dispatched by UploadContractTrigger buttons
  // elsewhere on the page (setup card, SOV empty state). When received, open
  // the hidden file input — same as clicking "Select Contract PDF" directly.
  useEffect(() => {
    const handleOpen = () => {
      if (uploadState !== 'uploading' && uploadState !== 'success') {
        inputRef.current?.click()
      }
    }
    window.addEventListener(CONTRACT_PICKER_EVENT, handleOpen)
    return () => window.removeEventListener(CONTRACT_PICKER_EVENT, handleOpen)
  }, [uploadState])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Client-side validation before hitting the server
    if (file.type !== 'application/pdf') {
      setErrorMsg('Only PDF files are accepted. Please select a .pdf file.')
      setUploadState('error')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setErrorMsg('File exceeds the 20 MB limit. Please upload a smaller file.')
      setUploadState('error')
      return
    }

    setFileName(file.name)
    setUploadState('uploading')
    setErrorMsg(null)

    const fd = new FormData()
    fd.append('file', file)

    try {
      const res  = await fetch(`/api/deals/${dealId}/contracts`, {
        method: 'POST',
        body:   fd,
      })
      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error ?? 'Upload failed. Please try again.')
        setUploadState('error')
      } else {
        setUploadState('success')
        // Refresh server component data so the contract status indicator
        // and setup card update without a hard reload.
        router.refresh()
      }
    } catch {
      setErrorMsg('Network error. Please check your connection and try again.')
      setUploadState('error')
    } finally {
      // Reset file input so the same file can be re-selected after an error
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <section
      id="contract-upload"
      aria-label="Upload contract"
      className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
        <div className="h-px w-5 bg-vektrum-blue flex-shrink-0" aria-hidden="true" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-300">
          Upload Contract
        </p>
      </div>

      <div className="px-5 py-5 space-y-4">
        {/* Description */}
        <p className="text-[13px] text-white/65 leading-relaxed">
          Upload the executed contract PDF. Once uploaded, both parties will need to sign
          via DocuSign before milestone releases are authorized. PDF only · max 20 MB.
        </p>

        {/* Success state */}
        {uploadState === 'success' && (
          <div className="flex items-center gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3">
            <CheckCircle2 size={15} className="flex-shrink-0 text-emerald-400" aria-hidden="true" />
            <p className="text-[13px] text-emerald-400 font-medium">
              {fileName ? `"${fileName}" uploaded successfully.` : 'Contract uploaded successfully.'}
              {' '}The contract status will update momentarily.
            </p>
          </div>
        )}

        {/* Error state */}
        {uploadState === 'error' && errorMsg && (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-500/20 bg-red-500/[0.06] px-4 py-3">
            <AlertCircle size={15} className="flex-shrink-0 text-red-400 mt-0.5" aria-hidden="true" />
            <p className="text-[13px] text-red-400">{errorMsg}</p>
          </div>
        )}

        {/* Upload button / uploading state */}
        {uploadState !== 'success' && (
          <div>
            <input
              ref={inputRef}
              id="contract-file-input"
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              onChange={handleFileChange}
              disabled={uploadState === 'uploading'}
              aria-label="Select contract PDF file"
            />
            <label
              htmlFor="contract-file-input"
              className={[
                'inline-flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-medium cursor-pointer transition-colors',
                uploadState === 'uploading'
                  ? 'bg-white/[0.04] text-white/30 cursor-not-allowed pointer-events-none'
                  : 'bg-vektrum-blue/15 text-blue-300 border border-vektrum-blue/30 hover:bg-vektrum-blue/20',
              ].join(' ')}
            >
              {uploadState === 'uploading' ? (
                <>
                  <Upload size={14} aria-hidden="true" className="animate-pulse" />
                  Uploading…
                </>
              ) : (
                <>
                  <FileText size={14} aria-hidden="true" />
                  Select Contract PDF
                </>
              )}
            </label>
          </div>
        )}

        {/* Re-upload after error */}
        {uploadState === 'error' && (
          <button
            type="button"
            onClick={() => { setUploadState('idle'); setErrorMsg(null) }}
            className="text-[12px] text-white/40 underline hover:text-white/60 transition-colors"
          >
            Try again
          </button>
        )}
      </div>
    </section>
  )
}
