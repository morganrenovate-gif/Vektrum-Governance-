import Link from 'next/link'
import {
  Users, DollarSign, AlertTriangle, CheckCircle2,
  Shield, Activity, Zap
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'

// ── Mock data ────────────────────────────────────────────────────────────────

const MOCK_USERS = [
  { name: 'Marcus Webb', email: 'marcus@webbcg.com', role: 'contractor', company: 'Webb Construction Group', stripeStatus: 'Stripe Connected' },
  { name: 'Sarah Chen', email: 'sarah@meridiancap.com', role: 'funder', company: 'Meridian Capital Partners', stripeStatus: '—' },
]

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DemoAdminPage() {
  return (
    <div className="page-container section space-y-8">
      {/* Back link */}
      <Link
        href="/demo-live"
        className="inline-flex items-center gap-1.5 text-sm text-vektrum-muted hover:text-vektrum-text transition-colors"
      >
        ← Back to role selector
      </Link>

      {/* Demo info */}
      <div className="rounded-xl border border-vektrum-blue-border bg-vektrum-blue-subtle px-5 py-4">
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
            <h1 className="font-display text-2xl font-bold text-vektrum-text">Admin Dashboard</h1>
          </div>
          <p className="text-sm text-vektrum-muted">
            Platform-wide oversight. Read-only. All financial actions require the 7-condition release gate.
          </p>
        </div>
        <Link
          href="/demo-live/audit"
          className="inline-flex items-center gap-2 rounded-lg border border-vektrum-border bg-vektrum-surface px-4 py-2 text-[13px] font-medium text-vektrum-muted hover:bg-vektrum-surface-alt transition-all"
        >
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

      {/* Platform Overview */}
      <section>
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-vektrum-muted">
          Platform Overview
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <AdminTile label="Contractors" value={1} icon={Users} href="#user-management" />
          <AdminTile label="Funders" value={1} icon={Users} accent href="#user-management" />
          <AdminTile label="Active Deals" value={3} icon={Activity} href="#all-deals" />
          <AdminTile label="Capital Governed" value={formatCurrency(16_250_000)} icon={DollarSign} accent href="#all-deals" />
          <AdminTile label="Total Released" value={formatCurrency(4_890_000)} icon={CheckCircle2} href="#audit-activity" />
          <AdminTile label="Open Disputes" value={1} icon={AlertTriangle} warning href="#open-disputes" />
        </div>
      </section>

      {/* Dispute Queue */}
      <section id="open-disputes">
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-vektrum-muted">
          Open Disputes
        </h2>
        <div className="border border-orange-200 bg-orange-50 rounded-xl p-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-orange-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-vektrum-text">Harbor Logistics Center</p>
              <p className="text-sm text-vektrum-muted">HVAC Equipment Procurement · {formatCurrency(487_000)} disputed · Priority 1</p>
              <p className="text-sm text-vektrum-muted mt-0.5">Marcus Webb vs. Sarah Chen · Flagged 3 days ago</p>
            </div>
          </div>
          <Link href="/demo-live/deal/harbor-dispute?from=admin" className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap hover:bg-orange-600">
            View Dispute →
          </Link>
        </div>
      </section>

      {/* All Deals */}
      <section id="all-deals" className="mt-6">
        <h2 className="text-lg font-semibold text-vektrum-text mb-3">All Deals</h2>
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-vektrum-surface-alt">
              <tr>
                <th className="text-left px-4 py-3 text-vektrum-muted font-medium">Deal</th>
                <th className="text-left px-4 py-3 text-vektrum-muted font-medium">Contractor</th>
                <th className="text-left px-4 py-3 text-vektrum-muted font-medium">Funder</th>
                <th className="text-right px-4 py-3 text-vektrum-muted font-medium">Total</th>
                <th className="text-right px-4 py-3 text-vektrum-muted font-medium">Released</th>
                <th className="text-left px-4 py-3 text-vektrum-muted font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'Riverside Mixed-Use Development', slug: 'riverside', contractor: 'Marcus Webb', funder: 'Sarah Chen', total: 2400000, released: 480000 },
                { name: 'Harbor Logistics Center', slug: 'harbor-dispute', contractor: 'Marcus Webb', funder: 'Sarah Chen', total: 9100000, released: 7640000 },
                { name: 'Westside Medical Office Campus', slug: 'westside', contractor: 'Marcus Webb', funder: 'Sarah Chen', total: 4750000, released: 950000 },
              ].map(d => (
                <tr key={d.slug} className="border-t hover:bg-vektrum-surface-alt/50">
                  <td className="px-4 py-3"><Link href={`/demo-live/deal/${d.slug}?from=admin`} className="text-blue-600 hover:underline font-medium">{d.name}</Link></td>
                  <td className="px-4 py-3 text-vektrum-text">{d.contractor}</td>
                  <td className="px-4 py-3 text-vektrum-text">{d.funder}</td>
                  <td className="px-4 py-3 text-right text-vektrum-text">{formatCurrency(d.total)}</td>
                  <td className="px-4 py-3 text-right text-green-600 font-medium">{formatCurrency(d.released)}</td>
                  <td className="px-4 py-3"><span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">Active</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* User Table */}
      <section id="user-management">
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-vektrum-muted">
          User Management
        </h2>
        <div className="rounded-xl border border-vektrum-border bg-vektrum-surface shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-vektrum-border bg-vektrum-surface-alt">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-vektrum-muted">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-vektrum-muted">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-vektrum-muted">Company</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-vektrum-muted">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-vektrum-muted">Stripe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-vektrum-border-subtle">
                {MOCK_USERS.map((u) => (
                  <tr key={u.email} className="hover:bg-vektrum-surface-alt transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-medium text-vektrum-text">{u.name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        u.role === 'funder'
                          ? 'bg-vektrum-blue-subtle text-vektrum-blue border-vektrum-blue-border'
                          : 'bg-vektrum-green-bg text-vektrum-green border-vektrum-green-border'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-vektrum-muted">{u.company}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-[12px] text-green-600">
                        <CheckCircle2 size={12} aria-hidden="true" /> Active
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-vektrum-muted">{u.stripeStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Platform Health */}
      <section>
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-vektrum-muted">
          Platform Health
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <AdminTile
            label="Release Gate Status"
            value="Operational"
            sub="7 conditions enforced server-side"
            icon={Shield}
          />
          <AdminTile
            label="Stripe Connect Coverage"
            value="1 / 1 contractors verified"
            sub="All contractors Stripe-verified"
            icon={DollarSign}
          />
          <AdminTile
            label="Onboarding Completion"
            value="2 / 2 users onboarded"
            sub="Platform-wide onboarding complete"
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
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-vektrum-text">Recent Audit Activity</h2>
          <Link href="/demo-live/audit" className="text-sm text-blue-600 hover:underline">View full audit log →</Link>
        </div>
        <div className="border rounded-xl divide-y text-sm">
          {[
            { time: '3 days ago', actor: 'System', role: 'system', action: 'Dispute Opened', entity: 'Harbor Logistics Center', details: 'HVAC $487K' },
            { time: '14 days ago', actor: 'Sarah Chen', role: 'funder', action: 'Funds Released', entity: 'Harbor Logistics Center', details: '$2,640,000' },
            { time: '14 days ago', actor: 'Sarah Chen', role: 'funder', action: 'Milestone Approved', entity: 'Harbor Logistics Center', details: 'Building Envelope' },
            { time: '15 days ago', actor: 'Marcus Webb', role: 'contractor', action: 'Document Uploaded', entity: 'Westside Medical', details: 'Lien waiver' },
            { time: '45 days ago', actor: 'System', role: 'system', action: 'Deal Created', entity: 'Riverside Mixed-Use', details: '$2,400,000' },
          ].map((e, i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-4">
              <span className="text-vektrum-muted w-24 shrink-0">{e.time}</span>
              <span className="font-medium text-vektrum-text w-28 shrink-0">{e.actor}</span>
              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">{e.action}</span>
              <span className="text-vektrum-muted flex-1 truncate">{e.entity}</span>
              <span className="text-vektrum-muted text-xs">{e.details}</span>
            </div>
          ))}
        </div>
      </section>
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
    <div className={`rounded-xl border bg-vektrum-surface px-5 py-5 shadow-sm transition-all ${warning ? 'border-orange-200 bg-orange-50' : 'border-vektrum-border'} ${href ? 'hover:border-vektrum-blue hover:shadow-md cursor-pointer' : ''}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">{label}</p>
        <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${warning ? 'bg-orange-100' : 'bg-vektrum-blue-subtle'}`}>
          <Icon size={13} className={warning ? 'text-orange-500' : 'text-vektrum-blue'} aria-hidden="true" />
        </div>
      </div>
      <p className={`font-display text-2xl font-bold tabular-nums leading-none break-all ${accent ? 'text-vektrum-blue' : warning ? 'text-orange-500' : 'text-vektrum-text'}`}>
        {value}
      </p>
      {sub && <p className="mt-1.5 text-[11px] text-vektrum-faint">{sub}</p>}
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}
