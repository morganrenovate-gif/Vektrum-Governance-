'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  HardHat, CheckCircle2, ArrowRight, ArrowLeft, Sparkles, Loader2,
  List, Shield, AlertTriangle, Lock, Upload, FileWarning,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import { useDemoAutoReset } from '@/lib/demo-data/use-demo-auto-reset'
import { DemoActivityLog } from '@/components/demo/DemoActivityLog'
import type { DemoActivityEntry } from '@/lib/demo-data/use-demo-activity-log'
import { riverside, harbor, getMilestoneSummary } from '@/lib/demo-data'

// ── Mock data ────────────────────────────────────────────────────────────────
//
// Derived from the canonical demo data so dashboard tiles stay in sync with
// the deal pages.

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

// ── Demo-start activity seed ──────────────────────────────────────────────────
//
// Pre-populated entries representing the state when a visitor arrives.
// On demo reset, activityEntries reverts to this array so every session
// starts from the same canonical scenario.

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

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DemoContractorPage() {
  // ── Demo state ────────────────────────────────────────────────────────────
  //
  // Riverside MEP Rough-In AI review (Draw Review Status section).
  const [reviewSubmitted, setReviewSubmitted]   = useState(false)
  const [submitting, setSubmitting]             = useState(false)

  // Blocked-release conditions for Building Envelope & Roofing (ms-hb-4).
  // These are the three conditions the contractor can resolve themselves.
  // "Funder authorization required" is a 4th condition that the contractor
  // can NEVER clear — it always requires explicit funder action.
  const [lienWaiverUploaded, setLienWaiverUploaded]   = useState(false)
  const [changeOrderResolved, setChangeOrderResolved] = useState(false)
  const [blockedAiReviewDone, setBlockedAiReviewDone] = useState(false)

  const [activityEntries, setActivityEntries]   = useState<DemoActivityEntry[]>(SEED_ENTRIES)

  // All three contractor-side conditions satisfied — but funder auth is still
  // required. The blocked card switches to "Awaiting funder authorization" state.
  const contractorConditionsDone = lienWaiverUploaded && changeOrderResolved && blockedAiReviewDone

  useDemoAutoReset(() => {
    setReviewSubmitted(false)
    setSubmitting(false)
    setLienWaiverUploaded(false)
    setChangeOrderResolved(false)
    setBlockedAiReviewDone(false)
    setActivityEntries(SEED_ENTRIES)
  })

  function nowTime(): string {
    return new Date().toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
    })
  }

  // ── Handlers ──────────────────────────────────────────────────────────────
  //
  // None of these touch production release gate logic, Stripe, DB, or auth.
  // All changes are React useState only — no API calls.

  function handleRequestReview() {
    if (submitting || reviewSubmitted) return
    setSubmitting(true)
    setActivityEntries((prev) => [{
      id:        `act-req-${Date.now()}`,
      timestamp: nowTime(),
      actor:     'Marcus Webb',
      role:      'contractor',
      action:    'AI pre-review requested',
      detail:    'MEP Rough-In — Riverside Mixed-Use Development · $680,000',
    }, ...prev])
    setTimeout(() => {
      setSubmitting(false)
      setReviewSubmitted(true)
      setActivityEntries((prev) => [{
        id:        `act-done-${Date.now()}`,
        timestamp: nowTime(),
        actor:     'Perplexity Computer',
        role:      'system',
        action:    'AI pre-review completed — funder authorization still required',
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
    if (blockedAiReviewDone) return
    setBlockedAiReviewDone(true)
    setActivityEntries((prev) => [{
      id:        `act-bar-${Date.now()}`,
      timestamp: nowTime(),
      actor:     'Perplexity Computer',
      role:      'system',
      action:    'AI pre-review completed — deterministic release gate and funder authorization still control release',
      detail:    'Building Envelope & Roofing — review passed · funder authorization required',
    }, ...prev])
  }

  const totalDeals    = MOCK_DEALS.length
  const totalFunded   = MOCK_DEALS.reduce((s, d) => s + d.total, 0)
  const totalReleased = riverside.released + harbor.released
  const pendingReview = reviewSubmitted ? 0 : 1

  // ── Missing conditions list (dynamic) ─────────────────────────────────────
  //
  // Each condition has a `done` flag driven by the contractor's actions above.
  // "Funder authorization required" is hardcoded done:false — contractors can
  // never clear it. This is the core Vektrum teaching moment: the gate is
  // deterministic and the funder authorizes; the contractor cannot self-release.

  const MISSING_CONDITIONS = [
    {
      key:    'lien_waiver',
      icon:   FileWarning,
      label:  'Lien waiver missing',
      detail: 'Conditional lien waiver required before release gate can proceed',
      done:   lienWaiverUploaded,
      doneLabel: 'Lien waiver uploaded',
    },
    {
      key:    'change_order',
      icon:   AlertTriangle,
      label:  'Open change order unresolved',
      detail: 'Change order CO-007 must be resolved or closed by funder',
      done:   changeOrderResolved,
      doneLabel: 'Change order resolved',
    },
    {
      key:    'ai_review',
      icon:   Sparkles,
      label:  'AI pre-review not current',
      detail: 'No current AI pre-review on file for this draw request',
      done:   blockedAiReviewDone,
      doneLabel: 'AI pre-review complete',
    },
    {
      key:    'funder_auth',
      icon:   Lock,
      label:  'Funder authorization required',
      detail: 'Release gate authorized only by explicit funder action',
      done:   false, // Contractor can never clear this — always required
      doneLabel: '',
    },
  ]

  const remainingCount = MISSING_CONDITIONS.filter((c) => !c.done).length

  return (
    <div className="min-h-screen bg-surface-0">
    <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-12 sm:py-16 space-y-8">
      {/* Back link */}
      <Link
        href="/demo-live"
        className="inline-flex items-center gap-1.5 text-sm text-white/65 hover:text-white transition-colors"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Back to role selector
      </Link>

      {/* Demo info */}
      <div className="rounded-xl border border-vektrum-blue/20 bg-vektrum-blue/10 px-5 py-4">
        <p className="text-[13px] text-blue-200 leading-relaxed">
          You&apos;re viewing the Contractor dashboard as <strong>Marcus Webb</strong>. In the live app, this connects to your real deals and payments.
        </p>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-3">
            <div className="h-px w-5 bg-vektrum-blue" />
            <p className="text-[11px] tracking-[0.12em] uppercase text-blue-300 font-semibold">Contractor Dashboard</p>
          </div>
          <h1 className="font-display text-[2.25rem] font-bold tracking-[-0.04em] text-white leading-[1.05]">
            Welcome back, Marcus
          </h1>
        </div>
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-2 self-start rounded-xl bg-vektrum-blue/40 px-4 py-2.5 text-[13px] font-semibold text-white/50 cursor-not-allowed"
          title="Demo mode — deal creation disabled"
        >
          <HardHat size={15} aria-hidden="true" />
          Create New Deal
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Total Deals" value={totalDeals} href="#your-deals" />
        <MoneyTile label="Total Funded" amount={totalFunded} href="#your-deals" />
        <MoneyTile label="Total Released" amount={totalReleased} href="#your-deals" />
        <StatTile
          label="Pending Review"
          value={pendingReview}
          warning={pendingReview > 0}
          href={pendingReview > 0 ? '#draw-review' : undefined}
        />
      </div>

      {/* ── Draw #3 Status Banner ─────────────────────────────────────────── */}
      <section className="rounded-xl border border-vektrum-blue/20 bg-surface-2 overflow-hidden">
        <div className="px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 flex items-center justify-center rounded-xl bg-vektrum-blue/[0.12] border border-vektrum-blue/20 flex-shrink-0">
              <Shield size={15} className="text-blue-400" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40 mb-0.5">Draw #3 Status</p>
              <p className="text-[14px] font-semibold text-white">
                Structural Steel Erection — {formatCurrency(2_180_000)}
              </p>
              <p className="text-[12px] text-blue-300/80 mt-0.5">
                Approved — Awaiting Funder Authorization
              </p>
            </div>
          </div>
          <Link
            href="/demo-live/deal/harbor?from=contractor"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.10] bg-surface-3 px-3 py-2 text-[12px] font-semibold text-white/65 whitespace-nowrap hover:text-white hover:border-white/[0.20] transition-all self-start sm:self-auto"
          >
            View Draw
            <ArrowRight size={12} aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* ── Release Blocked / Awaiting Funder Auth — Building Envelope ───── */}
      {/*
        Demo scene: ms-hb-4 (Building Envelope & Roofing) is in_progress with
        missing conditions. This card teaches the core Vektrum value: releases are
        blocked when conditions are missing, the gate is deterministic, and the
        funder authorizes only after all conditions are satisfied.

        State machine (demo only — no production logic):
          contractorConditionsDone=false → amber "Release blocked" card
            with interactive action buttons that each clear their condition.
          contractorConditionsDone=true  → blue "Awaiting funder authorization"
            card, showing all conditions met but funder auth still required.

        Contractor never sees funder-only actions such as disbursement controls —
        those exist only in the funder view.
      */}
      <section
        className={`rounded-2xl overflow-hidden border ${
          contractorConditionsDone
            ? 'border-vektrum-blue/30 bg-vektrum-blue/[0.04]'
            : 'border-amber-500/30 bg-amber-500/[0.04]'
        }`}
        aria-label={contractorConditionsDone ? 'Awaiting funder authorization' : 'Release blocked — missing conditions'}
      >
        {/* Card header */}
        <div className={`flex items-center gap-3 border-b px-5 py-4 ${
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
            {contractorConditionsDone ? (
              <>
                <p className="text-[13px] font-semibold text-blue-300">Awaiting funder authorization</p>
                <p className="text-[11px] text-white/55 mt-0.5">
                  All contractor-side release conditions are complete. Release still requires explicit funder authorization.
                </p>
              </>
            ) : (
              <>
                <p className="text-[13px] font-semibold text-amber-300">Release blocked</p>
                <p className="text-[11px] text-white/55 mt-0.5">
                  Building Envelope &amp; Roofing cannot be released yet because required release conditions are missing.
                  {remainingCount > 0 && (
                    <span className="ml-1 font-semibold text-amber-400">
                      {remainingCount} condition{remainingCount !== 1 ? 's' : ''} remaining.
                    </span>
                  )}
                </p>
              </>
            )}
          </div>
          <Link
            href="/demo-live/deal/harbor?from=contractor"
            className={`ml-2 inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${
              contractorConditionsDone
                ? 'border-vektrum-blue/20 bg-vektrum-blue/[0.08] text-blue-300 hover:bg-vektrum-blue/[0.14]'
                : 'border-amber-500/20 bg-amber-500/[0.08] text-amber-300 hover:bg-amber-500/[0.14]'
            }`}
          >
            View deal
            <ArrowRight size={11} aria-hidden="true" />
          </Link>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Conditions list — dynamic based on state */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40 mb-2.5">
              {contractorConditionsDone ? 'Release conditions' : 'Missing release conditions'}
            </p>
            <ul className="space-y-2">
              {MISSING_CONDITIONS.map(({ key, icon: Icon, label, detail, done, doneLabel }) => (
                <li key={key} className="flex items-start gap-2.5">
                  {done ? (
                    <CheckCircle2 size={13} className="text-emerald-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
                  ) : (
                    <Icon size={13} className={`mt-0.5 flex-shrink-0 ${key === 'funder_auth' ? 'text-white/40' : 'text-amber-400'}`} aria-hidden="true" />
                  )}
                  <div>
                    <p className={`text-[12px] font-semibold ${
                      done ? 'text-emerald-300 line-through opacity-60' : key === 'funder_auth' ? 'text-white/55' : 'text-amber-200/90'
                    }`}>
                      {done ? doneLabel : label}
                    </p>
                    <p className="text-[11px] text-white/40 mt-0.5">{done ? 'Release condition satisfied' : detail}</p>
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

              {!blockedAiReviewDone ? (
                <button
                  type="button"
                  onClick={handleBlockedAiReview}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/[0.14] border border-amber-500/25 px-3 py-1.5 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/[0.22] active:scale-95 transition-all"
                >
                  <Sparkles size={11} aria-hidden="true" />
                  Request AI review
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/[0.10] border border-emerald-500/20 px-3 py-1.5 text-[11px] font-semibold text-emerald-400">
                  <CheckCircle2 size={11} aria-hidden="true" />
                  AI review complete
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Draw Review Status */}
      <section
        id="draw-review"
        className="rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden"
      >
        <div className="border-l-4 border-vektrum-blue px-5 py-4 border-b border-white/[0.06]">
          <p className="text-[13px] font-semibold text-white">Draw Review Status</p>
        </div>
        <div className="p-5">
          {reviewSubmitted ? (
            /* ── Submitted state ─────────────────────────────────────────── */
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[13px] font-medium text-white/80">MEP Rough-In &mdash; Riverside Mixed-Use Development</p>
                  <p className="text-[12px] text-white/75 mt-0.5">Amount: {formatCurrency(680_000)}</p>
                </div>
                <Link
                  href="/demo-live/deal/riverside?from=contractor"
                  className="group inline-flex items-center gap-1.5 rounded-xl border border-white/[0.10] bg-surface-3 px-3 py-2 text-[12px] font-semibold text-white/65 whitespace-nowrap hover:text-white hover:border-white/[0.20] transition-all"
                >
                  View Deal <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              </div>
              {/* AI review result — framed as pre-review, not approval */}
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] px-4 py-3">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-[12px] font-semibold text-emerald-300">
                      AI pre-review complete — funder authorization still required.
                    </p>
                    <p className="text-[11px] text-white/50 mt-1 leading-relaxed">
                      The deterministic release gate and funder authorization still control release. AI review is a precondition, not an approval.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ── Default state — Request AI review button ─────────────────── */
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[13px] font-medium text-white/80">MEP Rough-In &mdash; Riverside Mixed-Use Development</p>
                <p className="text-[12px] text-white/75 mt-0.5">Status: Awaiting AI Review &middot; Amount: {formatCurrency(680_000)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRequestReview}
                  disabled={submitting}
                  className="group inline-flex items-center gap-1.5 rounded-xl bg-vektrum-blue px-3 py-2 text-[12px] font-semibold text-white whitespace-nowrap hover:bg-vektrum-blue-hover transition-all hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                      Submitting&hellip;
                    </>
                  ) : (
                    <>
                      <Sparkles size={12} aria-hidden="true" />
                      Request AI review
                    </>
                  )}
                </button>
                <Link
                  href="/demo-live/deal/riverside?from=contractor"
                  className="group inline-flex items-center gap-1.5 rounded-xl border border-white/[0.10] bg-surface-3 px-3 py-2 text-[12px] font-semibold text-white/65 whitespace-nowrap hover:text-white hover:border-white/[0.20] transition-all"
                >
                  View Deal <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Milestone Status Overview ─────────────────────────────────────── */}
      {/*
        Three milestone states that teach the Vektrum release model:
          Released       — all conditions met, funder authorized, funds moved via rail.
          AI-review-ready — gate passed, awaiting funder authorization.
          Blocked        — one or more conditions missing; gate will not pass.
        The Building Envelope row updates dynamically as the contractor resolves conditions.
      */}
      <section className="rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-5 py-4">
          <Shield size={14} className="text-blue-400 flex-shrink-0" aria-hidden="true" />
          <p className="text-[13px] font-semibold text-white">Milestone Status — Harbor Logistics Center</p>
          <span className="ml-auto text-[11px] text-white/40">Release gate state</span>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {/* Row 1: Released milestone */}
          <div className="flex items-center gap-4 px-5 py-3.5">
            <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-white/85 truncate">Site Preparation &amp; Grading</p>
              <p className="text-[11px] text-white/40 mt-0.5">All 10 conditions met · funder authorized · released via rail</p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-[11px] text-white/50 tabular-nums">{formatCurrency(320_000)}</span>
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border bg-emerald-500/[0.12] text-emerald-400 border-emerald-500/20">
                Released
              </span>
            </div>
          </div>

          {/* Row 2: Gate passed, awaiting funder */}
          <div className="flex items-center gap-4 px-5 py-3.5">
            <Shield size={14} className="text-blue-400 flex-shrink-0" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-white/85 truncate">Structural Steel Erection</p>
              <p className="text-[11px] text-white/40 mt-0.5">AI pre-review complete · release gate passed · awaiting funder authorization</p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-[11px] text-white/50 tabular-nums">{formatCurrency(2_180_000)}</span>
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border bg-vektrum-blue/20 text-blue-300 border-vektrum-blue/40">
                Gate passed — funder auth required
              </span>
            </div>
          </div>

          {/* Row 3: Building Envelope — dynamic based on contractor actions */}
          <div className="flex items-center gap-4 px-5 py-3.5">
            {contractorConditionsDone
              ? <Shield size={14} className="text-blue-400 flex-shrink-0" aria-hidden="true" />
              : <AlertTriangle size={14} className="text-amber-400 flex-shrink-0" aria-hidden="true" />
            }
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-white/85 truncate">Building Envelope &amp; Roofing</p>
              <p className="text-[11px] text-white/40 mt-0.5">
                {contractorConditionsDone
                  ? 'All contractor conditions met · awaiting funder authorization'
                  : `Lien waiver${lienWaiverUploaded ? ' ✓' : ' missing'} · change order${changeOrderResolved ? ' ✓' : ' unresolved'} · AI pre-review${blockedAiReviewDone ? ' ✓' : ' not current'}`
                }
              </p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-[11px] text-white/50 tabular-nums">{formatCurrency(2_640_000)}</span>
              {contractorConditionsDone ? (
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border bg-vektrum-blue/20 text-blue-300 border-vektrum-blue/40">
                  Awaiting funder auth
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border bg-amber-500/[0.12] text-amber-400 border-amber-500/20">
                  Release blocked
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Guided Workflow — Harbor Logistics Center ──────────────────────── */}
      <section className="rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-5 py-4">
          <List size={14} className="text-blue-400 flex-shrink-0" aria-hidden="true" />
          <p className="text-[13px] font-semibold text-white">Required Steps — Harbor Logistics Center</p>
          <span className="ml-auto text-[11px] text-white/40">Draw #4 in progress</span>
        </div>
        <div className="p-5">
          <ol className="relative border-l border-white/[0.08] ml-3 space-y-5">
            {[
              { label: 'Contract on file',           detail: 'Harbor_Logistics_Agreement.pdf — signed',       done: true  },
              { label: 'Schedule of Values submitted', detail: '5 line items · $9,100,000 total contract value', done: true  },
              { label: 'Draw request submitted',      detail: 'Draw #3 — Structural Steel Erection · $2,180,000', done: true  },
              { label: 'Upload supporting documents', detail: 'Inspection report, lien waiver, and draw request for Building Envelope & Roofing', done: false },
              { label: 'Request AI review',           detail: 'Vektrum runs a 10-condition check before funder authorization', done: false },
            ].map((s, i) => (
              <li key={i} className="ml-4">
                <div className={`absolute -left-[9px] h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                  s.done
                    ? 'border-emerald-500 bg-emerald-500/20'
                    : i === 3 ? 'border-vektrum-blue bg-vektrum-blue/20' : 'border-white/20 bg-surface-3'
                }`} style={{ top: `${i * 60 + 22}px` }}>
                  {s.done && <CheckCircle2 size={10} className="text-emerald-400" />}
                </div>
                <div className={`rounded-lg px-3 py-2.5 ${
                  !s.done && i === 3 ? 'border border-vektrum-blue/30 bg-vektrum-blue/[0.05]' : 'border border-white/[0.05] bg-white/[0.02]'
                }`}>
                  <p className={`text-[13px] font-medium ${s.done ? 'text-white/50 line-through' : i === 3 ? 'text-white' : 'text-white/55'}`}>
                    {s.label}
                    {!s.done && i === 3 && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-vektrum-blue/20 border border-vektrum-blue/30 px-2 py-0.5 text-[10px] font-semibold text-blue-300 no-underline" style={{ textDecoration: 'none' }}>
                        Next step
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-white/40 mt-0.5">{s.detail}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-5 pl-4">
            <Link
              href="/demo-live/deal/harbor?from=contractor"
              className="inline-flex items-center gap-1.5 rounded-xl bg-vektrum-blue px-4 py-2 text-[12px] font-semibold text-white hover:bg-vektrum-blue-hover transition-all hover:-translate-y-0.5"
            >
              <Sparkles size={12} aria-hidden="true" />
              Go to Harbor Deal
              <ArrowRight size={12} className="ml-0.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* Your Deals */}
      <section id="your-deals">
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
          Your Deals
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MOCK_DEALS.map((deal) => (
            <Link
              key={deal.slug}
              href={`/demo-live/deal/${deal.slug}?from=contractor`}
              className="group rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card p-5 flex flex-col transition-all duration-300 hover:-translate-y-1 hover:border-white/[0.14]"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                  Active
                </span>
                <span className="text-[11px] text-white/75">{deal.milestonesCompleted}/{deal.milestonesTotal} milestones</span>
              </div>
              <p className="text-[14px] font-semibold text-white/80 group-hover:text-white transition-colors leading-snug">{deal.title}</p>
              <p className="mt-1 text-[12px] text-white/55">{deal.funder} &middot; {deal.funderCompany}</p>
              <p className="mt-0.5 text-[12px] text-white/50">Total: {formatCurrency(deal.total)}</p>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${deal.pct}%` }} />
                </div>
                <span className="text-[11px] text-white/75 tabular-nums">{deal.pct}%</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Demo Activity Log ─────────────────────────────────────────────── */}
      <DemoActivityLog entries={activityEntries} />

      {/* ── Rail-neutral disclaimer ───────────────────────────────────────── */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
        <p className="text-[11px] text-white/40 leading-relaxed text-center">
          Vektrum authorizes releases only after all conditions are satisfied.
          It does not hold funds or act as escrow. Payment execution is handled by the selected rail —
          Stripe Connect, title, escrow, bank wire, or your institution&rsquo;s existing process.
        </p>
      </div>
    </div>
    </div>
  )
}

// ── Inline components ────────────────────────────────────────────────────────

function StatTile({ label, value, warning = false, href }: { label: string; value: string | number; warning?: boolean; href?: string }) {
  const inner = (
    <div
      className={`rounded-2xl border bg-surface-2 shadow-card px-5 py-5 transition-all duration-300 ${warning ? 'border-vektrum-amber/30' : 'border-white/[0.08]'} ${href ? 'hover:-translate-y-0.5 hover:border-white/[0.14] cursor-pointer' : ''}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/75">{label}</p>
      <p className={`mt-2 font-display text-4xl font-bold tabular-nums leading-none ${warning ? 'text-amber-400' : 'text-white'}`}>{value}</p>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

function MoneyTile({ label, amount, href }: { label: string; amount: number; href?: string }) {
  const inner = (
    <div
      className={`rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card px-5 py-5 transition-all duration-300 ${href ? 'hover:-translate-y-0.5 hover:border-white/[0.14] cursor-pointer' : ''}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/75">{label}</p>
      <p className="mt-2 font-display text-xl font-bold tabular-nums leading-none text-white">{formatCurrency(amount)}</p>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}
