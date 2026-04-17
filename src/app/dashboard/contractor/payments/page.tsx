export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { DollarSign, ArrowRight } from 'lucide-react'
import { formatMoney } from '@/lib/utils'
import type { Profile } from '@/lib/types'

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
    <div className="page-container section space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-vektrum-text">Payments</h1>
        <p className="mt-1 text-sm text-vektrum-muted">
          Track released milestone funds
        </p>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-vektrum-border bg-vektrum-surface px-5 py-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">
            Total Earned
          </p>
          <p className="mt-1.5 font-display text-4xl font-bold tabular-nums text-vektrum-text leading-none">
            {formatMoney(totalEarned)}
          </p>
        </div>
        <div className="rounded-lg border border-vektrum-border bg-vektrum-surface px-5 py-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">
            Pending Release
          </p>
          <p className="mt-1.5 font-display text-4xl font-bold tabular-nums text-vektrum-amber leading-none">
            {formatMoney(pendingRelease)}
          </p>
        </div>
        <div className="rounded-lg border border-vektrum-border bg-vektrum-surface px-5 py-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">
            Last Payment
          </p>
          <p className="mt-1.5 font-display text-4xl font-bold tabular-nums text-vektrum-green leading-none">
            {lastPayment ? formatMoney(lastPayment.amount) : '—'}
          </p>
          {lastPayment && (
            <p className="mt-1 text-[11px] text-vektrum-muted">
              {new Intl.DateTimeFormat('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              }).format(new Date(lastPayment.released_at))}
            </p>
          )}
        </div>
      </div>

      {releases.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl">
          <DollarSign size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-vektrum-text font-medium mb-1">No payments yet</p>
          <p className="text-vektrum-muted text-sm mb-4">
            Payments will appear here once milestone funds are released.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 bg-vektrum-navy text-white px-6 py-2 rounded-lg text-sm font-medium"
          >
            Go to Dashboard
            <ArrowRight size={14} />
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-vektrum-border bg-vektrum-surface shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-vektrum-border bg-vektrum-surface-alt">
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-vektrum-muted">
                  Milestone
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-vektrum-muted">
                  Deal
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-vektrum-muted">
                  Amount
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-vektrum-muted">
                  Date Released
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-vektrum-muted">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-vektrum-border-subtle">
              {releases.map((rel) => (
                <tr key={rel.id} className="hover:bg-vektrum-surface-alt transition-colors">
                  <td className="px-4 py-3 font-medium text-vektrum-text">
                    {rel.milestone?.title ?? 'Unknown'}
                  </td>
                  <td className="px-4 py-3 text-vektrum-muted">
                    {(dealMap.get(rel.deal_id) as string) ?? 'Unknown Deal'}
                  </td>
                  <td className="px-4 py-3 font-semibold tabular-nums text-vektrum-green">
                    {formatMoney(rel.amount)}
                  </td>
                  <td className="px-4 py-3 text-vektrum-muted">
                    {new Intl.DateTimeFormat('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    }).format(new Date(rel.released_at))}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700">
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
  )
}
