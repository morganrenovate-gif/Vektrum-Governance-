'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PenLine, Send, ExternalLink, CheckCircle2, Clock,
  AlertCircle, Loader2,
} from 'lucide-react'
import type { ContractStatus } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContractSigningSectionProps {
  dealId:             string
  contractId:         string
  /** null when the contract was uploaded without triggering DocuSign yet */
  envelopeId:         string | null
  funderSignedAt:     string | null
  contractorSignedAt: string | null
  contractStatus:     ContractStatus
  /** 'funder' | 'contractor' | 'admin' — drives which actions are shown */
  currentUserRole:    'funder' | 'contractor' | 'admin'
  documentName:       string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ContractSigningSection({
  dealId,
  contractId: _contractId,
  envelopeId,
  funderSignedAt,
  contractorSignedAt,
  contractStatus: _contractStatus,
  currentUserRole,
  documentName,
}: ContractSigningSectionProps) {
  const router = useRouter()

  const [loading, setLoading]               = useState(false)
  const [error,   setError]                 = useState<string | null>(null)
  // Optimistic state: once the user sends the envelope in this session,
  // show the new envelope ID without waiting for a full page reload.
  const [localEnvelopeId, setLocalEnvelopeId] = useState<string | null>(envelopeId)

  const isFunder     = currentUserRole === 'funder'
  const isContractor = currentUserRole === 'contractor'
  const isAdmin      = currentUserRole === 'admin'

  const funderDone     = !!funderSignedAt
  const contractorDone = !!contractorSignedAt

  // Signing-turn logic — must match server-side rules in /contract/sign
  const funderTurn     = isFunder     && !funderDone
  const contractorTurn = isContractor && funderDone && !contractorDone
  const waitingOnFunder     = isContractor && !funderDone
  const waitingOnContractor = isFunder     && funderDone && !contractorDone

  // Primary action visibility
  // Funders are authorized to initiate signing in funder-led workflows where
  // the funder uploads the governing contract or funding document.
  const showSendEnvelope = !localEnvelopeId && (isContractor || isAdmin || isFunder)
  const showOpenDocuSign = !!localEnvelopeId && (funderTurn || contractorTurn)

  // ── Actions ─────────────────────────────────────────────────────────────────

  async function handleSendEnvelope() {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/deals/${dealId}/contract/send-envelope`, { method: 'POST' })
      const data = await res.json() as { envelope_id?: string; error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Failed to send the envelope. Please try again.')
        return
      }
      setLocalEnvelopeId(data.envelope_id ?? null)
      router.refresh()
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleOpenDocuSign() {
    setLoading(true)
    setError(null)
    try {
      const returnUrl = window.location.href
      const res = await fetch(`/api/deals/${dealId}/contract/sign`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ returnUrl }),
      })
      const data = await res.json() as { signing_url?: string; error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Could not open DocuSign. Please try again.')
        return
      }
      if (!data.signing_url) {
        setError('DocuSign did not return a signing URL. Please try again.')
        return
      }
      // Redirect immediately — the one-time URL expires in ~5 minutes
      window.location.href = data.signing_url
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-5 py-3.5">
        <PenLine size={14} className="text-blue-400 flex-shrink-0" aria-hidden="true" />
        <p className="text-[13px] font-semibold text-white">Contract Signatures</p>
        <span className="ml-auto text-[11px] text-amber-400/80 font-medium">Pending</span>
      </div>

      <div className="px-5 py-4 space-y-4">

        {/* Filename */}
        <p className="text-[12px] text-white/40 truncate" title={documentName}>
          {documentName}
        </p>

        {/* Signer status rows */}
        <div className="space-y-2">
          <SignerRow
            label="Funder"
            signedAt={funderSignedAt}
            isActiveParty={isFunder && !funderDone && !!localEnvelopeId}
          />
          <SignerRow
            label="Contractor"
            signedAt={contractorSignedAt}
            isActiveParty={isContractor && funderDone && !contractorDone && !!localEnvelopeId}
          />
        </div>

        {/* DocuSign envelope status */}
        {localEnvelopeId ? (
          <div className="flex items-center gap-1.5 text-[11px] text-white/30">
            <span>DocuSign envelope active</span>
            <span aria-hidden="true">·</span>
            <span
              className="font-mono truncate max-w-[160px]"
              title={localEnvelopeId}
              aria-label={`Envelope ID: ${localEnvelopeId}`}
            >
              {localEnvelopeId.slice(0, 8)}…
            </span>
          </div>
        ) : (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2.5 space-y-1">
            <div className="flex items-center gap-1.5">
              <AlertCircle size={11} className="text-amber-400/80 flex-shrink-0" aria-hidden="true" />
              <span className="text-[11px] font-semibold text-amber-400/80">
                Contract uploaded — signatures not sent
              </span>
            </div>
            <p className="text-[11px] text-white/40 leading-relaxed">
              This contract has been added to the deal, but no signature request has been sent yet.
              Milestone releases remain blocked until the required parties complete signing.
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2.5"
          >
            <AlertCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-[12px] text-red-400 leading-relaxed">{error}</p>
          </div>
        )}

        {/* Primary actions */}
        <div className="flex flex-col gap-2.5">

          {/* Funder / contractor / admin: send envelope when none exists */}
          {showSendEnvelope && (
            <button
              type="button"
              onClick={handleSendEnvelope}
              disabled={loading}
              className="inline-flex items-center gap-2 justify-center rounded-lg bg-vektrum-blue px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-vektrum-blue-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                : <Send    size={14} aria-hidden="true" />
              }
              {loading ? 'Sending…' : 'Send for DocuSign Signatures'}
            </button>
          )}

          {/* Funder / contractor: open DocuSign when it is their turn */}
          {showOpenDocuSign && (
            <button
              type="button"
              onClick={handleOpenDocuSign}
              disabled={loading}
              className="inline-flex items-center gap-2 justify-center rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-[13px] font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? <Loader2     size={14} className="animate-spin" aria-hidden="true" />
                : <ExternalLink size={14} aria-hidden="true" />
              }
              {loading ? 'Opening DocuSign…' : 'Open DocuSign to Sign'}
            </button>
          )}

          {/* Contractor: waiting for funder to sign first */}
          {localEnvelopeId && waitingOnFunder && !contractorDone && (
            <div className="flex items-center gap-2 text-[12px] text-white/50">
              <Clock size={13} className="text-amber-400/70 flex-shrink-0" aria-hidden="true" />
              Waiting for the funder to sign first. You will be notified when it is your turn.
            </div>
          )}

          {/* Funder: already signed, waiting on contractor */}
          {localEnvelopeId && waitingOnContractor && (
            <div className="flex items-center gap-2 text-[12px] text-white/50">
              <Clock size={13} className="text-amber-400/70 flex-shrink-0" aria-hidden="true" />
              You have signed. Waiting for the contractor to sign.
            </div>
          )}

          {/* Admin: read-only view */}
          {isAdmin && localEnvelopeId && (
            <p className="text-[12px] text-white/35">
              Admins do not sign contracts. Both parties sign directly in DocuSign.
            </p>
          )}
        </div>

        {/* Release blocker note */}
        <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2.5">
          <p className="text-[11px] text-white/35 leading-relaxed">
            Milestone releases are blocked until both parties complete signing in DocuSign.
          </p>
        </div>

      </div>
    </div>
  )
}

// ─── SignerRow ─────────────────────────────────────────────────────────────────

function SignerRow({
  label,
  signedAt,
  isActiveParty,
}: {
  label:         string
  signedAt:      string | null
  isActiveParty: boolean
}) {
  const signed = !!signedAt
  return (
    <div className="flex items-center gap-2.5">
      {signed ? (
        <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" aria-hidden="true" />
      ) : (
        <Clock
          size={14}
          className={`flex-shrink-0 ${isActiveParty ? 'text-blue-400' : 'text-white/25'}`}
          aria-hidden="true"
        />
      )}
      <span className={`text-[12px] ${
        signed
          ? 'text-emerald-400'
          : isActiveParty
          ? 'text-white/80'
          : 'text-white/35'
      }`}>
        {label}:{' '}
        {signed
          ? `Signed ${new Date(signedAt!).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            })}`
          : isActiveParty
          ? 'Signature required — your turn'
          : 'Pending'
        }
      </span>
    </div>
  )
}
