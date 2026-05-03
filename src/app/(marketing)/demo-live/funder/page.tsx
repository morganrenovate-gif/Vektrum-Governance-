'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  TrendingUp, DollarSign, AlertCircle, ArrowRight, ArrowLeft,
  CheckCircle2, FileText, Activity, ListChecks, ShieldCheck,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import { FundDealModal } from '@/components/demo/FundDealModal'
import { DemoFunderTour } from '@/components/demo/DemoFunderTour'
import { useDemoAutoReset } from '@/lib/demo-data/use-demo-auto-reset'

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_DEALS = [
  {
    id: 'riverside',
    title: 'Riverside Mixed-Use Development',
    total: 2_400_000,
    funded: 2_400_000,
    released: 480_000,
    status: 'active',
    milestoneCount: 4,
    contractor: 'Marcus Webb',
    contractorCompany: 'Webb Construction Group',
  },
  {
    id: 'harbor',
    title: 'Harbor Logistics Center',
    total: 9_100_000,
    funded: 9_100_000,
    released: 2_160_000,
    status: 'active',
    milestoneCount: 5,
    contractor: 'Marcus Webb',
    contractorCompany: 'Webb Construction Group',
  },
  {
    id: 'westside',
    title: 'Westside Medical Office Campus',
    total: 4_750_000,
    funded: 4_750_000,
    released: 950_000,
    status: 'active',
    milestoneCount: 4,
    contractor: 'Diane Reyes',
    contractorCompany: 'Reyes Development Partners',
  },
]

// Recent control activity. Wording is operational/institutional, not chatbot-y.
const CONTROL_ACTIVITY = [
  {
    deal:   'Harbor Logistics Center',
    line:   'Structural Steel Erection — Draw 3',
    detail: 'All 10 release conditions verified. No blocking exceptions identified. Ready for funder authorization.',
    state:  'ready',
    when:   'Today · 9:14 AM',
  },
  {
    deal:   'Riverside Mixed-Use Development',
    line:   'MEP Rough-In — Draw 2',
    detail: 'Submitted for control review. Awaiting evidence reconciliation against schedule of values.',
    state:  'in_review',
    when:   'Today · 7:42 AM',
  },
  {
    deal:   'Westside Medical Office Campus',
    line:   'Site Work — Draw 1',
    detail: 'Released on schedule. Building Envelope advancing into next milestone window.',
    state:  'released',
    when:   'Yesterday · 4:08 PM',
  },
] as const

// Items requiring funder action. Each has a clear next step + aging timestamp.
const ACTION_ITEMS = [
  {
    id:        'riverside-mep',
    deal:      'Riverside Mixed-Use Development',
    line:      'MEP Rough-In — Draw 2',
    amount:    680_000,
    aging:     'Submitted 18 hours ago',
    nextStep:  'Review draw package and authorize release',
    cta:       'Review draw',
    href:      '/demo-live/deal/riverside?from=funder',
    severity:  'review' as const,
  },
  {
    id:        'harbor-hvac',
    deal:      'Harbor Logistics Center',
    line:      'HVAC Equipment Procurement — Draw 4',
    amount:    487_000,
    aging:     'Exception flagged 2 days ago',
    nextStep:  'Review held line item; verified balance remains releasable',
    cta:       'View dispute',
    href:      '/demo-live/deal/harbor-dispute?from=funder',
    severity:  'exception' as const,
  },
] as const

// Partial-dispute featured scenario — concrete numbers visible above the click.
const DISPUTE = {
  deal:           'Harbor Logistics Center',
  line:           'HVAC Equipment Procurement — Draw 4',
  requested:      487_000,
  held:           78_000,
  eligible:      409_000,
  reasonForHold: 'Invoice support mismatch on a single equipment line item',
  actionOwner:   'Contractor to provide vendor confirmation; funder review on receipt',
  href:          '/demo-live/deal/harbor-dispute?from=funder',
} as const

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DemoFunderPage() {
  const [fundModal, setFundModal] = useState(false)

  useDemoAutoReset(() => {
    setFundModal(false)
  })

  const totalDeals      = MOCK_DEALS.length
  const capitalDeployed = MOCK_DEALS.reduce((s, d) => s + d.funded, 0)
  const totalReleased   = MOCK_DEALS.reduce((s, d) => s + d.released, 0)
  const actionCount     = ACTION_ITEMS.length

  return (
    <div className="min-h-screen bg-surface-0">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-10 sm:py-14 space-y-10">

        {/* Back to role selector */}
        <Link
          href="/demo-live"
          className="inline-flex items-center gap-1.5 text-[13px] text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Back to role selector
        </Link>

        {/* Demo info banner — makes the simulated nature explicit */}
        <div
          role="note"
          aria-label="Demo mode"
          className="rounded-xl border border-white/[0.10] bg-white/[0.02] px-5 py-4 flex flex-wrap items-center gap-x-4 gap-y-2"
        >
          <span className="inline-flex items-center rounded-full bg-white/[0.06] border border-white/[0.10] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.10em] text-white/65">
            Demo mode
          </span>
          <p className="text-[13px] text-white/65 leading-relaxed flex-1 min-w-[260px]">
            Viewing the funder dashboard as <strong className="text-white">Sarah Chen</strong>. All
            data is simulated. In the live app this connects to your real portfolio and
            release-control records.
          </p>
        </div>

        {/* Guided walkthrough — renders only when ?tour=1 is present */}
        <DemoFunderTour />

        {/* Header — restrained, no decorative dot */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <p className="text-[11px] tracking-[0.14em] uppercase text-white/45 font-semibold">
              Funder dashboard
            </p>
            <h1 className="font-display text-[2.25rem] font-bold tracking-[-0.04em] text-white leading-[1.05]">
              Welcome back, Sarah
            </h1>
            <p className="text-[13px] text-white/55 leading-relaxed max-w-xl">
              Three active facilities, {actionCount} item{actionCount === 1 ? '' : 's'} requiring
              your action. Release controls are reviewed before items reach this view.
            </p>
          </div>
          <button
            onClick={() => setFundModal(true)}
            className="group inline-flex min-h-[40px] items-center justify-center gap-2 self-start rounded-xl bg-vektrum-blue px-5 py-2.5 text-[13px] font-semibold text-white shadow-md shadow-vektrum-blue/20 transition-all hover:bg-vektrum-blue-hover hover:shadow-lg hover:shadow-vektrum-blue/30"
          >
            Fund a new deal
            <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        </header>

        <FundDealModal open={fundModal} onConfirm={() => setFundModal(false)} onClose={() => setFundModal(false)} />

        {/* ── Guided demo strip — 4 steps ──────────────────────────────────── */}
        <GuidedStrip />

        {/* ── Decision area — hero + adjacent control summary ──────────────── */}
        <section
          aria-label="Decision-ready draw"
          className="grid gap-4 lg:grid-cols-5"
        >
          {/* Hero decision panel (3/5) */}
          <article className="lg:col-span-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.04] overflow-hidden">
            <div className="px-6 pt-5 pb-4 border-b border-white/[0.06] space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300">
                  Decision-ready draw
                </p>
                <span aria-hidden="true" className="text-white/15">·</span>
                <p className="text-[11px] text-white/45">Updated today · 9:14 AM</p>
              </div>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-[18px] font-semibold text-white leading-tight">
                    Harbor Logistics Center — Draw 3
                  </h2>
                  <p className="mt-1 text-[12px] text-white/55">Structural Steel Erection</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-[1.625rem] font-bold tabular-nums text-white leading-none">
                    {formatCurrency(2_180_000)}
                  </p>
                  <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-500/[0.12] border border-emerald-500/25 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                    <CheckCircle2 size={10} aria-hidden="true" />
                    Ready for authorization
                  </span>
                </div>
              </div>
              <p className="text-[13px] text-white/75 leading-relaxed">
                Release controls satisfied for Structural Steel Erection. No blocking exceptions
                identified in the current draw package.
              </p>
            </div>

            <ul className="px-6 py-4 space-y-2.5 border-b border-white/[0.06]">
              {[
                '10 of 10 release conditions satisfied',
                'Supporting draw documents reviewed and matched to the schedule of values',
                'No exception requiring manual hold',
              ].map((line) => (
                <li key={line} className="flex items-start gap-2.5 text-[13px] text-white/70 leading-relaxed">
                  <CheckCircle2 size={13} className="text-emerald-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>

            <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] text-white/40 leading-relaxed max-w-md">
                Funder authorization is required to proceed. Vektrum records authorization;
                disbursement is executed through the selected rail.
              </p>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link
                  href="/demo-live/deal/harbor?from=funder#control-basis"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.10] px-3.5 py-2 text-[12px] font-semibold text-white/75 hover:text-white hover:bg-white/[0.04] transition-colors"
                >
                  Inspect control basis
                </Link>
                <Link
                  href="/demo-live/deal/harbor?from=funder"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-[12px] font-semibold text-white transition-colors"
                >
                  Review and authorize
                  <ArrowRight size={12} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </article>

          {/* Release control summary (2/5) */}
          <ReleaseControlSummary />
        </section>

        {/* ── Items requiring funder action ────────────────────────────────── */}
        <section id="action-queue" aria-label="Items requiring funder action">
          <SectionHeader
            label="Items requiring funder action"
            count={actionCount}
            tone="amber"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {ACTION_ITEMS.map((item) => (
              <ActionCard key={item.id} item={item} />
            ))}
          </div>
        </section>

        {/* ── Featured scenario: partial release under active dispute ──────── */}
        <section aria-label="Partial release under active dispute">
          <SectionHeader label="Partial release under active dispute" />
          <DisputeScenarioCard />
        </section>

        {/* ── Recent control activity (renamed from Perplexity briefing) ──── */}
        <section aria-label="Recent control activity">
          <SectionHeader label="Recent control activity" />
          <div className="rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden">
            <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-2.5">
              <Activity size={13} className="text-white/55" aria-hidden="true" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.10em] text-white/55">
                Control log · last 24 hours
              </p>
              <span className="ml-auto text-[11px] text-white/35">3 entries</span>
            </div>
            <ol className="divide-y divide-white/[0.05]">
              {CONTROL_ACTIVITY.map((entry, i) => (
                <li key={i} className="px-5 py-3.5 flex items-start gap-3">
                  <ActivityDot state={entry.state} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[13px] font-semibold text-white">{entry.deal}</p>
                      <span aria-hidden="true" className="text-white/15">·</span>
                      <p className="text-[12px] text-white/55">{entry.line}</p>
                    </div>
                    <p className="mt-1 text-[12px] text-white/55 leading-relaxed">{entry.detail}</p>
                  </div>
                  <span className="text-[11px] text-white/35 tabular-nums whitespace-nowrap flex-shrink-0">
                    {entry.when}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Portfolio analytics — moved below action area ────────────────── */}
        <section aria-label="Portfolio analytics">
          <SectionHeader label="Portfolio analytics" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <AnalyticsTile
              label="Active facilities"
              value={String(totalDeals)}
              icon={TrendingUp}
              href="#active-facilities"
            />
            <AnalyticsTile
              label="Capital deployed"
              value={formatCurrency(capitalDeployed)}
              icon={DollarSign}
              href="/demo-live/funder/capital"
            />
            <AnalyticsTile
              label="Released to date"
              value={formatCurrency(totalReleased)}
              icon={CheckCircle2}
              href="#active-portfolio"
            />
          </div>
        </section>

        {/* ── Active portfolio (renamed from Portfolio Overview) ───────────── */}
        <section id="active-portfolio" aria-label="Active portfolio">
          <SectionHeader label="Active portfolio" />
          <div className="rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden">
            <div className="hidden sm:grid grid-cols-12 gap-3 px-5 py-2.5 border-b border-white/[0.06] text-[10px] font-semibold uppercase tracking-[0.10em] text-white/45">
              <span className="col-span-5">Facility</span>
              <span className="col-span-2">Status</span>
              <span className="col-span-2 text-right">Total</span>
              <span className="col-span-3 text-right">Released</span>
            </div>
            <div className="divide-y divide-white/[0.05]">
              {MOCK_DEALS.map((deal) => {
                const pct = deal.total > 0 ? Math.round((deal.released / deal.total) * 100) : 0
                return (
                  <Link
                    key={deal.id}
                    href={`/demo-live/deal/${deal.id}?from=funder`}
                    className="grid sm:grid-cols-12 gap-y-1 gap-x-3 items-center px-5 py-3.5 hover:bg-white/[0.03] transition-colors"
                  >
                    <span className="sm:col-span-5 text-[13px] font-medium text-white/85">
                      {deal.title}
                      <span className="block text-[11px] text-white/40 mt-0.5">
                        {deal.contractor} · {deal.contractorCompany}
                      </span>
                    </span>
                    <span className="sm:col-span-2">
                      <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                        Active
                      </span>
                    </span>
                    <span className="sm:col-span-2 text-[12px] text-white/70 tabular-nums sm:text-right">
                      {formatCurrency(deal.total)}
                    </span>
                    <span className="sm:col-span-3 sm:text-right">
                      <span className="inline-flex sm:justify-end items-center gap-2.5 w-full">
                        <span className="flex-1 sm:max-w-[80px] h-1 rounded-full bg-white/[0.08] overflow-hidden">
                          <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                        </span>
                        <span className="text-[12px] text-white/55 tabular-nums whitespace-nowrap">
                          {pct}%
                        </span>
                      </span>
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── Active facilities (renamed from Funded Deals) ────────────────── */}
        <section id="active-facilities" aria-label="Active facilities">
          <SectionHeader label="Active facilities" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MOCK_DEALS.map((deal) => (
              <DealCard key={deal.id} deal={deal} />
            ))}
          </div>
        </section>

        {/* ── Authorization-infrastructure footer note ─────────────────────── */}
        <footer className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
          <p className="text-[11px] text-white/45 leading-relaxed">
            Vektrum is authorization infrastructure for construction draw governance. Vektrum does
            not hold funds, act as a bank or custodian, or move money. Funds are held by Stripe or
            the funding partner; the selected rail executes disbursement after release controls
            are satisfied and explicit funder authorization is recorded.
          </p>
        </footer>

      </div>
    </div>
  )
}

// ─── Components ───────────────────────────────────────────────────────────────

function GuidedStrip() {
  const steps = [
    { n: 1, label: 'Review the control brief' },
    { n: 2, label: 'Inspect evidence and exceptions' },
    { n: 3, label: 'Authorize or escalate' },
    { n: 4, label: 'Track release and audit trail' },
  ]
  return (
    <section
      aria-label="How this demo works"
      className="rounded-xl border border-white/[0.07] bg-surface-2/40 px-5 py-3.5"
    >
      <div className="flex items-center gap-2 mb-2.5">
        <ListChecks size={12} className="text-white/55" aria-hidden="true" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">
          How this demo works
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

function ReleaseControlSummary() {
  const fields: Array<{ label: string; value: string; tone?: 'ok' }> = [
    { label: 'Control status',          value: '10 / 10 conditions passed', tone: 'ok' },
    { label: 'Manual review required',  value: 'No',                        tone: 'ok' },
    { label: 'Last updated',            value: 'Today · 9:14 AM' },
  ]
  return (
    <aside
      aria-label="Release control summary"
      className="lg:col-span-2 rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden flex flex-col"
    >
      <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center gap-2">
        <ShieldCheck size={13} className="text-white/55" aria-hidden="true" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.10em] text-white/55">
          Release control summary
        </p>
      </div>

      <dl className="px-5 py-4 space-y-3">
        {fields.map((f) => (
          <div key={f.label} className="flex items-baseline justify-between gap-3">
            <dt className="text-[11px] text-white/45 uppercase tracking-[0.08em]">{f.label}</dt>
            <dd className={`text-[12px] font-semibold tabular-nums ${
              f.tone === 'ok' ? 'text-emerald-300' : 'text-white/80'
            }`}>
              {f.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="px-5 pb-4 border-t border-white/[0.05] pt-3 space-y-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.10em] text-white/45 mb-1.5">
            Evidence reviewed
          </p>
          <ul className="space-y-1">
            {['Draw request', 'Schedule of values', 'Invoices', 'Lien waivers', 'Site verification'].map((e) => (
              <li key={e} className="flex items-center gap-2 text-[12px] text-white/70">
                <FileText size={11} className="text-white/35 flex-shrink-0" aria-hidden="true" />
                {e}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.10em] text-white/45 mb-1.5">
            Blocking conditions checked
          </p>
          <ul className="space-y-1">
            {[
              'Duplicate billing',
              'Incomplete waiver coverage',
              'Unsupported percent complete',
              'Unresolved prior exception',
            ].map((b) => (
              <li key={b} className="flex items-center gap-2 text-[12px] text-white/55">
                <CheckCircle2 size={11} className="text-emerald-400/80 flex-shrink-0" aria-hidden="true" />
                {b}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  )
}

function ActionCard({ item }: { item: typeof ACTION_ITEMS[number] }) {
  const isException = item.severity === 'exception'
  const tones = isException
    ? {
        border:   'border-red-500/25',
        eyebrow:  'text-red-400',
        eyebrowText: 'Exception · review held',
        cta:      'bg-white/[0.06] hover:bg-white/[0.10] border border-red-500/30 text-red-300',
        dot:      'bg-red-400',
      }
    : {
        border:   'border-amber-500/25',
        eyebrow:  'text-amber-300',
        eyebrowText: 'Ready for review',
        cta:      'bg-vektrum-blue hover:bg-vektrum-blue-hover text-white',
        dot:      'bg-amber-400',
      }
  return (
    <article className={`rounded-2xl border ${tones.border} bg-surface-2 shadow-card overflow-hidden flex flex-col`}>
      <div className="px-5 pt-4 pb-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${tones.dot} flex-shrink-0`} aria-hidden="true" />
          <p className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${tones.eyebrow}`}>
            {tones.eyebrowText}
          </p>
          <span aria-hidden="true" className="text-white/15">·</span>
          <p className="text-[11px] text-white/45">{item.aging}</p>
        </div>
        <h3 className="text-[14px] font-semibold text-white leading-tight">{item.deal}</h3>
        <p className="text-[12px] text-white/55">{item.line}</p>
        <p className="font-display text-[1.25rem] font-bold tabular-nums text-white leading-none mt-1">
          {formatCurrency(item.amount)}
        </p>
      </div>
      <div className="px-5 py-3 border-t border-white/[0.06] bg-white/[0.02] flex items-center justify-between gap-3">
        <p className="text-[11px] text-white/55 leading-snug flex-1">{item.nextStep}</p>
        <Link
          href={item.href}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-[12px] font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${tones.cta}`}
        >
          {item.cta}
          <ArrowRight size={11} aria-hidden="true" />
        </Link>
      </div>
    </article>
  )
}

function DisputeScenarioCard() {
  const releasablePct = Math.round((DISPUTE.eligible / DISPUTE.requested) * 100)
  return (
    <article className="rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden">
      <div className="px-6 pt-5 pb-4 border-b border-white/[0.06] space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-300">
            Partial release scenario
          </p>
          <span aria-hidden="true" className="text-white/15">·</span>
          <p className="text-[11px] text-white/45">{DISPUTE.deal}</p>
        </div>
        <h3 className="text-[16px] font-semibold text-white">{DISPUTE.line}</h3>
        <p className="text-[13px] text-white/65 leading-relaxed max-w-2xl">
          A disputed equipment line is held for review while the verified balance remains
          eligible for release. Partial release reduces unnecessary project delay without
          weakening control discipline.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">
        <DisputeMetric
          label="Requested"
          value={formatCurrency(DISPUTE.requested)}
          tone="neutral"
        />
        <DisputeMetric
          label="Held for review"
          value={formatCurrency(DISPUTE.held)}
          tone="hold"
          sublabel={`${100 - releasablePct}% of draw`}
        />
        <DisputeMetric
          label="Eligible for release"
          value={formatCurrency(DISPUTE.eligible)}
          tone="ok"
          sublabel={`${releasablePct}% of draw`}
        />
      </div>

      <div className="px-6 py-4 border-t border-white/[0.06] grid gap-3 sm:grid-cols-2">
        <DisputeRow label="Reason for hold" value={DISPUTE.reasonForHold} />
        <DisputeRow label="Action owner"    value={DISPUTE.actionOwner} />
      </div>

      <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[11px] text-white/40 leading-relaxed max-w-md">
          Held lines remain blocked until resolved. The release gate continues to enforce all
          conditions on the eligible balance before disbursement.
        </p>
        <Link
          href={DISPUTE.href}
          className="inline-flex items-center gap-1.5 rounded-xl bg-vektrum-blue hover:bg-vektrum-blue-hover px-4 py-2 text-[12px] font-semibold text-white transition-colors"
        >
          Review dispute workflow
          <ArrowRight size={12} aria-hidden="true" />
        </Link>
      </div>
    </article>
  )
}

function DisputeMetric({ label, value, sublabel, tone }: {
  label:    string
  value:    string
  sublabel?: string
  tone:     'neutral' | 'ok' | 'hold'
}) {
  const valueColor =
    tone === 'ok'   ? 'text-emerald-300' :
    tone === 'hold' ? 'text-amber-300'   :
                      'text-white'
  return (
    <div className="px-6 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.10em] text-white/45 mb-1.5">{label}</p>
      <p className={`font-display text-[1.375rem] font-bold tabular-nums leading-none ${valueColor}`}>{value}</p>
      {sublabel && (
        <p className="mt-1 text-[11px] text-white/45 tabular-nums">{sublabel}</p>
      )}
    </div>
  )
}

function DisputeRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.10em] text-white/45 mb-1">{label}</p>
      <p className="text-[12px] text-white/75 leading-relaxed">{value}</p>
    </div>
  )
}

function ActivityDot({ state }: { state: 'ready' | 'in_review' | 'released' }) {
  const cls =
    state === 'ready'     ? 'bg-emerald-400 ring-2 ring-emerald-400/15' :
    state === 'in_review' ? 'bg-amber-400'   :
                            'bg-white/30'
  return (
    <span className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${cls}`} aria-hidden="true" />
  )
}

function SectionHeader({ label, count, tone }: {
  label: string
  count?: number
  tone?:  'amber' | 'default'
}) {
  const labelColor = tone === 'amber' ? 'text-amber-300' : 'text-white/65'
  return (
    <div className="mb-3 flex items-center gap-2">
      <h2 className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${labelColor}`}>
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

function AnalyticsTile({ label, value, icon: Icon, href }: {
  label: string
  value: string
  icon:  React.ElementType
  href?: string
}) {
  const inner = (
    <div className={`rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card px-5 py-4 ${href ? 'hover:border-white/[0.16] transition-colors cursor-pointer' : ''}`}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">{label}</p>
        <Icon size={13} className="text-white/35" aria-hidden="true" />
      </div>
      <p className="font-display text-[1.625rem] font-bold tabular-nums leading-none text-white">{value}</p>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

function DealCard({ deal }: { deal: typeof MOCK_DEALS[number] }) {
  const pct = deal.total > 0 ? Math.round((deal.released / deal.total) * 100) : 0
  return (
    <Link
      href={`/demo-live/deal/${deal.id}?from=funder`}
      className="group rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card p-5 flex flex-col transition-all duration-300 hover:border-white/[0.16]"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
          {deal.status}
        </span>
        <span className="text-[11px] text-white/55">{deal.milestoneCount} milestones</span>
      </div>
      <p className="text-[14px] font-semibold text-white/85 group-hover:text-white transition-colors leading-snug">{deal.title}</p>
      <p className="mt-1 text-[12px] text-white/45">{deal.contractor} &middot; {deal.contractorCompany}</p>
      <div className="mt-4 flex items-center gap-3">
        <div className="flex-1 h-1 rounded-full bg-white/[0.08] overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[11px] text-white/55 tabular-nums">{pct}%</span>
      </div>
      <div className="mt-3 flex items-center justify-between text-[12px]">
        <span className="text-white/45">Total: {formatCurrency(deal.total)}</span>
        <span className="text-emerald-300 font-medium">Released: {formatCurrency(deal.released)}</span>
      </div>
    </Link>
  )
}
