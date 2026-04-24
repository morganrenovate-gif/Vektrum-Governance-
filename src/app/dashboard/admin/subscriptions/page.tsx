export const dynamic = 'force-dynamic'

// Vektrum Admin — Subscription Management
//
// Displays all funder profiles with their current subscription tier,
// billing rate, and active deal count. Admins can change tiers inline
// via TierChangeButton (client component), which calls the
// POST /api/admin/subscriptions/[profileId]/tier endpoint and requires
// an admin_justification that is permanently logged in admin_audit_log.
//
// Note: Changing a tier does NOT retroactively update existing deal
// billing_rate_bps values. Deals lock in the rate at funding time.

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { formatMoney } from '@/lib/utils'
import { getFeeDescription, billingRateFromTier } from '@/lib/engine/billing'
import type { SubscriptionTier } from '@/lib/engine/billing'
import { PageHeader, SectionHeader } from '@/components/layout'
import { TierChangeButton } from './tier-change-button'
import { ArrowLeft, Users, CreditCard, TrendingUp, Info, ShieldCheck } from 'lucide-react'

export const metadata = {
  title: 'Subscription Management — Vektrum Admin',
}

// ─── Server-side data fetch ───────────────────────────────────────────────────

interface FunderRow {
  id:                string
  full_name:         string | null
  company_name:      string | null
  subscription_tier: SubscriptionTier | null
  billing_rate_bps:  number | null
  created_at:        string
}

interface DealSummary {
  funder_id:         string
  status:            string
  fees_collected:    number
  funded_amount:     number
}

async function getSubscriptionData() {
  const adminClient = createSupabaseAdminClient()

  // All funder profiles
  const { data: funders, error: fundersError } = await adminClient
    .from('profiles')
    .select('id, full_name, company_name, subscription_tier, billing_rate_bps, created_at')
    .eq('role', 'funder')
    .order('created_at', { ascending: false })

  if (fundersError) {
    console.error('[subscriptions] Failed to fetch funders:', fundersError.message)
  }

  // Auth users for emails
  const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers()
  const emailMap = new Map(authUsers.map((u) => [u.id, u.email ?? null]))

  // All deals for deal count and fees
  const { data: deals } = await adminClient
    .from('deals')
    .select('funder_id, status, fees_collected, funded_amount')
    .not('funder_id', 'is', null)

  const dealsByFunder = new Map<string, DealSummary[]>()
  for (const deal of (deals ?? []) as DealSummary[]) {
    const existing = dealsByFunder.get(deal.funder_id) ?? []
    existing.push(deal)
    dealsByFunder.set(deal.funder_id, existing)
  }

  // Recent subscription tier changes from admin_audit_log
  const { data: recentChanges } = await adminClient
    .from('admin_audit_log')
    .select('entity_id, action, new_values, created_at, actor_id')
    .eq('action', 'subscription_tier_changed')
    .order('created_at', { ascending: false })
    .limit(20)

  const funderRows: Array<FunderRow & {
    email:              string | null
    totalDeals:         number
    activeDeals:        number
    totalFeesCollected: number
    totalFunded:        number
    lastTierChange:     string | null
  }> = (funders ?? []).map((f: FunderRow) => {
    const funderDeals  = dealsByFunder.get(f.id) ?? []
    const activeDeals  = funderDeals.filter(
      (d) => d.status === 'active' || d.status === 'in_progress',
    ).length
    const lastChange   = recentChanges?.find((c) => c.entity_id === f.id)

    return {
      ...f,
      email:              emailMap.get(f.id) ?? null,
      totalDeals:         funderDeals.length,
      activeDeals,
      totalFeesCollected: funderDeals.reduce((s, d) => s + Number(d.fees_collected ?? 0), 0),
      totalFunded:        funderDeals.reduce((s, d) => s + Number(d.funded_amount  ?? 0), 0),
      lastTierChange:     lastChange?.created_at ?? null,
    }
  })

  // Platform-level subscription breakdown
  const tierBreakdown = {
    standalone:    funderRows.filter((f) => f.subscription_tier === 'standalone').length,
    institutional: funderRows.filter((f) => f.subscription_tier === 'institutional').length,
    enterprise:    funderRows.filter((f) => f.subscription_tier === 'enterprise').length,
    unset:         funderRows.filter((f) => !f.subscription_tier).length,
  }

  return { funderRows, tierBreakdown }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: SubscriptionTier | null }) {
  if (!tier) {
    return (
      <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium bg-white/[0.05] text-white/30 border border-white/[0.08]">
        Unset
      </span>
    )
  }
  const colors: Record<SubscriptionTier, string> = {
    standalone:    'bg-white/[0.05] text-white/60 border-white/[0.1]',
    institutional: 'bg-vektrum-blue/10 text-vektrum-blue border-vektrum-blue/20',
    enterprise:    'bg-amber-500/10 text-amber-400 border-amber-500/20',
  }
  const labels: Record<SubscriptionTier, string> = {
    standalone:    'Standalone',
    institutional: 'Institutional',
    enterprise:    'Enterprise',
  }
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium border ${colors[tier]}`}>
      {labels[tier]}
    </span>
  )
}

function formatDateShort(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function SubscriptionsPage() {
  // ── Auth gate ────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?next=/dashboard/admin/subscriptions')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileData } = await (supabase as any)
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profileData || profileData.role !== 'admin') redirect('/dashboard')

  const { funderRows, tierBreakdown } = await getSubscriptionData()

  return (
    <div className="min-h-screen bg-surface-0">
    <div className="dash-page">

      {/* Header */}
      <PageHeader
        eyebrow="Admin → Subscriptions"
        title="Subscription Management"
        description="Change funder subscription tiers. All changes are permanently logged with justification."
        action={
          <Link
            href="/dashboard/admin"
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.05] px-4 py-2.5 text-[13px] font-medium text-white/60 hover:bg-white/[0.08] hover:text-white transition-all"
          >
            <ArrowLeft size={14} />
            Admin Dashboard
          </Link>
        }
      />

      {/* Compliance notice */}
      <div className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
        <ShieldCheck size={15} className="text-vektrum-blue flex-shrink-0 mt-0.5" />
        <div className="text-[13px] text-white/50 space-y-0.5">
          <p className="font-medium text-white/70">Tier changes are audit-logged</p>
          <p>
            Every change requires a written justification and is permanently recorded in the
            admin audit log with your user ID. Changes affect only future deal fundings —
            existing <code className="text-white/60">billing_rate_bps</code> values are never retroactively modified.
          </p>
        </div>
      </div>

      {/* Tier summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Standalone',    count: tierBreakdown.standalone,    color: 'text-white/60' },
          { label: 'Institutional', count: tierBreakdown.institutional, color: 'text-vektrum-blue' },
          { label: 'Enterprise',    count: tierBreakdown.enterprise,    color: 'text-amber-400' },
          { label: 'Unset',         count: tierBreakdown.unset,         color: 'text-white/30' },
        ].map(({ label, count, color }) => (
          <div
            key={label}
            className="rounded-xl border border-white/[0.08] bg-surface-2 px-4 py-3"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35 mb-1">{label}</p>
            <p className={`font-display text-2xl font-bold ${color}`}>{count}</p>
            <p className="text-[11px] text-white/30 mt-0.5">funders</p>
          </div>
        ))}
      </div>

      {/* Funder table */}
      <div>
        <SectionHeader label="Funder Accounts" count={funderRows.length} />

        {funderRows.length === 0 ? (
          <div className="rounded-xl border border-white/[0.08] bg-surface-2 p-10 text-center text-[13px] text-white/30">
            No funder accounts found.
          </div>
        ) : (
          <div className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Funder</th>
                    <th>Current Tier</th>
                    <th>Rate</th>
                    <th>Deals</th>
                    <th>Fees Collected</th>
                    <th>Total Funded</th>
                    <th>Last Tier Change</th>
                    <th>Change Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {funderRows.map((funder) => (
                    <tr key={funder.id}>
                      <td>
                        <div>
                          <p className="font-medium text-white/90">
                            {funder.full_name ?? funder.company_name ?? '—'}
                          </p>
                          {funder.email && (
                            <p className="text-[11px] text-white/40 mt-0.5">{funder.email}</p>
                          )}
                          {funder.company_name && funder.full_name && (
                            <p className="text-[11px] text-white/35 mt-0.5">{funder.company_name}</p>
                          )}
                        </div>
                      </td>
                      <td>
                        <TierBadge tier={funder.subscription_tier} />
                      </td>
                      <td className="tabular-nums text-white/60">
                        {funder.subscription_tier
                          ? `${billingRateFromTier(funder.subscription_tier) / 100}%`
                          : '—'}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums">{funder.totalDeals}</span>
                          {funder.activeDeals > 0 && (
                            <span className="inline-flex items-center rounded-full bg-vektrum-blue/10 border border-vektrum-blue/20 px-1.5 py-0.5 text-[10px] text-vektrum-blue">
                              {funder.activeDeals} active
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="tabular-nums text-white/70">
                        {formatMoney(funder.totalFeesCollected)}
                      </td>
                      <td className="tabular-nums text-white/70">
                        {formatMoney(funder.totalFunded)}
                      </td>
                      <td className="text-white/40">
                        {formatDateShort(funder.lastTierChange)}
                      </td>
                      <td>
                        <TierChangeButton
                          profileId={funder.id}
                          currentTier={funder.subscription_tier ?? 'standalone'}
                          funderName={
                            funder.full_name ?? funder.company_name ?? funder.email ?? funder.id
                          }
                          hasActiveDeals={funder.activeDeals > 0}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Tier reference */}
      <div>
        <SectionHeader label="Tier Reference" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(['standalone', 'institutional', 'enterprise'] as SubscriptionTier[]).map((tier) => (
            <div
              key={tier}
              className="rounded-xl border border-white/[0.08] bg-surface-2 p-4"
            >
              <TierBadge tier={tier} />
              <p className="mt-2 text-[13px] text-white/70">{getFeeDescription(tier)}</p>
              <p className="mt-1 text-[11px] text-white/35">
                {tier === 'standalone'    && 'Self-service. No retainer required.'}
                {tier === 'institutional' && 'Retainer applies. Volume commitments.'}
                {tier === 'enterprise'    && 'Negotiated annually. Custom terms.'}
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
    </div>
  )
}
