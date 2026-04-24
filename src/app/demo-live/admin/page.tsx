import Link from 'next/link'
import {
  Users, DollarSign, AlertTriangle, CheckCircle2,
  Shield, Activity, Zap
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'

// ── Mock data ────────────────────────────────────────────────────────────────

const MOCK_USERS = [
  { name: 'Sarah Chen',   email: 'sarah@meridiancap.com', role: 'funder',      company: 'Meridian Capital Partners',  stripeStatus: '—' },
  { name: 'James Okafor', email: 'james@okaforcap.com',   role: 'funder',      company: 'Okafor Capital Group',       stripeStatus: '—' },
  { name: 'Marcus Webb',  email: 'marcus@webbcg.com',     role: 'contractor',  company: 'Webb Construction Group',    stripeStatus: 'Stripe Connected' },
  { name: 'Diane Reyes',  email: 'diane@reyesdev.com',    role: 'contractor',  company: 'Reyes Development Partners', stripeStatus: 'Stripe Connected' },
  { name: 'Carlos Torres',email: 'carlos@torresankim.com',role: 'contractor',  company: 'Torres & Kim Builders',      stripeStatus: 'Stripe Pending' },
]

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DemoAdminPage() {
  return (
    <div className="min-h-screen bg-surface-0">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-12 sm:py-16 space-y-8">
        {/* Back link */}
        <Link
          href="/demo-live"
          className="inline-flex items-center gap-1.5 text-sm text-white/65 hover:text-white transition-colors"
        >
          ← Back to role selector
        </Link>

        {/* Demo info */}
        <div className="rounded-xl border border-vektrum-blue/20 bg-vektrum-blue/10 px-5 py-4">
          <p className="text-[13px] text-vektrum-blue leading-relaxed">
            You&apos;re viewing the Admin dashboard in demo mode. In the live app, all data comes from real platform activity.
          </p>
        </div>

        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-vektrum-blue">
                <Shield size={14} className="text-white" aria-hidden="true" />
              </div>
              <h1 className="font-display text-[2.25rem] font-bold tracking-[-0.04em] text-white leading-[1.05]">Admin Dashboard</h1>
            </div>
            <p className="text-sm text-white/55">
              Platform-wide oversight. Read-only. All financial actions require the 8-condition release gate.
            </p>
          </div>
          <Link
            href="/demo-live/audit"
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.14] bg-white/[0.06] px-4 py-2 text-[13px] font-medium text-white/80 hover:bg-white/[0.10] hover:text-white hover:border-white/[0.22] transition-all"
          >
            Full Audit Log
          </Link>
        </div>

        {/* Security notice */}
        <div className="flex items-start gap-3 rounded-xl border border-vektrum-blue/20 bg-vektrum-blue/10 px-5 py-4">
          <Shield size={15} className="text-vektrum-blue flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-[13px] text-vektrum-blue leading-relaxed">
            <strong>Admin access is read-only for financial data.</strong> You cannot release funds, modify milestone amounts,
            or alter deal terms from this panel. All payment actions require the full 8-condition release gate
            to be satisfied by the deal participants.
          </p>
        </div>

        {/* Platform Overview */}
        <section>
          <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/75">
            Platform Overview
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <AdminTile label="Contractors" value={3} icon={Users} href="#user-management" />
            <AdminTile label="Funders" value={2} icon={Users} accent href="#user-management" />
            <AdminTile label="Active Deals" value={4} icon={Activity} href="#all-deals" />
            <AdminTile label="Capital Governed" value={formatCurrency(21_450_000)} icon={DollarSign} accent href="#all-deals" />
            <AdminTile label="Total Released" value={formatCurrency(11_410_000)} icon={CheckCircle2} href="#audit-activity" />
            <AdminTile label="Open Disputes" value={1} icon={AlertTriangle} warning href="#open-disputes" />
          </div>
        </section>

        {/* Dispute Queue */}
        <section id="open-disputes">
          <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/75">
            Open Disputes
          </h2>
          <div className="rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card p-4 flex items-start justify-between gap-4" >
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-white">Harbor Logistics Center</p>
                <p className="text-sm text-white/55">HVAC Equipment Procurement · {formatCurrency(487_000)} disputed · Priority 1</p>
                <p className="text-sm text-white/55 mt-0.5">Marcus Webb vs. Sarah Chen · Flagged 3 days ago</p>
              </div>
            </div>
            <Link href="/demo-live/deal/harbor-dispute?from=admin" className="bg-amber-500/25 border border-amber-500/40 text-amber-300 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap hover:bg-amber-500/35 hover:text-amber-200 transition-all">
              View Dispute →
            </Link>
          </div>
        </section>

        {/* All Deals */}
        <section id="all-deals" className="mt-6">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/75 mb-4">All Deals</h2>
          <div className="rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden" >
            <table className="w-full text-sm">
              <thead className="bg-white/[0.04]">
                <tr>
                  <th className="text-left px-4 py-3 text-white/75 font-medium">Deal</th>
                  <th className="text-left px-4 py-3 text-white/75 font-medium">Contractor</th>
                  <th className="text-left px-4 py-3 text-white/75 font-medium">Funder</th>
                  <th className="text-right px-4 py-3 text-white/75 font-medium">Total</th>
                  <th className="text-right px-4 py-3 text-white/75 font-medium">Released</th>
                  <th className="text-left px-4 py-3 text-white/75 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: 'Riverside Mixed-Use Development',  slug: 'riverside',      contractor: 'Marcus Webb',   funder: 'Sarah Chen',   total: 2_400_000, released: 480_000   },
                  { name: 'Harbor Logistics Center',          slug: 'harbor-dispute', contractor: 'Marcus Webb',   funder: 'Sarah Chen',   total: 9_100_000, released: 7_640_000 },
                  { name: 'Westside Medical Office Campus',   slug: 'westside',       contractor: 'Diane Reyes',   funder: 'Sarah Chen',   total: 4_750_000, released: 950_000   },
                  { name: 'Eastside Industrial Park',         slug: null,             contractor: 'Carlos Torres', funder: 'James Okafor', total: 5_200_000, released: 2_340_000 },
                ].map(d => (
                  <tr key={d.name} className="border-t border-white/[0.06] hover:bg-white/[0.03] transition-colors">
                    <td className="px-4 py-3">
                      {d.slug
                        ? <Link href={`/demo-live/deal/${d.slug}?from=admin`} className="text-vektrum-blue hover:underline font-medium">{d.name}</Link>
                        : <span className="text-white/70 font-medium">{d.name}</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-white">{d.contractor}</td>
                    <td className="px-4 py-3 text-white">{d.funder}</td>
                    <td className="px-4 py-3 text-right text-white">{formatCurrency(d.total)}</td>
                    <td className="px-4 py-3 text-right text-emerald-400 font-medium">{formatCurrency(d.released)}</td>
                    <td className="px-4 py-3"><span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full text-xs font-medium">Active</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* User Table */}
        <section id="user-management">
          <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/75">
            User Management
          </h2>
          <div className="rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden" >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.04]">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/75">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/75">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/75">Company</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/75">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/75">Stripe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {MOCK_USERS.map((u) => (
                    <tr key={u.email} className="hover:bg-white/[0.03] transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-[13px] font-medium text-white">{u.name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          u.role === 'funder'
                            ? 'bg-vektrum-blue/10 text-vektrum-blue border-vektrum-blue/20'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-white/55">{u.company}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-[12px] text-emerald-400">
                          <CheckCircle2 size={12} aria-hidden="true" /> Active
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-white/55">{u.stripeStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Platform Health */}
        <section>
          <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/75">
            Platform Health
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <AdminTile
              label="Release Gate Status"
              value="Operational"
              sub="8 conditions enforced server-side"
              icon={Shield}
            />
            <AdminTile
              label="Stripe Connect Coverage"
              value="2 / 3 contractors verified"
              sub="Torres & Kim onboarding pending"
              icon={DollarSign}
            />
            <AdminTile
              label="Onboarding Completion"
              value="4 / 5 users onboarded"
              sub="Carlos Torres verification pending"
              icon={CheckCircle2}
            />
          </div>
          <div className="mt-3">
            <AdminTile
              label="Perplexity AI Integration"
              value="Active — Sonar Pro draw review enabled"
              sub="All draw requests route through /api/ai/draw-review"
              icon={Zap}
            />
          </div>
        </section>

        {/* Recent Audit Activity */}
        <section className="mt-6" id="audit-activity">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/75">Recent Audit Activity</h2>
            <Link href="/demo-live/audit" className="text-sm text-vektrum-blue hover:underline">View full audit log →</Link>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-surface-2 divide-y divide-white/[0.06] text-sm overflow-hidden" >
            {[
              { time: '3 days ago',  actor: 'System',       role: 'system',     action: 'Dispute Opened',     entity: 'Harbor Logistics Center',         details: 'HVAC $487K' },
              { time: '7 days ago',  actor: 'Diane Reyes',  role: 'contractor', action: 'Document Uploaded',  entity: 'Westside Medical Office Campus',  details: 'Lien_Waiver_Reyes.pdf' },
              { time: '10 days ago', actor: 'James Okafor', role: 'funder',     action: 'Funds Released',     entity: 'Eastside Industrial Park',        details: '$780,000 → Torres & Kim' },
              { time: '20 days ago', actor: 'Sarah Chen',   role: 'funder',     action: 'Funds Released',     entity: 'Harbor Logistics Center',         details: '$2,640,000' },
              { time: '20 days ago', actor: 'Sarah Chen',   role: 'funder',     action: 'Milestone Approved', entity: 'Harbor Logistics Center',         details: 'Building Envelope' },
            ].map((e, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-4">
                <span className="text-white/50 w-24 shrink-0">{e.time}</span>
                <span className="font-medium text-white w-28 shrink-0">{e.actor}</span>
                <span className="bg-vektrum-blue/10 text-vektrum-blue border border-vektrum-blue/20 px-2 py-0.5 rounded-full text-xs">{e.action}</span>
                <span className="text-white/55 flex-1 truncate">{e.entity}</span>
                <span className="text-white/50 text-xs">{e.details}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

// ── Inline AdminTile ─────────────────────────────────────────────────────────

function AdminTile({
  label, value, sub, icon: Icon, accent = false, warning = false, href,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  accent?: boolean
  warning?: boolean
  href?: string
}) {
  const inner = (
    <div className={`rounded-2xl border bg-surface-2 shadow-card px-5 py-5 transition-all duration-300 hover:-translate-y-0.5 ${warning ? 'border-vektrum-amber/30' : 'border-white/[0.08] hover:border-white/[0.14]'} ${href ? 'cursor-pointer' : ''}`} >
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/75">{label}</p>
        <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${warning ? 'bg-vektrum-amber/10' : 'bg-vektrum-blue/10'}`}>
          <Icon size={13} className={warning ? 'text-amber-400' : 'text-vektrum-blue'} aria-hidden="true" />
        </div>
      </div>
      <p className={`font-display text-2xl font-bold tabular-nums leading-none break-all ${accent ? 'text-vektrum-blue' : warning ? 'text-amber-400' : 'text-white'}`}>
        {value}
      </p>
      {sub && <p className="mt-1.5 text-[11px] text-white/75">{sub}</p>}
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}
