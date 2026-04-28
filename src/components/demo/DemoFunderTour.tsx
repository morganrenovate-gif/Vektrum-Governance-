'use client'

/**
 * DemoFunderTour — guided walkthrough for /demo-live/funder?tour=1
 *
 * Client-side only. Reads ?tour=1 from the URL via useEffect so it is
 * compatible with Next.js 15 App Router without a Suspense boundary.
 * Returns null when the query param is absent — zero effect on normal demo use.
 *
 * No production API calls, no Supabase, no Stripe, no auth, no real data.
 * All copy is demo-safe: no escrow claims, no funds-held claims, no AI-approves claims.
 */

import { useState, useEffect } from 'react'
import { ArrowLeft, ArrowRight, MapPin, X } from 'lucide-react'

// ── Tour step data ────────────────────────────────────────────────────────────

interface TourStep {
  /** Short label shown above the title (10px uppercase eyebrow) */
  stepLabel: string
  /** Bold headline for this step */
  title: string
  /** Two-to-three sentence explanation — must be authority-safe */
  body: string
  /** "Where to look" hint shown in the hint box */
  hint: string
}

const TOUR_STEPS: TourStep[] = [
  {
    stepLabel: 'Simulated environment',
    title: 'No real funds — this is a demo',
    body:
      'This walkthrough shows Vektrum as a first-time funder would experience it. All deals, milestones, and releases are simulated. No real funds, accounts, or payment instructions are processed in demo mode.',
    hint:
      'The red Demo Mode banner at the top confirms you are in a safe, isolated environment.',
  },
  {
    stepLabel: 'Draw evidence',
    title: 'Review draw evidence before releasing',
    body:
      'Contractors submit draw requests with supporting documents — invoices, inspection reports, site photos. As funder, you review evidence and decide whether conditions are met before the gate runs. Vektrum records all evidence against each milestone.',
    hint:
      'Click "Review Draw" on the Riverside milestone (Action Queue below) to see the supporting documents panel.',
  },
  {
    stepLabel: 'Draw Control Brief',
    title: 'Perplexity Computer generates the Draw Control Brief',
    body:
      'Before the release gate runs, Perplexity Computer reads the draw package, extracts structured release facts, and flags missing evidence and conflicts. The result is the Draw Control Brief — required before the release gate can evaluate a draw. Without a current brief, the governed release workflow cannot proceed. AI informs; the gate decides; the funder authorizes.',
    hint:
      'On a deal page, click "Generate Draw Control Brief" on a milestone to see the evidence-to-policy layer in action.',
  },
  {
    stepLabel: 'Release gate',
    title: '10 conditions. All must pass.',
    body:
      'No single condition can be overridden at will. Admins cannot bypass the gate. Contractors cannot self-approve. Every authorized release records who approved it, when, and against what evidence — logged to an append-only audit trail.',
    hint:
      'On an approved milestone, click "Release" to see the gate evaluate all 10 conditions in real time.',
  },
  {
    stepLabel: 'Dispute isolation',
    title: 'Disputes isolate one milestone — not the deal',
    body:
      'A flagged draw locks one milestone. All other milestones on the same deal continue to release on schedule. Vektrum contains risk at the milestone level so the rest of your portfolio keeps moving.',
    hint:
      'The Harbor Dispute deal (Action Queue) shows HVAC procurement in dispute while other milestones stay active.',
  },
  {
    stepLabel: 'Activity log',
    title: 'Every action is logged',
    body:
      'In the live app, approvals, releases, and status changes are appended to a hash-chained audit log — append-only and tamper-evident. In this demo, the activity log shows your walkthrough actions without writing anything to production.',
    hint:
      'Scroll to the bottom of the Harbor Dispute page to see the Demo Activity Log.',
  },
  {
    stepLabel: 'Your payment rail',
    title: 'Vektrum governs. Your rail executes.',
    body:
      'After Vektrum authorizes a release, payment runs through Stripe Connect or your existing wire/ACH/escrow infrastructure. Vektrum does not hold funds or move wires. The governance fee is invoiced separately from disbursements.',
    hint:
      'Tour complete. Click “End Tour” or explore the demo freely — no action is irreversible.',
  },
]

// ── Component ─────────────────────────────────────────────────────────────────

export function DemoFunderTour() {
  const [tourActive, setTourActive] = useState(false)
  const [step, setStep] = useState(0)

  // Detect ?tour=1 on the client only — no SSR, no Suspense boundary needed.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('tour') === '1') {
        setTourActive(true)
        setStep(0)
      }
    }
  }, [])

  if (!tourActive) return null

  const current = TOUR_STEPS[step]
  const total   = TOUR_STEPS.length
  const isFirst = step === 0
  const isLast  = step === total - 1

  return (
    <div
      className="rounded-2xl border border-vektrum-blue/40 bg-vektrum-blue/[0.07] ring-1 ring-vektrum-blue/15 overflow-hidden"
      data-demo-tour="active"
      data-testid="demo-funder-tour"
      aria-label="Guided walkthrough"
      role="region"
    >
      {/* ── Header bar ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 border-b border-vektrum-blue/20 bg-vektrum-blue/[0.08] px-5 py-3">
        <div className="flex items-center gap-2.5">
          <MapPin size={13} className="text-blue-400 flex-shrink-0" aria-hidden="true" />
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-300">
            Guided Walkthrough
          </p>
          <span className="rounded-full bg-vektrum-blue/30 px-2 py-0.5 text-[10px] font-semibold text-blue-200">
            {step + 1}&nbsp;of&nbsp;{total}
          </span>
        </div>
        <button
          onClick={() => setTourActive(false)}
          aria-label="Exit walkthrough"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-white/50 hover:text-white transition-colors"
        >
          <X size={12} aria-hidden="true" />
          Exit walkthrough
        </button>
      </div>

      {/* ── Step dot indicators ───────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 px-5 pt-4" role="tablist" aria-label="Tour steps">
        {TOUR_STEPS.map((s, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={i === step}
            aria-label={`Step ${i + 1}: ${s.stepLabel}`}
            onClick={() => setStep(i)}
            className={[
              'h-1.5 rounded-full transition-all',
              i === step
                ? 'w-5 bg-vektrum-blue'
                : 'w-1.5 bg-white/[0.14] hover:bg-white/30',
            ].join(' ')}
          />
        ))}
      </div>

      {/* ── Step content ──────────────────────────────────────────────────── */}
      <div className="px-5 pt-3 pb-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-400/70 mb-1.5">
          {current.stepLabel}
        </p>
        <h3 className="text-[16px] font-bold tracking-[-0.02em] text-white mb-2">
          {current.title}
        </h3>
        <p className="text-[13px] leading-relaxed text-white/70 mb-3">
          {current.body}
        </p>
        {/* "Where to look" hint */}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5">
          <p className="text-[12px] text-white/55 leading-relaxed">
            <span className="font-semibold text-blue-300/80">↳&nbsp;</span>
            {current.hint}
          </p>
        </div>
      </div>

      {/* ── Navigation ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 border-t border-vektrum-blue/20 px-5 py-3">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={isFirst}
          aria-label="Previous step"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.10] bg-transparent px-3 py-1.5 text-[12px] font-semibold text-white/50 transition-all hover:bg-white/[0.05] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ArrowLeft size={11} aria-hidden="true" />
          Back
        </button>

        <span className="text-[11px] text-white/35 tabular-nums select-none">
          {step + 1} / {total}
        </span>

        {isLast ? (
          <button
            onClick={() => setTourActive(false)}
            aria-label="End tour"
            className="inline-flex items-center gap-1.5 rounded-lg bg-vektrum-blue px-4 py-1.5 text-[12px] font-semibold text-white transition-all hover:bg-vektrum-blue-hover"
          >
            End Tour
          </button>
        ) : (
          <button
            onClick={() => setStep((s) => Math.min(total - 1, s + 1))}
            aria-label="Next step"
            className="inline-flex items-center gap-1.5 rounded-lg bg-vektrum-blue px-4 py-1.5 text-[12px] font-semibold text-white transition-all hover:bg-vektrum-blue-hover"
          >
            Next
            <ArrowRight size={11} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}
