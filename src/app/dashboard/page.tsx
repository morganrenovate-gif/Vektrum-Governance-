import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { DealCard } from '@/components/deal/deal-card'
import { Button } from '@/components/ui/button'
import type { Deal, Profile } from '@/lib/types'
import { Plus, FolderOpen, AlertCircle, ArrowRight } from 'lucide-react'
// Shared layout primitives
import { PageHeader, SectionHeader, StatBlock, MetricStrip, EmptyState } from '@/components/layout'
import { DrawReviewPanel } from '@/components/dashboard/draw-review-panel'
import { CapitalSummary } from '@/components/dashboard/capital-summary'
import { ReadinessGauge } from '@/components/dashboard/readiness-gauge'
import { IntelBriefing } from '@/components/dashboard/intel-briefing'
import { PortfolioRiskChart } from '@/components/dashboard/portfolio-risk-chart'
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard'
import { AssistantPanel } from '@/components/assistant/assistant-panel'
import { formatMoney } from '@/lib/utils'

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
      <div className="min-h-screen bg-surface-0 flex items-center justify-center px-4">
        <div className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-card px-8 py-7 max-w-sm w-full space-y-4">
          <div className="notice-error">
            <span>Your profile could not be loaded. This is usually a temporary issue.</span>
          </div>
          <div className="flex gap-3">
            <a
              href="/dashboard"
              className="inline-flex items-center justify-center min-h-[36px] px-4 rounded-xl bg-vektrum-blue text-white text-sm font-semibold hover:bg-vektrum-blue-hover transition-colors"
            >
              Retry
            </a>
            <a
              href="/auth/logout"
              className="inline-flex items-center justify-center min-h-[36px] px-4 rounded-xl border border-white/[0.12] text-sm text-white/60 hover:bg-white/[0.06] transition-colors"
            >
              Sign out
            </a>
          </div>
        </div>
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

        <div className="min-h-screen bg-surface-0">
          <div className="dash-page">

            {/* Header */}
            <PageHeader
              eyebrow="Contractor Dashboard"
              title={`Welcome back, ${profile.full_name?.split(' ')[0] ?? 'there'}`}
              action={
                profile.stripe_account_id ? (
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
                      Complete Setup
                      <ArrowRight size={14} aria-hidden="true" />
                    </Button>
                  </Link>
                )
              }
            />

            {/* Next Best Action module */}
            {(() => {
              const allMilestones = deals.flatMap((d) => d.milestones ?? [])
              let actionTitle: string | null = null
              let actionDescription = ''
              let actionCTA = ''
              let actionHref = ''
              let accentColor = 'border-vektrum-blue'
              let dotColor = 'bg-vektrum-blue'

              if (!profile.stripe_account_id) {
                actionTitle = 'Connect your Stripe account'
                actionDescription = 'Connect your Stripe account to receive payments.'
                actionCTA = 'Complete Setup'
                actionHref = '/dashboard/contractor/onboarding'
                accentColor = 'border-vektrum-amber'
                dotColor = 'bg-vektrum-amber'
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
                accentColor = 'border-vektrum-amber'
                dotColor = 'bg-vektrum-amber'
              } else if (allMilestones.some((m) => m.status === 'in_progress')) {
                actionTitle = 'Update your milestone progress'
                actionDescription = 'You have milestones in progress. Upload documents or submit for review when ready.'
                actionCTA = 'View Deal'
                actionHref = `/dashboard/deals/${deals.find((d) => (d.milestones ?? []).some((m) => m.status === 'in_progress'))?.id}`
              }

              if (!actionTitle) return null

              return (
                <div
                  className={`rounded-xl border border-white/[0.08] bg-surface-2 shadow-card px-5 py-4 flex items-center justify-between border-l-4 ${accentColor}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
                    <div>
                      <p className="text-[14px] font-semibold text-white">{actionTitle}</p>
                      <p className="text-[13px] text-white/55 mt-0.5">{actionDescription}</p>
                    </div>
                  </div>
                  <Link href={actionHref} className="ml-4 flex-shrink-0">
                    <Button variant="primary" size="sm">
                      {actionCTA}
                      <ArrowRight size={13} aria-hidden="true" />
                    </Button>
                  </Link>
                </div>
              )
            })()}

            {/* Stripe setup banner */}
            {!profile.stripe_account_id && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-5 py-4">
                <AlertCircle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="text-[13px] font-semibold text-amber-400">
                    Connect your Stripe account to create deals
                  </p>
                  <p className="text-[12px] text-white/45 mt-0.5">
                    You must connect a Stripe account before you can create deals and receive milestone payments.
                  </p>
                  <Link href="/dashboard/contractor/onboarding" className="mt-3 inline-block">
                    <Button variant="primary" size="sm">
                      Complete Setup
                      <ArrowRight size={12} aria-hidden="true" />
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {/* Quick Stats — horizontal metric strip */}
            <MetricStrip>
              <StatBlock inline label="Total Deals" value={deals.length} />
              <StatBlock inline label="Total Funded" value={formatMoney(totalFunded)} money />
              <StatBlock inline label="Total Released" value={formatMoney(totalReleased)} money />
              <StatBlock inline label="Pending Review" value={pendingMilestones} alert={pendingMilestones > 0} />
            </MetricStrip>

            {/* Draw Review Status Panel */}
            <div className="rounded-xl border border-white/[0.08] bg-surface-2 overflow-hidden shadow-card">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
                <div className="h-px w-5 bg-vektrum-blue flex-shrink-0" aria-hidden="true" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-vektrum-blue">
                  Draw Review Status
                </p>
              </div>
              <div className="p-4">
                <DrawReviewPanel deals={deals} embedded />
              </div>
            </div>

            {/* Deals */}
            <section>
              <SectionHeader label="Your Deals" count={deals.length > 0 ? deals.length : undefined} />
              {deals.length === 0 ? (
                <EmptyState
                  icon={FolderOpen}
                  title="No deals yet"
                  description="Create your first deal to start tracking milestones and receiving payments."
                  action={{ label: "Create Deal", href: "/dashboard/deals/new" }}
                />
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

        <div className="min-h-screen bg-surface-0">
          <div className="dash-page">

            {/* Header */}
            <PageHeader
              eyebrow="Funder Dashboard"
              title={`Welcome back, ${profile.full_name?.split(' ')[0] ?? 'there'}`}
            />

            {/* Weekly briefing card */}
            <IntelBriefing />

            {/* Capital Summary */}
            <CapitalSummary totalFunded={totalFunded} totalReleased={totalReleased} />

            {/* Portfolio Risk Chart */}
            <PortfolioRiskChart deals={deals} />

            {/* Action Queue — sorted by amount */}
            {actionRequiredSorted.length > 0 && (
              <section>
                <SectionHeader
                  label="Action Queue"
                  count={actionRequiredSorted.length}
                  variant="warning"
                />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {actionRequiredSorted.map((deal) => (
                    <div key={deal.id} className="space-y-3">
                      <DealCard deal={deal} />
                      <div className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-card px-4 py-4">
                        <ReadinessGauge dealId={deal.id} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Funded Deals */}
            <section>
              <SectionHeader label="Funded Deals" count={funded.length > 0 ? funded.length : undefined} />
              {funded.length === 0 ? (
                <EmptyState
                  icon={FolderOpen}
                  title="No funded deals yet"
                  description="Deals will appear here once a contractor invites you to a project."
                />
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