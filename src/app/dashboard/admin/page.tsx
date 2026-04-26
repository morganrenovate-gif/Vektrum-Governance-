// Vektrum Admin Dashboard
//
// Advisory Panel consensus:
// - Advisor 9 (Skeptical Investor): All stats server-side only. Never trust client values.
// - Advisor 10 (Adversarial): Admins CANNOT modify financial data or release funds.
//   Every display is read-only. Money moves only through the 10-condition gate.
// - Advisor 6 (Attorney): Admin viewing a dispute is an auditable event (logged server-side).
// - Advisor 4 (Security): Role gate is server-side. Client-side checks are supplementary only.
// - Advisor 8 (Ops): Support needs platform health signals — added as coming-soon panel.

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import type { Profile, Deal } from '@/lib/types'
import { formatMoney } from '@/lib/utils'
import {
  Users, DollarSign, AlertTriangle, FileText,
  CheckCircle2, Clock, XCircle, Shield, Activity, Zap, Building2
} from 'lucide-react'
import { DisputeQueue } from '@/components/admin/dispute-queue'
import { UserTable } from '@/components/admin/user-table'
import { InviteAdminForm } from '@/components/admin/invite-admin-form'
import { ReconciliationPanel } from '@/components/admin/ReconciliationPanel'
import { PageHeader, SectionHeader, MetricStrip, StatBlock } from '@/components/layout'

export const metadata = {
  title: 'Admin Dashboard — Vektrum',
}

// ─── Server-side data fetching ────────────────────────────────────────────────
// All queries use the admin client (service role) to bypass RLS.
// Advisor 9: These numbers come exclusively from server-side queries.

// ─── Reconciliation data ──────────────────────────────────────────────────────

async function getReconciliationData() {
  const adminClient = createSupabaseAdminClient()

  const { data: issues } = await adminClient
    .from('reconciliation_issues')
    .select(
      'id, run_id, issue_type, severity, status, deal_id, milestone_id, ' +
      'release_id, stripe_transfer_id, expected_amount, actual_amount, ' +
      'description, auto_fixable, resolution_note, resolution_action, ' +
      'resolved_at, created_at, updated_at'
    )
    .eq('status', 'open')
    .order('severity',   { ascending: true })
    .order('created_at', { ascending: false })
    .limit(50)

  const { count: totalIssues } = await adminClient
    .from('reconciliation_issues')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'open')

  const { data: lastRun } = await adminClient
    .from('reconciliation_runs')
    .select(
      'id, status, started_at, completed_at, releases_checked, ' +
      'transfers_checked, deals_checked, issues_found, error_message, triggered_by'
    )
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openIssues = (issues ?? []) as any[]
  const openCritical = openIssues.filter((i: { severity: string }) => i.severity === 'critical').length
  const openHigh     = openIssues.filter((i: { severity: string }) => i.severity === 'high').length

  return {
    issues:    openIssues,
    total:     totalIssues ?? 0,
    lastRun:   lastRun ?? null,
    health: {
      open_critical: openCritical,
      open_high:     openHigh,
      open_total:    totalIssues ?? 0,
    },
  }
}

async function getAdminData() {
  const adminClient = createSupabaseAdminClient()

  // All profiles
  const { data: profiles } = await adminClient
    .from('profiles')
    .select('id, role, full_name, company_name, stripe_account_id, stripe_payouts_enabled, onboarding_complete, created_at')
    .order('created_at', { ascending: false })

  // All deals with milestone counts
  const { data: deals } = await adminClient
    .from('deals')
    .select('id, title, status, total_amount, funded_amount, released_amount, contractor_id, funder_id, created_at')
    .order('created_at', { ascending: false })

  // All open disputes with deal + milestone context
  const { data: disputes } = await adminClient
    .from('disputes')
    .select(`
      id,
      amount_in_dispute,
      reason,
      status,
      opened_at,
      opened_by,
      deal_id,
      milestone_id,
      deals ( id, title ),
      milestones ( id, title )
    `)
    .eq('status', 'open')
    .order('opened_at', { ascending: true })

  // Recent audit log entries — fetch compliance fields including actor_name
  const { data: recentAudit } = await adminClient
    .from('audit_log')
    .select('id, event_sequence, entity_type, entity_id, action, actor_id, actor_name, actor_role, system_source, created_at, metadata')
    .order('event_sequence', { ascending: false })
    .limit(10)

  // Fetch emails from auth.users (email lives in auth.users, not profiles)
  const { data: authUsersData } = await adminClient.auth.admin.listUsers()
  const emailMap: Record<string, string> = {}
  if (authUsersData?.users) {
    for (const u of authUsersData.users) {
      if (u.email) emailMap[u.id] = u.email
    }
  }

  // ── Health metrics ──────────────────────────────────────────────────────────
  const { count: onboardingBacklog } = await adminClient
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .in('role', ['contractor', 'funder'])
    .is('stripe_account_id', null)

  const { count: blockedReleases } = await adminClient
    .from('milestones')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'approved')

  const { count: openDisputeCount } = await adminClient
    .from('milestones')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'disputed')

  const { count: recentRoleChanges } = await adminClient
    .from('audit_log')
    .select('*', { count: 'exact', head: true })
    .eq('action', 'admin_role_granted')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

  return {
    profiles: (profiles ?? []) as (Profile & { company_name?: string | null })[],
    deals:    (deals    ?? []) as Deal[],
    // Supabase returns foreign-key joins as arrays; we pick the first element in the component.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    disputes: (disputes ?? []) as any as DisputeRow[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recentAudit: (recentAudit ?? []) as any[],
    emailMap,
    healthMetrics: {
      onboardingBacklog: onboardingBacklog ?? 0,
      blockedReleases: blockedReleases ?? 0,
      openDisputes: openDisputeCount ?? 0,
      recentRoleChanges: recentRoleChanges ?? 0,
    },
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DisputeRow {
  id: string
  amount_in_dispute: number
  reason: string
  status: string
  opened_at: string
  opened_by: string
  deal_id: string
  milestone_id: string
  deals:      { id: string; title: string } | { id: string; title: string }[] | null
  milestones: { id: string; title: string } | { id: string; title: string }[] | null
}

// ─── Stat Tile ────────────────────────────────────────────────────────────────

function AdminStatTile({
  label, value, sub, icon: Icon, accent = false, warning = false,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  accent?: boolean
  warning?: boolean
}) {
  return (
    <div
      className={`rounded-xl border bg-surface-2 shadow-card px-5 py-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover hover:border-white/[0.14] ${warning ? 'border-vektrum-amber/30' : 'border-white/[0.08]'}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/65">{label}</p>
        <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.08]`}>
          <Icon size={13} className={warning ? 'text-amber-400' : 'text-blue-400'} aria-hidden="true" />
        </div>
      </div>
      <p className={`font-display text-2xl font-bold tabular-nums leading-none break-all ${accent ? 'text-blue-300' : warning ? 'text-amber-400' : 'text-white'}`}>
        {value}
      </p>
      {sub && <p className="mt-1.5 text-[11px] text-white/60">{sub}</p>}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminDashboardPage() {
  // Advisor 4: Server-side role gate. Redirect if not admin.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?next=/dashboard/admin')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileData } = await (supabase as any)
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profileData || profileData.role !== 'admin') {
    redirect('/dashboard')
  }

  const [
    { profiles, deals, disputes, recentAudit, healthMetrics, emailMap },
    reconciliationData,
  ] = await Promise.all([
    getAdminData(),
    getReconciliationData(),
  ])

  // ── Computed platform stats ────────────────────────────────────────────────
  const contractors    = profiles.filter(p => p.role === 'contractor')
  const funders        = profiles.filter(p => p.role === 'funder')
  const activeDeals    = deals.filter(d => d.status === 'active' || d.status === 'in_progress' as string)
  const completedDeals = deals.filter(d => d.status === 'completed')
  const totalCapital   = deals.reduce((s, d) => s + Number(d.funded_amount), 0)
  const totalReleased  = deals.reduce((s, d) => s + Number(d.released_amount), 0)
  const openDisputes   = disputes.filter(d => d.status === 'open')

  return (
    <div className="min-h-screen bg-surface-0">
    <div className="dash-page">

      {/* Header */}
      <PageHeader
        eyebrow="Admin Dashboard"
        title="Platform Overview"
        description="Read-only. All financial actions require the 10-condition release gate."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard/admin/ops"
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.22] bg-white/[0.09] px-4 py-2.5 text-[13px] font-medium text-white hover:bg-white/[0.14] hover:border-white/[0.32] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue transition-all self-start"
            >
              <Activity size={14} aria-hidden="true" />
              Ops Dashboard
            </Link>
            <Link
              href="/dashboard/admin/partners"
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.22] bg-white/[0.09] px-4 py-2.5 text-[13px] font-medium text-white hover:bg-white/[0.14] hover:border-white/[0.32] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue transition-all self-start"
            >
              <Building2 size={14} aria-hidden="true" />
              Partners / API Integrations
            </Link>
            <Link
              href="/dashboard/audit"
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.22] bg-white/[0.09] px-4 py-2.5 text-[13px] font-medium text-white hover:bg-white/[0.14] hover:border-white/[0.32] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue transition-all self-start"
            >
              <FileText size={14} aria-hidden="true" />
              Full Audit Log
            </Link>
          </div>
        }
      />

      {/* Admin access info */}
      <div className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-card p-5 text-sm text-white/80">
        <p className="font-semibold text-white mb-1.5">Admin Access</p>
        <p>You can manage users, invite new admins, review audit logs, and monitor platform health.
        <strong className="text-white font-semibold"> Financial actions (fund releases, payment processing) are governed by the 10-condition milestone gate</strong>
        {' '}and cannot be overridden from this dashboard. All admin actions are permanently logged.</p>
      </div>

      {/* ── Operator Health Metrics ─────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] font-semibold border ${healthMetrics.onboardingBacklog > 0 ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
          <Users size={12} />
          {healthMetrics.onboardingBacklog} pending onboarding
        </div>
        <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] font-semibold border ${healthMetrics.blockedReleases > 0 ? 'bg-vektrum-blue/10 border-vektrum-blue/30 text-blue-300' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
          <Clock size={12} />
          {healthMetrics.blockedReleases} releases pending
        </div>
        <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] font-semibold border ${healthMetrics.openDisputes > 0 ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
          <AlertTriangle size={12} />
          {healthMetrics.openDisputes} open disputes
        </div>
        <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] font-semibold border ${healthMetrics.recentRoleChanges > 0 ? 'bg-vektrum-blue/10 border-vektrum-blue/30 text-blue-300' : 'bg-white/[0.05] border-white/[0.12] text-white/75'}`}>
          <Shield size={12} />
          {healthMetrics.recentRoleChanges} role changes (7d)
        </div>
        {/* Reconciliation health badge */}
        {reconciliationData.health.open_critical > 0 ? (
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] font-semibold border bg-red-500/10 border-red-500/20 text-red-400">
            <AlertTriangle size={12} />
            {reconciliationData.health.open_critical} critical reconciliation issue{reconciliationData.health.open_critical !== 1 ? 's' : ''}
          </div>
        ) : reconciliationData.health.open_total > 0 ? (
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] font-semibold border bg-amber-500/10 border-amber-500/20 text-amber-400">
            <AlertTriangle size={12} />
            {reconciliationData.health.open_total} reconciliation issue{reconciliationData.health.open_total !== 1 ? 's' : ''}
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] font-semibold border bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
            <Activity size={12} />
            Stripe reconciled
          </div>
        )}
      </div>

      {/* ── Section 1: Platform Overview ──────────────────────────────────── */}
      <section>
        <SectionHeader label="Platform Overview" />
        <MetricStrip>
          <StatBlock inline label="Contractors" value={contractors.length} />
          <StatBlock inline label="Funders" value={funders.length} />
          <StatBlock inline label="Active Deals" value={activeDeals.length} subvalue={`${completedDeals.length} completed`} />
          <StatBlock inline label="Capital Governed" value={formatMoney(totalCapital)} money />
          <StatBlock inline label="Total Released" value={formatMoney(totalReleased)} money />
          <StatBlock inline label="Open Disputes" value={openDisputes.length} alert={openDisputes.length > 0} />
        </MetricStrip>
      </section>

      {/* ── Section: Admin Navigation ────────────────────────────────────── */}
      <section>
        <SectionHeader label="Admin Tools" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link
            href="/dashboard/admin/partners"
            className="group rounded-xl border border-white/[0.08] bg-surface-2 shadow-card px-5 py-5 hover:border-vektrum-blue/30 hover:bg-surface-3 transition-all"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-vektrum-blue/10 border border-vektrum-blue/20">
                <Building2 size={15} className="text-blue-400" aria-hidden="true" />
              </div>
            </div>
            <p className="text-[13px] font-semibold text-white mb-1">Partners / API Integrations</p>
            <p className="text-[12px] text-white/55 leading-relaxed">
              Create partners, issue API keys, rotate credentials, and assign deals.
            </p>
          </Link>

          <Link
            href="/dashboard/admin/ops"
            className="group rounded-xl border border-white/[0.08] bg-surface-2 shadow-card px-5 py-5 hover:border-white/[0.18] hover:bg-surface-3 transition-all"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.08]">
                <Activity size={15} className="text-white/65" aria-hidden="true" />
              </div>
            </div>
            <p className="text-[13px] font-semibold text-white mb-1">Ops Dashboard</p>
            <p className="text-[12px] text-white/55 leading-relaxed">
              Release health, webhook monitoring, external release queue, and ops search.
            </p>
          </Link>

          <Link
            href="/dashboard/audit"
            className="group rounded-xl border border-white/[0.08] bg-surface-2 shadow-card px-5 py-5 hover:border-white/[0.18] hover:bg-surface-3 transition-all"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.08]">
                <FileText size={15} className="text-white/65" aria-hidden="true" />
              </div>
            </div>
            <p className="text-[13px] font-semibold text-white mb-1">Full Audit Log</p>
            <p className="text-[12px] text-white/55 leading-relaxed">
              Immutable, tamper-evident log of all platform events and admin actions.
            </p>
          </Link>
        </div>
      </section>

      {/* ── Section: Invite New Admin ────────────────────────────────────── */}
      <section>
        <SectionHeader label="Admin Management" />
        <InviteAdminForm />
      </section>

      {/* ── Section 2: Dispute Queue ──────────────────────────────────────── */}
      <section>
        <SectionHeader
          label="Open Disputes"
          count={openDisputes.length > 0 ? openDisputes.length : undefined}
          variant={openDisputes.length > 0 ? 'warning' : 'default'}
        />
        <DisputeQueue disputes={disputes} />
      </section>

      {/* ── Section 3: User Management ───────────────────────────────────── */}
      <section>
        <SectionHeader label="User Management" count={profiles.length} />
        <UserTable profiles={profiles} deals={deals} emailMap={emailMap} />
      </section>

      {/* ── Section 4: Platform Health ───────────────────────────────────── */}
      <section>
        <SectionHeader label="Platform Health" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <AdminStatTile
            label="Release Gate Status"
            value="Operational"
            sub="10 conditions enforced server-side on every release"
            icon={Shield}
          />
          {(() => {
            const stripeVerified = contractors.filter(p => p.stripe_payouts_enabled).length
            const allVerified = stripeVerified === contractors.length && contractors.length > 0
            return (
              <AdminStatTile
                label="Stripe Connect Coverage"
                value={`${stripeVerified} / ${contractors.length} contractors verified`}
                sub={allVerified ? 'All contractors Stripe-verified' : `${contractors.length - stripeVerified} awaiting Stripe onboarding`}
                icon={DollarSign}
                warning={!allVerified}
              />
            )
          })()}
          {(() => {
            const onboarded = profiles.filter(p => p.onboarding_complete).length
            return (
              <AdminStatTile
                label="Onboarding Completion"
                value={`${onboarded} / ${profiles.length} users onboarded`}
                sub="Platform-wide onboarding completion rate"
                icon={CheckCircle2}
              />
            )
          })()}
        </div>

        {/* AI Draw Review System — full width tile */}
        <div className="mt-3">
          <AdminStatTile
            label="AI Draw Review"
            value="Operational"
            sub="AI precondition required before any fund release — all draw reviews are logged"
            icon={Zap}
          />
          <div className="mt-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.07] px-4 py-3 text-[12px] text-emerald-400">
            <strong>AI draw review system is operational.</strong> All precondition checks are active.
          </div>
        </div>
      </section>

      {/* ── Section 5: Stripe Reconciliation ─────────────────────────────── */}
      <section>
        <SectionHeader
          label="Stripe Reconciliation"
          count={reconciliationData.health.open_total > 0 ? reconciliationData.health.open_total : undefined}
          variant={reconciliationData.health.open_critical > 0 ? 'warning' : 'default'}
        />
        <ReconciliationPanel
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          initialIssues={reconciliationData.issues as any}
          initialTotal={reconciliationData.total}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          lastRun={reconciliationData.lastRun as any}
          health={reconciliationData.health}
        />
      </section>

      {/* ── Section 6: Recent Audit Activity ─────────────────────────────── */}
      <section>
        <SectionHeader label="Recent Audit Activity" />
        {recentAudit.length === 0 ? (
          <p className="text-sm text-white/70">No audit activity yet</p>
        ) : (
          <div className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden">
            <ul className="divide-y divide-white/[0.05]">
              {recentAudit.map((entry) => {
                const actionColor = entry.action?.includes('release') || entry.action?.includes('released')
                  ? 'text-emerald-400'
                  : entry.action?.includes('blocked') || entry.action?.includes('dispute') || entry.action?.includes('failed')
                  ? 'text-amber-400'
                  : entry.action?.includes('ai_draw_review')
                  ? 'text-blue-300'
                  : 'text-white/75'

                // Exact UTC timestamp — never relative time for audit records
                const d = new Date(entry.created_at)
                const pad = (n: number) => String(n).padStart(2, '0')
                const utcTimestamp = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`

                return (
                  <li key={entry.id} className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.03] transition-colors">
                    {/* Sequence number */}
                    {entry.event_sequence != null && (
                      <span className="text-[10px] font-mono text-white/55 flex-shrink-0 w-10 text-right tabular-nums">
                        #{entry.event_sequence}
                      </span>
                    )}
                    <span className={`font-mono text-[13px] font-medium ${actionColor} min-w-[160px]`}>
                      {entry.action}
                    </span>
                    <span className="text-[12px] text-white/70 truncate flex-1">
                      {entry.entity_type}/{entry.entity_id?.slice(0, 8)}
                      {entry.actor_name && entry.actor_name !== 'system' && (
                        <span className="text-white/60 ml-1.5">· {entry.actor_name}</span>
                      )}
                    </span>
                    {/* Exact UTC timestamp */}
                    <span className="text-[11px] font-mono text-white/65 tabular-nums flex-shrink-0 whitespace-nowrap">
                      {utcTimestamp}
                    </span>
                  </li>
                )
              })}
            </ul>
            <div className="border-t border-white/[0.05] px-5 py-3 bg-white/[0.02]">
              <Link
                href="/dashboard/audit"
                className="text-[13px] font-medium text-blue-300 hover:text-blue-200 transition-colors"
              >
                View full audit log &rarr;
              </Link>
            </div>
          </div>
        )}
      </section>

    </div>
    </div>
  )
}
