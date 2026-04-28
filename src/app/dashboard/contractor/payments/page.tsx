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

  // Fetch deals with retainage fields
  interface DealRow {
    id: string
    title: string
    retainage_percentage: number | null
    retainage_held: number | null
    retainage_released: number | null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: deals } = await (supabase as any)
    .from('deals')
    .select('id, title, retainage_percentage, retainage_held, retainage_released')
    .eq('contractor_id', user.id)

  const dealList = (deals ?? []) as DealRow[]
  const dealIds = dealList.map((d) => d.id)
  const dealMap = new Map(dealList.map((d) => [d.id, d.title]))

  interface ReleaseRecord {
    id: string
    milestone_id: string
    deal_id: string
    amount: number   // net_to_contractor (gross minus retainage)
    released_at: string
    milestone?: { title: string } | null
  }

  interface BillingRow {
    release_id: string
    retainage_amount: number | null
  }

  let releases: ReleaseRecord[] = []
  let billingRows: BillingRow[] = []

  if (dealIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rels } = await (supabase as any)
      .from('releases')
      .select('id, milestone_id, deal_id, amount, released_at, milestone:milestones!releases_milestone_id_fkey(title)')
      .in('deal_id', dealIds)
      .order('released_at', { ascending: false })

    releases = (rels ?? []) as ReleaseRecord[]

    // Fetch billing_records to get per-release retainage_amount
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: recs } = await (supabase as any)
      .from('billing_records')
      .select('release_id, retainage_amount')
      .in('deal_id', dealIds)

    billingRows = (recs ?? []) as BillingRow[]
  }

  // Build lookup: release_id → retainage_amount withheld
  const retainageByRelease = new Map<string, number>(
    billingRows.map((r) => [r.release_id, r.retainage_amount ?? 0]),
  )

  // ── Retainage stats ────────────────────────────────────────────────────────
  // releases.amount = net_to_contractor (gross minus retainage at release time)
  // billing_records.retainage_amount = the amount withheld for that release
  const netReleased       = releases.reduce((s, r) => s + r.amount, 0)
  const retainageWithheld = releases.reduce((s, r) => s + (retainageByRelease.get(r.id) ?? 0), 0)
  const grossEarned       = netReleased + retainageWithheld

  // Deal-level running totals for retainage held and released
  const totalRetainageHeld     = dealList.reduce((s, d) => s + (d.retainage_held ?? 0), 0)
  const totalRetainageReleased = dealList.reduce((s, d) => s + (d.retainage_released ?? 0), 0)
  const retainageRemaining     = totalRetainageHeld - totalRetainageReleased

  // Show retainage rows only when retainage applies on at least one deal
  const hasRetainage = dealList.some((d) => (d.retainage_percentage ?? 0) > 0) || retainageWithheld > 0

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
        {hasRetainage ? (
          <>
            <StatBlock inline label="Gross Earned" value={formatMoney(grossEarned)} money />
            <StatBlock inline label="Retainage Withheld" value={formatMoney(retainageWithheld)} money />
            <StatBlock inline label="Net Released" value={formatMoney(netReleased)} money />
            <StatBlock inline label="Retainage Released" value={formatMoney(totalRetainageReleased)} money />
            <StatBlock
              inline
              label="Retainage Remaining"
              value={formatMoney(retainageRemaining)}
              money
              alert={retainageRemaining > 0}
            />
          </>
        ) : (
          <>
            <StatBlock inline label="Total Earned" value={formatMoney(netReleased)} money />
            <StatBlock inline label="Pending Release" value={formatMoney(pendingRelease)} money alert={pendingRelease > 0} />
            <StatBlock
              inline
              label="Last Payment"
              value={lastPayment ? formatMoney(lastPayment.amount) : '—'}
              money={!!lastPayment}
              subvalue={lastPayment ? formatDateShort(lastPayment.released_at) : undefined}
            />
          </>
        )}
      </MetricStrip>

      {hasRetainage && (
        <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-300/80">
          <span className="font-semibold text-amber-300">Retainage applies to this project.</span>
          {' '}A portion of each milestone payment is withheld until project completion. Contact your funder to arrange retainage release.
        </div>
      )}

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
                  {hasRetainage && <th>Gross</th>}
                  {hasRetainage && <th>Withheld</th>}
                  <th>{hasRetainage ? 'Net Released' : 'Amount'}</th>
                  <th>Date Released</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {releases.map((rel) => {
                  const withheld = retainageByRelease.get(rel.id) ?? 0
                  const gross    = rel.amount + withheld
                  return (
                    <tr key={rel.id}>
                      <td className="font-medium text-white/90">{rel.milestone?.title ?? <span className="text-white/65 italic">Milestone removed</span>}</td>
                      <td>{(dealMap.get(rel.deal_id) as string) ?? <span className="text-white/65 italic">Deal removed</span>}</td>
                      {hasRetainage && (
                        <td className="tabular-nums text-white/70">{formatMoney(gross)}</td>
                      )}
                      {hasRetainage && (
                        <td className="tabular-nums text-amber-400">
                          {withheld > 0 ? `−${formatMoney(withheld)}` : '—'}
                        </td>
                      )}
                      <td className="font-semibold tabular-nums text-emerald-400">{formatMoney(rel.amount)}</td>
                      <td>{formatDateShort(rel.released_at)}</td>
                      <td>
                        <span className="inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide text-emerald-400">
                          Released
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
    </div>
  )
}
