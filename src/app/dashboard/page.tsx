import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { DealCard } from '@/components/deal/deal-card'
import { Money } from '@/components/ui/money'
import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import type { Deal, Profile } from '@/lib/types'
import { Plus, FolderOpen, Lock, AlertCircle, ArrowRight } from 'lucide-react'

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
    <div
      className="rounded-2xl border border-white/[0.08] bg-[#111827] px-5 py-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/[0.14]"
      style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03)' }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
        {label}
      </p>
      <p className="mt-2 font-display text-4xl font-bold tabular-nums text-white leading-none">{value}</p>
    </div>
  )
}

function MoneyStatTile({ label, amount }: { label: string; amount: number }) {
  return (
    <div
      className="rounded-2xl border border-white/[0.08] bg-[#111827] px-5 py-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/[0.14]"
      style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03)' }}
    >
      <Money label={label} amount={amount} size="xl" />
    </div>
  )
}

function EmptyDeals({ role }: { role: string }) {
  return (
    <div className="text-center py-16 rounded-2xl border border-dashed border-white/[0.08]">
      <FolderOpen size={40} className="mx-auto text-white/25 mb-3" aria-hidden="true" />
      <p className="text-white font-medium mb-1">No deals yet</p>
      <p className="text-white/50 text-sm mb-5">
        {role === 'contractor'
          ? 'Create your first deal to start tracking milestones and receiving payments.'
          : 'Deals will appear here once a contractor invites you to a project.'}
      </p>
      {role === 'contractor' && (
        <Link
          href="/dashboard/deals/new"
          className="group inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-vektrum-blue px-6 py-2.5 text-[14px] font-semibold text-white shadow-lg shadow-vektrum-blue/30 transition-all hover:bg-vektrum-blue-hover hover:shadow-xl hover:shadow-vektrum-blue/40 hover:-translate-y-0.5"
        >
          <Plus size={14} aria-hidden="true" />
          Create Deal
          <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
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

  if (!user) redirect('/auth/login?next=/dashboard')

  const { profile, deals } = await getProfileAndDeals(user.id)

  // First-login redirect: contractors and funders without Stripe go to onboarding
  // Admins are never gated
  if (profile && !profile.stripe_account_id) {
    if (profile.role === 'contractor') redirect('/dashboard/contractor/onboarding')
    if (profile.role === 'funder') redirect('/dashboard/funder/onboarding')
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center">
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

        <div className="min-h-screen bg-[#0D1B2A]">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-12 sm:py-16 space-y-8">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-3">
                <div className="h-px w-5 bg-vektrum-blue" />
                <p className="text-[11px] tracking-[0.12em] uppercase text-vektrum-blue font-semibold">Contractor Dashboard</p>
              </div>
              <h1 className="font-display text-[2.25rem] font-bold tracking-[-0.04em] text-white leading-[1.05]">
                Welcome back, {profile.full_name?.split(' ')[0] ?? 'there'}
              </h1>
            </div>
            {profile.stripe_account_id ? (
              <Link href="/dashboard/deals/new">
                <Button variant="primary" size="md">
                  <Plus size={15} aria-hidden="true" />
                  Create New Deal
                </Button>
              </Link>
            ) : (
              <Link href="/dashboard/contractor/onboarding">
                <Button variant="secondary" size="md">
                  <AlertCircle size={15} aria-hidden="true" />
                  Complete Setup to Create Deals
                  <ArrowRight size={14} aria-hidden="true" />
                </Button>
              </Link>
            )}
          </div>

          {/* Next Best Action module */}
          {(() => {
            const allMilestones = deals.flatMap((d) => d.milestones ?? [])
            let actionTitle: string | null = null
            let actionDescription = ''
            let actionCTA = ''
            let actionHref = ''
            let borderColor = 'border-vektrum-blue'
            let bgColor = 'bg-vektrum-blue-subtle'

            if (!profile.stripe_account_id) {
              actionTitle = 'Connect your Stripe account'
              actionDescription = 'Connect your Stripe account to receive payments.'
              actionCTA = 'Complete Setup'
              actionHref = '/dashboard/contractor/onboarding'
              borderColor = 'border-vektrum-amber'
              bgColor = 'bg-vektrum-amber-bg'
            } else if (deals.length === 0) {
              actionTitle = 'Create your first deal'
              actionDescription = 'Create your first deal to get started.'
              actionCTA = 'Create Deal'
              actionHref = '/dashboard/deals/new'
            } else if (allMilestones.some((m) => m.status === 'ready_for_review')) {
              actionTitle = 'Draw ready to submit'
              actionDescription = 'You have a draw ready to submit for funder review.'
              actionCTA = 'View Milestones'
              actionHref = `/dashboard/deals/${deals.find((d) => (d.milestones ?? []).some((m) => m.status === 'ready_for_review'))?.id}`
              borderColor = 'border-vektrum-amber'
              bgColor = 'bg-vektrum-amber-bg'
            } else if (allMilestones.some((m) => m.status === 'in_progress')) {
              actionTitle = 'Update your milestone progress'
              actionDescription = 'You have milestones in progress. Upload documents or submit for review when ready.'
              actionCTA = 'View Deal'
              actionHref = `/dashboard/deals/${deals.find((d) => (d.milestones ?? []).some((m) => m.status === 'in_progress'))?.id}`
            }

            if (!actionTitle) return null

            return (
              <div
                className={`border-l-4 ${borderColor} rounded-xl p-4 flex items-center justify-between`}
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderLeftWidth: '4px' }}
              >
                <div>
                  <p className="font-semibold text-white">{actionTitle}</p>
                  <p className="text-sm text-white/55">{actionDescription}</p>
                </div>
                <Link
                  href={actionHref}
                  className="group inline-flex items-center gap-1.5 bg-vektrum-blue text-white px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap ml-4 hover:bg-vektrum-blue-hover transition-all hover:-translate-y-0.5"
                >
                  {actionCTA}
                  <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            )
          })()}

          {/* Stripe setup banner */}
          {!profile.stripe_account_id && (
            <div className="flex items-start gap-3 rounded-xl border border-vektrum-amber-border bg-vektrum-amber-bg px-5 py-4">
              <AlertCircle size={18} className="text-vektrum-amber flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-[13px] font-semibold text-vektrum-amber">
                  Connect your Stripe account to create deals
                </p>
                <p className="text-[12px] text-vektrum-muted mt-0.5">
                  You must connect a Stripe account before you can create deals and receive milestone payments.
                </p>
                <Link
                  href="/dashboard/contractor/onboarding"
                  className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-vektrum-blue px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-vektrum-blue-hover transition-all"
                >
                  Complete Setup
                  <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Total Deals" value={deals.length} />
            <MoneyStatTile label="Total Funded" amount={totalFunded} />
            <MoneyStatTile label="Total Released" amount={totalReleased} />
            <StatTile label="Pending Review" value={pendingMilestones} />
          </div>

          {/* Draw Review Status Panel */}
          <div
            className="rounded-2xl border border-white/[0.08] overflow-hidden"
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03)' }}
          >
            <div className="border-l-4 border-vektrum-blue px-5 py-4 border-b border-white/[0.06] bg-[#111827]">
              <p className="text-[13px] font-semibold text-white">Draw Review Status</p>
            </div>
            <div className="p-4 bg-[#111827]">
              <DrawReviewPanel deals={deals} embedded />
            </div>
          </div>

          {/* Lien Waiver Tracker — feature-flagged */}
          {process.env.NEXT_PUBLIC_FEATURE_LIEN_WAIVER === 'true' && (
            <div className="rounded-2xl border border-dashed border-white/[0.08] bg-[#111827] p-6 opacity-60 cursor-not-allowed select-none">
              <div className="flex items-center gap-3 pointer-events-none">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.08]">
                  <Lock size={16} className="text-white/40" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-white/60">
                    Lien Waiver Tracker
                  </p>
                  <p className="text-[12px] text-white/35">
                    Track lien waivers per deal — required before final release. Coming soon.
                  </p>
                </div>
                <span className="ml-auto flex-shrink-0 rounded-full border border-vektrum-amber-border bg-vektrum-amber-bg px-2.5 py-0.5 text-[10px] font-medium text-vektrum-amber">
                  Coming soon
                </span>
              </div>
            </div>
          )}

          {/* Deals */}
          <section>
            <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
              Your Deals
            </h2>
            {deals.length === 0 ? (
              <EmptyDeals role="contractor" />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {deals.map((deal) => (
                  <DealCard key={deal.id} deal={deal} viewerRole="contractor" />
                ))}
              </div>
            )}
          </section>
        </div>
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

        <div className="min-h-screen bg-[#0D1B2A]">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-12 sm:py-16 space-y-8">
          {/* Header */}
          <div>
            <div className="mb-3 flex items-center gap-3">
              <div className="h-px w-5 bg-vektrum-blue" />
              <p className="text-[11px] tracking-[0.12em] uppercase text-vektrum-blue font-semibold">Funder Dashboard</p>
            </div>
            <h1 className="font-display text-[2.25rem] font-bold tracking-[-0.04em] text-white leading-[1.05]">
              Welcome back, {profile.full_name?.split(' ')[0] ?? 'there'}
            </h1>
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
              <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-vektrum-amber">
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
            <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
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
        </div>
      </>
    )
  }

  // ── Admin view — redirect to dedicated admin panel ──────────────────────────
  if (profile.role === 'admin') {
    redirect('/dashboard/admin')
  }
}
