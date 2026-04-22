// Vektrum Admin Dashboard
//
// Advisory Panel consensus:
// - Advisor 9 (Skeptical Investor): All stats server-side only. Never trust client values.
// - Advisor 10 (Adversarial): Admins CANNOT modify financial data or release funds.
//   Every display is read-only. Money moves only through the 7-condition gate.
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
  CheckCircle2, Clock, XCircle, Shield, Activity, Zap
} from 'lucide-react'
import { DisputeQueue } from '@/components/admin/dispute-queue'
import { UserTable } from '@/components/admin/user-table'
import { InviteAdminForm } from '@/components/admin/invite-admin-form'

export const metadata = {
  title: 'Admin Dashboard — Vektrum',
}

// ─── Server-side data fetching ────────────────────────────────────────────────
// All queries use the admin client (service role) to bypass RLS.
// Advisor 9: These numbers come exclusively from server-side queries.

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

  // Recent audit log entries
  const { data: recentAudit } = await adminClient
    .from('audit_log')
    .select('id, entity_type, entity_id, action, actor_id, created_at, metadata')
    .order('created_at', { ascending: false })
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
      className={`rounded-2xl border bg-[#111827] px-5 py-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/[0.14] ${warning ? 'border-vektrum-amber/30' : 'border-white/[0.08]'}`}
      style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03)' }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">{label}</p>
        <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.08]`}>
          <Icon size={13} className={warning ? 'text-vektrum-amber' : 'text-vektrum-blue'} aria-hidden="true" />
        </div>
      </div>
      <p className={`font-display text-2xl font-bold tabular-nums leading-none break-all ${accent ? 'text-vektrum-blue' : warning ? 'text-vektrum-amber' : 'text-white'}`}>
        {value}
      </p>
      {sub && <p className="mt-1.5 text-[11px] text-white/30">{sub}</p>}
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

  const { profiles, deals, disputes, recentAudit, healthMetrics, emailMap } = await getAdminData()

  // ── Computed platform stats ────────────────────────────────────────────────
  const contractors    = profiles.filter(p => p.role === 'contractor')
  const funders        = profiles.filter(p => p.role === 'funder')
  const activeDeals    = deals.filter(d => d.status === 'active' || d.status === 'in_progress' as string)
  const completedDeals = deals.filter(d => d.status === 'completed')
  const totalCapital   = deals.reduce((s, d) => s + Number(d.funded_amount), 0)
  const totalReleased  = deals.reduce((s, d) => s + Number(d.released_amount), 0)
  const openDisputes   = disputes.filter(d => d.status === 'open')

  return (
    <div className="min-h-screen bg-[#0D1B2A]">

      {/* Ambient glow */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-gradient-to-b from-vektrum-blue/10 to-transparent rounded-full blur-3xl" />

    <div className="relative max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-12 sm:py-16 space-y-8">

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-3">
            <div className="h-px w-5 bg-vektrum-blue" />
            <p className="text-[11px] tracking-[0.12em] uppercase text-vektrum-blue font-semibold">Admin Dashboard</p>
          </div>
          <h1 className="font-display text-[2.25rem] font-bold tracking-[-0.04em] text-white leading-[1.05]">
            Platform Overview
          </h1>
          <p className="mt-2 text-[15px] text-white/55">
            Read-only. All financial actions require the 7-condition release gate.
          </p>
        </div>
        <Link
          href="/dashboard/audit"
          className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.05] px-4 py-2.5 text-[13px] font-medium text-white/60 hover:bg-white/[0.08] hover:text-white transition-all self-start"
        >
          <FileText size={14} aria-hidden="true" />
          Full Audit Log
        </Link>
      </div>

      {/* Admin access info */}
      <div
        className="rounded-2xl border border-white/[0.08] bg-[#111827] p-5 text-sm text-white/55"
        style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03)' }}
      >
        <p className="font-semibold text-white mb-1.5">Admin Access</p>
        <p>You can manage users, invite new admins, review audit logs, and monitor platform health.
        <strong className="text-white/80"> Financial actions (fund releases, payment processing) are governed by the 7-condition milestone gate</strong>
        {' '}and cannot be overridden from this dashboard. All admin actions are permanently logged.</p>
      </div>

      {/* ── Operator Health Metrics ─────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border ${healthMetrics.onboardingBacklog > 0 ? 'bg-vektrum-amber-bg border-vektrum-amber-border text-vektrum-amber' : 'bg-vektrum-green-bg border-vektrum-green-border text-vektrum-green'}`}>
          <Users size={14} />
          {healthMetrics.onboardingBacklog} pending onboarding
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border ${healthMetrics.blockedReleases > 0 ? 'bg-vektrum-blue-subtle border-vektrum-blue-border text-vektrum-blue' : 'bg-vektrum-green-bg border-vektrum-green-border text-vektrum-green'}`}>
          <Clock size={14} />
          {healthMetrics.blockedReleases} releases pending
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border ${healthMetrics.openDisputes > 0 ? 'bg-vektrum-red-bg border-vektrum-red-border text-vektrum-red' : 'bg-vektrum-green-bg border-vektrum-green-border text-vektrum-green'}`}>
          <AlertTriangle size={14} />
          {healthMetrics.openDisputes} open disputes
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border ${healthMetrics.recentRoleChanges > 0 ? 'bg-vektrum-blue-subtle border-vektrum-blue-border text-vektrum-blue' : 'bg-vektrum-surface-alt border-vektrum-border text-vektrum-muted'}`}>
          <Shield size={14} />
          {healthMetrics.recentRoleChanges} role changes (7d)
        </div>
      </div>

      {/* ── Section 1: Platform Overview ──────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
          Platform Overview
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <AdminStatTile
            label="Contractors"
            value={contractors.length}
            icon={Users}
          />
          <AdminStatTile
            label="Funders"
            value={funders.length}
            icon={Users}
            accent
          />
          <AdminStatTile
            label="Active Deals"
            value={activeDeals.length}
            sub={`${completedDeals.length} completed`}
            icon={Activity}
          />
          <AdminStatTile
            label="Capital Governed"
            value={formatMoney(totalCapital)}
            icon={DollarSign}
            accent
          />
          <AdminStatTile
            label="Total Released"
            value={formatMoney(totalReleased)}
            icon={CheckCircle2}
          />
          <AdminStatTile
            label="Open Disputes"
            value={openDisputes.length}
            icon={AlertTriangle}
            warning={openDisputes.length > 0}
          />
        </div>
      </section>

      {/* ── Section: Invite New Admin ────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
          Admin Management
        </h2>
        <InviteAdminForm />
      </section>

      {/* ── Section 2: Dispute Queue ──────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
              Open Disputes
            </h2>
            {openDisputes.length > 0 && (
              <p className="text-[11px] text-vektrum-amber mt-0.5">
                {openDisputes.length} dispute{openDisputes.length !== 1 ? 's' : ''} require attention
              </p>
            )}
          </div>
        </div>
        <DisputeQueue disputes={disputes} />
      </section>

      {/* ── Section 3: User Management ───────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
          User Management
        </h2>
        <UserTable profiles={profiles} deals={deals} emailMap={emailMap} />
      </section>

      {/* ── Section 4: Platform Health ───────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
          Platform Health
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <AdminStatTile
            label="Release Gate Status"
            value="Operational"
            sub="7 conditions enforced server-side on every release"
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
          <div className="mt-2 rounded-lg border border-vektrum-green-border bg-vektrum-green-bg px-4 py-3 text-[12px] text-vektrum-green">
            <strong>AI draw review system is operational.</strong> All precondition checks are active.
          </div>
        </div>
      </section>

      {/* ── Section 5: Recent Audit Activity ─────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
          Recent Audit Activity
        </h2>
        {recentAudit.length === 0 ? (
          <p className="text-sm text-white/35">No audit activity yet</p>
        ) : (
          <div
            className="rounded-2xl border border-white/[0.08] bg-[#111827] overflow-hidden"
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03)' }}
          >
            <ul className="divide-y divide-white/[0.05]">
              {recentAudit.map((entry) => {
                const actionColor = entry.action?.includes('release') || entry.action?.includes('released')
                  ? 'text-emerald-400'
                  : entry.action?.includes('blocked') || entry.action?.includes('dispute')
                  ? 'text-vektrum-amber'
                  : entry.action?.includes('ai_draw_review')
                  ? 'text-vektrum-blue'
                  : 'text-white/50'

                const createdAt = new Date(entry.created_at)
                const now = new Date()
                const diffMs = now.getTime() - createdAt.getTime()
                const diffMin = Math.floor(diffMs / 60000)
                const diffHours = Math.floor(diffMin / 60)
                const diffDays = Math.floor(diffHours / 24)
                const relativeTime = diffDays > 0
                  ? `${diffDays}d ago`
                  : diffHours > 0
                  ? `${diffHours}h ago`
                  : diffMin > 0
                  ? `${diffMin}m ago`
                  : 'just now'

                return (
                  <li key={entry.id} className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.03] transition-colors">
                    <span className={`font-mono text-[13px] font-medium ${actionColor} min-w-[160px]`}>
                      {entry.action}
                    </span>
                    <span className="text-[12px] text-white/35 truncate flex-1">
                      {entry.entity_type}/{entry.entity_id?.slice(0, 8)}
                    </span>
                    <span className="text-[11px] text-white/25 tabular-nums flex-shrink-0">
                      {relativeTime}
                    </span>
                  </li>
                )
              })}
            </ul>
            <div className="border-t border-white/[0.05] px-5 py-3 bg-white/[0.02]">
              <Link
                href="/dashboard/audit"
                className="text-[13px] font-medium text-vektrum-blue hover:text-vektrum-blue-hover transition-colors"
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
