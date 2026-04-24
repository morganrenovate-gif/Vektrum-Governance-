'use client'

// ─── ReceiptCard ──────────────────────────────────────────────────────────────
//
// Shared receipt display component used by both the in-app receipt page
// and the print/PDF view. Renders all financial fields with exact UTC timestamps.
//
// Props control whether interactive elements (resend button, print link) are shown,
// so the same component works in both contexts without duplication.

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle, XCircle, RotateCcw, Printer, Mail, ExternalLink } from 'lucide-react'
import type { TransactionReceipt } from '@/lib/engine/receipts'
import { formatReceiptFeeRate } from '@/lib/engine/receipts'
import { AuditTimestamp } from '@/components/ui/local-time'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReceiptCardProps {
  receipt:     TransactionReceipt
  /** Show print and resend action buttons. Hide in print view. */
  showActions?: boolean
  /** Show the "View on Vektrum" footer link. Hide in print view. */
  showFooterLink?: boolean
  /** Passed from server — used for "back to deal" link */
  dealUrl?:    string
}

// ─── Dollar formatter ─────────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style:    'currency',
    currency: 'USD',
  }).format(n)
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TransactionReceipt['status'] }) {
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1 text-sm font-semibold text-red-400">
        <XCircle className="h-3.5 w-3.5" />
        Transfer Failed
      </span>
    )
  }
  if (status === 'reversed') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/15 px-3 py-1 text-sm font-semibold text-orange-400">
        <RotateCcw className="h-3.5 w-3.5" />
        Transfer Reversed
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-semibold text-emerald-400">
      <CheckCircle className="h-3.5 w-3.5" />
      Transfer Issued
    </span>
  )
}

// ─── Row helper ───────────────────────────────────────────────────────────────

function Row({
  label,
  children,
  mono = false,
  bold = false,
  separator = false,
}: {
  label:     string
  children:  React.ReactNode
  mono?:     boolean
  bold?:     boolean
  separator?: boolean
}) {
  return (
    <tr className={separator ? 'border-t-2 border-white/20' : 'border-t border-white/8'}>
      <td className="py-2.5 pr-6 text-sm text-white/50 whitespace-nowrap align-top">{label}</td>
      <td
        className={[
          'py-2.5 text-sm align-top',
          mono  ? 'font-mono text-xs tracking-tight' : '',
          bold  ? 'font-semibold text-white' : 'text-white/85',
        ].join(' ')}
      >
        {children}
      </td>
    </tr>
  )
}

// ─── ResendButton ─────────────────────────────────────────────────────────────

function ResendButton({ releaseId }: { releaseId: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function handleResend() {
    setState('sending')
    try {
      const res = await fetch(`/api/releases/${releaseId}/receipt/resend`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        console.error('[ReceiptCard] resend failed:', body)
        setState('error')
      } else {
        setState('sent')
      }
    } catch (err) {
      console.error('[ReceiptCard] resend error:', err)
      setState('error')
    }
  }

  if (state === 'sent') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-emerald-400">
        <CheckCircle className="h-4 w-4" />
        Receipt resent
      </span>
    )
  }

  if (state === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-red-400">
        <XCircle className="h-4 w-4" />
        Failed to resend — try again
      </span>
    )
  }

  return (
    <button
      onClick={handleResend}
      disabled={state === 'sending'}
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5
                 px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white
                 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      <Mail className="h-4 w-4" />
      {state === 'sending' ? 'Sending…' : 'Resend by email'}
    </button>
  )
}

// ─── ReceiptCard ──────────────────────────────────────────────────────────────

export function ReceiptCard({
  receipt,
  showActions    = true,
  showFooterLink = true,
  dealUrl,
}: ReceiptCardProps) {
  const isFailed = receipt.status === 'failed' || receipt.status === 'reversed'

  return (
    <div className="rounded-2xl border border-white/10 bg-white/4 overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3
                      border-b border-white/10 bg-white/3 px-6 py-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-white/40 mb-1">
            Transaction Receipt
          </p>
          <h2 className="text-2xl font-bold text-white tracking-tight font-mono">
            {receipt.receipt_number}
          </h2>
          {isFailed && (
            <p className="mt-1 text-xs text-red-400/80">
              This transfer did not settle. No funds were received by the contractor.
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={receipt.status} />
        </div>
      </div>

      {/* ── Financial table ────────────────────────────────────────────── */}
      <div className="px-6 py-4">
        <table className="w-full">
          <tbody>
            {/* Deal & milestone */}
            <Row label="Deal">{receipt.deal_title}</Row>
            <Row label="Milestone" bold>{receipt.milestone_title}</Row>

            {/* Parties */}
            <Row label="Contractor">{receipt.contractor_name}</Row>
            <Row label="Funder">{receipt.funder_name}</Row>

            {/* Financials */}
            <Row label="Milestone Amount" bold>{fmt(receipt.gross_amount)}</Row>
            <Row label={`Platform Fee (${formatReceiptFeeRate(receipt.fee_rate_bps)})`}>
              {fmt(receipt.fee_amount)}
            </Row>
            <Row label="Total Charged to Funder" bold separator>
              <span className="text-lg">{fmt(receipt.total_charged)}</span>
            </Row>

            {/* Stripe */}
            <Row label="Stripe Transfer ID" mono>{receipt.stripe_transfer_id}</Row>

            {/* Timestamps */}
            <Row label="Released (UTC)" mono>
              <AuditTimestamp iso={receipt.released_at} />
            </Row>
            {receipt.failed_at && (
              <Row label="Failed (UTC)" mono>
                <AuditTimestamp iso={receipt.failed_at} />
              </Row>
            )}
            {receipt.email_sent_at && (
              <Row label="Last Email Sent (UTC)" mono>
                <AuditTimestamp iso={receipt.email_sent_at} />
              </Row>
            )}

            {/* Receipt metadata */}
            <Row label="Receipt ID" mono>{receipt.id}</Row>
            <Row label="Release ID" mono>{receipt.release_id}</Row>
          </tbody>
        </table>
      </div>

      {/* ── Actions ────────────────────────────────────────────────────── */}
      {showActions && (
        <div className="flex flex-wrap items-center gap-3 border-t border-white/10 px-6 py-4">
          {/* Print / PDF */}
          <Link
            href={`/dashboard/receipts/${receipt.id}/print`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2
                       text-sm font-medium text-white hover:bg-white/15 transition-colors"
          >
            <Printer className="h-4 w-4" />
            Export / Print PDF
          </Link>

          {/* Resend (only for non-failed receipts) */}
          {!isFailed && (
            <ResendButton releaseId={receipt.release_id} />
          )}

          {/* Back to deal */}
          {dealUrl && (
            <Link
              href={dealUrl}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15
                         px-3 py-2 text-sm font-medium text-white/70 hover:text-white
                         hover:border-white/30 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              View Deal
            </Link>
          )}
        </div>
      )}

      {/* ── Footer link (for email-like contexts) ──────────────────────── */}
      {showFooterLink && (
        <div className="border-t border-white/10 px-6 py-3 text-center">
          <p className="text-xs text-white/30">
            Vektrum · Construction payment governance ·{' '}
            <a
              href={`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/dashboard/receipts/${receipt.id}`}
              className="text-white/65 underline underline-offset-2 hover:text-white transition-colors"
            >
              View on Vektrum
            </a>
          </p>
        </div>
      )}
    </div>
  )
}
