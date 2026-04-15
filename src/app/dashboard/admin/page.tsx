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
  CheckCircle2, Clock, XCircle, Shield, Activity
} from 'lucide-react'
import { DisputeQueue } from '@/components/admin/dispute-queue'
import { UserTable } from '@/components/admin/user-table'

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

  return {
    profiles: (profiles ?? []) as (Profile & { company_name?: string | null })[],
    deals:    (deals    ?? []) as Deal[],
    // Supabase returns foreign-key joins as arrays; we pick the first element in the component.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    disputes: (disputes ?? []) as any as DisputeRow[],
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
    <div className={`rounded-xl border bg-vektrum-surface px-5 py-5 shadow-sm ${warning ? 'border-vektrum-amber-border' : 'border-vektrum-border'}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">{label}</p>
        <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${warning ? 'bg-vektrum-amber-bg' : 'bg-vektrum-blue-subtle'}`}>
          <Icon size={13} className={warning ? 'text-vektrum-amber' : 'text-vektrum-blue'} aria-hidden="true" />
        </div>
      </div>
      <p className={`font-display text-3xl font-bold tabular-nums leading-none ${accent ? 'text-vektrum-blue' : warning ? 'text-vektrum-amber' : 'text-vektrum-text'}`}>
        {value}
      </p>
      {sub && <p className="mt-1.5 text-[11px] text-vektrum-faint">{sub}</p>}
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

  const { profiles, deals, disputes } = await getAdminData()

  // ── Computed platform stats ────────────────────────────────────────────────
  const contractors    = profiles.filter(p => p.role === 'contractor')
  const funders        = profiles.filter(p => p.role === 'funder')
  const activeDeals    = deals.filter(d => d.status === 'active' || d.status === 'in_progress' as string)
  const completedDeals = deals.filter(d => d.status === 'completed')
  const totalCapital   = deals.reduce((s, d) => s + Number(d.funded_amount), 0)
  const totalReleased  = deals.reduce((s, d) => s + Number(d.released_amount), 0)
  const openDisputes   = disputes.filter(d => d.status === 'open')

  return (
    <div className="page-container section space-y-8">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-vektrum-blue">
              <Shield size={14} className="text-white" aria-hidden="true" />
            </div>
            <h1 className="font-display text-2xl font-bold text-vektrum-text">Admin Dashboard</h1>
          </div>
          <p className="text-sm text-vektrum-muted">
            Platform-wide oversight. Read-only. All financial actions require the 7-condition release gate.
          </p>
        </div>
        <Link
          href="/dashboard/audit"
          className="inline-flex items-center gap-2 rounded-lg border border-vektrum-border bg-vektrum-surface px-4 py-2 text-[13px] font-medium text-vektrum-muted hover:bg-vektrum-surface-alt transition-all"
        >
          <FileText size={14} aria-hidden="true" />
          Full Audit Log
        </Link>
      </div>

      {/* Security notice */}
      <div className="flex items-start gap-3 rounded-xl border border-vektrum-blue-border bg-vektrum-blue-subtle px-5 py-4">
        <Shield size={15} className="text-vektrum-blue flex-shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-[13px] text-vektrum-blue leading-relaxed">
          <strong>Admin access is read-only for financial data.</strong> You cannot release funds, modify milestone amounts,
          or alter deal terms from this panel. All payment actions require the full 7-condition release gate
          to be satisfied by the deal participants.
        </p>
      </div>

      {/* ── Section 1: Platform Overview ──────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-vektrum-muted">
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

      {/* ── Section 2: Dispute Queue ──────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-vektrum-muted">
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
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-vektrum-muted">
          User Management
        </h2>
        <UserTable profiles={profiles} deals={deals} />
      </section>

      {/* ── Section 4: Platform Health ───────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-vektrum-muted">
          Platform Health
        </h2>
        <div className="rounded-xl border border-dashed border-vektrum-border bg-vektrum-surface-alt p-6 opacity-60 cursor-not-allowed select-none">
          <div className="pointer-events-none flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-vektrum-border">
                <Activity size={16} className="text-vektrum-faint" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-vektrum-muted">Stripe Webhook Health / Failed Releases / Error Rate</p>
                <p className="text-[12px] text-vektrum-faint mt-0.5">
                  Real-time platform health monitoring. Know before your users do.
                </p>
              </div>
            </div>
            <span className="flex-shrink-0 rounded-full border border-vektrum-amber-border bg-vektrum-amber-bg px-2.5 py-0.5 text-[10px] font-semibold text-vektrum-amber">
              Coming soon
            </span>
          </div>
        </div>
      </section>

    </div>
  )
}
