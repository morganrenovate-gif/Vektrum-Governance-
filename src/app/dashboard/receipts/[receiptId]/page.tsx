import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getReceiptById } from '@/lib/engine/receipts'
import { ReceiptCard } from '@/components/receipt/ReceiptCard'
import { ArrowLeft, FileText } from 'lucide-react'

export const dynamic = 'force-dynamic'

// ─── /dashboard/receipts/[receiptId] ─────────────────────────────────────────
//
// In-app receipt view. Accessible to the deal's contractor, funder, and admins.
// Uses the service-role client (via getReceiptById) then performs manual access
// check against the authenticated user's profile.

export default async function ReceiptPage({
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

  if (!receipt) {
    notFound()
  }

  // ── Access check ──────────────────────────────────────────────────────────────
  const isAdmin       = profile.role === 'admin'
  const isParticipant = receipt.contractor_id === user.id || receipt.funder_id === user.id

  if (!isAdmin && !isParticipant) {
    redirect('/dashboard')
  }

  const dealUrl = `/dashboard/deals/${receipt.deal_id}`

  return (
    <div className="min-h-screen bg-[#0A0A0A] px-4 py-8">
      <div className="mx-auto max-w-2xl">

        {/* ── Breadcrumb ─────────────────────────────────────────────── */}
        <div className="mb-6 flex items-center gap-2 text-sm text-white/40">
          <Link
            href="/dashboard"
            className="hover:text-white/70 transition-colors"
          >
            Dashboard
          </Link>
          <span>/</span>
          <Link
            href={dealUrl}
            className="hover:text-white/70 transition-colors"
          >
            {receipt.deal_title}
          </Link>
          <span>/</span>
          <span className="text-white/60">Receipt</span>
        </div>

        {/* ── Page header ────────────────────────────────────────────── */}
        <div className="mb-6 flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center
                          rounded-lg bg-blue-500/15 ring-1 ring-blue-500/30">
            <FileText className="h-4.5 w-4.5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">
              Transaction Receipt
            </h1>
            <p className="text-sm text-white/40">
              {receipt.deal_title} · {receipt.milestone_title}
            </p>
          </div>
        </div>

        {/* ── Receipt card ───────────────────────────────────────────── */}
        <ReceiptCard
          receipt={receipt}
          showActions
          showFooterLink={false}
          dealUrl={dealUrl}
        />

        {/* ── Compliance note ────────────────────────────────────────── */}
        <p className="mt-4 text-center text-xs text-white/25">
          This receipt is a legally defensible record. All timestamps are in UTC.
          Use &ldquo;Export / Print PDF&rdquo; to generate a PDF for your records.
        </p>

        {/* ── Back link ──────────────────────────────────────────────── */}
        <div className="mt-6 flex justify-center">
          <Link
            href={dealUrl}
            className="inline-flex items-center gap-1.5 text-sm text-white/40
                       hover:text-white/70 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to deal
          </Link>
        </div>
      </div>
    </div>
  )
}
