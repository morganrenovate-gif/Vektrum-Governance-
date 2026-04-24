export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DollarSign } from 'lucide-react'
import { formatMoney, formatDateShort } from '@/lib/utils'
import type { Profile } from '@/lib/types'
import { PageHeader, StatBlock, MetricStrip, EmptyState, SectionHeader } from '@/components/layout'
import { ExportButton } from './export-button'

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

      {/* Stat strip */}
      <MetricStrip>
        <StatBlock inline label="Total Earned" value={formatMoney(totalEarned)} money />
        <StatBlock inline label="Pending Release" value={formatMoney(pendingRelease)} money alert={pendingRelease > 0} />
        <StatBlock
          inline
          label="Last Payment"
          value={lastPayment ? formatMoney(lastPayment.amount) : '—'}
          money={!!lastPayment}
          subvalue={lastPayment ? formatDateShort(lastPayment.released_at) : undefined}
        />
      </MetricStrip>

      {releases.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title="No payments yet"
          description="Payments will appear here once milestone funds are released."
          action={{ label: 'Go to Dashboard', href: '/dashboard' }}
          variant="dashed"
        />
      ) : (
        <section className="space-y-4">
          <SectionHeader
            label={`${releases.length} payment${releases.length !== 1 ? 's' : ''}`}
            action={
              <ExportButton
                payments={releases.map((r) => ({
                  milestoneTitle: r.milestone?.title ?? null,
                  dealTitle: (dealMap.get(r.deal_id) as string) ?? null,
                  amount: r.amount,
                  releasedAt: r.released_at,
                }))}
              />
            }
          />
          <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-surface-2 shadow-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Milestone</th>
                  <th>Deal</th>
                  <th>Amount</th>
                  <th>Date Released</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {releases.map((rel) => (
                  <tr key={rel.id}>
                    <td className="font-medium text-white/90">{rel.milestone?.title ?? <span className="text-white/65 italic">Milestone removed</span>}</td>
                    <td>{(dealMap.get(rel.deal_id) as string) ?? <span className="text-white/65 italic">Deal removed</span>}</td>
                    <td className="font-semibold tabular-nums text-emerald-400">{formatMoney(rel.amount)}</td>
                    <td>{formatDateShort(rel.released_at)}</td>
                    <td>
                      <span className="inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide text-emerald-400">
                        Released
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
    </div>
  )
}
