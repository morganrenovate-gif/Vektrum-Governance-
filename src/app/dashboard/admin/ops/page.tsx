// Vektrum Ops Dashboard
//
// Purpose: Proactive operational monitoring for support and platform ops.
// This page surfaces signals BEFORE users file tickets:
//   - Stuck release approvals (approved but not released > N hours)
//   - Failed Stripe payouts (transfer.failed / transfer.reversed)
//   - Webhook feed health (stale pending transfers, feed silence)
//   - Prioritized alert feed across all signals
//   - Full-text search across deals, users, and Stripe transfers
//
// All data is fetched server-side on load, then panels can self-refresh.
// This page is admin-only. Session and role validated server-side.
// Nothing here can modify financial data — it's read + retry only.

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  Activity, AlertTriangle, ArrowLeft, Bell,
  CheckCircle2, DollarSign, Search, ShieldAlert, ShieldCheck, Wifi, Zap,
} from 'lucide-react'
import { ReleaseHealthPanel }  from '@/components/admin/ops/ReleaseHealthPanel'
import { WebhookHealthPanel }  from '@/components/admin/ops/WebhookHealthPanel'
import { AlertsFeed }          from '@/components/admin/ops/AlertsFeed'
import { OpsSearch }           from '@/components/admin/ops/OpsSearch'
import { AdminAuditLogPanel }  from '@/components/admin/ops/AdminAuditLogPanel'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Ops Dashboard — Vektrum Admin',
}

// ─── Server-side data fetch ───────────────────────────────────────────────────

async function fetchOpsData(baseUrl: string) {
  // All three data sources fetched in parallel — the page render blocks on all.
  const [releaseHealth, webhookHealth, alerts] = await Promise.all([
    fetch(`${baseUrl}/api/admin/ops/release-health`, { cache: 'no-store' })
      .then((r) => r.json())
      .catch(() => null),
    fetch(`${baseUrl}/api/admin/ops/webhook-health`, { cache: 'no-store' })
      .then((r) => r.json())
      .catch(() => null),
    fetch(`${baseUrl}/api/admin/ops/alerts`, { cache: 'no-store' })
      .then((r) => r.json())
      .catch(() => null),
  ])
  return { releaseHealth, webhookHealth, alerts }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function OpsPage() {
  // ── Auth gate ────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  // ── Fetch page data via internal API routes ───────────────────────────────
  // Using the API routes (rather than direct DB queries) means the ops page
  // gets the same data shape as the client-side refresh path — no divergence.
  //
  // Determine the base URL: prefer NEXT_PUBLIC_APP_URL, fall back to localhost.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const { releaseHealth, webhookHealth, alerts } = await fetchOpsData(appUrl)

  // ── Quick stats for the top strip ─────────────────────────────────────────
  const adminClient = createSupabaseAdminClient()

  const [
    { count: openDisputeCount },
    { count: payoutFailedCount },
    { count: stuckApprovedCount },
    adminAuditResult,
    unreviewedResult,
  ] = await Promise.all([
    adminClient.from('disputes').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    adminClient.from('milestones').select('id', { count: 'exact', head: true }).eq('status', 'payout_failed'),
    adminClient.from('milestones').select('id', { count: 'exact', head: true }).eq('status', 'approved')
      .lt('approved_at', new Date(Date.now() - 4 * 3_600_000).toISOString()),
    // Admin audit log: last 20 entries for initial render
    adminClient
      .from('admin_audit_log')
      .select(
        `id, event_sequence, entity_type, entity_id, action,
         actor_id, actor_role, actor_name, actor_email,
         system_source, ip_address, created_at,
         admin_justification, authorization_reference,
         reviewed_by, reviewed_at,
         old_values, new_values, metadata`,
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(0, 19),
    // Count of unreviewed entries for the badge
    adminClient
      .from('admin_audit_log')
      .select('id', { count: 'exact', head: true })
      .is('reviewed_by', null),
  ])

  const adminAuditEntries = adminAuditResult.data ?? []
  const adminAuditTotal   = adminAuditResult.count  ?? 0
  const unreviewedTotal   = unreviewedResult.count  ?? 0

  const alertCount    = (alerts?.total as number | undefined) ?? 0
  const criticalCount = (alerts?.critical_count as number | undefined) ?? 0
  const feedHealth    = (webhookHealth?.feed_health as string | undefined) ?? 'ok'

  // ── Page ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">

        {/* ── Page header ─────────────────────────────────────────── */}
        <div>
          <Link
            href="/dashboard/admin"
            className="inline-flex items-center gap-1.5 text-[12px] text-white/75 hover:text-white focus-visible:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue rounded-sm transition-colors mb-4"
          >
            <ArrowLeft size={12} />
            Admin Dashboard
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-[22px] font-bold text-white tracking-tight">
                Ops Dashboard
              </h1>
              <p className="text-[13px] text-white/70 mt-1">
                Release health · Payout failures · Webhook monitoring · Search
              </p>
            </div>

            {/* Global health indicator */}
            {criticalCount > 0 ? (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[13px] font-semibold">
                <ShieldAlert size={15} />
                {criticalCount} critical
              </div>
            ) : alertCount > 0 ? (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[13px] font-semibold">
                <AlertTriangle size={15} />
                {alertCount} alert{alertCount !== 1 ? 's' : ''}
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[13px] font-semibold">
                <CheckCircle2 size={15} />
                All clear
              </div>
            )}
          </div>
        </div>

        {/* ── Summary strip ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard
            icon={DollarSign}
            label="Stuck approvals"
            value={String(stuckApprovedCount ?? 0)}
            warn={(stuckApprovedCount ?? 0) > 0}
            href="#release-health"
          />
          <SummaryCard
            icon={AlertTriangle}
            label="Failed payouts"
            value={String(payoutFailedCount ?? 0)}
            critical={(payoutFailedCount ?? 0) > 0}
            href="#failed-payouts"
          />
          <SummaryCard
            icon={Wifi}
            label="Webhook feed"
            value={feedHealth === 'ok' ? 'Healthy' : feedHealth === 'warning' ? 'Degraded' : 'Critical'}
            warn={feedHealth === 'warning'}
            critical={feedHealth === 'critical'}
            href="#webhook-health"
          />
          <SummaryCard
            icon={Zap}
            label="Open disputes"
            value={String(openDisputeCount ?? 0)}
            warn={(openDisputeCount ?? 0) > 0}
            href="/dashboard/admin#disputes"
          />
        </div>

        {/* ── Search ──────────────────────────────────────────────── */}
        <section>
          <SectionHeader
            icon={Search}
            title="Search"
            description="Find any deal, user, or Stripe transfer instantly"
          />
          <OpsSearch />
        </section>

        {/* ── Alert feed ──────────────────────────────────────────── */}
        <section>
          <SectionHeader
            icon={Bell}
            title="Alert Feed"
            description="All active signals, sorted by severity"
          />
          {alerts ? (
            <AlertsFeed initialData={alerts} pollInterval={30} />
          ) : (
            <FetchError label="alert feed" />
          )}
        </section>

        {/* ── Release health ──────────────────────────────────────── */}
        <section>
          <SectionHeader
            icon={DollarSign}
            title="Release Health"
            description="Stuck approvals and failed Stripe payouts"
          />
          {releaseHealth ? (
            <ReleaseHealthPanel initialData={releaseHealth} />
          ) : (
            <FetchError label="release health" />
          )}
        </section>

        {/* ── Webhook health ──────────────────────────────────────── */}
        <section>
          <SectionHeader
            icon={Activity}
            title="Webhook Health"
            description="Stripe event delivery — stale transfers and feed status"
          />
          {webhookHealth ? (
            <WebhookHealthPanel initialData={webhookHealth} />
          ) : (
            <FetchError label="webhook health" />
          )}
        </section>

        {/* ── Admin audit log ─────────────────────────────────────── */}
        <section id="admin-audit-log">
          <SectionHeader
            icon={ShieldCheck}
            title="Admin Audit Log"
            description="All admin-privileged write actions — requires four-eyes review"
            badge={unreviewedTotal > 0
              ? { text: `${unreviewedTotal} unreviewed`, variant: 'warn' }
              : { text: 'All reviewed', variant: 'ok' }
            }
          />
          <AdminAuditLogPanel
            initialData={{
              entries:          adminAuditEntries,
              total:            adminAuditTotal,
              unreviewed_total: unreviewedTotal,
            }}
          />
        </section>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <footer className="text-center py-4">
          <p className="text-[11px] text-white/65">
            Ops Dashboard · Read-only · All financial actions require the 8-condition release gate
          </p>
        </footer>
      </div>
    </div>
  )
}

// ─── Micro-components ─────────────────────────────────────────────────────────

function SummaryCard({
  icon: Icon, label, value, warn, critical, href,
}: {
  icon: React.ElementType
  label: string
  value: string
  warn?: boolean
  critical?: boolean
  href?: string
}) {
  const color = critical
    ? 'border-red-500/20 bg-red-500/[0.06]'
    : warn
      ? 'border-amber-500/20 bg-amber-500/[0.06]'
      : 'border-white/[0.08] bg-white/[0.03]'

  const valueColor = critical
    ? 'text-red-400'
    : warn
      ? 'text-amber-400'
      : 'text-white/70'

  const iconEl = critical
    ? <Icon size={14} className="text-red-400" />
    : warn
      ? <Icon size={14} className="text-amber-400" />
      : <Icon size={14} className="text-white/60" />

  const inner = (
    <div className={`rounded-xl border ${color} px-4 py-3 transition-all ${href ? 'hover:brightness-110 cursor-pointer' : ''}`}>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] uppercase tracking-widest text-white/65">{label}</p>
        {iconEl}
      </div>
      <p className={`text-[20px] font-bold tabular-nums ${valueColor}`}>{value}</p>
    </div>
  )

  if (href) {
    return <Link href={href} className="block">{inner}</Link>
  }
  return inner
}

function SectionHeader({
  icon: Icon, title, description, badge,
}: {
  icon: React.ElementType
  title: string
  description: string
  badge?: { text: string; variant: 'ok' | 'warn' | 'critical' }
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
        <Icon size={14} className="text-white/75" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-semibold text-white">{title}</h2>
          {badge && (
            <span className={[
              'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold',
              badge.variant === 'ok'       ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : '',
              badge.variant === 'warn'     ? 'bg-amber-500/10   text-amber-400   border border-amber-500/20'   : '',
              badge.variant === 'critical' ? 'bg-red-500/10     text-red-400     border border-red-500/20'     : '',
            ].join(' ')}>
              {badge.text}
            </span>
          )}
        </div>
        <p className="text-[12px] text-white/65">{description}</p>
      </div>
    </div>
  )
}

function FetchError({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-5 py-4 text-[13px] text-red-400">
      Failed to load {label}. Check server logs and try refreshing.
    </div>
  )
}
