import Link from 'next/link'
import {
  Users, DollarSign, AlertTriangle, CheckCircle2,
  Shield, Activity, Zap, ArrowRight, ArrowLeft, Eye, ListChecks,
  Building2, FileText, Lock, ClipboardList,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import { DemoResetButton } from '@/components/demo/DemoResetButton'

// ─── Mock data ────────────────────────────────────────────────────────────────

interface AdminUser {
  name:           string
  email:          string
  role:           'funder' | 'contractor'
  company:        string
  /** What does the platform need from this user, if anything? */
  readiness:      'verified' | 'pending'
  /** Specifically which onboarding step is outstanding (if pending). */
  blocker?:       string
  stripeStatus:   string
}

const MOCK_USERS: AdminUser[] = [
  { name: 'Sarah Chen',    email: 'sarah@meridiancap.com',  role: 'funder',     company: 'Meridian Capital Partners',  readiness: 'verified', stripeStatus: '—' },
  { name: 'James Okafor',  email: 'james@okaforcap.com',    role: 'funder',     company: 'Okafor Capital Group',       readiness: 'verified', stripeStatus: '—' },
  { name: 'Marcus Webb',   email: 'marcus@webbcg.com',      role: 'contractor', company: 'Webb Construction Group',    readiness: 'verified', stripeStatus: 'Stripe connected' },
  { name: 'Diane Reyes',   email: 'diane@reyesdev.com',     role: 'contractor', company: 'Reyes Development Partners', readiness: 'verified', stripeStatus: 'Stripe connected' },
  { name: 'Carlos Torres', email: 'carlos@torresankim.com', role: 'contractor', company: 'Torres & Kim Builders',      readiness: 'pending',  blocker: 'Stripe Connect onboarding incomplete', stripeStatus: 'Stripe pending' },
]

interface AdminDeal {
  name:        string
  slug:        string | null
  contractor:  string
  funder:      string
  total:       number
  released:    number
  /** Operational status — drives the Stage badge. */
  stage:       'healthy' | 'exception' | 'awaiting_funder'
  exception?:  string
  nextEvent:   string
}

const MOCK_DEALS: AdminDeal[] = [
  {
    name:       'Riverside Mixed-Use Development',
    slug:       'riverside',
    contractor: 'Marcus Webb',
    funder:     'Sarah Chen',
    total:      2_400_000,
    released:   480_000,
    stage:      'awaiting_funder',
    nextEvent:  'MEP Rough-In awaiting control review',
  },
  {
    name:       'Harbor Logistics Center',
    slug:       'harbor-dispute',
    contractor: 'Marcus Webb',
    funder:     'Sarah Chen',
    total:      9_100_000,
    released:   7_640_000,
    stage:      'exception',
    exception:  'Open dispute · HVAC $487,000',
    nextEvent:  'Dispute review with counterparties',
  },
  {
    name:       'Westside Medical Office Campus',
    slug:       'westside',
    contractor: 'Diane Reyes',
    funder:     'Sarah Chen',
    total:      4_750_000,
    released:   950_000,
    stage:      'healthy',
    nextEvent:  'Building Envelope progressing on schedule',
  },
  {
    name:       'Eastside Industrial Park',
    slug:       null,
    contractor: 'Carlos Torres',
    funder:     'James Okafor',
    total:      5_200_000,
    released:   2_340_000,
    stage:      'healthy',
    nextEvent:  'Awaiting next draw submission',
  },
]

// Recent governed activity — typed for visual scanning.
type EventType = 'dispute' | 'release' | 'approval' | 'document'

interface AuditEvent {
  time:    string
  actor:   string
  role:    'system' | 'contractor' | 'funder' | 'admin'
  type:    EventType
  action:  string
  entity:  string
  details: string
}

const AUDIT_EVENTS: AuditEvent[] = [
  { time: '3 days ago',  actor: 'System',       role: 'system',     type: 'dispute',  action: 'Dispute opened',      entity: 'Harbor Logistics Center',        details: 'HVAC $487K · contractor vs. funder' },
  { time: '7 days ago',  actor: 'Diane Reyes',  role: 'contractor', type: 'document', action: 'Document uploaded',   entity: 'Westside Medical Office Campus', details: 'Lien_Waiver_Reyes.pdf' },
  { time: '10 days ago', actor: 'James Okafor', role: 'funder',     type: 'release',  action: 'Funds released',      entity: 'Eastside Industrial Park',       details: '$780,000 → Torres & Kim' },
  { time: '20 days ago', actor: 'Sarah Chen',   role: 'funder',     type: 'release',  action: 'Funds released',      entity: 'Harbor Logistics Center',        details: '$2,640,000' },
  { time: '20 days ago', actor: 'Sarah Chen',   role: 'funder',     type: 'approval', action: 'Milestone approved',  entity: 'Harbor Logistics Center',        details: 'Building Envelope' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DemoAdminPage() {
  const totalContractors = MOCK_USERS.filter((u) => u.role === 'contractor').length
  const totalFunders     = MOCK_USERS.filter((u) => u.role === 'funder').length
  const onboardingPending = MOCK_USERS.filter((u) => u.readiness === 'pending').length
  const stripePending     = MOCK_USERS.filter((u) => u.role === 'contractor' && u.stripeStatus === 'Stripe pending').length
  const activeDeals       = MOCK_DEALS.length
  const exceptionDeals    = MOCK_DEALS.filter((d) => d.stage === 'exception').length
  const capitalGoverned   = MOCK_DEALS.reduce((s, d) => s + d.total, 0)
  const totalReleased     = MOCK_DEALS.reduce((s, d) => s + d.released, 0)
  const openDisputes      = exceptionDeals

  return (
    <div className="min-h-screen bg-surface-0">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-10 sm:py-14 space-y-10">

        {/* Back link */}
        <Link
          href="/demo-live"
          className="inline-flex items-center gap-1.5 text-[13px] text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Back to role selector
        </Link>

        {/* Demo info */}
        <div
          role="note"
          aria-label="Demo mode"
          className="rounded-xl border border-white/[0.10] bg-white/[0.02] px-5 py-4 flex flex-wrap items-center gap-x-4 gap-y-2"
        >
          <span className="inline-flex items-center rounded-full bg-white/[0.06] border border-white/[0.10] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.10em] text-white/65">
            Demo mode
          </span>
          <p className="text-[13px] text-white/65 leading-relaxed flex-1 min-w-[260px]">
            Viewing the admin dashboard in demo mode. All data is simulated. In the live app this
            connects to platform-wide deals, audit events, and onboarding records.
          </p>
        </div>

        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <p className="text-[11px] tracking-[0.14em] uppercase text-white/45 font-semibold">
              Admin oversight
            </p>
            <h1 className="font-display text-[2.25rem] font-bold tracking-[-0.04em] text-white leading-[1.05]">
              Platform oversight
            </h1>
            <p className="text-[13px] text-white/55 leading-relaxed max-w-xl">
              {openDisputes} priority exception{openDisputes === 1 ? '' : 's'}
              · {onboardingPending} onboarding item{onboardingPending === 1 ? '' : 's'} pending
              · governance systems operational.
            </p>
          </div>
          <Link
            href="/demo-live/audit"
            className="inline-flex items-center gap-2 self-start rounded-xl border border-white/[0.10] bg-white/[0.04] px-4 py-2.5 text-[13px] font-semibold text-white/75 hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            <ClipboardList size={14} aria-hidden="true" />
            Full audit log
          </Link>
        </header>

        {/* ── Guided oversight strip ────────────────────────────────────────── */}
        <GuidedOversightStrip />

        {/* ── Top command area: priority exception + admin scope ───────────── */}
        <section
          aria-label="Today's oversight focus"
          className="grid gap-4 lg:grid-cols-5"
        >
          <PriorityExceptionCard />
          <AdminScopeCard />
        </section>

        {/* ── Immediate-attention metrics ───────────────────────────────────── */}
        <section aria-label="Immediate attention">
          <SectionHeader label="Immediate attention" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <OpsTile
              label="Open disputes"
              value={String(openDisputes)}
              sublabel={openDisputes === 0 ? 'None' : 'Priority exception active'}
              tone={openDisputes === 0 ? 'ok' : 'amber'}
              href="#priority-exception"
            />
            <OpsTile
              label="Onboarding pending"
              value={String(onboardingPending)}
              sublabel={onboardingPending === 0 ? 'All clear' : 'Verification incomplete'}
              tone={onboardingPending === 0 ? 'ok' : 'amber'}
              href="#user-readiness"
            />
            <OpsTile
              label="Stripe pending"
              value={String(stripePending)}
              sublabel={stripePending === 0 ? 'Coverage complete' : 'Contractor not yet verified'}
              tone={stripePending === 0 ? 'ok' : 'amber'}
              href="#user-readiness"
            />
            <OpsTile
              label="Deals with exceptions"
              value={`${exceptionDeals} / ${activeDeals}`}
              sublabel={exceptionDeals === 0 ? 'All deals healthy' : 'Review exception column'}
              tone={exceptionDeals === 0 ? 'ok' : 'amber'}
              href="#all-deals"
            />
          </div>
        </section>

        {/* ── Governance systems (rebuilt Platform Health) ─────────────────── */}
        <section aria-label="Governance systems">
          <SectionHeader label="Governance systems" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <GovernanceCard
              icon={Shield}
              title="Release gate enforcement"
              status="operational"
              detail="10 release conditions enforced server-side"
            />
            <GovernanceCard
              icon={Activity}
              title="Audit event chain"
              status="operational"
              detail="Append-only, hash-chained governed events"
            />
            <GovernanceCard
              icon={Zap}
              title="AI review resilience"
              status="operational"
              detail="Primary and fallback providers configured"
            />
            <GovernanceCard
              icon={DollarSign}
              title="Rail readiness"
              status={stripePending === 0 ? 'operational' : 'attention'}
              detail={`${totalContractors - stripePending} of ${totalContractors} contractors verified`}
              note={stripePending === 0 ? undefined : 'Torres & Kim onboarding pending'}
            />
            <GovernanceCard
              icon={CheckCircle2}
              title="Onboarding completion"
              status={onboardingPending === 0 ? 'operational' : 'attention'}
              detail={`${MOCK_USERS.length - onboardingPending} of ${MOCK_USERS.length} users onboarded`}
              note={onboardingPending === 0 ? undefined : 'Carlos Torres verification pending'}
            />
            <GovernanceCard
              icon={Lock}
              title="Custody boundary"
              status="operational"
              detail="Vektrum does not hold or move funds"
              note="Funds held by Stripe or the funder's payment partner"
            />
          </div>
        </section>

        {/* ── Platform exposure ─────────────────────────────────────────────── */}
        <section aria-label="Platform exposure">
          <SectionHeader label="Platform exposure" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <AnalyticsTile label="Active deals"     value={String(activeDeals)}                />
            <AnalyticsTile label="Capital governed" value={formatCurrency(capitalGoverned)}    />
            <AnalyticsTile label="Released to date" value={formatCurrency(totalReleased)}      />
          </div>
        </section>

        {/* ── All deals (oversight table) ──────────────────────────────────── */}
        <section id="all-deals" aria-label="All deals">
          <SectionHeader label="All deals · oversight view" />
          <div className="rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-[12.5px]">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.04] text-[10px] uppercase tracking-[0.10em] text-white/45">
                    <th className="text-left  px-4 py-3 font-semibold">Deal</th>
                    <th className="text-left  px-4 py-3 font-semibold">Counterparties</th>
                    <th className="text-right px-4 py-3 font-semibold">Total</th>
                    <th className="text-right px-4 py-3 font-semibold">Released</th>
                    <th className="text-left  px-4 py-3 font-semibold">Stage</th>
                    <th className="text-left  px-4 py-3 font-semibold">Next event / exception</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {MOCK_DEALS.map((d) => (
                    <tr
                      key={d.name}
                      className={`hover:bg-white/[0.03] transition-colors ${
                        d.stage === 'exception' ? 'bg-amber-500/[0.03]' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        {d.slug ? (
                          <Link
                            href={`/demo-live/deal/${d.slug}?from=admin`}
                            className="text-[13px] font-semibold text-white hover:text-blue-300 transition-colors"
                          >
                            {d.name}
                          </Link>
                        ) : (
                          <span className="text-[13px] font-semibold text-white">{d.name}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-white/70">
                        <p>{d.contractor}</p>
                        <p className="text-[11px] text-white/40">{d.funder}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-white/80 tabular-nums">{formatCurrency(d.total)}</td>
                      <td className="px-4 py-3 text-right text-emerald-300 tabular-nums">{formatCurrency(d.released)}</td>
                      <td className="px-4 py-3">
                        <DealStageBadge stage={d.stage} />
                      </td>
                      <td className="px-4 py-3 text-white/65">
                        {d.exception ? (
                          <span className="inline-flex items-center gap-1.5 text-amber-300">
                            <AlertTriangle size={11} className="flex-shrink-0" aria-hidden="true" />
                            {d.exception}
                          </span>
                        ) : (
                          <span className="text-white/55">{d.nextEvent}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── Entity readiness (renamed from User Management) ─────────────── */}
        <section id="user-readiness" aria-label="Entity readiness">
          <SectionHeader label="Entity readiness" />
          <div className="rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-[12.5px]">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.04] text-[10px] uppercase tracking-[0.10em] text-white/45">
                    <th className="px-4 py-3 text-left  font-semibold">Entity</th>
                    <th className="px-4 py-3 text-left  font-semibold">Role</th>
                    <th className="px-4 py-3 text-left  font-semibold">Readiness</th>
                    <th className="px-4 py-3 text-left  font-semibold">Rail status</th>
                    <th className="px-4 py-3 text-left  font-semibold">Outstanding</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {MOCK_USERS.map((u) => (
                    <tr
                      key={u.email}
                      className={`hover:bg-white/[0.03] transition-colors ${
                        u.readiness === 'pending' ? 'bg-amber-500/[0.03]' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <p className="text-[13px] font-semibold text-white">{u.name}</p>
                        <p className="text-[11px] text-white/40">{u.company}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          u.role === 'funder'
                            ? 'bg-vektrum-blue/10 text-blue-300 border-vektrum-blue/30'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <ReadinessBadge state={u.readiness} />
                      </td>
                      <td className="px-4 py-3 text-white/70">{u.stripeStatus}</td>
                      <td className="px-4 py-3 text-white/55">
                        {u.blocker ? (
                          <span className="inline-flex items-center gap-1.5 text-amber-300">
                            <AlertTriangle size={11} className="flex-shrink-0" aria-hidden="true" />
                            {u.blocker}
                          </span>
                        ) : (
                          <span className="text-white/35">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── Recent governed activity ─────────────────────────────────────── */}
        <section id="audit-activity" aria-label="Recent governed activity">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/65">
              Recent governed activity
            </h2>
            <Link
              href="/demo-live/audit"
              className="text-[12px] font-semibold text-blue-300 hover:text-blue-200 transition-colors"
            >
              View full audit log →
            </Link>
          </div>
          <p className="-mt-1 mb-3 text-[11px] text-white/45 leading-relaxed">
            Demo session events are shown here. In production, platform events are written to an
            append-only audit record with hash-chained integrity.
          </p>
          <div className="rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden">
            <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-2.5">
              <Activity size={13} className="text-white/55" aria-hidden="true" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.10em] text-white/55">
                Audit event stream
              </p>
              <span className="ml-auto text-[11px] text-white/35">{AUDIT_EVENTS.length} entries</span>
            </div>
            <ol className="divide-y divide-white/[0.05]">
              {AUDIT_EVENTS.map((e, i) => (
                <li key={i} className="px-5 py-3 grid grid-cols-12 gap-3 items-center">
                  <span className="col-span-2 text-[11px] text-white/40 tabular-nums">{e.time}</span>
                  <span className="col-span-2 text-[12px] font-semibold text-white truncate">{e.actor}</span>
                  <span className="col-span-2">
                    <EventTypeBadge type={e.type} action={e.action} />
                  </span>
                  <span className="col-span-3 text-[12px] text-white/70 truncate">{e.entity}</span>
                  <span className="col-span-3 text-[11px] text-white/45 tabular-nums truncate">{e.details}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Demo controls — small, lower-priority ────────────────────────── */}
        <section aria-label="Demo controls" className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center rounded-full bg-white/[0.06] border border-white/[0.10] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.10em] text-white/65">
            Demo tooling
          </span>
          <p className="text-[12px] text-white/55 leading-relaxed flex-1 min-w-[220px]">
            Reset the simulated session to its starting state. Demo tooling does not exist in
            production.
          </p>
          <DemoResetButton variant="admin" />
        </section>

        {/* ── Footer / non-custodial framing ───────────────────────────────── */}
        <footer className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
          <p className="text-[11px] text-white/45 leading-relaxed">
            Vektrum is authorization infrastructure for construction draw governance. Vektrum does
            not hold funds, act as a bank or custodian, or move money. Funds are held by Stripe or
            the funder&rsquo;s payment partner. Admin access is read-only for financial data —
            financial actions remain controlled at the participant and release-gate layer.
          </p>
        </footer>

      </div>
    </div>
  )
}

// ─── Components ───────────────────────────────────────────────────────────────

function GuidedOversightStrip() {
  const steps = [
    { n: 1, label: 'Monitor exceptions' },
    { n: 2, label: 'Review governed activity' },
    { n: 3, label: 'Check onboarding and rail readiness' },
    { n: 4, label: 'Verify control systems' },
    { n: 5, label: 'Inspect audit history' },
  ]
  return (
    <section
      aria-label="How oversight works"
      className="rounded-xl border border-white/[0.07] bg-surface-2/40 px-5 py-3.5"
    >
      <div className="flex items-center gap-2 mb-2.5">
        <ListChecks size={12} className="text-white/55" aria-hidden="true" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">
          How oversight works
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

function PriorityExceptionCard() {
  return (
    <article
      id="priority-exception"
      className="lg:col-span-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] overflow-hidden"
    >
      <div className="px-6 pt-5 pb-4 border-b border-white/[0.06] space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-300">
            Attention now
          </p>
          <span aria-hidden="true" className="text-white/15">·</span>
          <p className="text-[11px] text-white/45">Flagged 3 days ago</p>
        </div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-[17px] font-semibold text-white leading-tight">
              Priority exception — Harbor Logistics Center
            </h2>
            <p className="mt-1 text-[12px] text-white/55">HVAC Equipment Procurement</p>
          </div>
          <div className="text-right">
            <p className="font-display text-[1.5rem] font-bold tabular-nums text-white leading-none">
              {formatCurrency(487_000)}
            </p>
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/[0.10] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
              <AlertTriangle size={10} aria-hidden="true" />
              Priority 1 · disputed
            </span>
          </div>
        </div>
        <p className="text-[13px] text-white/75 leading-relaxed">
          A disputed line item remains open between contractor and funder. Release governance
          remains active; the exception requires participant review rather than platform
          intervention.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">
        <ExceptionMeta label="Counterparties" value="Marcus Webb / Sarah Chen" />
        <ExceptionMeta label="Current stage"  value="Dispute open · partial release" />
        <ExceptionMeta label="Operational impact" value="Single line item held; remainder eligible for release" />
      </div>

      <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[11px] text-white/40 leading-relaxed max-w-md">
          Admin role is read-only here. Resolution is owned by participants; admin reviews
          and monitors the exception lifecycle.
        </p>
        <Link
          href="/demo-live/deal/harbor-dispute?from=admin"
          className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.10] border border-amber-500/30 px-4 py-2 text-[12px] font-semibold text-amber-300 transition-colors"
        >
          <Eye size={12} aria-hidden="true" />
          Review dispute
          <ArrowRight size={12} aria-hidden="true" />
        </Link>
      </div>
    </article>
  )
}

function ExceptionMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-6 py-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.10em] text-white/45 mb-1">{label}</p>
      <p className="text-[12px] text-white/75 leading-relaxed">{value}</p>
    </div>
  )
}

function AdminScopeCard() {
  return (
    <aside
      aria-label="Admin scope"
      className="lg:col-span-2 rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden flex flex-col"
    >
      <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center gap-2">
        <Shield size={13} className="text-white/55" aria-hidden="true" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.10em] text-white/55">
          Admin scope
        </p>
      </div>
      <div className="p-5 space-y-3 flex-1">
        <p className="text-[13px] text-white/75 leading-relaxed">
          This panel provides platform-wide oversight of disputes, onboarding, payment-rail
          readiness, and governed release activity.
        </p>
        <ul className="space-y-2">
          <ScopeItem icon={Eye}       text="Read-only access to financial data" />
          <ScopeItem icon={Lock}      text="Cannot release funds or alter deal terms" />
          <ScopeItem icon={Users}     text="Monitors disputes, onboarding, and exceptions" />
          <ScopeItem icon={Building2} text="Vektrum does not hold or move funds" />
        </ul>
      </div>
    </aside>
  )
}

function ScopeItem({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <li className="flex items-start gap-2 text-[12.5px] text-white/70">
      <Icon size={12} className="text-white/45 mt-0.5 flex-shrink-0" aria-hidden="true" />
      <span>{text}</span>
    </li>
  )
}

function GovernanceCard({ icon: Icon, title, status, detail, note }: {
  icon:    React.ElementType
  title:   string
  status:  'operational' | 'attention'
  detail:  string
  note?:   string
}) {
  const isOk = status === 'operational'
  const statusClasses = isOk
    ? 'bg-emerald-500/[0.10] text-emerald-300 border-emerald-500/25'
    : 'bg-amber-500/[0.10] text-amber-300 border-amber-500/25'
  const statusLabel = isOk ? 'Operational' : 'Attention'
  return (
    <article className={`rounded-2xl border ${isOk ? 'border-white/[0.08]' : 'border-amber-500/20'} bg-surface-2 shadow-card p-5 flex flex-col gap-2.5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-white/55" aria-hidden="true" />
          <p className="text-[12.5px] font-semibold text-white">{title}</p>
        </div>
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusClasses}`}>
          {statusLabel}
        </span>
      </div>
      <p className="text-[12px] text-white/65 leading-relaxed">{detail}</p>
      {note && (
        <p className="text-[11px] text-amber-300/80 leading-relaxed">{note}</p>
      )}
    </article>
  )
}

type DealStage = 'healthy' | 'exception' | 'awaiting_funder'

function DealStageBadge({ stage }: { stage: DealStage }) {
  const meta: Record<DealStage, { label: string; classes: string }> = {
    healthy: {
      label:   'Healthy',
      classes: 'bg-emerald-500/[0.10] text-emerald-300 border-emerald-500/25',
    },
    awaiting_funder: {
      label:   'Waiting on funder',
      classes: 'bg-vektrum-blue/[0.10] text-blue-300 border-vektrum-blue/25',
    },
    exception: {
      label:   'Exception',
      classes: 'bg-amber-500/[0.10] text-amber-300 border-amber-500/25',
    },
  }
  const m = meta[stage]
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${m.classes}`}>
      {m.label}
    </span>
  )
}

function ReadinessBadge({ state }: { state: 'verified' | 'pending' }) {
  const isVerified = state === 'verified'
  const classes = isVerified
    ? 'bg-emerald-500/[0.10] text-emerald-300 border-emerald-500/25'
    : 'bg-amber-500/[0.10] text-amber-300 border-amber-500/25'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${classes}`}>
      {isVerified ? <CheckCircle2 size={10} aria-hidden="true" /> : <AlertTriangle size={10} aria-hidden="true" />}
      {isVerified ? 'Verified' : 'Pending'}
    </span>
  )
}

function EventTypeBadge({ type, action }: { type: EventType; action: string }) {
  const meta: Record<EventType, { classes: string; icon: React.ElementType }> = {
    dispute:  { classes: 'bg-amber-500/[0.10] text-amber-300 border-amber-500/25',         icon: AlertTriangle },
    release:  { classes: 'bg-emerald-500/[0.10] text-emerald-300 border-emerald-500/25',   icon: CheckCircle2 },
    approval: { classes: 'bg-vektrum-blue/[0.10] text-blue-300 border-vektrum-blue/25',    icon: Shield },
    document: { classes: 'bg-white/[0.06] text-white/70 border-white/[0.12]',              icon: FileText },
  }
  const m = meta[type]
  const Icon = m.icon
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap ${m.classes}`}>
      <Icon size={10} aria-hidden="true" />
      {action}
    </span>
  )
}

function SectionHeader({ label, count }: { label: string; count?: number }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/65">
        {label}
      </h2>
      {typeof count === 'number' && count > 0 && (
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-white/[0.06] border border-white/[0.10] text-[10px] font-semibold tabular-nums text-white/70">
          {count}
        </span>
      )}
    </div>
  )
}

function OpsTile({ label, value, sublabel, tone, href }: {
  label:    string
  value:    string
  sublabel: string
  tone:     'amber' | 'ok'
  href?:    string
}) {
  const valueColor = tone === 'amber' ? 'text-amber-300' : 'text-emerald-300'
  const inner = (
    <div className={`rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card px-5 py-4 ${href ? 'hover:border-white/[0.16] transition-colors cursor-pointer' : ''}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">{label}</p>
      <p className={`mt-1.5 font-display text-[1.625rem] font-bold tabular-nums leading-none ${valueColor}`}>{value}</p>
      <p className="mt-1.5 text-[11px] text-white/45">{sublabel}</p>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

function AnalyticsTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card px-5 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">{label}</p>
      <p className="mt-1.5 font-display text-[1.625rem] font-bold tabular-nums leading-none text-white">{value}</p>
    </div>
  )
}
