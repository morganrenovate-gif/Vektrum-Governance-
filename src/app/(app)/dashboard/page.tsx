import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { DealCard } from '@/components/deal/deal-card'
import { Button } from '@/components/ui/button'
import type { Deal, Profile } from '@/lib/types'
import { Plus, FolderOpen, AlertCircle, ArrowRight, CheckCircle2, ListChecks, Lock, Building2, User as UserIcon, Eye } from 'lucide-react'
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
import type { Milestone, MilestoneStatus } from '@/lib/types'

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

  const { data: rawDeals } = await query
let deals = rawDeals ?? []

  // ── Funder profile fallback ─────────────────────────────────────────────────
  // The user-session client (RLS) may not allow contractors to read the funder's
  // profile, causing the funder join to return null even when funder_id is set.
  // When any deal has funder_id set but funder join is null, batch-fetch those
  // profiles via the admin client (server-side only).
  const dealsMissingFunder = (deals ?? []).filter(
    (d: any) => d.funder_id && !d.funder,
  )
  if (dealsMissingFunder.length > 0) {
    const uniqueFunderIds = [...new Set(dealsMissingFunder.map((d: any) => d.funder_id as string))]
    const adminClient = createSupabaseAdminClient()
    const { data: funderProfiles } = await adminClient
      .from('profiles')
      .select('id, full_name, company_name, email, role')
      .in('id', uniqueFunderIds)
    if (funderProfiles) {
      const funderById = new Map(funderProfiles.map((p) => [p.id, p]))

deals = deals.map((deal: any) => {
  if (deal.funder_id && !deal.funder) {
    const funder = funderById.get(deal.funder_id)

    if (funder) {
      return {
        ...deal,
        funder,
      }
    }

    console.warn('[dashboard] funder profile fallback unresolved', {
      deal_id: deal.id,
      funder_id: deal.funder_id,
    })
  }

  return deal
})
    }
  }

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

  // First-login redirects.
  // Admins are never gated.
  // Contractors must connect Stripe before they reach the dashboard
  // (contractors receive released funds via Stripe Connect — the only
  // execution path implemented today).
  // Funders are routed to onboarding only until they have made a
  // disbursement-rail choice (Stripe / external / set up later). Once
  // any rail is selected, they can use the dashboard freely. Release
  // execution still requires a configured rail — that gate is enforced
  // server-side by the deterministic release gate.
  if (profile) {
    if (profile.role === 'contractor' && !profile.stripe_account_id) {
      redirect('/dashboard/contractor/onboarding')
    }
    if (profile.role === 'funder' && !profile.disbursement_rail) {
      redirect('/dashboard/funder/onboarding')
    }
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
  // Governance fee totals — only from deals that have governance model data
  const totalFacility = deals.reduce((s, d) => s + (d.facility_total ?? 0), 0)
  const totalGovernanceFees = deals.reduce((s, d) => s + (d.governance_fee_total ?? 0), 0)
  const pendingMilestones = deals
    .flatMap((d) => d.milestones ?? [])
    .filter((m) => m.status === 'ready_for_review').length

  // ── Contractor view ─────────────────────────────────────────────────────────
  if (profile.role === 'contractor') {
    // Annotate every milestone with its parent deal so we can sort/route by it.
    const milestonesWithDeal = deals.flatMap((d) =>
      (d.milestones ?? []).map((m) => ({ milestone: m, deal: d })),
    )

    // Workflow buckets — drives both the workflow metric tiles and the pipeline
    // table. Mapping to a consistent contractor status vocabulary used across
    // the demo and the live app.
    const needsActionMs    = milestonesWithDeal.filter(({ milestone: m }) => m.status === 'in_progress' || m.status === 'not_started')
    const underReviewMs    = milestonesWithDeal.filter(({ milestone: m }) => m.status === 'ready_for_review')
    const waitingFunderMs  = milestonesWithDeal.filter(({ milestone: m }) => m.status === 'approved')
    const releasedMs       = milestonesWithDeal.filter(({ milestone: m }) => m.status === 'released')
    const disputedMs       = milestonesWithDeal.filter(({ milestone: m }) => m.status === 'disputed')

    // Pipeline value = anything actively moving toward release.
    const pendingValue   = [...underReviewMs, ...waitingFunderMs].reduce((s, x) => s + x.milestone.amount, 0)
    const awaitingValue  = waitingFunderMs.reduce((s, x) => s + x.milestone.amount, 0)
    const inReviewValue  = underReviewMs.reduce((s, x) => s + x.milestone.amount, 0)

    // Deals that have no milestones yet — explicit "Setup incomplete" state.
    const setupIncompleteDeals = deals.filter((d) => (d.milestones ?? []).length === 0)

    // Most-important draw selection — bubble disputes first, then approved
    // (about to release), then under review, then in-progress, then not-started.
    // Within a status, larger amount wins.
    const PRIORITY_ORDER: Record<MilestoneStatus, number> = {
      disputed:         0,
      payout_failed:    0,
      approved:         1,
      ready_for_review: 2,
      in_progress:      3,
      not_started:      4,
      released:         99,
    }
    const sortable = [...milestonesWithDeal]
      .filter(({ milestone: m }) => m.status !== 'released')
      .sort((a, b) => {
        const pa = PRIORITY_ORDER[a.milestone.status] ?? 99
        const pb = PRIORITY_ORDER[b.milestone.status] ?? 99
        if (pa !== pb) return pa - pb
        return b.milestone.amount - a.milestone.amount
      })
    const primary = sortable[0] ?? null

    // Header subtitle — concrete, operational, never empty even with zero released.
    const subtitleParts: string[] = []
    if (needsActionMs.length > 0)         subtitleParts.push(`${needsActionMs.length} need${needsActionMs.length === 1 ? 's' : ''} your action`)
    if (underReviewMs.length > 0)         subtitleParts.push(`${underReviewMs.length} under control review`)
    if (waitingFunderMs.length > 0)       subtitleParts.push(`${waitingFunderMs.length} awaiting funder`)
    if (disputedMs.length > 0)            subtitleParts.push(`${disputedMs.length} in dispute`)
    if (setupIncompleteDeals.length > 0)  subtitleParts.push(`${setupIncompleteDeals.length} deal${setupIncompleteDeals.length === 1 ? '' : 's'} need setup`)
    const headerSubtitle = subtitleParts.length > 0
      ? subtitleParts.join(' · ')
      : 'No items requiring action right now.'

    return (
      <>
        {/* Onboarding wizard — renders only if onboarding_complete === false */}
        {!profile.onboarding_complete && <OnboardingWizard profile={profile} />}

        {/* Persistent AI assistant */}
        <AssistantPanel actionRequired={pendingMilestones} />

        <div className="min-h-screen bg-surface-0">
          <div className="dash-page">

            {/* Header — restrained title + concrete operational subtitle */}
            <PageHeader
              eyebrow="Contractor dashboard"
              title={`Welcome back, ${profile.full_name?.split(' ')[0] ?? 'there'}`}
              description={headerSubtitle}
              action={
                <Link href="/dashboard/deals/new">
                  <Button variant="primary" size="md">
                    <Plus size={15} aria-hidden="true" />
                    Submit project information
                  </Button>
                </Link>
              }
            />

            {/* Stripe setup banner — kept as fallback. Normally contractors are
                redirected to onboarding before reaching this view, but render
                this if the redirect was somehow bypassed. */}
            {!profile.stripe_account_id && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-5 py-4">
                <AlertCircle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div className="flex-1">
                  <p className="text-[13px] font-semibold text-amber-400">
                    Connect your Stripe account to receive releases
                  </p>
                  <p className="text-[12px] text-white/75 mt-0.5 leading-relaxed">
                    Funder authorization releases funds via your selected rail. Stripe Connect must be
                    in place before milestone releases can execute.
                  </p>
                  <Link href="/dashboard/contractor/onboarding" className="mt-3 inline-block">
                    <Button variant="primary" size="sm">
                      Complete setup
                      <ArrowRight size={12} aria-hidden="true" />
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {/* ── Guided release-flow strip ─────────────────────────────── */}
            <ContractorGuidedStrip />

            {/* ── Command center: most important draw + needs action + waiting on funder ── */}
            <section
              aria-label="Today's release work"
              className="grid gap-4 lg:grid-cols-5"
            >
              <ContractorPrimaryDrawCard primary={primary} />
              <ContractorAttentionStack
                needsAction={needsActionMs}
                setupIncompleteDeals={setupIncompleteDeals}
                waitingFunderCount={waitingFunderMs.length}
                waitingFunderAmount={awaitingValue}
                inReviewCount={underReviewMs.length}
              />
            </section>

            {/* ── Workflow metrics — replaces the generic KPI strip ─────── */}
            <section aria-label="Workflow metrics">
              <SectionHeader label="Workflow metrics" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <ContractorMetricTile
                  label="Need your action"
                  value={String(needsActionMs.length + setupIncompleteDeals.length)}
                  sublabel={(needsActionMs.length + setupIncompleteDeals.length) === 0 ? 'All clear' : 'Items waiting on you'}
                  tone={(needsActionMs.length + setupIncompleteDeals.length) === 0 ? 'ok' : 'amber'}
                />
                <ContractorMetricTile
                  label="Under control review"
                  value={String(underReviewMs.length)}
                  sublabel={inReviewValue > 0 ? formatMoney(inReviewValue) : 'None'}
                  tone="neutral"
                />
                <ContractorMetricTile
                  label="Waiting on funder"
                  value={String(waitingFunderMs.length)}
                  sublabel={awaitingValue > 0 ? formatMoney(awaitingValue) : 'None'}
                  tone="blue"
                />
                <ContractorMetricTile
                  label="Released to date"
                  value={formatMoney(totalReleased)}
                  sublabel={`${releasedMs.length} milestone${releasedMs.length === 1 ? '' : 's'} released`}
                  tone="ok"
                />
              </div>
            </section>

            {/* ── Release pipeline (replaces Draw Review Status) ────────── */}
            <section aria-label="Release pipeline">
              <SectionHeader label="Release pipeline" />
              {milestonesWithDeal.length === 0 ? (
                <div className="rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card px-5 py-6 text-center">
                  <p className="text-[13px] text-white/55">No milestones yet. Add milestones to a deal to start moving releases.</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden">
                  <div className="hidden sm:grid grid-cols-12 gap-3 px-5 py-2.5 border-b border-white/[0.06] text-[10px] font-semibold uppercase tracking-[0.10em] text-white/45">
                    <span className="col-span-4">Project / milestone</span>
                    <span className="col-span-2 text-right">Amount</span>
                    <span className="col-span-2">Stage</span>
                    <span className="col-span-2">Next owner</span>
                    <span className="col-span-2 text-right">Action</span>
                  </div>
                  <div className="divide-y divide-white/[0.05]">
                    {[...milestonesWithDeal]
                      .filter(({ milestone: m }) => m.status !== 'released')
                      .sort((a, b) => {
                        const pa = PRIORITY_ORDER[a.milestone.status] ?? 99
                        const pb = PRIORITY_ORDER[b.milestone.status] ?? 99
                        if (pa !== pb) return pa - pb
                        return b.milestone.amount - a.milestone.amount
                      })
                      .map(({ milestone, deal }) => (
                        <ContractorPipelineRow
                          key={milestone.id}
                          milestone={milestone}
                          dealId={deal.id}
                          dealTitle={deal.title}
                        />
                      ))}
                    {releasedMs.length > 0 && releasedMs.slice(0, 3).map(({ milestone, deal }) => (
                      <ContractorPipelineRow
                        key={milestone.id}
                        milestone={milestone}
                        dealId={deal.id}
                        dealTitle={deal.title}
                      />
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* ── Active deals ──────────────────────────────────────────── */}
            <section>
              <SectionHeader label="Active deals" count={deals.length > 0 ? deals.length : undefined} />
              {deals.length === 0 ? (
                <EmptyState
                  icon={FolderOpen}
                  title="No projects yet"
                  description="You’ll see projects here when a funder invites you, or you can submit project information for funder review. Vektrum enforces release conditions — funders authorize, the gate decides."
                  action={{ label: "Submit project information", href: "/dashboard/deals/new" }}
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {deals.map((deal) => (
                    <ContractorDealCard key={deal.id} deal={deal} />
                  ))}
                </div>
              )}
            </section>

            {/* ── Secondary tools — keeps the existing legacy review panel
                  available for reference, demoted below operational sections ── */}
            {milestonesWithDeal.length > 0 && (
              <details className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <summary className="cursor-pointer list-none px-5 py-3 flex items-center justify-between text-[12px] text-white/55 hover:text-white/80 transition-colors">
                  <span className="font-semibold uppercase tracking-[0.10em]">Detailed draw review status</span>
                  <span className="text-[11px] text-white/35">expand</span>
                </summary>
                <div className="p-4 border-t border-white/[0.06]">
                  <DrawReviewPanel deals={deals} embedded />
                </div>
              </details>
            )}

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
              action={
                <Link href="/dashboard/deals/new">
                  <Button variant="primary" size="md">
                    <Plus size={15} aria-hidden="true" />
                    Create governed deal
                  </Button>
                </Link>
              }
            />

            {/* ── Disbursement rail status ─────────────────────────────────
                Surfaces the funder's selected rail so the rest of the
                dashboard does not silently assume Stripe. Vektrum records
                authorization readiness; disbursement is executed through
                the selected rail. */}
            {profile.disbursement_rail === 'external_rail' && (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-5 py-3">
                <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="text-[13px] font-semibold text-emerald-300">
                    Disbursement rail: External / partner rail
                  </p>
                  <p className="mt-0.5 text-[12px] text-white/65 leading-relaxed">
                    Vektrum records authorization readiness. Disbursement is executed through the selected external rail.
                  </p>
                </div>
              </div>
            )}
            {profile.disbursement_rail === 'not_configured' && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-5 py-3">
                <AlertCircle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div className="flex-1">
                  <p className="text-[13px] font-semibold text-amber-400">
                    Payment rail not configured
                  </p>
                  <p className="mt-0.5 text-[12px] text-white/65 leading-relaxed">
                    You can set up Stripe or select an external rail before release execution.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href="/dashboard/funder/onboarding"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 px-3 py-1.5 text-[12px] font-semibold hover:bg-amber-500/25 transition-colors"
                    >
                      Choose rail
                      <ArrowRight size={12} aria-hidden="true" />
                    </Link>
                    <Link
                      href="/dashboard/settings"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.10] px-3 py-1.5 text-[12px] font-semibold text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
                    >
                      Manage in Settings
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Weekly briefing card */}
            <IntelBriefing />

            {/* Capital Summary */}
            <CapitalSummary
              totalFunded={totalFunded}
              totalReleased={totalReleased}
              totalFacility={totalFacility > 0 ? totalFacility : undefined}
              totalGovernanceFees={totalGovernanceFees > 0 ? totalGovernanceFees : undefined}
            />

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

            {/* All Projects — shows every deal where funder_id matches, regardless of funded_amount */}
            <section>
              <SectionHeader label="All Projects" count={deals.length > 0 ? deals.length : undefined} />
              {deals.length === 0 ? (
                <EmptyState
                  icon={FolderOpen}
                  title="No governed deals yet"
                  description="Create your first governed deal from a contract, funding agreement, or draw schedule. Vektrum helps organize parties, release conditions, SOV/milestones, retainage, and audit evidence before release authorization."
                  action={{ label: "Create governed deal", href: "/dashboard/deals/new" }}
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {deals.map((deal) => (
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

  // ── Unknown / unexpected role ─────────────────────────────────────────────────
  // profile.role is not contractor, funder, or admin. This can happen when a user
  // signed up via a path that set an unexpected role value, or if the DB trigger
  // failed to assign a role. Do NOT silently fall through to any role-specific
  // view (the design-pass spec is explicit: "Do not silently default to funder").
  // Show a complete-profile prompt with a safe CTA to /dashboard/settings, where
  // the user can correct their role or contact support.
  console.error(
    `[dashboard] User ${profile.id ?? 'unknown'} has unrecognised role — ` +
    'rendering complete-profile fallback. Expected: contractor | funder | admin.',
  )
  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center px-4">
      <div
        role="alert"
        aria-live="polite"
        className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-card px-8 py-7 max-w-md w-full space-y-4"
      >
        <div>
          <p className="text-[15px] font-semibold text-white">
            Complete your profile to continue.
          </p>
          <p className="mt-2 text-[13px] text-white/65 leading-relaxed">
            We could not determine your account role. Visit your profile to set
            your role, or sign out and sign back in. Contact support if the issue
            persists.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center justify-center min-h-[36px] px-4 rounded-xl bg-vektrum-blue text-sm font-semibold text-white hover:bg-vektrum-blue-hover transition-colors"
          >
            Complete profile
            <ArrowRight size={13} className="ml-1.5" aria-hidden="true" />
          </Link>
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

// ─── Contractor dashboard components ──────────────────────────────────────────
// Server-rendered. All state is derived from props; no client interactivity.

type ContractorStage =
  | 'setup_incomplete'
  | 'contractor_action'
  | 'under_review'
  | 'awaiting_funder'
  | 'released'
  | 'disputed'

const CONTRACTOR_STAGE_META: Record<ContractorStage, { label: string; classes: string }> = {
  setup_incomplete: {
    label:   'Setup incomplete',
    classes: 'bg-white/[0.06] text-white/70 border-white/[0.12]',
  },
  contractor_action: {
    label:   'Contractor action required',
    classes: 'bg-amber-500/[0.10] text-amber-300 border-amber-500/25',
  },
  under_review: {
    label:   'Under control review',
    classes: 'bg-white/[0.06] text-white/65 border-white/[0.12]',
  },
  awaiting_funder: {
    label:   'Waiting on funder approval',
    classes: 'bg-vektrum-blue/[0.10] text-blue-300 border-vektrum-blue/25',
  },
  released: {
    label:   'Released',
    classes: 'bg-emerald-500/[0.10] text-emerald-300 border-emerald-500/25',
  },
  disputed: {
    label:   'Disputed',
    classes: 'bg-red-500/[0.10] text-red-300 border-red-500/25',
  },
}

function ContractorStageBadge({ stage, className = '' }: { stage: ContractorStage; className?: string }) {
  const m = CONTRACTOR_STAGE_META[stage]
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${m.classes} ${className}`}>
      {m.label}
    </span>
  )
}

function milestoneToStage(status: MilestoneStatus): ContractorStage {
  switch (status) {
    case 'released':         return 'released'
    case 'approved':         return 'awaiting_funder'
    case 'ready_for_review': return 'under_review'
    case 'in_progress':      return 'contractor_action'
    case 'not_started':      return 'contractor_action'
    case 'disputed':         return 'disputed'
    default:                 return 'contractor_action'
  }
}

function ContractorGuidedStrip() {
  const steps = [
    { n: 1, label: 'Submit draw package' },
    { n: 2, label: 'Clear required conditions' },
    { n: 3, label: 'Complete control review' },
    { n: 4, label: 'Await funder authorization' },
    { n: 5, label: 'Track payment execution' },
  ]
  return (
    <section
      aria-label="How releases move"
      className="rounded-xl border border-white/[0.07] bg-surface-2/40 px-5 py-3.5"
    >
      <div className="flex items-center gap-2 mb-2.5">
        <ListChecks size={12} className="text-white/55" aria-hidden="true" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">
          How releases move
        </p>
      </div>
      <ol className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 sm:flex-wrap">
        {steps.map((step, i) => (
          <li key={step.n} className="flex items-center gap-2 text-[12px] text-white/65">
            <span className="inline-flex items-center justify-center h-5 w-5 rounded-full border border-white/[0.14] bg-white/[0.04] text-[10px] font-semibold tabular-nums text-white/65 flex-shrink-0">
              {step.n}
            </span>
            <span>{step.label}</span>
            {i < steps.length - 1 && (
              <span aria-hidden="true" className="hidden sm:inline text-white/15 ml-1">→</span>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}

interface PrimaryDrawData {
  milestone: Milestone
  deal:      Deal
}

function ContractorPrimaryDrawCard({ primary }: { primary: PrimaryDrawData | null }) {
  // Empty state — no actionable milestone anywhere in the portfolio.
  if (!primary) {
    return (
      <article className="lg:col-span-3 rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden">
        <div className="px-6 py-6 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
            Most important draw
          </p>
          <h2 className="text-[16px] font-semibold text-white leading-tight">
            No active draws right now
          </h2>
          <p className="text-[13px] text-white/55 leading-relaxed">
            When a deal has a milestone in progress or under review, the most important draw will
            appear here with a clear next step.
          </p>
        </div>
      </article>
    )
  }

  const { milestone, deal } = primary
  const stage = milestoneToStage(milestone.status)
  const meta = CONTRACTOR_STAGE_META[stage]

  // Per-stage messaging — explains the bottleneck and the contractor's next step.
  const variant: {
    summary:    string
    completed:  string[]
    pending:    Array<{ label: string; owner: string }>
    cta:        string
    bottleneck: string
  } = (() => {
    switch (stage) {
      case 'awaiting_funder':
        return {
          summary:    'Control review is complete. No additional contractor action is required before funder authorization.',
          completed:  ['Draw package submitted', 'Control review completed', 'Release conditions satisfied'],
          pending:    [
            { label: 'Funder approval',                 owner: 'Funder' },
            { label: 'Release execution after approval', owner: 'Selected rail' },
          ],
          cta:        'View draw details',
          bottleneck: 'Bottleneck: funder approval',
        }
      case 'under_review':
        return {
          summary:    'Submitted for control review. Funder authorization remains the next step after review clears.',
          completed:  ['Draw package submitted'],
          pending:    [
            { label: 'Control review',                  owner: 'Vektrum review' },
            { label: 'Funder approval after review',    owner: 'Funder' },
          ],
          cta:        'Track review',
          bottleneck: 'Bottleneck: control review in progress',
        }
      case 'contractor_action':
        return {
          summary:    'Upload supporting documents and submit this milestone for control review. The release gate runs after submission.',
          completed:  [],
          pending:    [
            { label: 'Upload supporting documents',     owner: 'Contractor' },
            { label: 'Submit draw for review',          owner: 'Contractor' },
            { label: 'Funder approval after review',    owner: 'Funder' },
          ],
          cta:        'Complete draw package',
          bottleneck: 'Bottleneck: contractor action required',
        }
      case 'setup_incomplete':
        return {
          summary:    'Add milestone details to this deal before a draw request can be submitted.',
          completed:  [],
          pending:    [
            { label: 'Add milestones and amounts',      owner: 'Contractor' },
            { label: 'Submit first draw',                owner: 'Contractor' },
          ],
          cta:        'Continue setup',
          bottleneck: 'Bottleneck: deal setup',
        }
      case 'disputed':
        return {
          summary:    'A milestone on this draw is in dispute. Resolution is between contractor and funder; release governance remains active.',
          completed:  [],
          pending:    [
            { label: 'Dispute resolution',              owner: 'Contractor / funder' },
          ],
          cta:        'Open dispute view',
          bottleneck: 'Bottleneck: open dispute',
        }
      default:
        return {
          summary:    '',
          completed:  [],
          pending:    [],
          cta:        'View draw details',
          bottleneck: '',
        }
    }
  })()

  const accent =
    stage === 'awaiting_funder'   ? 'border-vektrum-blue/25 bg-vektrum-blue/[0.04]' :
    stage === 'contractor_action' ? 'border-amber-500/25 bg-amber-500/[0.04]'        :
    stage === 'disputed'          ? 'border-red-500/25 bg-red-500/[0.04]'            :
                                    'border-white/[0.08] bg-surface-2'

  return (
    <article className={`lg:col-span-3 rounded-2xl border ${accent} overflow-hidden`}>
      <div className="px-6 pt-5 pb-4 border-b border-white/[0.06] space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">
            Most important draw
          </p>
          <span aria-hidden="true" className="text-white/15">·</span>
          <p className="text-[11px] text-white/45">{deal.title}</p>
        </div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-[17px] font-semibold text-white leading-tight">
              {milestone.title}
            </h2>
            {variant.bottleneck && (
              <p className="mt-1 text-[12px] text-white/55">{variant.bottleneck}</p>
            )}
          </div>
          <div className="text-right">
            <p className="font-display text-[1.625rem] font-bold tabular-nums text-white leading-none">
              {formatMoney(milestone.amount)}
            </p>
            <span className="mt-1.5 inline-block">
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.classes}`}>
                {meta.label}
              </span>
            </span>
          </div>
        </div>
        {variant.summary && (
          <p className="text-[13px] text-white/75 leading-relaxed">{variant.summary}</p>
        )}
      </div>

      {(variant.completed.length > 0 || variant.pending.length > 0) && (
        <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06] border-b border-white/[0.06]">
          <div className="px-6 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.10em] text-white/45 mb-2">Completed</p>
            {variant.completed.length === 0 ? (
              <p className="text-[12px] text-white/40">—</p>
            ) : (
              <ul className="space-y-1.5">
                {variant.completed.map((line) => (
                  <li key={line} className="flex items-start gap-2 text-[12.5px] text-white/75">
                    <CheckCircle2 size={12} className="text-emerald-400 mt-1 flex-shrink-0" aria-hidden="true" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="px-6 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.10em] text-white/45 mb-2">Pending</p>
            <ul className="space-y-1.5">
              {variant.pending.map((p) => (
                <li key={p.label} className="flex items-start gap-2 text-[12.5px] text-white/65">
                  <Lock size={12} className="text-white/35 mt-1 flex-shrink-0" aria-hidden="true" />
                  <span className="flex-1">
                    {p.label}
                    <span className="ml-1.5 text-[11px] text-white/40">· {p.owner}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="px-6 py-4 flex items-center justify-end">
        <Link
          href={`/dashboard/deals/${deal.id}#milestone-${milestone.id}`}
          className="inline-flex items-center gap-1.5 rounded-xl bg-vektrum-blue hover:bg-vektrum-blue-hover px-4 py-2 text-[12px] font-semibold text-white transition-colors"
        >
          {variant.cta}
          <ArrowRight size={12} aria-hidden="true" />
        </Link>
      </div>
    </article>
  )
}

interface ContractorAttentionStackProps {
  needsAction:           Array<{ milestone: Milestone; deal: Deal }>
  setupIncompleteDeals:  Deal[]
  waitingFunderCount:    number
  waitingFunderAmount:   number
  inReviewCount:         number
}

function ContractorAttentionStack({
  needsAction, setupIncompleteDeals, waitingFunderCount, waitingFunderAmount, inReviewCount,
}: ContractorAttentionStackProps) {
  const totalNeedsAction = needsAction.length + setupIncompleteDeals.length

  return (
    <div className="lg:col-span-2 grid grid-cols-1 gap-4">
      {/* Needs contractor action */}
      <article className="rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden flex flex-col">
        <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center gap-2">
          <AlertCircle size={13} className={totalNeedsAction > 0 ? 'text-amber-400' : 'text-emerald-400'} aria-hidden="true" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.10em] text-white/55">
            Needs contractor action
          </p>
        </div>
        <div className="p-5 space-y-3 flex-1">
          {totalNeedsAction === 0 ? (
            <p className="text-[12.5px] text-white/55 leading-relaxed">
              All deals are either under review, awaiting the funder, or fully released. Nothing
              needs your attention right now.
            </p>
          ) : (
            <>
              <ul className="space-y-1.5">
                {setupIncompleteDeals.length > 0 && (
                  <li className="flex items-start gap-2 text-[12.5px] text-white/75">
                    <span aria-hidden="true" className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                    <span>
                      {setupIncompleteDeals.length} deal{setupIncompleteDeals.length === 1 ? '' : 's'} still require setup before submission
                    </span>
                  </li>
                )}
                {needsAction.length > 0 && (
                  <li className="flex items-start gap-2 text-[12.5px] text-white/75">
                    <span aria-hidden="true" className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                    <span>
                      {needsAction.length} milestone{needsAction.length === 1 ? '' : 's'} need supporting documents or submission
                    </span>
                  </li>
                )}
              </ul>
              <div>
                <Link
                  href={
                    setupIncompleteDeals[0]
                      ? `/dashboard/deals/${setupIncompleteDeals[0].id}/milestones`
                      : `/dashboard/deals/${needsAction[0].deal.id}#milestone-${needsAction[0].milestone.id}`
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/[0.14] border border-amber-500/25 px-3 py-1.5 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/[0.22] transition-colors"
                >
                  Resolve now
                  <ArrowRight size={11} aria-hidden="true" />
                </Link>
              </div>
            </>
          )}
        </div>
      </article>

      {/* Waiting on funder */}
      <article className="rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden flex flex-col">
        <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center gap-2">
          <Building2 size={13} className="text-white/55" aria-hidden="true" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.10em] text-white/55">
            Waiting on funder
          </p>
        </div>
        <div className="p-5 space-y-2.5 flex-1">
          <div>
            <p className="font-display text-[1.5rem] font-bold tabular-nums leading-none text-white">
              {waitingFunderCount + inReviewCount}
            </p>
            <p className="mt-1 text-[11px] text-white/45 tabular-nums">
              {waitingFunderCount} awaiting approval · {inReviewCount} under review
            </p>
            {waitingFunderAmount > 0 && (
              <p className="mt-1 text-[12px] text-blue-300 tabular-nums">
                {formatMoney(waitingFunderAmount)} pending release
              </p>
            )}
          </div>
          <p className="text-[11px] text-white/45 leading-relaxed">
            Funders authorize releases after the deterministic gate clears. The selected rail
            executes disbursement after authorization is recorded.
          </p>
        </div>
      </article>
    </div>
  )
}

function ContractorMetricTile({ label, value, sublabel, tone }: {
  label:    string
  value:    string
  sublabel: string
  tone:     'amber' | 'blue' | 'ok' | 'neutral'
}) {
  const valueColor =
    tone === 'amber'   ? 'text-amber-300'   :
    tone === 'blue'    ? 'text-blue-300'    :
    tone === 'ok'      ? 'text-emerald-300' :
                         'text-white'
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card px-5 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">{label}</p>
      <p className={`mt-1.5 font-display text-[1.625rem] font-bold tabular-nums leading-none ${valueColor}`}>{value}</p>
      <p className="mt-1.5 text-[11px] text-white/45 tabular-nums">{sublabel}</p>
    </div>
  )
}

function ContractorPipelineRow({ milestone, dealId, dealTitle }: {
  milestone:  Milestone
  dealId:     string
  dealTitle:  string
}) {
  const stage = milestoneToStage(milestone.status)
  const owner =
    stage === 'contractor_action' ? 'Contractor' :
    stage === 'under_review'      ? 'Vektrum review' :
    stage === 'awaiting_funder'   ? 'Funder' :
    stage === 'released'          ? '—' :
    stage === 'disputed'          ? 'Contractor / funder' :
                                    'Contractor'
  const cta =
    stage === 'awaiting_funder'   ? 'Track approval' :
    stage === 'under_review'      ? 'View review' :
    stage === 'contractor_action' ? 'Complete draw' :
    stage === 'released'          ? 'View receipt' :
    stage === 'disputed'          ? 'Open dispute' :
                                    'View'
  return (
    <Link
      href={`/dashboard/deals/${dealId}#milestone-${milestone.id}`}
      className="grid sm:grid-cols-12 gap-x-3 gap-y-1 items-center px-5 py-3.5 hover:bg-white/[0.03] transition-colors"
    >
      <div className="sm:col-span-4 min-w-0">
        <p className="text-[12.5px] font-semibold text-white truncate">{milestone.title}</p>
        <p className="text-[11px] text-white/45 truncate">{dealTitle}</p>
      </div>
      <div className="sm:col-span-2 text-[12px] text-white/70 tabular-nums sm:text-right">
        {formatMoney(milestone.amount)}
      </div>
      <div className="sm:col-span-2">
        <ContractorStageBadge stage={stage} />
      </div>
      <div className="sm:col-span-2 flex items-center gap-1.5 text-[12px] text-white/65">
        <UserIcon size={11} className="text-white/35" aria-hidden="true" />
        {owner}
      </div>
      <div className="sm:col-span-2 sm:text-right">
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-300">
          {cta}
          <ArrowRight size={11} aria-hidden="true" />
        </span>
      </div>
    </Link>
  )
}

function ContractorDealCard({ deal }: { deal: Deal }) {
  const milestones = deal.milestones ?? []
  const releasedCount = milestones.filter((m) => m.status === 'released').length
  const pct = deal.total_amount > 0 ? Math.round((deal.released_amount / deal.total_amount) * 100) : 0

  // Roll the deal up into a single contractor stage.
  const dealStage: ContractorStage = (() => {
    if (milestones.length === 0)                                  return 'setup_incomplete'
    if (milestones.some((m) => m.status === 'disputed'))          return 'disputed'
    if (milestones.every((m) => m.status === 'released'))         return 'released'
    if (milestones.some((m) => m.status === 'approved'))          return 'awaiting_funder'
    if (milestones.some((m) => m.status === 'ready_for_review'))  return 'under_review'
    if (milestones.some((m) => m.status === 'in_progress' || m.status === 'not_started')) return 'contractor_action'
    return 'contractor_action'
  })()

  // Awaiting-approval value = sum of milestones currently moving through the gate.
  const awaitingValue = milestones
    .filter((m) => m.status === 'approved' || m.status === 'ready_for_review')
    .reduce((s, m) => s + m.amount, 0)

  // Per-stage next-step + CTA copy.
  const nextStep =
    dealStage === 'setup_incomplete'  ? 'Add milestones and draw details before submission.' :
    dealStage === 'contractor_action' ? 'Upload supporting documents and submit a draw for review.' :
    dealStage === 'under_review'      ? 'Submitted draw is in control review. Funder approval comes after review clears.' :
    dealStage === 'awaiting_funder'   ? 'Submitted draw is through control review and awaiting release decision.' :
    dealStage === 'released'          ? 'All milestones released. Project complete.' :
    dealStage === 'disputed'          ? 'A milestone on this deal is in dispute. Review the dispute view.' :
                                        ''

  const cta =
    dealStage === 'setup_incomplete'  ? { label: 'Continue setup',  href: `/dashboard/deals/${deal.id}/milestones` } :
    dealStage === 'contractor_action' ? { label: 'Complete draw',   href: `/dashboard/deals/${deal.id}` } :
    dealStage === 'under_review'      ? { label: 'Track review',    href: `/dashboard/deals/${deal.id}` } :
    dealStage === 'awaiting_funder'   ? { label: 'Track approval',  href: `/dashboard/deals/${deal.id}` } :
    dealStage === 'released'          ? { label: 'View deal',       href: `/dashboard/deals/${deal.id}` } :
    dealStage === 'disputed'          ? { label: 'Open dispute',    href: `/dashboard/deals/${deal.id}` } :
                                        { label: 'View deal',       href: `/dashboard/deals/${deal.id}` }

  return (
    <Link
      href={`/dashboard/deals/${deal.id}`}
      className="group rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card p-5 flex flex-col transition-colors hover:border-white/[0.16]"
    >
      <div className="flex items-center justify-between mb-3">
        <ContractorStageBadge stage={dealStage} />
        <span className="text-[11px] text-white/55">
          {milestones.length === 0 ? 'No milestones' : `${releasedCount}/${milestones.length} milestones`}
        </span>
      </div>

      <p className="text-[14px] font-semibold text-white/85 group-hover:text-white transition-colors leading-snug truncate">{deal.title}</p>
      {deal.funder ? (
        <p className="mt-1 text-[12px] text-white/45 truncate">
          {deal.funder.company_name ?? deal.funder.full_name}
        </p>
      ) : deal.funder_id ? (
        <p className="mt-1 text-[12px] text-white/45">Funder assigned</p>
      ) : (
        <p className="mt-1 text-[12px] text-amber-300/75">No funder assigned yet</p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <div className="flex-1 h-1 rounded-full bg-white/[0.08] overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[11px] text-white/55 tabular-nums">{pct}%</span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-3">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/40">Total</dt>
          <dd className="text-[12px] text-white/75 tabular-nums mt-0.5">{formatMoney(deal.total_amount)}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/40">Awaiting approval</dt>
          <dd className={`text-[12px] tabular-nums mt-0.5 ${awaitingValue > 0 ? 'text-blue-300' : 'text-white/45'}`}>
            {awaitingValue > 0 ? formatMoney(awaitingValue) : '—'}
          </dd>
        </div>
      </dl>

      {nextStep && (
        <p className="mt-3 text-[11px] text-white/55 leading-snug">
          {nextStep}
        </p>
      )}

      <div className="mt-3 flex items-center justify-end">
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-300 group-hover:text-blue-200 transition-colors">
          {cta.label}
          <ArrowRight size={11} aria-hidden="true" />
        </span>
      </div>
    </Link>
  )
}
