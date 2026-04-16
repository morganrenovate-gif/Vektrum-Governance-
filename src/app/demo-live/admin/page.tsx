import Link from 'next/link'
import {
  Users, DollarSign, AlertTriangle, CheckCircle2,
  Shield, Activity, Zap
} from 'lucide-react'

// ── Mock data ────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

const MOCK_USERS = [
  { name: 'Sarah Chen', email: 'sarah@meridiancap.com', role: 'funder', company: 'Meridian Capital Partners', stripeVerified: true, onboarded: true },
  { name: 'Marcus Webb', email: 'marcus@webbcg.com', role: 'contractor', company: 'Webb Construction Group', stripeVerified: true, onboarded: true },
]

const MOCK_AUDIT = [
  { id: '1', action: 'milestone_released', entity: 'milestone / Framing & Structural (Deal 1)', actor: 'Sarah Chen', time: '2h ago' },
  { id: '2', action: 'ai_draw_review', entity: 'milestone / Framing & Structural (Deal 1)', actor: 'system', time: '2h 5m ago' },
  { id: '3', action: 'milestone_approved', entity: 'milestone / Framing & Structural (Deal 1)', actor: 'Sarah Chen', time: '2h 10m ago' },
  { id: '4', action: 'milestone_transition', entity: 'milestone / MEP Rough-In', actor: 'Marcus Webb', time: '3h ago' },
  { id: '5', action: 'ai_draw_review', entity: 'milestone / Building Envelope (Deal 2)', actor: 'system', time: '1d ago' },
]

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DemoAdminPage() {
  return (
    <div className="page-container section space-y-8">
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
          <AdminTile label="Contractors" value={1} icon={Users} />
          <AdminTile label="Funders" value={1} icon={Users} accent />
          <AdminTile label="Active Deals" value={3} icon={Activity} />
          <AdminTile label="Capital Governed" value={fmt(16_250_000)} icon={DollarSign} accent />
          <AdminTile label="Total Released" value={fmt(4_890_000)} icon={CheckCircle2} />
          <AdminTile label="Open Disputes" value={0} icon={AlertTriangle} />
        </div>
      </section>

      {/* Dispute Queue */}
      <section>
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-vektrum-muted">
          Open Disputes
        </h2>
        <div className="rounded-xl border border-dashed border-vektrum-border bg-vektrum-surface-alt px-8 py-12 text-center">
          <p className="text-sm text-vektrum-faint">No open disputes. The platform is operating cleanly.</p>
        </div>
      </section>

      {/* User Table */}
      <section>
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
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-vektrum-muted">Stripe</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-vektrum-muted">Onboarded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-vektrum-border-subtle">
                {MOCK_USERS.map((u) => (
                  <tr key={u.email} className="hover:bg-vektrum-surface-alt transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-medium text-vektrum-text">{u.name}</p>
                      <p className="text-[11px] text-vektrum-faint">{u.email}</p>
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
                      <span className="inline-flex items-center gap-1 text-[12px] text-vektrum-green">
                        <CheckCircle2 size={12} aria-hidden="true" /> Verified
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-[12px] text-vektrum-green">
                        <CheckCircle2 size={12} aria-hidden="true" /> Complete
                      </span>
                    </td>
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
      <section>
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-vektrum-muted">
          Recent Audit Activity
        </h2>
        <div className="rounded-xl border border-vektrum-border bg-vektrum-surface shadow-sm overflow-hidden">
          <ul className="divide-y divide-vektrum-border-subtle">
            {MOCK_AUDIT.map((entry) => {
              const color = entry.action.includes('released')
                ? 'text-vektrum-green'
                : entry.action.includes('blocked') || entry.action.includes('dispute')
                ? 'text-vektrum-amber'
                : entry.action.includes('ai_draw_review')
                ? 'text-vektrum-blue'
                : 'text-vektrum-muted'
              return (
                <li key={entry.id} className="flex items-center gap-4 px-5 py-3 hover:bg-vektrum-surface-alt transition-colors">
                  <span className={`font-mono text-[13px] font-medium ${color} min-w-[160px]`}>{entry.action}</span>
                  <span className="text-[12px] text-vektrum-muted truncate flex-1">{entry.entity}</span>
                  <span className="text-[12px] text-vektrum-faint flex-shrink-0">{entry.actor}</span>
                  <span className="text-[11px] text-vektrum-faint tabular-nums flex-shrink-0">{entry.time}</span>
                </li>
              )
            })}
          </ul>
          <div className="border-t border-vektrum-border-subtle px-5 py-3 bg-vektrum-surface-alt">
            <Link
              href="/demo-live/audit"
              className="text-[13px] font-medium text-vektrum-blue hover:text-vektrum-blue-hover transition-colors"
            >
              View full audit log &rarr;
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

// ── Inline AdminTile ─────────────────────────────────────────────────────────

function AdminTile({
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
      <p className={`font-display text-2xl font-bold tabular-nums leading-none break-all ${accent ? 'text-vektrum-blue' : warning ? 'text-vektrum-amber' : 'text-vektrum-text'}`}>
        {value}
      </p>
      {sub && <p className="mt-1.5 text-[11px] text-vektrum-faint">{sub}</p>}
    </div>
  )
}
