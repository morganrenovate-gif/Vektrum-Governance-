'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  FileText,
  Upload,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  Download,
  PenLine,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import type { Contract, ContractStatus, UserRole } from '@/lib/types'

interface ContractPanelProps {
  dealId:        string
  userRole:      UserRole
  userId:        string
  dealFunderId:  string | null
  dealContractorId: string
  /** Called after the contract reaches 'signed' status */
  onContractSigned?: () => void
}

// ─── Status helpers ───────────────────────────────────────────────────────────

function statusLabel(status: ContractStatus | null): string {
  switch (status) {
    case null:                return 'No contract'
    case 'pending_signatures': return 'Awaiting signatures'
    case 'funder_signed':     return 'Funder signed — awaiting contractor'
    case 'contractor_signed': return 'Contractor signed — awaiting funder'
    case 'signed':            return 'Fully executed'
    case 'voided':            return 'Voided'
    default:                  return 'Unknown'
  }
}

function isSigned(status: ContractStatus | null): boolean {
  return status === 'signed'
}

// ─── File size formatter ──────────────────────────────────────────────────────

function formatBytes(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1_048_576)   return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1_048_576).toFixed(1)} MB`
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ContractPanel({
  dealId,
  userRole,
  userId,
  dealFunderId,
  dealContractorId,
  onContractSigned,
}: ContractPanelProps) {
  const [contract,    setContract]    = useState<Contract | null | undefined>(undefined) // undefined = loading
  const [uploading,   setUploading]   = useState(false)
  const [signing,     setSigning]     = useState(false)
  const [dragActive,  setDragActive]  = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Load contract on mount ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await fetch(`/api/deals/${dealId}/contract`)
      if (!res.ok) { if (!cancelled) setContract(null); return }
      const json = await res.json() as { contract: Contract | null }
      if (!cancelled) {
        setContract(json.contract)
        if (json.contract?.status === 'signed') onContractSigned?.()
      }
    }
    load()
    return () => { cancelled = true }
  }, [dealId, onContractSigned])

  // ── Polling: refresh every 15s while waiting for signatures ────────────────
  useEffect(() => {
    if (!contract || isSigned(contract.status) || contract.status === 'voided') return
    const id = setInterval(async () => {
      const res = await fetch(`/api/deals/${dealId}/contract`)
      if (!res.ok) return
      const json = await res.json() as { contract: Contract | null }
      if (json.contract) {
        setContract(json.contract)
        if (json.contract.status === 'signed') {
          clearInterval(id)
          onContractSigned?.()
        }
      }
    }, 15_000)
    return () => clearInterval(id)
  }, [contract, dealId, onContractSigned])

  // ── Upload handler ──────────────────────────────────────────────────────────
  const handleUpload = useCallback(async (file: File) => {
    setUploadError(null)

    if (file.type !== 'application/pdf') {
      setUploadError('Only PDF files are accepted.')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setUploadError('File must be under 20 MB.')
      return
    }

    setUploading(true)
    try {
      const body = new FormData()
      body.append('file', file)

      const res = await fetch(`/api/deals/${dealId}/contract`, {
        method: 'POST',
        body,
      })

      const json = await res.json()
      if (!res.ok) {
        setUploadError(json.error ?? 'Upload failed. Please try again.')
        return
      }

      // Reload the full contract record (with signed URL)
      const reload = await fetch(`/api/deals/${dealId}/contract`)
      if (reload.ok) {
        const reloaded = await reload.json() as { contract: Contract | null }
        setContract(reloaded.contract)
      }
    } catch {
      setUploadError('Network error. Please check your connection and try again.')
    } finally {
      setUploading(false)
    }
  }, [dealId])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }

  // ── Sign handler ─────────────────────────────────────────────────────────────
  const handleSignNow = useCallback(async () => {
    setSigning(true)
    try {
      const returnUrl = `${window.location.origin}/dashboard/deals/${dealId}?contract_event=signing_complete`

      const res = await fetch(`/api/deals/${dealId}/contract/sign`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ returnUrl }),
      })

      const json = await res.json()
      if (!res.ok) {
        alert(json.error ?? 'Could not generate signing URL. Please try again.')
        return
      }

      // Open signing session in a new tab
      window.open(json.signing_url, '_blank', 'noopener,noreferrer')
    } catch {
      alert('Network error. Please try again.')
    } finally {
      setSigning(false)
    }
  }, [dealId])

  // ── Derived state ─────────────────────────────────────────────────────────────
  const isFunder     = userRole === 'funder'     || userId === dealFunderId
  const isContractor = userRole === 'contractor' || userId === dealContractorId
  const isAdmin      = userRole === 'admin'

  const canUpload = (isContractor || isAdmin) && (!contract || contract.status === 'voided')

  const canSign = (() => {
    if (!contract || isSigned(contract.status) || contract.status === 'voided') return false
    if (!contract.docusign_envelope_id) return false
    if (isFunder     && !contract.funder_signed_at)     return true
    if (isContractor && !contract.contractor_signed_at &&
        contract.funder_signed_at)                      return true
    return false
  })()

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (contract === undefined) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2.5">
        <FileText size={16} className="text-gray-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">Project Contract</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {isSigned(contract?.status ?? null)
              ? 'Fully executed — deal is cleared for funding'
              : 'Required before funding is enabled'}
          </p>
        </div>
        {/* Status badge */}
        <StatusBadge status={contract?.status ?? null} />
      </div>

      <div className="p-5 space-y-4">

        {/* ── No contract yet: upload prompt ──────────────────────── */}
        {!contract && canUpload && (
          <UploadZone
            dragActive={dragActive}
            uploading={uploading}
            uploadError={uploadError}
            onDragOver={e => { e.preventDefault(); setDragActive(true) }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClickBrowse={() => fileInputRef.current?.click()}
          />
        )}

        {/* ── No contract + funder view ─────────────────────────── */}
        {!contract && !canUpload && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
            <div className="flex items-start gap-2">
              <Clock size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                Waiting for the contractor to upload the contract PDF.
                You will be able to sign once it has been uploaded.
              </p>
            </div>
          </div>
        )}

        {/* ── Contract exists ───────────────────────────────────── */}
        {contract && (
          <>
            {/* Document info */}
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
                <FileText size={14} className="text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {contract.document_name}
                </p>
                <p className="text-xs text-gray-400">
                  {formatBytes(contract.document_size_bytes)}
                  {contract.document_url && (
                    <>
                      {' · '}
                      <a
                        href={contract.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        View PDF
                      </a>
                    </>
                  )}
                  {contract.signed_document_url && (
                    <>
                      {' · '}
                      <a
                        href={contract.signed_document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 hover:underline"
                      >
                        Download signed copy
                      </a>
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Signature status rows */}
            <SignatureStatus
              funderSignedAt={contract.funder_signed_at}
              contractorSignedAt={contract.contractor_signed_at}
            />

            {/* Sign Now button */}
            {canSign && (
              <button
                type="button"
                onClick={handleSignNow}
                disabled={signing}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60 transition-colors"
              >
                {signing
                  ? <Loader2 size={14} className="animate-spin" />
                  : <PenLine size={14} />
                }
                {signing ? 'Opening signing session…' : 'Sign Contract Now'}
              </button>
            )}

            {/* Waiting message for the party that has already signed */}
            {!canSign && !isSigned(contract.status) && contract.status !== 'voided' && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
                <div className="flex items-start gap-2">
                  <Clock size={14} className="text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-800">
                    {isFunder && contract.funder_signed_at
                      ? 'You have signed. Waiting for the contractor to countersign.'
                      : isContractor && contract.contractor_signed_at
                        ? 'You have countersigned. Waiting for the funder to sign.'
                        : isContractor && !contract.funder_signed_at
                          ? 'The funder must sign first. You will be notified when it is your turn.'
                          : 'Waiting for signatures.'}
                  </p>
                </div>
              </div>
            )}

            {/* Voided contract: upload new one */}
            {contract.status === 'voided' && (canUpload) && (
              <div className="space-y-3">
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                  <div className="flex items-start gap-2">
                    <XCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-800">Contract voided</p>
                      {contract.void_reason && (
                        <p className="text-xs text-red-700 mt-0.5">{contract.void_reason}</p>
                      )}
                    </div>
                  </div>
                </div>
                <UploadZone
                  dragActive={dragActive}
                  uploading={uploading}
                  uploadError={uploadError}
                  label="Upload replacement contract"
                  onDragOver={e => { e.preventDefault(); setDragActive(true) }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                  onClickBrowse={() => fileInputRef.current?.click()}
                />
              </div>
            )}

            {/* Fully signed */}
            {isSigned(contract.status) && (
              <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-green-600 flex-shrink-0" />
                  <p className="text-sm font-medium text-green-800">
                    Contract fully executed. Funding is now enabled.
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {uploadError && (
          <p className="text-sm text-red-600 flex items-center gap-1.5">
            <AlertTriangle size={13} className="flex-shrink-0" />
            {uploadError}
          </p>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFileChange}
        aria-hidden="true"
      />
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ContractStatus | null }) {
  const base = 'text-[11px] font-semibold px-2 py-0.5 rounded-full border'

  if (!status || status === 'pending_signatures') {
    return (
      <span className={`${base} bg-amber-50 border-amber-200 text-amber-700`}>
        {status ? 'Pending' : 'Required'}
      </span>
    )
  }
  if (status === 'signed') {
    return (
      <span className={`${base} bg-green-50 border-green-200 text-green-700`}>
        Signed
      </span>
    )
  }
  if (status === 'voided') {
    return (
      <span className={`${base} bg-red-50 border-red-200 text-red-700`}>
        Voided
      </span>
    )
  }
  // funder_signed | contractor_signed
  return (
    <span className={`${base} bg-blue-50 border-blue-200 text-blue-700`}>
      Partial
    </span>
  )
}

function SignatureStatus({
  funderSignedAt,
  contractorSignedAt,
}: {
  funderSignedAt:     string | null
  contractorSignedAt: string | null
}) {
  return (
    <div className="rounded-lg border border-gray-100 divide-y divide-gray-100 overflow-hidden">
      <SignerRow
        label="Funder"
        routingOrder={1}
        signedAt={funderSignedAt}
      />
      <SignerRow
        label="Contractor"
        routingOrder={2}
        signedAt={contractorSignedAt}
        waitingFor={!funderSignedAt ? 'Funder must sign first' : undefined}
      />
    </div>
  )
}

function SignerRow({
  label,
  routingOrder,
  signedAt,
  waitingFor,
}: {
  label:        string
  routingOrder: number
  signedAt:     string | null
  waitingFor?:  string
}) {
  return (
    <div className="px-4 py-3 flex items-center gap-3">
      <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
        {signedAt ? (
          <CheckCircle2 size={16} className="text-green-500" />
        ) : (
          <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800">
          {label}
          <span className="ml-1.5 text-xs font-normal text-gray-400">
            (signs {routingOrder === 1 ? 'first' : 'second'})
          </span>
        </p>
        {signedAt ? (
          <p className="text-xs text-gray-500">
            Signed {new Date(signedAt).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
              hour: 'numeric', minute: '2-digit',
            })}
          </p>
        ) : waitingFor ? (
          <p className="text-xs text-gray-400">{waitingFor}</p>
        ) : (
          <p className="text-xs text-gray-400">Awaiting signature</p>
        )}
      </div>
    </div>
  )
}

function UploadZone({
  dragActive,
  uploading,
  uploadError,
  label = 'Upload contract PDF',
  onDragOver,
  onDragLeave,
  onDrop,
  onClickBrowse,
}: {
  dragActive:    boolean
  uploading:     boolean
  uploadError:   string | null
  label?:        string
  onDragOver:    (e: React.DragEvent) => void
  onDragLeave:   () => void
  onDrop:        (e: React.DragEvent) => void
  onClickBrowse: () => void
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`
        relative rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors cursor-pointer
        ${dragActive
          ? 'border-gray-400 bg-gray-100'
          : uploadError
            ? 'border-red-300 bg-red-50'
            : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100'
        }
      `}
      onClick={onClickBrowse}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClickBrowse()}
      aria-label={label}
    >
      {uploading ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 size={22} className="text-gray-400 animate-spin" />
          <p className="text-sm font-medium text-gray-600">Uploading…</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Upload size={22} className={dragActive ? 'text-gray-600' : 'text-gray-400'} />
          <div>
            <p className="text-sm font-medium text-gray-700">{label}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              PDF only · max 20 MB · drag and drop or click to browse
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
