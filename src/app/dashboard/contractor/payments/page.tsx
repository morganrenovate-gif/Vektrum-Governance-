export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { DollarSign, ArrowRight } from 'lucide-react'
import { formatMoney } from '@/lib/utils'
import type { Profile } from '@/lib/types'
import { PageHeader, StatBlock, EmptyState } from '@/components/layout'

export default async function ContractorPaymentsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login?next=/dashboard/contractor/payments')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawProfile } = await (supabase as any)
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  const profile = rawProfile as Pick<Profile, 'id' | 'role'> | null
  if (!profile || profile.role !== 'contractor') redirect('/dashboard')

  // Fetch releases for this contractor's deals
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: deals } = await (supabase as any)
    .from('deals')
    .select('id, title')
    .eq('contractor_id', user.id)

  const dealIds = (deals ?? []).map((d: { id: string }) => d.id)
  const dealMap = new Map((deals ?? []).map((d: { id: string; title: string }) => [d.id, d.title]))

  interface ReleaseRecord {
    id: string
    milestone_id: string
    deal_id: string
    amount: number
    released_at: string
    milestone?: { title: string } | null
  }

  let releases: ReleaseRecord[] = []

  if (dealIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rels } = await (supabase as any)
      .from('releases')
      .select('id, milestone_id, deal_id, amount, released_at, milestone:milestones!releases_milestone_id_fkey(title)')
      .in('deal_id', dealIds)
      .order('released_at', { ascending: false })

    releases = (rels ?? []) as ReleaseRecord[]
  }

  // Compute stats
  const totalEarned = releases.reduce((s, r) => s + r.amount, 0)

  // Pending release: milestones in approved status (not yet released)
  let pendingRelease = 0
  if (dealIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pendingMilestones } = await (supabase as any)
      .from('milestones')
      .select('amount')
      .in('deal_id', dealIds)
      .eq('status', 'approved')

    pendingRelease = (pendingMilestones ?? []).reduce(
      (s: number, m: { amount: number }) => s + m.amount,
      0,
    )
  }

  const lastPayment = releases.length > 0 ? releases[0] : null

  return (
    <div className="min-h-screen bg-surface-0">
    <div className="dash-page">
      <PageHeader
        eyebrow="Payments"
        title="Payment History"
        description="Track released milestone funds"
      />

      {/* Stat tiles */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatBlock label="Total Earned" value={formatMoney(totalEarned)} money />
        <StatBlock label="Pending Release" value={formatMoney(pendingRelease)} money alert={pendingRelease > 0} />
        <StatBlock
          label="Last Payment"
          value={lastPayment ? formatMoney(lastPayment.amount) : '—'}
          money={!!lastPayment}
          subvalue={lastPayment
            ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(lastPayment.released_at))
            : undefined}
        />
      </div>

      {releases.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title="No payments yet"
          description="Payments will appear here once milestone funds are released."
          action={{ label: 'Go to Dashboard', href: '/dashboard' }}
          variant="dashed"
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">Milestone</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">Deal</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">Amount</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">Date Released</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {releases.map((rel) => (
                <tr key={rel.id} className="hover:bg-white/[0.025] transition-colors">
                  <td className="px-4 py-3 font-medium text-white/80">{rel.milestone?.title ?? 'Unknown'}</td>
                  <td className="px-4 py-3 text-white/45">{(dealMap.get(rel.deal_id) as string) ?? 'Unknown Deal'}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums text-emerald-400">{formatMoney(rel.amount)}</td>
                  <td className="px-4 py-3 text-white/45">
                    {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(rel.released_at))}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                      Released
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
    </div>
  )
}
