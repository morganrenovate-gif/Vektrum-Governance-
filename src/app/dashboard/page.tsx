import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { DealCard } from '@/components/deal/deal-card'
import { Money } from '@/components/ui/money'
import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import type { Deal, Profile } from '@/lib/types'
import { Plus, FileText, AlertCircle, Lock } from 'lucide-react'

// Phase 6/7 dashboard sub-components
import { DrawReviewPanel } from '@/components/dashboard/draw-review-panel'
import { CapitalSummary } from '@/components/dashboard/capital-summary'
import { ReadinessGauge } from '@/components/dashboard/readiness-gauge'
import { IntelBriefing } from '@/components/dashboard/intel-briefing'
import { PortfolioRiskChart } from '@/components/dashboard/portfolio-risk-chart'

// Phase 2/3 overlay + assistant (client components — imported dynamically)
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard'
import { AssistantPanel } from '@/components/assistant/assistant-panel'

async function getProfileAndDeals(userId: string) {
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawProfile } = await (supabase as any)
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (!rawProfile) return { profile: null, deals: [] }

  const profile = rawProfile as Profile

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('deals')
    .select(
      `
      *,
      contractor:profiles!deals_contractor_id_fkey(*),
      funder:profiles!deals_funder_id_fkey(*),
      milestones(*)
    `,
    )
    .order('created_at', { ascending: false })
    .order('order_index', { referencedTable: 'milestones', ascending: true })

  if (profile.role === 'contractor') {
    query = query.eq('contractor_id', userId)
  } else if (profile.role === 'funder') {
    query = query.eq('funder_id', userId)
  }

  const { data: deals } = await query
  return { profile, deals: (deals ?? []) as Deal[] }
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-vektrum-border bg-vektrum-surface px-5 py-4 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-vektrum-text">{value}</p>
    </div>
  )
}

function MoneyStatTile({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="rounded-lg border border-vektrum-border bg-vektrum-surface px-5 py-4 shadow-sm">
      <Money label={label} amount={amount} size="lg" />
    </div>
  )
}

function EmptyDeals({ role }: { role: string }) {
  return (
    <div className="rounded-lg border border-dashed border-vektrum-border bg-vektrum-surface-alt px-8 py-16 text-center">
      <AlertCircle size={32} className="mx-auto text-vektrum-faint" aria-hidden="true" />
      <p className="mt-3 text-sm font-medium text-vektrum-muted">
        {role === 'contractor'
          ? "You haven't created any deals yet."
          : 'No deals have been assigned to you yet.'}
      </p>
      {role === 'contractor' && (
        <div className="mt-4">
          <Link href="/dashboard/deals/new">
            <Button variant="primary" size="sm">
              <Plus size={14} aria-hidden="true" />
              Create your first deal
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { profile, deals } = await getProfileAndDeals(user.id)

  if (!profile) {
    return (
      <div className="page-container py-12">
        <Card>
          <CardBody>
            <p className="text-sm text-vektrum-muted">
              Your profile could not be loaded. Please sign out and try again.
            </p>
          </CardBody>
        </Card>
      </div>
    )
  }

  const totalFunded = deals.reduce((s, d) => s + d.funded_amount, 0)
  const totalReleased = deals.reduce((s, d) => s + d.released_amount, 0)
  const pendingMilestones = deals
    .flatMap((d) => d.milestones ?? [])
    .filter((m) => m.status === 'ready_for_review').length

  // ── Contractor view ─────────────────────────────────────────────────────────
  if (profile.role === 'contractor') {
    return (
      <>
        {/* Onboarding wizard — renders only if onboarding_complete === false */}
        {!profile.onboarding_complete && <OnboardingWizard profile={profile} />}

        {/* Persistent AI assistant */}
        <AssistantPanel actionRequired={pendingMilestones} />

        <div className="page-container section space-y-8">
          {/* Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-bold text-vektrum-text">
                Welcome back, {profile.full_name?.split(' ')[0] ?? 'there'}
              </h1>
              <p className="mt-0.5 text-sm text-vektrum-muted">Contractor dashboard</p>
            </div>
            <Link href="/dashboard/deals/new">
              <Button variant="primary" size="md">
                <Plus size={15} aria-hidden="true" />
                Create New Deal
              </Button>
            </Link>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Total Deals" value={deals.length} />
            <MoneyStatTile label="Total Funded" amount={totalFunded} />
            <MoneyStatTile label="Total Released" amount={totalReleased} />
            <StatTile label="Pending Review" value={pendingMilestones} />
          </div>

          {/* Draw Review Status Panel */}
          <DrawReviewPanel deals={deals} />

          {/* Lien Waiver Tracker — Coming Soon */}
          <div className="rounded-xl border border-dashed border-vektrum-border bg-vektrum-surface-alt p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-vektrum-border">
                <Lock size={16} className="text-vektrum-faint" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-vektrum-muted">
                  Lien Waiver Tracker
                </p>
                <p className="text-[12px] text-vektrum-faint">
                  Track lien waivers per deal — required before final release. Coming soon.
                </p>
              </div>
              <span className="ml-auto flex-shrink-0 rounded-full border border-vektrum-amber-border bg-vektrum-amber-bg px-2.5 py-0.5 text-[10px] font-medium text-vektrum-amber">
                Coming soon
              </span>
            </div>
          </div>

          {/* Deals */}
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-vektrum-muted">
              Your Deals
            </h2>
            {deals.length === 0 ? (
              <EmptyDeals role="contractor" />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {deals.map((deal) => (
                  <DealCard key={deal.id} deal={deal} />
                ))}
              </div>
            )}
          </section>
        </div>
      </>
    )
  }

  // ── Funder view ─────────────────────────────────────────────────────────────
  if (profile.role === 'funder') {
    const actionRequired = deals.filter((d) =>
      (d.milestones ?? []).some((m) => m.status === 'ready_for_review'),
    )
    // Sort by highest milestone amount needing action (descending)
    const actionRequiredSorted = [...actionRequired].sort((a, b) => {
      const aMax = Math.max(
        ...(a.milestones ?? [])
          .filter((m) => m.status === 'ready_for_review')
          .map((m) => m.amount),
        0,
      )
      const bMax = Math.max(
        ...(b.milestones ?? [])
          .filter((m) => m.status === 'ready_for_review')
          .map((m) => m.amount),
        0,
      )
      return bMax - aMax
    })
    const funded = deals.filter((d) => d.funded_amount > 0)

    return (
      <>
        {/* Onboarding wizard */}
        {!profile.onboarding_complete && <OnboardingWizard profile={profile} />}

        {/* Persistent AI assistant */}
        <AssistantPanel actionRequired={pendingMilestones} />

        <div className="page-container section space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-xl font-bold text-vektrum-text">
              Welcome back, {profile.full_name?.split(' ')[0] ?? 'there'}
            </h1>
            <p className="mt-0.5 text-sm text-vektrum-muted">Funder dashboard</p>
          </div>

          {/* Weekly briefing card */}
          <IntelBriefing />

          {/* Capital Summary */}
          <CapitalSummary totalFunded={totalFunded} totalReleased={totalReleased} />

          {/* Portfolio Risk Chart */}
          <PortfolioRiskChart deals={deals} />

          {/* Action Queue — sorted by amount */}
          {actionRequiredSorted.length > 0 && (
            <section>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-vektrum-amber">
                Action Queue ({actionRequiredSorted.length})
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {actionRequiredSorted.map((deal) => (
                  <div key={deal.id} className="space-y-3">
                    <DealCard deal={deal} />
                    {/* Readiness gauge per deal */}
                    <div className="rounded-lg border border-vektrum-border bg-vektrum-surface px-4 py-4">
                      <ReadinessGauge dealId={deal.id} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Funded Deals */}
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-vektrum-muted">
              Funded Deals
            </h2>
            {funded.length === 0 ? (
              <EmptyDeals role="funder" />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {funded.map((deal) => (
                  <DealCard key={deal.id} deal={deal} />
                ))}
              </div>
            )}
          </section>
        </div>
      </>
    )
  }

  // ── Admin view ──────────────────────────────────────────────────────────────
  const totalAmount = deals.reduce((s, d) => s + d.total_amount, 0)

  return (
    <>
      {/* Admin also gets the assistant */}
      <AssistantPanel actionRequired={pendingMilestones} />

      <div className="page-container section space-y-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-vektrum-text">Admin Dashboard</h1>
            <p className="mt-0.5 text-sm text-vektrum-muted">All deals across the platform</p>
          </div>
          <Link href="/dashboard/audit">
            <Button variant="secondary" size="md">
              <FileText size={15} aria-hidden="true" />
              Audit Log
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Total Deals" value={deals.length} />
          <MoneyStatTile label="Deal Volume" amount={totalAmount} />
          <MoneyStatTile label="Total Released" amount={totalReleased} />
          <StatTile label="Pending Milestones" value={pendingMilestones} />
        </div>

        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-vektrum-muted">
            All Deals
          </h2>
          {deals.length === 0 ? (
            <div className="rounded-lg border border-dashed border-vektrum-border bg-vektrum-surface-alt px-8 py-12 text-center">
              <p className="text-sm text-vektrum-faint">No deals in the system yet.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {deals.map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  )
}
