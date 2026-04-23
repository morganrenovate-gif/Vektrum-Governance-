import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getReceiptById, formatReceiptFeeRate } from '@/lib/engine/receipts'
import { PrintTrigger } from './PrintTrigger'

export const dynamic = 'force-dynamic'

// ─── /dashboard/receipts/[receiptId]/print ────────────────────────────────────
//
// Print-optimized receipt view. Opens in a new tab via `target="_blank"`.
// The PrintTrigger client component calls window.print() after mount so
// the browser's save-as-PDF dialog opens automatically.
//
// No nav chrome — the print/layout.tsx wraps only the children with no sidebar.
// Uses print: Tailwind variants to suppress screen-only elements when printing.

function fmtUsd(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style:    'currency',
    currency: 'USD',
  }).format(n)
}

function fmtUtc(iso: string): string {
  const d   = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`
  )
}

function Row({ label, children, mono = false, strong = false }: {
  label:    string
  children: React.ReactNode
  mono?:    boolean
  strong?:  boolean
}) {
  return (
    <tr className="border-t border-gray-200">
      <td className="py-2 pr-8 text-sm text-gray-500 align-top whitespace-nowrap w-52">{label}</td>
      <td className={[
        'py-2 text-sm align-top',
        mono   ? 'font-mono text-xs tracking-tight' : '',
        strong ? 'font-semibold text-gray-900' : 'text-gray-800',
      ].join(' ')}>
        {children}
      </td>
    </tr>
  )
}

export default async function ReceiptPrintPage({
  params,
}: {
  params: Promise<{ receiptId: string }>
}) {
  const { receiptId } = await params

  // ── Auth ─────────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  // ── Fetch receipt ─────────────────────────────────────────────────────────────
  const receipt = await getReceiptById(receiptId)

  if (!receipt) notFound()

  // ── Access check ──────────────────────────────────────────────────────────────
  const isAdmin       = profile.role === 'admin'
  const isParticipant = receipt.contractor_id === user.id || receipt.funder_id === user.id

  if (!isAdmin && !isParticipant) redirect('/dashboard')

  const releasedUtc = fmtUtc(receipt.released_at)
  const failedUtc   = receipt.failed_at ? fmtUtc(receipt.failed_at) : null
  const createdUtc  = fmtUtc(receipt.created_at)
  const feeRatePct  = formatReceiptFeeRate(receipt.fee_rate_bps)
  const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? 'https://vektrum.io'
  const isFailed    = receipt.status === 'failed' || receipt.status === 'reversed'

  const statusLabel =
    receipt.status === 'failed'   ? 'TRANSFER FAILED' :
    receipt.status === 'reversed' ? 'TRANSFER REVERSED' :
    'TRANSFER ISSUED'

  return (
    <>
      {/* Auto-trigger print dialog */}
      <PrintTrigger />

      <div
        className="min-h-screen bg-white text-gray-900 print:bg-white"
        style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}
      >
        <div className="mx-auto max-w-xl px-8 py-10 print:py-4 print:px-0">

          {/* ── Print button (screen only) ──────────────────────────── */}
          <div className="print:hidden mb-6">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300
                         bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700
                         hover:bg-gray-100 transition-colors"
            >
              🖨&nbsp; Print / Save as PDF
            </button>
            <p className="mt-2 text-xs text-gray-400">
              Use your browser&apos;s print dialog to save as PDF.
            </p>
          </div>

          {/* ── Failed transfer warning ─────────────────────────────── */}
          {isFailed && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <strong>Note:</strong> This transfer{' '}
              {receipt.status === 'reversed' ? 'was reversed' : 'failed'} — the contractor
              did not receive funds.
              {failedUtc && (
                <> Failure recorded at: <span className="font-mono text-xs">{failedUtc}</span>.</>
              )}
            </div>
          )}

          {/* ── Header ──────────────────────────────────────────────── */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-lg font-black tracking-tight">
                Vekt<span className="text-blue-700">rum</span>
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Construction Payment Governance</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">
                Transaction Receipt
              </p>
              <p className="text-xl font-bold font-mono">{receipt.receipt_number}</p>
              <span
                className="mt-1.5 inline-block rounded px-2 py-0.5 text-xs font-bold
                           uppercase tracking-wider text-white"
                style={{
                  backgroundColor:
                    receipt.status === 'failed'   ? '#DC2626' :
                    receipt.status === 'reversed' ? '#D97706' :
                    '#059669',
                }}
              >
                {statusLabel}
              </span>
            </div>
          </div>

          <hr className="border-gray-200 mb-5" />

          {/* ── Deal info ───────────────────────────────────────────── */}
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
            Deal Information
          </p>
          <table className="w-full mb-5">
            <tbody>
              <Row label="Deal"><strong>{receipt.deal_title}</strong></Row>
              <Row label="Milestone" strong>{receipt.milestone_title}</Row>
              <Row label="Contractor">{receipt.contractor_name}</Row>
              <Row label="Funder">{receipt.funder_name}</Row>
            </tbody>
          </table>

          <hr className="border-gray-200 mb-5" />

          {/* ── Financial summary ───────────────────────────────────── */}
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
            Financial Summary
          </p>
          <table className="w-full mb-1">
            <tbody>
              <Row label="Milestone Amount" strong>{fmtUsd(receipt.gross_amount)}</Row>
              <Row label={`Platform Fee (${feeRatePct})`}>{fmtUsd(receipt.fee_amount)}</Row>
            </tbody>
          </table>
          <div className="border-t-2 border-gray-900 pt-2 pb-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-900">Total Charged to Funder</span>
              <span className="text-lg font-bold text-gray-900">{fmtUsd(receipt.total_charged)}</span>
            </div>
          </div>

          <hr className="border-gray-200 mb-5" />

          {/* ── Transfer details ────────────────────────────────────── */}
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
            Transfer Details
          </p>
          <table className="w-full mb-5">
            <tbody>
              <Row label="Stripe Transfer ID" mono>{receipt.stripe_transfer_id}</Row>
              <Row label="Released (UTC)" mono>{releasedUtc}</Row>
              {failedUtc && (
                <Row label="Failed (UTC)" mono>
                  <span className="text-red-600">{failedUtc}</span>
                </Row>
              )}
              <Row label="Receipt Issued (UTC)" mono>{createdUtc}</Row>
            </tbody>
          </table>

          <hr className="border-gray-200 mb-5" />

          {/* ── Receipt identity ────────────────────────────────────── */}
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
            Receipt Identity
          </p>
          <table className="w-full mb-8">
            <tbody>
              <Row label="Receipt Number" mono>{receipt.receipt_number}</Row>
              <Row label="Receipt ID" mono>{receipt.id}</Row>
              <Row label="Release ID" mono>{receipt.release_id}</Row>
            </tbody>
          </table>

          {/* ── Footer ──────────────────────────────────────────────── */}
          <div className="border-t border-gray-200 pt-4 flex justify-between items-end text-xs text-gray-400">
            <div>
              <strong className="text-gray-500">Vektrum</strong> · Construction payment governance
              <br />
              Powered by Stripe Connect · All timestamps in UTC
            </div>
            <div className="text-right">
              <span className="block">
                {appUrl}/dashboard/receipts/{receipt.id}
              </span>
              <span className="block">
                Generated: {fmtUtc(new Date().toISOString())}
              </span>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
