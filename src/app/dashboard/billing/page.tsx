export const dynamic = 'force-dynamic'

// Vektrum Funder Billing Portal
//
// Provides funders with a deal-by-deal breakdown of platform governance fees:
//   - Per-deal: billing_rate_bps, fees_collected, governance_fee_total (budget)
//     and actual fees against that budget, plus a CSV export link.
//   - Platform total: sum of fees across all deals.
//
// All queries run server-side with the authenticated funder's session (RLS-scoped).
// The billing export endpoint enforces its own access check in addition to RLS.

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatMoney } from '@/lib/utils'
import { rateLabel, getFeeDescription } from '@/lib/engine/billing'
import type { SubscriptionTier } from '@/lib/engine/billing'
import { PageHeader, SectionHeader } from '@/components/layout'
import { Download, DollarSign, TrendingUp, FileText, Info, CheckCircle2 } from 'lucide-react'
import type { Profile } from '@/lib/types'

export const metadata = {
  title: 'Billing — Vektrum',
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DealBillingRow {
  id:                   string
  title:                string
  status:               string
  total_amount:         number
  funded_amount:        number
  released_amount:      number
  fees_collected:       number
  governance_fee_total: number | null
  billing_rate_bps:     number | null
  created_at:           string
  milestoneCount:       number
  releasedMilestones:   number
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function BillingPortalPage() {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?next=/dashboard/billing')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawProfile } = await (supabase as any)
    .from('profiles')
    .select('id, role, full_name, company_name, subscription_tier, billing_rate_bps')
    .eq('id', user.id)
    .single()

  const profile = rawProfile as (Pick<Profile, 'id' | 'role'> & {
    full_name:         string | null
    company_name:      string | null
    subscription_tier: SubscriptionTier | null
    billing_rate_bps:  number | null
  }) | null

  if (!profile || profile.role !== 'funder') redirect('/dashboard')

  // ── Fetch deals with billing data ─────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawDeals } = await (supabase as any)
    .from('deals')
    .select(
      'id, title, status, total_amount, funded_amount, released_amount, ' +
      'fees_collected, governance_fee_total, billing_rate_bps, created_at'
    )
    .eq('funder_id', user.id)
    .order('created_at', { ascending: false })

  const deals = (rawDeals ?? []) as Omit<DealBillingRow, 'milestoneCount' | 'releasedMilestones'>[]

  // Fetch milestone counts per deal for progress display
  const dealIds = deals.map((d) => d.id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: milestones } = dealIds.length > 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? await (supabase as any)
        .from('milestones')
        .select('deal_id, status')
        .in('deal_id', dealIds)
    : { data: [] }

  const milestoneCounts  = new Map<string, number>()
  const releasedCounts   = new Map<string, number>()
  for (const m of (milestones ?? []) as { deal_id: string; status: string }[]) {
    milestoneCounts.set(m.deal_id, (milestoneCounts.get(m.deal_id) ?? 0) + 1)
    if (m.status === 'released') {
      releasedCounts.set(m.deal_id, (releasedCounts.get(m.deal_id) ?? 0) + 1)
    }
  }

  const dealRows: DealBillingRow[] = deals.map((d) => ({
    ...d,
    milestoneCount:     milestoneCounts.get(d.id) ?? 0,
    releasedMilestones: releasedCounts.get(d.id)  ?? 0,
  }))

  // ── Platform-level totals ─────────────────────────────────────────────────
  const totalFeesCollected    = dealRows.reduce((s, d) => s + Number(d.fees_collected    ?? 0), 0)
  const totalGovernanceBudget = dealRows.reduce((s, d) => s + Number(d.governance_fee_total ?? 0), 0)
  const totalFunded           = dealRows.reduce((s, d) => s + Number(d.funded_amount ?? 0), 0)
  const totalReleased         = dealRows.reduce((s, d) => s + Number(d.released_amount ?? 0), 0)

  const tierLabel = profile.subscription_tier
    ? getFeeDescription(profile.subscription_tier)
    : 'No tier set'

  // ─── Status display helpers ───────────────────────────────────────────────

  function statusBadgeClass(status: string): string {
    switch (status) {
      case 'active':    return 'bg-vektrum-blue/10 text-blue-300 border-vektrum-blue/30'
      case 'completed': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      case 'disputed':  return 'bg-red-500/10 text-red-400 border-red-500/20'
      case 'draft':     return 'bg-white/[0.05] text-white/75 border-white/[0.14]'
      default:          return 'bg-white/[0.05] text-white/75 border-white/[0.14]'
    }
  }

  function formatDateShort(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })
  }

  return (
    <div className="min-h-screen bg-surface-0">
    <div className="dash-page">

      {/* Header */}
      <PageHeader
        eyebrow="Billing"
        title="Governance Fee Summary"
        description="Deal-by-deal breakdown of platform governance fees for your portfolio."
      />

      {/* Account fee tier */}
      <div className="flex items-start gap-3 rounded-xl border border-vektrum-blue/20 bg-vektrum-blue/5 p-4">
        <Info size={15} className="text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-[13px]">
          <p className="font-medium text-white/80">Your account plan</p>
          <p className="text-white/50 mt-0.5">
            {tierLabel}. This rate is locked in at deal funding time —
            it applies to each deal independently and does not change retroactively.
          </p>
        </div>
      </div>

      {/* Platform totals */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: 'Total Funded',
            value: formatMoney(totalFunded),
            icon:  DollarSign,
            sub:   `${dealRows.length} deal${dealRows.length !== 1 ? 's' : ''}`,
          },
          {
            label: 'Total Released',
            value: formatMoney(totalReleased),
            icon:  TrendingUp,
            sub:   'to contractors',
          },
          {
            label: 'Fees Collected',
            value: formatMoney(totalFeesCollected),
            icon:  CheckCircle2,
            sub:   'governance fees paid',
          },
          {
            label: 'Fee Budget',
            value: formatMoney(totalGovernanceBudget),
            icon:  FileText,
            sub:   'projected total fees',
          },
        ].map(({ label, value, icon: Icon, sub }) => (
          <div
            key={label}
            className="rounded-xl border border-white/[0.08] bg-surface-2 px-4 py-4 shadow-card"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/65">
                {label}
              </p>
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/[0.05] border border-white/[0.08]">
                <Icon size={12} className="text-blue-400" />
              </div>
            </div>
            <p className="font-display text-xl font-bold tabular-nums text-white">{value}</p>
            {sub && <p className="mt-1 text-[11px] text-white/65">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Per-deal billing table */}
      <div>
        <SectionHeader
          label="Deal Billing Detail"
          count={dealRows.length}
        />

        {dealRows.length === 0 ? (
          <div className="rounded-xl border border-white/[0.08] bg-surface-2 p-10 text-center">
            <DollarSign size={32} className="text-white/65 mx-auto mb-3" aria-hidden="true" />
            <p className="text-[13px] text-white/80">No deals found. Create and fund a deal to see billing data.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Deal</th>
                    <th>Status</th>
                    <th>Rate</th>
                    <th>Milestones</th>
                    <th>Funded</th>
                    <th>Released</th>
                    <th>Fee Budget</th>
                    <th>Fees Collected</th>
                    <th>Variance</th>
                    <th>Export</th>
                  </tr>
                </thead>
                <tbody>
                  {dealRows.map((deal) => {
                    const feeBudget   = Number(deal.governance_fee_total ?? 0)
                    const feesActual  = Number(deal.fees_collected ?? 0)
                    const variance    = feesActual - feeBudget
                    const bps         = deal.billing_rate_bps

                    return (
                      <tr key={deal.id}>
                        <td>
                          <div>
                            <Link
                              href={`/dashboard/deals/${deal.id}`}
                              className="font-medium text-white/90 hover:text-white transition-colors"
                            >
                              {deal.title}
                            </Link>
                            <p className="text-[11px] text-white/65 mt-0.5">
                              {formatDateShort(deal.created_at)}
                            </p>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium border capitalize ${statusBadgeClass(deal.status)}`}
                          >
                            {deal.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="tabular-nums text-white/60">
                          {bps != null ? rateLabel(bps) : '—'}
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <span className="tabular-nums text-white/70">
                              {deal.releasedMilestones}/{deal.milestoneCount}
                            </span>
                            {deal.milestoneCount > 0 && (
                              <div className="h-1.5 w-12 rounded-full bg-white/[0.07] overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-emerald-500"
                                  style={{
                                    width: `${Math.round(deal.releasedMilestones / deal.milestoneCount * 100)}%`
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="tabular-nums text-white/70">
                          {formatMoney(Number(deal.funded_amount ?? 0))}
                        </td>
                        <td className="tabular-nums text-white/70">
                          {formatMoney(Number(deal.released_amount ?? 0))}
                        </td>
                        <td className="tabular-nums text-white/50">
                          {feeBudget > 0 ? formatMoney(feeBudget) : '—'}
                        </td>
                        <td className="tabular-nums font-medium text-white/90">
                          {formatMoney(feesActual)}
                        </td>
                        <td className={`tabular-nums text-[12px] ${
                          variance > 0.01
                            ? 'text-emerald-400'
                            : variance < -0.01
                            ? 'text-amber-400'
                            : 'text-white/65'
                        }`}>
                          {variance === 0 || feeBudget === 0
                            ? '—'
                            : `${variance > 0 ? '+' : ''}${formatMoney(variance)}`}
                        </td>
                        <td>
                          <Link
                            href={`/api/deals/${deal.id}/billing/export?format=csv`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-white/60 hover:bg-white/[0.08] hover:text-white transition-colors"
                          >
                            <Download size={11} />
                            CSV
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>

                {/* Totals footer */}
                <tfoot>
                  <tr className="border-t border-white/[0.1] bg-white/[0.02]">
                    <td colSpan={4} className="text-[12px] font-semibold text-white/50 py-3 px-4">
                      Platform Totals
                    </td>
                    <td className="tabular-nums font-semibold text-white/80 py-3 px-4">
                      {formatMoney(totalFunded)}
                    </td>
                    <td className="tabular-nums font-semibold text-white/80 py-3 px-4">
                      {formatMoney(totalReleased)}
                    </td>
                    <td className="tabular-nums text-white/50 py-3 px-4">
                      {formatMoney(totalGovernanceBudget)}
                    </td>
                    <td className="tabular-nums font-bold text-white py-3 px-4">
                      {formatMoney(totalFeesCollected)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Note on fee model */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-[12px] text-white/75">
        <p className="font-medium text-white/90 mb-1">About governance fees</p>
        <p>
          The governance fee is charged on top of each milestone release —
          contractors always receive the full gross milestone amount.
          The Fee Budget is the projected total fee for a deal at the time of funding,
          calculated as <code className="text-white/50">total_amount × billing_rate_bps / 10000</code>.
          Fees Collected reflects actual fees on released milestones.
          A minimum fee of $50.00 per milestone applies.
        </p>
      </div>

    </div>
    </div>
  )
}
