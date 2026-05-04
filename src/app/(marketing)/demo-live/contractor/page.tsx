'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  HardHat, CheckCircle2, ArrowRight, ArrowLeft, Sparkles, Loader2,
  ListChecks, Shield, AlertTriangle, Lock, Upload, FileWarning, Activity, User, Building2,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import { useDemoAutoReset } from '@/lib/demo-data/use-demo-auto-reset'
import { DemoActivityLog } from '@/components/demo/DemoActivityLog'
import type { DemoActivityEntry } from '@/lib/demo-data/use-demo-activity-log'
import { riverside, harbor, getMilestoneSummary } from '@/lib/demo-data'

// ─── Mock data ────────────────────────────────────────────────────────────────

const RIVERSIDE_SUMMARY = getMilestoneSummary(riverside)
const HARBOR_SUMMARY    = getMilestoneSummary(harbor)

const MOCK_DEALS = [
  {
    slug: 'riverside',
    title: riverside.title,
    funder: riverside.funder,
    funderCompany: 'Meridian Capital Partners',
    total: riverside.total,
    pct: RIVERSIDE_SUMMARY.pct,
    milestonesCompleted: RIVERSIDE_SUMMARY.released,
    milestonesTotal: RIVERSIDE_SUMMARY.total,
  },
  {
    slug: 'harbor',
    title: harbor.title,
    funder: harbor.funder,
    funderCompany: 'Meridian Capital Partners',
    total: harbor.total,
    pct: HARBOR_SUMMARY.pct,
    milestonesCompleted: HARBOR_SUMMARY.released,
    milestonesTotal: HARBOR_SUMMARY.total,
  },
]

const AI_REVIEW_STEPS = [
  'Reading draw request',
  'Comparing against SOV',
  'Checking lien waiver status',
  'Checking open change orders',
  'Preparing review summary',
]

const SEED_ENTRIES: DemoActivityEntry[] = [
  {
    id:        'seed-4',
    timestamp: 'Demo start',
    actor:     'System',
    role:      'system',
    action:    'Release gate blocked',
    detail:    'Building Envelope & Roofing — lien waiver missing, change order unresolved',
  },
  {
    id:        'seed-3',
    timestamp: 'Demo start',
    actor:     'System',
    role:      'system',
    action:    'AI pre-review not current',
    detail:    'Building Envelope & Roofing requires AI pre-review before release gate can proceed',
  },
  {
    id:        'seed-2',
    timestamp: 'Demo start',
    actor:     'System',
    role:      'system',
    action:    'Funder authorization pending',
    detail:    'Structural Steel Erection — approved by gate, awaiting funder authorization',
  },
  {
    id:        'seed-1',
    timestamp: 'Demo start',
    actor:     'Marcus Webb',
    role:      'contractor',
    action:    'Draw #3 submitted for review',
    detail:    'Structural Steel Erection — $2,180,000',
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DemoContractorPage() {
  const [reviewSubmitted, setReviewSubmitted]   = useState(false)
  const [submitting, setSubmitting]             = useState(false)

  const [lienWaiverUploaded, setLienWaiverUploaded]   = useState(false)
  const [changeOrderResolved, setChangeOrderResolved] = useState(false)
  const [blockedAiReviewRunning, setBlockedAiReviewRunning] = useState(false)
  const [blockedAiReviewStep, setBlockedAiReviewStep]       = useState(0)
  const [blockedAiReviewDone, setBlockedAiReviewDone] = useState(false)

  const [activityEntries, setActivityEntries]   = useState<DemoActivityEntry[]>(SEED_ENTRIES)

  const contractorConditionsDone = lienWaiverUploaded && changeOrderResolved && blockedAiReviewDone

  useDemoAutoReset(() => {
    setReviewSubmitted(false)
    setSubmitting(false)
    setLienWaiverUploaded(false)
    setChangeOrderResolved(false)
    setBlockedAiReviewRunning(false)
    setBlockedAiReviewStep(0)
    setBlockedAiReviewDone(false)
    setActivityEntries(SEED_ENTRIES)
  })

  function nowTime(): string {
    return new Date().toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
    })
  }

  function handleRequestReview() {
    if (submitting || reviewSubmitted) return
    setSubmitting(true)
    setActivityEntries((prev) => [{
      id:        `act-req-${Date.now()}`,
      timestamp: nowTime(),
      actor:     'Marcus Webb',
      role:      'contractor',
      action:    'Control review requested',
      detail:    'MEP Rough-In — Riverside Mixed-Use Development · $680,000',
    }, ...prev])
    setTimeout(() => {
      setSubmitting(false)
      setReviewSubmitted(true)
      setActivityEntries((prev) => [{
        id:        `act-done-${Date.now()}`,
        timestamp: nowTime(),
        actor:     'Vektrum Control Review',
        role:      'system',
        action:    'Control review complete — funder authorization still required',
        detail:    'MEP Rough-In — review passed · funder authorization controls release',
      }, ...prev])
    }, 900)
  }

  function handleUploadLienWaiver() {
    if (lienWaiverUploaded) return
    setLienWaiverUploaded(true)
    setActivityEntries((prev) => [{
      id:        `act-lien-${Date.now()}`,
      timestamp: nowTime(),
      actor:     'Marcus Webb',
      role:      'contractor',
      action:    'Conditional lien waiver uploaded',
      detail:    'Building Envelope & Roofing — release condition satisfied',
    }, ...prev])
  }

  function handleResolveChangeOrder() {
    if (changeOrderResolved) return
    setChangeOrderResolved(true)
    setActivityEntries((prev) => [{
      id:        `act-co-${Date.now()}`,
      timestamp: nowTime(),
      actor:     'Marcus Webb',
      role:      'contractor',
      action:    'Change order CO-007 resolved',
      detail:    'Building Envelope & Roofing — release condition satisfied',
    }, ...prev])
  }

  function handleBlockedAiReview() {
    if (blockedAiReviewRunning || blockedAiReviewDone) return

    setBlockedAiReviewRunning(true)
    setBlockedAiReviewStep(0)
    setActivityEntries((prev) => [{
      id:        `act-bar-req-${Date.now()}`,
      timestamp: nowTime(),
      actor:     'Marcus Webb',
      role:      'contractor',
      action:    'Control review requested',
      detail:    'Building Envelope & Roofing — Vektrum checking draw package',
    }, ...prev])

    const STEP_MS = 700
    AI_REVIEW_STEPS.forEach((_, i) => {
      setTimeout(() => setBlockedAiReviewStep(i + 1), (i + 1) * STEP_MS)
    })

    setTimeout(() => {
      setBlockedAiReviewRunning(false)
      setBlockedAiReviewDone(true)
      setActivityEntries((prev) => [{
        id:        `act-bar-${Date.now()}`,
        timestamp: nowTime(),
        actor:     'Vektrum Control Review',
        role:      'system',
        action:    'Control review complete — release gate and funder authorization still control release',
        detail:    'Building Envelope & Roofing — review passed · funder authorization required',
      }, ...prev])
    }, (AI_REVIEW_STEPS.length + 1) * STEP_MS)
  }

  // ─── Operational metrics ─────────────────────────────────────────────────
  // Computed from the live demo state so the cards stay in sync with actions.
  const totalDeals    = MOCK_DEALS.length
  const totalFunded   = MOCK_DEALS.reduce((s, d) => s + d.total, 0)
  const totalReleased = riverside.released + harbor.released
  // Awaiting funder approval — Structural Steel always; Building Envelope only
  // once contractor conditions are clear.
  const awaitingFunderCount  = 1 + (contractorConditionsDone ? 1 : 0)
  const awaitingFunderAmount = 2_180_000 + (contractorConditionsDone ? 2_640_000 : 0)
  // Items needing contractor action — MEP review + the 3 contractor-side
  // blockers on Building Envelope (lien waiver / change order / AI review).
  const contractorActionCount =
    (reviewSubmitted ? 0 : 1)
    + (lienWaiverUploaded   ? 0 : 1)
    + (changeOrderResolved  ? 0 : 1)
    + (blockedAiReviewDone  ? 0 : 1)
  // Blocked releases — Building Envelope is blocked while any contractor
  // condition is outstanding.
  const blockedReleaseCount = contractorConditionsDone ? 0 : 1

  // ─── Missing conditions list (dynamic) ───────────────────────────────────
  const MISSING_CONDITIONS = [
    {
      key:       'lien_waiver',
      icon:      FileWarning,
      label:     'Lien waiver missing',
      detail:    'Conditional lien waiver required before release gate can proceed',
      done:      lienWaiverUploaded,
      doneLabel: 'Lien waiver uploaded',
      owner:     'Contractor',
    },
    {
      key:       'change_order',
      icon:      AlertTriangle,
      label:     'Open change order unresolved',
      detail:    'Change order CO-007 must be resolved or closed by funder',
      done:      changeOrderResolved,
      doneLabel: 'Change order resolved',
      owner:     'Funder / contractor',
    },
    {
      key:       'ai_review',
      icon:      Sparkles,
      label:     blockedAiReviewRunning ? 'Control review in progress…' : 'Control review not current',
      detail:    'No current control review on file for this draw request',
      done:      blockedAiReviewDone,
      doneLabel: 'Control review complete',
      owner:     'Contractor',
    },
    {
      key:       'funder_auth',
      icon:      Lock,
      label:     'Authorization pending after conditions clear',
      detail:    'Release authorized only by explicit funder action',
      done:      false, // Contractor can never clear this — always required
      doneLabel: '',
      owner:     'Funder',
    },
  ]

  const remainingCount = MISSING_CONDITIONS.filter((c) => !c.done).length

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
            Viewing the contractor dashboard as <strong className="text-white">Marcus Webb</strong>. All
            data is simulated. In the live app this connects to your real deals, draws, and audit records.
          </p>
        </div>

        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <p className="text-[11px] tracking-[0.14em] uppercase text-white/45 font-semibold">
              Contractor dashboard
            </p>
            <h1 className="font-display text-[2.25rem] font-bold tracking-[-0.04em] text-white leading-[1.05]">
              Welcome back, Marcus
            </h1>
            <p className="text-[13px] text-white/55 leading-relaxed max-w-xl">
              {awaitingFunderCount} draw{awaitingFunderCount === 1 ? '' : 's'} waiting on funder approval
              · {contractorActionCount} item{contractorActionCount === 1 ? '' : 's'} need your action
              · {blockedReleaseCount} release{blockedReleaseCount === 1 ? '' : 's'} blocked.
            </p>
          </div>
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-2 self-start rounded-xl bg-white/[0.06] border border-white/[0.10] px-4 py-2.5 text-[13px] font-semibold text-white/45 cursor-not-allowed"
            title="Demo mode — deal creation disabled"
          >
            <HardHat size={14} aria-hidden="true" />
            Create new deal
          </button>
        </header>

        {/* ── Guided release-flow strip ────────────────────────────────────── */}
        <GuidedReleaseStrip />

        {/* ── Command center — primary draw + blocked release + waiting ──── */}
        <section
          aria-label="Today's release work"
          className="grid gap-4 lg:grid-cols-5"
        >
          {/* Most important draw (3/5) */}
          <PrimaryDrawCard />

          {/* Waiting on funder summary (2/5) */}
          <WaitingOnFunderCard
            count={awaitingFunderCount}
            amount={awaitingFunderAmount}
          />
        </section>

        {/* ── Release blocked / contractor action required (full-width) ───── */}
        <section
          aria-label={contractorConditionsDone ? 'Awaiting funder authorization' : 'Release blocked — contractor action required'}
          className={`rounded-2xl overflow-hidden border ${
            contractorConditionsDone
              ? 'border-vektrum-blue/30 bg-vektrum-blue/[0.04]'
              : 'border-amber-500/30 bg-amber-500/[0.04]'
          }`}
        >
          {/* Card header */}
          <div className={`flex items-start gap-3 border-b px-5 py-4 ${
            contractorConditionsDone ? 'border-vektrum-blue/20' : 'border-amber-500/20'
          }`}>
            <div className={`h-8 w-8 flex items-center justify-center rounded-lg flex-shrink-0 ${
              contractorConditionsDone ? 'bg-vektrum-blue/[0.12]' : 'bg-amber-500/[0.12]'
            }`}>
              {contractorConditionsDone
                ? <Shield size={15} className="text-blue-400" aria-hidden="true" />
                : <AlertTriangle size={15} className="text-amber-400" aria-hidden="true" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${
                  contractorConditionsDone ? 'text-blue-300' : 'text-amber-300'
                }`}>
                  {contractorConditionsDone ? 'Waiting on funder' : 'Release blocked — contractor action required'}
                </p>
                <span aria-hidden="true" className="text-white/15">·</span>
                <p className="text-[11px] text-white/45">Harbor Logistics Center</p>
              </div>
              <h2 className="text-[15px] font-semibold text-white leading-tight">
                Building Envelope &amp; Roofing — {formatCurrency(2_640_000)}
              </h2>
              <p className="text-[12px] text-white/55 mt-1 leading-relaxed">
                {contractorConditionsDone
                  ? 'All contractor-side release conditions are complete. Release still requires explicit funder authorization.'
                  : `This release cannot advance until missing draw conditions are resolved. ${remainingCount} condition${remainingCount === 1 ? '' : 's'} outstanding.`
                }
              </p>
            </div>
            <Link
              href="/demo-live/deal/harbor?from=contractor"
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${
                contractorConditionsDone
                  ? 'border-vektrum-blue/20 bg-vektrum-blue/[0.08] text-blue-300 hover:bg-vektrum-blue/[0.14]'
                  : 'border-white/[0.10] bg-white/[0.04] text-white/75 hover:bg-white/[0.08]'
              }`}
            >
              View deal
              <ArrowRight size={11} aria-hidden="true" />
            </Link>
          </div>

          <div className="px-5 py-4 space-y-4">
            {/* Conditions list — table-style with owner column */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.10em] text-white/45 mb-2.5">
                Release readiness checklist
              </p>
              <ul className="divide-y divide-white/[0.06] rounded-lg border border-white/[0.06] overflow-hidden bg-white/[0.02]">
                {MISSING_CONDITIONS.map(({ key, icon: Icon, label, detail, done, doneLabel, owner }) => (
                  <li key={key} className="grid grid-cols-12 gap-3 items-start px-4 py-3">
                    <div className="col-span-1 flex justify-center pt-0.5">
                      {done ? (
                        <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" aria-hidden="true" />
                      ) : (
                        <Icon size={14} className={`flex-shrink-0 ${key === 'funder_auth' ? 'text-white/40' : 'text-amber-400'}`} aria-hidden="true" />
                      )}
                    </div>
                    <div className="col-span-7">
                      <p className={`text-[12.5px] font-semibold ${
                        done ? 'text-emerald-300' : key === 'funder_auth' ? 'text-white/65' : 'text-amber-200/95'
                      }`}>
                        {done ? doneLabel : label}
                      </p>
                      <p className="text-[11px] text-white/45 mt-0.5">{done ? 'Release condition satisfied' : detail}</p>
                    </div>
                    <div className="col-span-4 sm:text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.10em] text-white/35">Owner</p>
                      <p className="text-[12px] text-white/70 mt-0.5">{owner}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Action buttons — hidden once all contractor conditions are met */}
            {!contractorConditionsDone && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {!lienWaiverUploaded ? (
                  <button
                    type="button"
                    onClick={handleUploadLienWaiver}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/[0.14] border border-amber-500/25 px-3 py-1.5 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/[0.22] active:scale-95 transition-all"
                  >
                    <Upload size={11} aria-hidden="true" />
                    Upload lien waiver
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/[0.10] border border-emerald-500/20 px-3 py-1.5 text-[11px] font-semibold text-emerald-400">
                    <CheckCircle2 size={11} aria-hidden="true" />
                    Lien waiver uploaded
                  </span>
                )}

                {!changeOrderResolved ? (
                  <button
                    type="button"
                    onClick={handleResolveChangeOrder}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/[0.14] border border-amber-500/25 px-3 py-1.5 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/[0.22] active:scale-95 transition-all"
                  >
                    <AlertTriangle size={11} aria-hidden="true" />
                    Resolve change order
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/[0.10] border border-emerald-500/20 px-3 py-1.5 text-[11px] font-semibold text-emerald-400">
                    <CheckCircle2 size={11} aria-hidden="true" />
                    Change order resolved
                  </span>
                )}

                {blockedAiReviewRunning ? (
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500/[0.14] border border-blue-500/25 px-3 py-1.5 text-[11px] font-semibold text-blue-300 cursor-not-allowed opacity-80"
                  >
                    <Loader2 size={11} className="animate-spin" aria-hidden="true" />
                    Control review running…
                  </button>
                ) : !blockedAiReviewDone ? (
                  <button
                    type="button"
                    onClick={handleBlockedAiReview}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/[0.14] border border-amber-500/25 px-3 py-1.5 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/[0.22] active:scale-95 transition-all"
                  >
                    <Sparkles size={11} aria-hidden="true" />
                    Request control review
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/[0.10] border border-emerald-500/20 px-3 py-1.5 text-[11px] font-semibold text-emerald-400">
                    <CheckCircle2 size={11} aria-hidden="true" />
                    Control review complete
                  </span>
                )}
              </div>
            )}

            {/* Control review in-progress panel */}
            {blockedAiReviewRunning && (
              <div className="rounded-xl border border-blue-500/25 bg-blue-500/[0.05] px-4 py-3">
                <div className="flex items-start gap-2.5 mb-3">
                  <Loader2 size={13} className="text-blue-400 animate-spin mt-0.5 flex-shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-[12px] font-semibold text-blue-300">Control review in progress</p>
                    <p className="text-[11px] text-white/55 mt-0.5 leading-relaxed">
                      Vektrum is checking the draw package against the contract, SOV, supporting
                      documents, lien waiver status, and open change orders.
                    </p>
                  </div>
                </div>
                <ul className="space-y-1.5 ml-5">
                  {AI_REVIEW_STEPS.map((step, i) => (
                    <li key={step} className="flex items-center gap-2">
                      {blockedAiReviewStep > i ? (
                        <CheckCircle2 size={11} className="text-emerald-400 flex-shrink-0" aria-hidden="true" />
                      ) : blockedAiReviewStep === i ? (
                        <Loader2 size={11} className="text-blue-400 animate-spin flex-shrink-0" aria-hidden="true" />
                      ) : (
                        <div className="h-[11px] w-[11px] rounded-full border border-white/20 flex-shrink-0" />
                      )}
                      <span className={`text-[11px] ${
                        blockedAiReviewStep > i ? 'text-emerald-300' :
                        blockedAiReviewStep === i ? 'text-white/80' : 'text-white/35'
                      }`}>
                        {step}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Control review completed panel */}
            {blockedAiReviewDone && !contractorConditionsDone && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] px-4 py-3">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 size={13} className="text-emerald-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-[12px] font-semibold text-emerald-300">
                      Control review complete — funder authorization still required.
                    </p>
                    <div className="mt-1.5 space-y-0.5">
                      <p className="text-[11px] text-white/55">Draw: Building Envelope &amp; Roofing</p>
                      <p className="text-[11px] text-white/55">Result: Review complete</p>
                    </div>
                    <ul className="mt-2 space-y-1">
                      <li className="text-[11px] text-white/55">&middot; Draw package appears ready for funder review.</li>
                      <li className="text-[11px] text-white/55">&middot; Control review is a precondition only — it does not grant release authority.</li>
                      <li className="text-[11px] text-white/55">&middot; The deterministic release gate and funder authorization still control release.</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Operational metrics (above-the-fold-priority) ────────────────── */}
        <section aria-label="Operational metrics">
          <SectionHeader label="Operational metrics" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <OpsTile
              label="Awaiting funder approval"
              value={String(awaitingFunderCount)}
              sublabel={formatCurrency(awaitingFunderAmount)}
              tone="blue"
              href="#milestone-pipeline"
            />
            <OpsTile
              label="Need your action"
              value={String(contractorActionCount)}
              sublabel={contractorActionCount === 0 ? 'All clear' : 'See checklist'}
              tone={contractorActionCount === 0 ? 'ok' : 'amber'}
              href="#release-checklist"
            />
            <OpsTile
              label="Blocked releases"
              value={String(blockedReleaseCount)}
              sublabel={blockedReleaseCount === 0 ? 'None' : 'Conditions outstanding'}
              tone={blockedReleaseCount === 0 ? 'ok' : 'amber'}
              href="#release-checklist"
            />
            <OpsTile
              label="Pending control review"
              value={String(reviewSubmitted ? 0 : 1)}
              sublabel={reviewSubmitted ? 'Cleared' : 'MEP Rough-In'}
              tone={reviewSubmitted ? 'ok' : 'amber'}
              href="#draw-review"
            />
          </div>
        </section>

        {/* ── Milestone pipeline (Harbor) ──────────────────────────────────── */}
        <section
          id="milestone-pipeline"
          aria-label="Milestone release pipeline"
        >
          <SectionHeader label="Milestone release pipeline · Harbor Logistics Center" />
          <div className="rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden">
            <div className="hidden sm:grid grid-cols-12 gap-3 px-5 py-2.5 border-b border-white/[0.06] text-[10px] font-semibold uppercase tracking-[0.10em] text-white/45">
              <span className="col-span-4">Milestone</span>
              <span className="col-span-2 text-right">Amount</span>
              <span className="col-span-3">Owner</span>
              <span className="col-span-3">Stage</span>
            </div>
            <div className="divide-y divide-white/[0.05]">
              <PipelineRow
                title="Site Preparation & Grading"
                amount={320_000}
                owner="Released"
                detail="All 10 conditions met · funder authorized · released via rail"
                stage="released"
              />
              <PipelineRow
                title="Structural Steel Erection"
                amount={2_180_000}
                owner="Funder"
                detail="Control review passed · awaiting funder release approval"
                stage="ready_for_funder"
              />
              <PipelineRow
                title="Building Envelope & Roofing"
                amount={2_640_000}
                owner={contractorConditionsDone ? 'Funder' : 'Contractor'}
                detail={
                  contractorConditionsDone
                    ? 'All contractor conditions met · awaiting funder authorization'
                    : `Lien waiver${lienWaiverUploaded ? ' ✓' : ' missing'} · change order${changeOrderResolved ? ' ✓' : ' unresolved'} · control review${blockedAiReviewDone ? ' ✓' : ' not current'}`
                }
                stage={contractorConditionsDone ? 'ready_for_funder' : 'blocked'}
              />
            </div>
          </div>
        </section>

        {/* ── Draw control review queue (Riverside MEP) ────────────────────── */}
        <section
          id="draw-review"
          aria-label="Draws awaiting control review"
        >
          <SectionHeader label="Draws awaiting control review" />
          <div className="rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden">
            <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-2.5">
              <Activity size={13} className="text-white/55" aria-hidden="true" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.10em] text-white/55">
                Riverside Mixed-Use Development
              </p>
            </div>
            {reviewSubmitted ? (
              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-[14px] font-semibold text-white">MEP Rough-In — Draw 2</p>
                    <p className="text-[12px] text-white/55 mt-0.5">Amount: {formatCurrency(680_000)}</p>
                  </div>
                  <StatusBadge stage="ready_for_funder" />
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] px-4 py-3">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
                    <div>
                      <p className="text-[12px] font-semibold text-emerald-300">
                        Control review complete — funder authorization still required.
                      </p>
                      <p className="text-[11px] text-white/55 mt-1 leading-relaxed">
                        The deterministic release gate and funder authorization still control release.
                        Control review is a precondition, not an approval.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Link
                    href="/demo-live/deal/riverside?from=contractor"
                    className="group inline-flex items-center gap-1.5 rounded-xl border border-white/[0.10] bg-surface-3 px-3.5 py-2 text-[12px] font-semibold text-white/75 hover:text-white hover:bg-white/[0.06] transition-colors"
                  >
                    View deal
                    <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[14px] font-semibold text-white">MEP Rough-In — Draw 2</p>
                      <StatusBadge stage="under_review" />
                    </div>
                    <p className="text-[12px] text-white/55">Amount: {formatCurrency(680_000)}</p>
                    <p className="text-[12px] text-white/55 leading-relaxed max-w-md">
                      Submit this draw for control review before the release gate can run. Review is a
                      precondition; funder authorization still controls actual release.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={handleRequestReview}
                      disabled={submitting}
                      className="group inline-flex items-center gap-1.5 rounded-xl bg-vektrum-blue px-3.5 py-2 text-[12px] font-semibold text-white whitespace-nowrap hover:bg-vektrum-blue-hover transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {submitting ? (
                        <>
                          <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                          Submitting…
                        </>
                      ) : (
                        <>
                          <Sparkles size={12} aria-hidden="true" />
                          Request control review
                        </>
                      )}
                    </button>
                    <Link
                      href="/demo-live/deal/riverside?from=contractor"
                      className="group inline-flex items-center gap-1.5 rounded-xl border border-white/[0.10] bg-surface-3 px-3.5 py-2 text-[12px] font-semibold text-white/75 hover:text-white hover:bg-white/[0.06] transition-colors"
                    >
                      View deal
                      <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Release-readiness checklist (Harbor draw 4) ──────────────────── */}
        <section
          id="release-checklist"
          aria-label="Release-readiness checklist"
        >
          <SectionHeader label="Release-readiness checklist · Harbor Draw 4" />
          <div className="rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden">
            <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-2.5">
              <ListChecks size={13} className="text-white/55" aria-hidden="true" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.10em] text-white/55">
                Path from submitted to released
              </p>
              <StatusBadge stage="contractor_action" className="ml-auto" />
            </div>
            <div className="p-5 grid gap-5 sm:grid-cols-3">
              <ChecklistGroup
                title="Completed prerequisites"
                tone="ok"
                items={[
                  'Contract on file (signed)',
                  'Schedule of values submitted',
                  'Draw request submitted (Draw #3)',
                ]}
              />
              <ChecklistGroup
                title="Outstanding"
                tone="active"
                items={[
                  'Upload supporting documents',
                  'Request control review',
                ]}
              />
              <ChecklistGroup
                title="After that"
                tone="upcoming"
                items={[
                  'Funder authorization',
                  'Payment execution by selected rail',
                ]}
              />
            </div>
            <div className="px-5 pb-5">
              <Link
                href="/demo-live/deal/harbor?from=contractor"
                className="inline-flex items-center gap-1.5 rounded-xl bg-vektrum-blue px-4 py-2 text-[12px] font-semibold text-white hover:bg-vektrum-blue-hover transition-colors"
              >
                Go to Harbor deal
                <ArrowRight size={12} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Your deals ──────────────────────────────────────────────────── */}
        <section id="your-deals" aria-label="Your deals">
          <SectionHeader label="Your deals" />
          <div className="grid gap-4 sm:grid-cols-2">
            {MOCK_DEALS.map((deal) => {
              // Per-deal next-event signal for contractor dashboards.
              const isHarbor = deal.slug === 'harbor'
              const nextEvent = isHarbor
                ? (contractorConditionsDone
                    ? 'Building Envelope: awaiting funder authorization'
                    : 'Building Envelope: contractor action required')
                : (reviewSubmitted
                    ? 'MEP Rough-In: awaiting funder release approval'
                    : 'MEP Rough-In: ready to request control review')
              const awaitingAmount = isHarbor
                ? 2_180_000 + (contractorConditionsDone ? 2_640_000 : 0)
                : (reviewSubmitted ? 680_000 : 0)
              const isBlocked = isHarbor && !contractorConditionsDone
              return (
                <Link
                  key={deal.slug}
                  href={`/demo-live/deal/${deal.slug}?from=contractor`}
                  className="group rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card p-5 flex flex-col transition-colors hover:border-white/[0.16]"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                      Active
                    </span>
                    <span className="text-[11px] text-white/55">
                      {deal.milestonesCompleted}/{deal.milestonesTotal} milestones
                    </span>
                  </div>
                  <p className="text-[14px] font-semibold text-white/85 group-hover:text-white transition-colors leading-snug">{deal.title}</p>
                  <p className="mt-1 text-[12px] text-white/45">{deal.funder} &middot; {deal.funderCompany}</p>

                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex-1 h-1 rounded-full bg-white/[0.08] overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${deal.pct}%` }} />
                    </div>
                    <span className="text-[11px] text-white/55 tabular-nums">{deal.pct}%</span>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-3">
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/40">Total</dt>
                      <dd className="text-[12px] text-white/75 tabular-nums mt-0.5">{formatCurrency(deal.total)}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/40">Awaiting approval</dt>
                      <dd className={`text-[12px] tabular-nums mt-0.5 ${awaitingAmount > 0 ? 'text-blue-300' : 'text-white/45'}`}>
                        {awaitingAmount > 0 ? formatCurrency(awaitingAmount) : '—'}
                      </dd>
                    </div>
                  </dl>

                  <div className={`mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 ${
                    isBlocked
                      ? 'border-amber-500/20 bg-amber-500/[0.05]'
                      : 'border-white/[0.06] bg-white/[0.02]'
                  }`}>
                    <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                      isBlocked ? 'bg-amber-400' : 'bg-blue-400'
                    }`} />
                    <p className="text-[11px] text-white/65 leading-snug flex-1 min-w-0">
                      {nextEvent}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>

        {/* ── Portfolio analytics — moved below the operational view ──────── */}
        <section aria-label="Portfolio analytics">
          <SectionHeader label="Portfolio analytics" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <AnalyticsTile label="Active deals"     value={String(totalDeals)}                   />
            <AnalyticsTile label="Total funded"     value={formatCurrency(totalFunded)}          />
            <AnalyticsTile label="Released to date" value={formatCurrency(totalReleased)}        />
          </div>
        </section>

        {/* ── Recent release activity (renamed from Demo Activity Log) ────── */}
        <section aria-label="Recent release activity">
          <SectionHeader label="Recent release activity" />
          <p className="-mt-1 mb-3 text-[11px] text-white/45 leading-relaxed">
            Demo session events are shown here. In production, release activity is written to an
            append-only audit record with hash-chained integrity.
          </p>
          <DemoActivityLog entries={activityEntries} />
        </section>

        {/* ── Authorization-infrastructure footer ─────────────────────────── */}
        <footer className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
          <p className="text-[11px] text-white/45 leading-relaxed">
            Vektrum authorizes releases only after all conditions are satisfied. It does not hold
            funds or act as escrow. Payment execution is handled by the selected rail —
            Stripe Connect, title, escrow, bank wire, or your institution&rsquo;s existing process.
          </p>
        </footer>

      </div>
    </div>
  )
}

// ─── Components ───────────────────────────────────────────────────────────────

type Stage =
  | 'released'
  | 'ready_for_funder'
  | 'awaiting_funder'
  | 'contractor_action'
  | 'blocked'
  | 'under_review'

const STAGE_META: Record<Stage, { label: string; classes: string }> = {
  released: {
    label:   'Released',
    classes: 'bg-emerald-500/[0.10] text-emerald-300 border-emerald-500/25',
  },
  ready_for_funder: {
    label:   'Ready for funder approval',
    classes: 'bg-vektrum-blue/[0.12] text-blue-300 border-vektrum-blue/30',
  },
  awaiting_funder: {
    label:   'Waiting on funder',
    classes: 'bg-vektrum-blue/[0.10] text-blue-300 border-vektrum-blue/25',
  },
  contractor_action: {
    label:   'Contractor action required',
    classes: 'bg-amber-500/[0.10] text-amber-300 border-amber-500/25',
  },
  blocked: {
    label:   'Release blocked',
    classes: 'bg-amber-500/[0.10] text-amber-300 border-amber-500/25',
  },
  under_review: {
    label:   'Under control review',
    classes: 'bg-white/[0.06] text-white/65 border-white/[0.12]',
  },
}

function StatusBadge({ stage, className = '' }: { stage: Stage; className?: string }) {
  const m = STAGE_META[stage]
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${m.classes} ${className}`}>
      {m.label}
    </span>
  )
}

function GuidedReleaseStrip() {
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

function PrimaryDrawCard() {
  return (
    <article className="lg:col-span-3 rounded-2xl border border-vektrum-blue/25 bg-vektrum-blue/[0.04] overflow-hidden">
      <div className="px-6 pt-5 pb-4 border-b border-white/[0.06] space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-300">
            Most important draw
          </p>
          <span aria-hidden="true" className="text-white/15">·</span>
          <p className="text-[11px] text-white/45">Draw #3 · Harbor Logistics Center</p>
        </div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-[17px] font-semibold text-white leading-tight">
              Structural Steel Erection
            </h2>
            <p className="mt-1 text-[12px] text-white/55">Bottleneck: funder approval</p>
          </div>
          <div className="text-right">
            <p className="font-display text-[1.625rem] font-bold tabular-nums text-white leading-none">
              {formatCurrency(2_180_000)}
            </p>
            <span className="mt-1.5 inline-block">
              <StatusBadge stage="awaiting_funder" />
            </span>
          </div>
        </div>
        <p className="text-[13px] text-white/75 leading-relaxed">
          Control review has passed for Structural Steel Erection. No additional contractor action
          is required before funder authorization.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06] border-b border-white/[0.06]">
        <div className="px-6 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.10em] text-white/45 mb-2">
            Completed
          </p>
          <ul className="space-y-1.5">
            {[
              'Draw package submitted',
              'Control review completed',
              'Release conditions satisfied',
            ].map((line) => (
              <li key={line} className="flex items-start gap-2 text-[12.5px] text-white/75">
                <CheckCircle2 size={12} className="text-emerald-400 mt-1 flex-shrink-0" aria-hidden="true" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="px-6 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.10em] text-white/45 mb-2">
            Pending
          </p>
          <ul className="space-y-1.5">
            {[
              { line: 'Funder authorization',          owner: 'Funder' },
              { line: 'Rail execution after approval', owner: 'Selected rail' },
            ].map((p) => (
              <li key={p.line} className="flex items-start gap-2 text-[12.5px] text-white/65">
                <Lock size={12} className="text-white/35 mt-1 flex-shrink-0" aria-hidden="true" />
                <span className="flex-1">
                  {p.line}
                  <span className="ml-1.5 text-[11px] text-white/40">· {p.owner}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="px-6 py-4 flex items-center justify-end">
        <Link
          href="/demo-live/deal/harbor?from=contractor"
          className="inline-flex items-center gap-1.5 rounded-xl bg-vektrum-blue hover:bg-vektrum-blue-hover px-4 py-2 text-[12px] font-semibold text-white transition-colors"
        >
          View draw details
          <ArrowRight size={12} aria-hidden="true" />
        </Link>
      </div>
    </article>
  )
}

function WaitingOnFunderCard({ count, amount }: { count: number; amount: number }) {
  return (
    <aside
      aria-label="Waiting on funder"
      className="lg:col-span-2 rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden flex flex-col"
    >
      <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center gap-2">
        <Building2 size={13} className="text-white/55" aria-hidden="true" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.10em] text-white/55">
          Waiting on funder
        </p>
      </div>
      <div className="p-5 space-y-4 flex-1">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.10em] text-white/45 mb-1">
            Draws awaiting approval
          </p>
          <p className="font-display text-[2rem] font-bold tabular-nums leading-none text-white">{count}</p>
          <p className="mt-1.5 text-[12px] text-white/55 tabular-nums">
            {formatCurrency(amount)} pending release
          </p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[12px] font-semibold text-white">Structural Steel Erection</p>
            <StatusBadge stage="ready_for_funder" />
          </div>
          <p className="text-[11px] text-white/55">
            Control review passed. Awaiting funder release approval.
          </p>
        </div>
        <p className="text-[11px] text-white/40 leading-relaxed">
          Funder authorization is recorded after the deterministic gate clears. Vektrum does not
          move money; the selected rail executes disbursement after authorization is recorded.
        </p>
      </div>
    </aside>
  )
}

function PipelineRow({ title, amount, owner, detail, stage }: {
  title:  string
  amount: number
  owner:  string
  detail: string
  stage:  Stage
}) {
  return (
    <div className="grid sm:grid-cols-12 gap-x-3 gap-y-1 items-start px-5 py-3.5">
      <div className="sm:col-span-4">
        <p className="text-[13px] font-semibold text-white/85">{title}</p>
        <p className="text-[11px] text-white/45 mt-0.5">{detail}</p>
      </div>
      <div className="sm:col-span-2 sm:text-right text-[12px] text-white/70 tabular-nums">
        {formatCurrency(amount)}
      </div>
      <div className="sm:col-span-3 flex items-center gap-1.5 text-[12px] text-white/65">
        <User size={11} className="text-white/35" aria-hidden="true" />
        {owner}
      </div>
      <div className="sm:col-span-3 sm:text-right">
        <StatusBadge stage={stage} />
      </div>
    </div>
  )
}

function ChecklistGroup({ title, tone, items }: {
  title: string
  tone:  'ok' | 'active' | 'upcoming'
  items: string[]
}) {
  const labelColor =
    tone === 'ok'       ? 'text-emerald-300' :
    tone === 'active'   ? 'text-amber-300'   :
                          'text-white/45'
  const iconColor =
    tone === 'ok'       ? 'text-emerald-400' :
    tone === 'active'   ? 'text-amber-400'   :
                          'text-white/30'
  const Icon =
    tone === 'ok'       ? CheckCircle2 :
    tone === 'active'   ? Sparkles     :
                          Lock
  const itemColor =
    tone === 'ok'       ? 'text-white/55 line-through' :
    tone === 'active'   ? 'text-white/85'              :
                          'text-white/55'
  return (
    <div className="space-y-2">
      <p className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${labelColor}`}>
        {title}
      </p>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2">
            <Icon size={12} className={`${iconColor} mt-0.5 flex-shrink-0`} aria-hidden="true" />
            <span className={`text-[12.5px] ${itemColor}`}>{it}</span>
          </li>
        ))}
      </ul>
    </div>
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
  tone:     'blue' | 'amber' | 'ok'
  href?:    string
}) {
  const valueColor =
    tone === 'amber' ? 'text-amber-300'   :
    tone === 'ok'    ? 'text-emerald-300' :
                       'text-blue-300'
  const inner = (
    <div className={`rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card px-5 py-4 ${href ? 'hover:border-white/[0.16] transition-colors cursor-pointer' : ''}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">{label}</p>
      <p className={`mt-1.5 font-display text-[1.625rem] font-bold tabular-nums leading-none ${valueColor}`}>{value}</p>
      <p className="mt-1.5 text-[11px] text-white/45 tabular-nums">{sublabel}</p>
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
