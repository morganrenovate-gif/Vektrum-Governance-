'use client'

// ─── Vektrum Pitch Deck ───────────────────────────────────────────────────────
//
// Slide-based pitch deck. Navigation: arrow keys (←/→), spacebar, or click.
// Designed for 1440×900+ presentation mode.
//
// Truth-aligned against:
//   - src/lib/engine/release-gate.ts      (10 conditions, role check, rail opt)
//   - src/lib/engine/billing.ts           (1% / 0.70% / 0.65%, $50 minimum)
//   - src/lib/engine/reconciliation.ts    (hourly, SLA escalation, stuck-run)
//   - src/lib/engine/audit.ts             (hash-chained append-only log)
//   - docs/payment-rails.md               (Stripe Connect + external_manual)
//   - src/app/api/milestones/[…]/release/route.ts
//   - src/app/api/milestones/[…]/authorize-external/route.ts
//   - src/app/api/releases/[…]/confirm-external/route.ts
//   - src/app/api/releases/[…]/mark-external-failed/route.ts
//
// Positioning: release-control infrastructure for construction capital.
// Not construction SaaS. Not a payment processor. Not an AI product.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import {
  ChevronLeft, ChevronRight, Shield, CheckCircle2, XCircle,
  DollarSign, AlertTriangle, FileCheck, CreditCard,
  Eye, Lock, Users, Cpu, Building2, Landmark, HardHat,
  GitBranch, Gauge, ScrollText, ArrowRight, Printer, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Shared background primitives ────────────────────────────────────────────

function DotGrid({ opacity = 0.22 }: { opacity?: number }) {
  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
        opacity,
      }}
    />
  )
}

function Glow({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'absolute rounded-full pointer-events-none',
        'bg-vektrum-blue/[0.13] blur-[110px]',
        className,
      )}
    />
  )
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mb-5">
      <div className="h-[3px] w-4 rounded-full bg-vektrum-blue flex-shrink-0" />
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-vektrum-blue">
        {children}
      </p>
    </div>
  )
}

function Tick() {
  return (
    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/10">
      <CheckCircle2 size={12} className="text-emerald-400" />
    </span>
  )
}
function Cross() {
  return (
    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-red-500/[0.08]">
      <XCircle size={12} className="text-red-500/50" />
    </span>
  )
}
function Half() {
  return (
    <span className="flex items-center justify-center w-5 h-5">
      <span className="block w-3 h-[2px] rounded-full bg-amber-400/55" />
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 1 — COVER
// ─────────────────────────────────────────────────────────────────────────────

function CoverSlide() {
  return (
    <div className="relative flex flex-col items-center justify-center h-full px-16 py-20 text-center overflow-hidden">
      <DotGrid />
      <Glow className="w-[720px] h-[560px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

      <div aria-hidden className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-vektrum-blue/45 to-transparent" />

      <div className="relative z-10 max-w-[880px] mx-auto">

        <div className="inline-flex items-center gap-2 rounded-full border border-vektrum-blue/30 bg-vektrum-blue/[0.07] px-3.5 py-1.5 mb-11">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          <span className="text-[10px] font-black text-vektrum-blue tracking-[0.18em] uppercase">
            Construction Finance Infrastructure
          </span>
        </div>

        <p className="text-[12px] font-black tracking-[0.28em] text-white/30 uppercase mb-5">
          Vektrum
        </p>

        <h1 className="text-[60px] font-black tracking-[-0.045em] text-white leading-[0.95] mb-8">
          Release-control infrastructure
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-br from-blue-300 via-blue-400 to-vektrum-blue">
            for construction capital.
          </span>
        </h1>

        <p className="text-[18px] text-white/62 leading-[1.6] max-w-[620px] mx-auto mb-12">
          Money does not move unless all release conditions pass.
          Vektrum governs authorization. Vektrum does not hold funds directly.
        </p>

        <div className="grid grid-cols-3 gap-4 max-w-[620px] mx-auto mb-14">
          {[
            { value: '10',        sub: 'Server-side release conditions' },
            { value: '2 rails',   sub: 'Stripe Connect + external/manual' },
            { value: 'Hash-chain',sub: 'Append-only audit log' },
          ].map((s) => (
            <div key={s.sub} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-5 py-4">
              <p className="text-[26px] font-black text-white tracking-tight tabular-nums leading-none mb-1.5">
                {s.value}
              </p>
              <p className="text-[11px] text-white/42 leading-snug">{s.sub}</p>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-white/22 tracking-[0.15em] uppercase">
          Confidential · Not for distribution · {new Date().getFullYear()}
        </p>
      </div>

      <div aria-hidden className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 2 — PROBLEM
// ─────────────────────────────────────────────────────────────────────────────

function ProblemSlide() {
  const cards = [
    {
      icon:    AlertTriangle,
      title:   'Risk happens before money moves',
      body:    'Draw approvals live in email threads, PDFs, and spreadsheets. Conditions are checked by memory. When a release is wrong, it is wrong before the wire leaves the bank.',
      accent:  { border: 'border-red-500/15', iconBg: 'bg-red-500/[0.07]', icon: 'text-red-400' },
    },
    {
      icon:    FileCheck,
      title:   'Fragmented documentation',
      body:    'Funders, contractors, inspectors, title, and attorneys all hold pieces of the record. No single authoritative source for "was this release allowed?".',
      accent:  { border: 'border-amber-500/15', iconBg: 'bg-amber-500/[0.07]', icon: 'text-amber-400' },
    },
    {
      icon:    Eye,
      title:   'Consequences compound',
      body:    'Bad releases create disputes, over-advancing, lien exposure, and payment uncertainty. Recovery is manual, expensive, and slow.',
      accent:  { border: 'border-red-500/15', iconBg: 'bg-red-500/[0.07]', icon: 'text-red-400' },
    },
  ]

  return (
    <div className="relative flex flex-col justify-center h-full px-20 py-16 overflow-hidden">
      <DotGrid opacity={0.18} />
      <Glow className="w-[460px] h-[460px] -top-32 -right-20" />

      <div className="relative z-10 max-w-[980px] mx-auto w-full">
        <Eyebrow>The Problem</Eyebrow>

        <h2 className="text-[50px] font-black tracking-[-0.038em] text-white leading-[1.02] mb-4">
          Construction capital movement
          <br />
          <span className="text-white/38">is governed by habit, not enforcement.</span>
        </h2>

        <p className="text-[15px] text-white/50 mb-12 max-w-[620px] leading-relaxed">
          Construction finance depends on approval chains, email, spreadsheets, and
          scanned PDFs. The moment money moves is the moment risk crystallises — and
          there is no systems layer between approval and disbursement.
        </p>

        <div className="grid grid-cols-3 gap-5">
          {cards.map((c) => {
            const Icon = c.icon
            return (
              <div key={c.title} className={cn('rounded-2xl border bg-white/[0.022] p-7', c.accent.border)}>
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-6', c.accent.iconBg)}>
                  <Icon size={16} className={c.accent.icon} />
                </div>
                <h3 className="text-[15px] font-semibold text-white mb-3">{c.title}</h3>
                <p className="text-[13px] text-white/55 leading-relaxed">{c.body}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 3 — CORE INSIGHT
// ─────────────────────────────────────────────────────────────────────────────

function InsightSlide() {
  return (
    <div className="relative flex flex-col justify-center h-full px-20 py-16 overflow-hidden">
      <DotGrid opacity={0.15} />
      <Glow className="w-[620px] h-[420px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

      <div className="relative z-10 max-w-[920px] mx-auto w-full">
        <Eyebrow>The Insight</Eyebrow>

        <h2 className="text-[54px] font-black tracking-[-0.04em] text-white leading-[1.0] mb-10">
          The industry does not need
          <br />
          another workflow tool.
        </h2>

        <div className="grid grid-cols-2 gap-5 mb-10">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-7">
            <p className="text-[11px] font-black tracking-[0.2em] uppercase text-white/35 mb-3">Already solved</p>
            <p className="text-[16px] text-white/70 leading-relaxed">
              Tracking drafts. Managing documents. Routing approvals.
              Storing files. Dashboards.
            </p>
          </div>
          <div className="rounded-2xl border border-vektrum-blue/30 bg-vektrum-blue/[0.06] p-7">
            <p className="text-[11px] font-black tracking-[0.2em] uppercase text-vektrum-blue mb-3">Still unsolved</p>
            <p className="text-[16px] text-white leading-relaxed">
              Enforcement at the moment of release. A server-side answer
              to a single question —
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.1] bg-gradient-to-br from-vektrum-blue/[0.10] to-transparent p-8 text-center">
          <p className="text-[26px] font-black text-white tracking-[-0.02em] leading-tight">
            “Is this release actually allowed right now?”
          </p>
          <p className="text-[13px] text-white/50 mt-3">
            Most systems track construction payments. Vektrum controls whether they are allowed to move.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 4 — SOLUTION
// ─────────────────────────────────────────────────────────────────────────────

function SolutionSlide() {
  const flow = [
    {
      label:    'Funder authorization',
      sub:      'Funder triggers release. Admins cannot.',
      icon:     Landmark,
      border:   'border-blue-500/20',
      bg:       'bg-blue-500/[0.05]',
      iconBg:   'bg-blue-500/[0.10]',
      iconText: 'text-blue-400',
    },
    {
      label:    'AI precondition',
      sub:      'Draw review — informs; never decides.',
      icon:     Cpu,
      border:   'border-purple-500/25',
      bg:       'bg-purple-500/[0.06]',
      iconBg:   'bg-purple-500/[0.12]',
      iconText: 'text-purple-400',
    },
    {
      label:    '10-condition gate',
      sub:      'Server-side. Atomic. No UI bypass.',
      icon:     Shield,
      border:   'border-vektrum-blue/40',
      bg:       'bg-vektrum-blue/[0.10]',
      iconBg:   'bg-vektrum-blue/[0.18]',
      iconText: 'text-blue-300',
      core:     true,
    },
    {
      label:    'Execution rail',
      sub:      'Stripe Connect or external/manual.',
      icon:     CreditCard,
      border:   'border-emerald-500/20',
      bg:       'bg-emerald-500/[0.05]',
      iconBg:   'bg-emerald-500/[0.10]',
      iconText: 'text-emerald-400',
    },
  ]

  return (
    <div className="relative flex flex-col justify-center h-full px-20 py-16 overflow-hidden">
      <DotGrid opacity={0.18} />
      <Glow className="w-[560px] h-[400px] bottom-0 left-1/2 -translate-x-1/2 translate-y-1/3" />

      <div className="relative z-10 max-w-[980px] mx-auto w-full">
        <Eyebrow>The Solution</Eyebrow>

        <div className="grid grid-cols-[1fr_300px] gap-14 items-center">

          <div>
            <h2 className="text-[46px] font-black tracking-[-0.038em] text-white leading-[1.02] mb-6">
              A release-control layer
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-blue-500">
                between approval and disbursement.
              </span>
            </h2>

            <p className="text-[15px] text-white/54 leading-relaxed mb-9 max-w-[460px]">
              Vektrum determines whether construction funds are allowed to move.
              Authorization is separated from execution — funds flow through Stripe
              Connect or a partner-controlled external process. Vektrum never holds,
              escrows, transmits, or forwards money.
            </p>

            <div className="space-y-3.5">
              {[
                'Server-side 10-condition release gate — no UI path around it',
                'AI-assisted draw review as a precondition, not the release authority',
                'Stripe Connect automated rail + external/manual authorized rail',
                'Append-only, hash-chained audit log with admin dual-logging',
                'Hourly Stripe reconciliation with 1-hour SLA escalation',
                'Funder-triggered release. Admin oversight. Admin cannot release.',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-[1px] w-5 h-5 rounded-full bg-vektrum-blue/10 flex items-center justify-center">
                    <CheckCircle2 size={11} className="text-blue-400" />
                  </div>
                  <p className="text-[13px] text-white/65 leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            {flow.map((step, i) => {
              const Icon = step.icon
              return (
                <div key={step.label}>
                  <div
                    className={cn(
                      'flex items-center gap-3.5 rounded-xl border px-4 py-3.5',
                      step.bg, step.border,
                      step.core ? 'ring-1 ring-blue-400/15' : '',
                    )}
                  >
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', step.iconBg)}>
                      <Icon size={14} className={step.iconText} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-white leading-tight">{step.label}</p>
                      <p className="text-[10.5px] text-white/42 leading-snug mt-0.5">{step.sub}</p>
                    </div>
                    {step.core && (
                      <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-vektrum-blue/10 border border-vektrum-blue/25">
                        <span className="text-[8px] font-black text-blue-300 uppercase tracking-wider">Core</span>
                      </span>
                    )}
                  </div>
                  {i < flow.length - 1 && (
                    <div className="flex justify-center h-3">
                      <div className="w-px h-full bg-gradient-to-b from-white/[0.08] to-transparent" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 5 — RELEASE GATE (10 CONDITIONS)
// ─────────────────────────────────────────────────────────────────────────────

function ReleaseGateSlide() {
  const conditions = [
    { n: '01', label: 'Milestone approved',         desc: 'Funder has explicitly approved the work' },
    { n: '02', label: 'Protection ready',           desc: 'Milestone protection cleared for release' },
    { n: '03', label: 'Sufficient funded balance',  desc: 'Available capital covers milestone + fee' },
    { n: '04', label: 'Payout readiness verified',  desc: 'Rail-aware: Stripe payouts enabled, or external rail authorized' },
    { n: '05', label: 'Onboarding complete',        desc: 'Contractor platform onboarding finalised' },
    { n: '06', label: 'No existing release',        desc: 'No pending or confirmed release for this milestone' },
    { n: '07', label: 'No open change orders',      desc: 'All change orders resolved before release' },
    { n: '08', label: 'Signed contract',            desc: 'Fully-executed, non-voided contract on file' },
    { n: '09', label: 'Sequential ordering',        desc: 'Prior milestones released + explicit prerequisites met' },
    { n: '10', label: 'Approved lien waiver',       desc: 'Conditional progress lien waiver on file (when required)' },
  ]

  return (
    <div className="relative flex flex-col justify-center h-full px-20 py-14 overflow-hidden">
      <DotGrid opacity={0.15} />
      <Glow className="w-[500px] h-[500px] top-1/2 right-0 translate-x-1/3 -translate-y-1/2" />

      <div className="relative z-10 max-w-[980px] mx-auto w-full">
        <Eyebrow>The Release Gate</Eyebrow>

        <div className="grid grid-cols-[300px_1fr] gap-12 items-start">

          <div>
            <h2 className="text-[44px] font-black tracking-[-0.038em] text-white leading-[1.02] mb-5">
              10 conditions.
              <br />
              <span className="text-white/38">Server-enforced.</span>
            </h2>

            <p className="text-[13.5px] text-white/52 leading-relaxed mb-7">
              Every release evaluates all 10 conditions in a single server-side pass.
              All failures return together — no partial bypass, no UI shortcut.
              Funder-triggered only; admin accounts are explicitly rejected.
            </p>

            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
              <p className="text-[11px] text-white/45 leading-relaxed">
                Funds cannot move unless all conditions pass. Reservation is atomic:
                concurrent releases against the same balance cannot over-authorize.
              </p>
            </div>

            <div className="mt-3 rounded-xl border border-vektrum-blue/25 bg-vektrum-blue/[0.05] p-4">
              <p className="text-[11px] text-blue-200/75 leading-relaxed">
                <span className="font-bold text-blue-300">Funder-triggered, system-enforced.</span>
                {' '}Admins oversee operations but cannot release funds.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {conditions.map((c) => (
              <div
                key={c.n}
                className="group flex items-start gap-3 rounded-xl border border-white/[0.055] bg-white/[0.02] px-4 py-3 hover:border-blue-400/20 hover:bg-blue-400/[0.03] transition-all duration-200"
              >
                <span className="text-[9.5px] font-mono text-vektrum-blue/65 mt-0.5 w-5 flex-shrink-0 select-none">
                  {c.n}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-white leading-tight">{c.label}</p>
                  <p className="text-[10px] text-white/38 mt-0.5 leading-snug">{c.desc}</p>
                </div>
                <div className="flex-shrink-0 mt-0.5">
                  <span className="flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500/10">
                    <CheckCircle2 size={9} className="text-emerald-400" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 6 — AI PRECONDITION
// ─────────────────────────────────────────────────────────────────────────────

function AiPreconditionSlide() {
  const guards = [
    { label: 'Risk below critical',   desc: 'Critical risk flags block the gate; admin review required.' },
    { label: 'Assessment < 48h old',  desc: 'Stale reviews do not satisfy the precondition.' },
    { label: 'Provider fallback',     desc: 'Perplexity → Anthropic → OpenAI. Malformed responses default to critical.' },
    { label: 'Admin override (AAL2)', desc: 'Emergency bypass is time-boxed, audit-logged, and does not touch the gate.' },
  ]

  return (
    <div className="relative flex flex-col justify-center h-full px-20 py-16 overflow-hidden">
      <DotGrid opacity={0.15} />
      <Glow className="w-[460px] h-[400px] -top-24 -left-20 bg-purple-500/[0.10]" />

      <div className="relative z-10 max-w-[980px] mx-auto w-full">
        <Eyebrow>AI Precondition</Eyebrow>

        <div className="grid grid-cols-[1fr_340px] gap-14 items-start">
          <div>
            <h2 className="text-[44px] font-black tracking-[-0.038em] text-white leading-[1.02] mb-6">
              AI informs.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-purple-500">
                The gate decides.
              </span>
            </h2>

            <p className="text-[14.5px] text-white/55 leading-relaxed mb-7 max-w-[460px]">
              An AI-assisted draw review runs before the 10-condition gate. It reads
              documentation, flags anomalies, and produces a risk level — but it
              has no authority to release funds. If AI is unavailable, the gate
              still runs; if AI is wrong, the gate still holds.
            </p>

            <div className="rounded-xl border border-purple-500/25 bg-purple-500/[0.05] p-5 max-w-[500px]">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-purple-300 mb-2">
                Architectural boundary
              </p>
              <p className="text-[13px] text-white/60 leading-relaxed">
                AI is a <span className="text-white font-semibold">precondition</span>, not an
                <span className="text-white font-semibold"> approver</span>. The gate runs
                independently in every case. A passing AI assessment does not bypass
                any gate condition.
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {guards.map((g) => (
              <div key={g.label} className="rounded-xl border border-white/[0.07] bg-white/[0.022] p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" />
                  <p className="text-[12.5px] font-semibold text-white">{g.label}</p>
                </div>
                <p className="text-[11.5px] text-white/45 leading-snug pl-3.5">{g.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 7 — EXECUTION RAILS
// ─────────────────────────────────────────────────────────────────────────────

function ExecutionRailsSlide() {
  return (
    <div className="relative flex flex-col justify-center h-full px-20 py-16 overflow-hidden">
      <DotGrid opacity={0.15} />
      <Glow className="w-[520px] h-[420px] bottom-0 left-0 -translate-x-1/3 translate-y-1/3" />
      <Glow className="w-[520px] h-[420px] top-0 right-0 translate-x-1/3 -translate-y-1/3 bg-emerald-500/[0.08]" />

      <div className="relative z-10 max-w-[980px] mx-auto w-full">
        <Eyebrow>Execution Rails</Eyebrow>

        <h2 className="text-[44px] font-black tracking-[-0.038em] text-white leading-[1.02] mb-4">
          Authorization is separated
          <br />
          <span className="text-white/38">from execution.</span>
        </h2>

        <p className="text-[14px] text-white/50 leading-relaxed mb-10 max-w-[640px]">
          Vektrum authorizes release. Execution happens on a payment rail. Funds
          never touch Vektrum infrastructure — on either rail.
        </p>

        <div className="grid grid-cols-2 gap-5">

          {/* Stripe Connect rail */}
          <div className="rounded-2xl border border-vektrum-blue/25 bg-vektrum-blue/[0.05] p-7">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-vektrum-blue/15">
                <CreditCard size={16} className="text-blue-300" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-300">Automated</p>
                <p className="text-[17px] font-bold text-white leading-tight">Stripe Connect</p>
              </div>
            </div>
            <p className="text-[13px] text-white/60 leading-relaxed mb-5">
              Funds are held in Stripe-managed accounts. Vektrum runs the gate and
              instructs Stripe to transfer. Stripe controls movement.
            </p>
            <div className="space-y-2">
              {[
                '10-condition gate, including Stripe payouts check',
                'Atomic reservation + transfer + ledger increment',
                'Billing record created on transfer confirmation',
                'Reconciled hourly against Stripe API',
              ].map((x) => (
                <div key={x} className="flex items-start gap-2">
                  <CheckCircle2 size={11} className="text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-[11.5px] text-white/55 leading-snug">{x}</p>
                </div>
              ))}
            </div>
          </div>

          {/* External / manual rail */}
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.04] p-7">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-500/15">
                <Building2 size={16} className="text-emerald-300" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300">Partner-controlled</p>
                <p className="text-[17px] font-bold text-white leading-tight">External / manual</p>
              </div>
            </div>
            <p className="text-[13px] text-white/60 leading-relaxed mb-5">
              Funds never touch Vektrum infrastructure at all. The funder (or their
              treasury, escrow, or title partner) executes payment off-platform
              after Vektrum authorizes.
            </p>
            <div className="space-y-2">
              {[
                'Same 10-condition gate (Stripe payouts check skipped)',
                'Authorization recorded; funder executes externally',
                'Confirmation records method, reference, proof, actor',
                'SLA-tracked; unconfirmed releases escalate',
              ].map((x) => (
                <div key={x} className="flex items-start gap-2">
                  <CheckCircle2 size={11} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                  <p className="text-[11.5px] text-white/55 leading-snug">{x}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-center">
          <p className="text-[13px] text-white/65">
            <span className="text-white font-semibold">Vektrum governs authorization.</span>{' '}
            <span className="text-white/50">Vektrum does not hold funds directly.</span>
          </p>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 8 — TRUST / AUDIT / OPS
// ─────────────────────────────────────────────────────────────────────────────

function TrustOpsSlide() {
  const items = [
    {
      icon:  ScrollText,
      title: 'Hash-chained audit log',
      desc:  'Append-only. Every action. Tamper-evident chain. Admin actions dual-log with justification ≥ 20 chars.',
      tone:  'blue',
    },
    {
      icon:  Lock,
      title: 'AAL2 for privileged admin actions',
      desc:  'Step-up MFA required for AI override, protection changes, and any admin write that could affect release eligibility.',
      tone:  'purple',
    },
    {
      icon:  Gauge,
      title: 'Hourly Stripe reconciliation',
      desc:  'Six-pass reconciliation compares DB ↔ Stripe ↔ ledger. Stuck-run detection. Rail-aware.',
      tone:  'emerald',
    },
    {
      icon:  AlertTriangle,
      title: '1-hour SLA escalation',
      desc:  'Unresolved critical findings escalate past a 1-hour threshold. External-rail pending releases tracked against SLA.',
      tone:  'amber',
    },
    {
      icon:  GitBranch,
      title: 'Frozen-deal behaviour',
      desc:  'If a contract is voided after releases have occurred, the deal freezes. No further release until admin review.',
      tone:  'blue',
    },
    {
      icon:  FileCheck,
      title: 'Sequential milestones + lien waivers',
      desc:  'Prior-milestone ordering and conditional progress lien waivers are enforced in the gate when configured.',
      tone:  'purple',
    },
  ] as const

  const toneMap: Record<string, { border: string; bg: string; iconBg: string; iconText: string }> = {
    blue:    { border: 'border-blue-500/22',    bg: 'bg-blue-500/[0.04]',    iconBg: 'bg-blue-500/15',    iconText: 'text-blue-300' },
    purple:  { border: 'border-purple-500/22',  bg: 'bg-purple-500/[0.04]',  iconBg: 'bg-purple-500/15',  iconText: 'text-purple-300' },
    emerald: { border: 'border-emerald-500/22', bg: 'bg-emerald-500/[0.04]', iconBg: 'bg-emerald-500/15', iconText: 'text-emerald-300' },
    amber:   { border: 'border-amber-500/22',   bg: 'bg-amber-500/[0.04]',   iconBg: 'bg-amber-500/15',   iconText: 'text-amber-300' },
  }

  return (
    <div className="relative flex flex-col justify-center h-full px-20 py-16 overflow-hidden">
      <DotGrid opacity={0.15} />

      <div className="relative z-10 max-w-[1000px] mx-auto w-full">
        <Eyebrow>Trust · Audit · Ops</Eyebrow>

        <h2 className="text-[44px] font-black tracking-[-0.038em] text-white leading-[1.02] mb-4">
          The trust layer lives
          <br />
          <span className="text-white/38">under every release.</span>
        </h2>

        <p className="text-[14px] text-white/50 leading-relaxed mb-10 max-w-[620px]">
          A release is only as trustworthy as the record behind it. Vektrum writes
          an immutable, operationally-monitored record of every authorization,
          confirmation, and override.
        </p>

        <div className="grid grid-cols-3 gap-4">
          {items.map((it) => {
            const tone = toneMap[it.tone]
            const Icon = it.icon
            return (
              <div key={it.title} className={cn('rounded-xl border p-5', tone.border, tone.bg)}>
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-4', tone.iconBg)}>
                  <Icon size={14} className={tone.iconText} />
                </div>
                <p className="text-[13px] font-semibold text-white mb-1.5 leading-tight">{it.title}</p>
                <p className="text-[11.5px] text-white/50 leading-snug">{it.desc}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 9 — ROLE SEPARATION
// ─────────────────────────────────────────────────────────────────────────────

function RolesSlide() {
  const roles = [
    {
      icon:  Landmark,
      label: 'Funder',
      can:   ['Fund the deal', 'Approve milestones', 'Trigger release', 'Confirm external execution'],
      cant:  ['Release without conditions', 'Bypass the gate'],
      tone:  'blue',
    },
    {
      icon:  HardHat,
      label: 'Contractor',
      can:   ['Submit draws', 'Upload evidence / waivers', 'Receive payment after release'],
      cant:  ['Release funds', 'Self-approve milestones'],
      tone:  'emerald',
    },
    {
      icon:  Shield,
      label: 'Admin',
      can:   ['Oversee disputes', 'Review audit log', 'Manage ops', 'Apply time-boxed overrides (AAL2)'],
      cant:  ['Release funds', 'Modify financial records silently'],
      tone:  'amber',
    },
  ] as const

  const toneMap: Record<string, { border: string; bg: string; iconBg: string; iconText: string; label: string }> = {
    blue:    { border: 'border-blue-500/25',    bg: 'bg-blue-500/[0.05]',    iconBg: 'bg-blue-500/15',    iconText: 'text-blue-300',    label: 'text-blue-300' },
    emerald: { border: 'border-emerald-500/25', bg: 'bg-emerald-500/[0.04]', iconBg: 'bg-emerald-500/15', iconText: 'text-emerald-300', label: 'text-emerald-300' },
    amber:   { border: 'border-amber-500/25',   bg: 'bg-amber-500/[0.04]',   iconBg: 'bg-amber-500/15',   iconText: 'text-amber-300',   label: 'text-amber-300' },
  }

  return (
    <div className="relative flex flex-col justify-center h-full px-20 py-16 overflow-hidden">
      <DotGrid opacity={0.15} />
      <Glow className="w-[540px] h-[400px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

      <div className="relative z-10 max-w-[1000px] mx-auto w-full">
        <Eyebrow>Role Separation</Eyebrow>

        <h2 className="text-[44px] font-black tracking-[-0.038em] text-white leading-[1.02] mb-4">
          Funder triggers.
          <br />
          <span className="text-white/38">Admin does not release.</span>
        </h2>

        <p className="text-[14px] text-white/50 leading-relaxed mb-10 max-w-[620px]">
          The release gate rejects any caller whose role is not `funder`. This is a
          deliberate security boundary — admin compromise cannot become unauthorized
          disbursement.
        </p>

        <div className="grid grid-cols-3 gap-4">
          {roles.map((r) => {
            const tone = toneMap[r.tone]
            const Icon = r.icon
            return (
              <div key={r.label} className={cn('rounded-2xl border p-6', tone.border, tone.bg)}>
                <div className="flex items-center gap-3 mb-5">
                  <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', tone.iconBg)}>
                    <Icon size={15} className={tone.iconText} />
                  </div>
                  <p className={cn('text-[11px] font-black uppercase tracking-[0.16em]', tone.label)}>{r.label}</p>
                </div>

                <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2">Can</p>
                <ul className="space-y-1.5 mb-4">
                  {r.can.map((x) => (
                    <li key={x} className="flex items-start gap-2">
                      <CheckCircle2 size={11} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span className="text-[11.5px] text-white/65 leading-snug">{x}</span>
                    </li>
                  ))}
                </ul>

                <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2">Cannot</p>
                <ul className="space-y-1.5">
                  {r.cant.map((x) => (
                    <li key={x} className="flex items-start gap-2">
                      <XCircle size={11} className="text-red-400/70 mt-0.5 flex-shrink-0" />
                      <span className="text-[11.5px] text-white/55 leading-snug">{x}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 10 — MARKET / WHY NOW
// ─────────────────────────────────────────────────────────────────────────────

function MarketSlide() {
  const reasons = [
    {
      title: 'Construction capital is still manual',
      body:  'Draw decisions move through email, spreadsheets, and PDFs. Enforcement is memory, not systems.',
    },
    {
      title: 'Private credit needs stronger release control',
      body:  'Non-bank construction lenders are growing and they need institutional-grade release evidence.',
    },
    {
      title: 'Payment rails are fragmented',
      body:  'Lenders use Stripe, existing treasury, escrow, and title. A rail-agnostic authorization layer is the high-leverage position.',
    },
  ]

  return (
    <div className="relative flex flex-col justify-center h-full px-20 py-16 overflow-hidden">
      <DotGrid opacity={0.15} />
      <Glow className="w-[540px] h-[360px] -top-28 left-1/2 -translate-x-1/2" />

      <div className="relative z-10 max-w-[980px] mx-auto w-full">
        <Eyebrow>Market · Why Now</Eyebrow>

        <div className="grid grid-cols-[1fr_360px] gap-14 items-start">

          <div>
            <h2 className="text-[44px] font-black tracking-[-0.038em] text-white leading-[1.02] mb-5">
              Construction finance
              <br />
              <span className="text-white/38">is due for an enforcement layer.</span>
            </h2>
            <p className="text-[14px] text-white/50 leading-relaxed mb-8 max-w-[460px]">
              Construction starts represent one of the largest and least-digitised
              credit flows in the US. The release-control layer has seen near-zero
              investment — until now.
            </p>

            <div className="space-y-3">
              {reasons.map((r) => (
                <div key={r.title} className="rounded-xl border border-white/[0.07] bg-white/[0.022] p-5">
                  <p className="text-[13.5px] font-semibold text-white mb-1">{r.title}</p>
                  <p className="text-[12px] text-white/50 leading-relaxed">{r.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-vektrum-blue/25 bg-vektrum-blue/[0.06] p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-300 mb-4">
              Who needs this
            </p>
            <div className="space-y-4">
              {[
                { label: 'Private construction lenders', desc: 'Release evidence for LP reporting and diligence.' },
                { label: 'Regional + community banks',    desc: 'Modernise draw operations without ripping out core.' },
                { label: 'Fund managers / credit funds',  desc: 'Institutional-grade controls over portfolio draws.' },
                { label: 'Vertical construction platforms', desc: 'Embed governance alongside existing workflow.' },
              ].map((x) => (
                <div key={x.label}>
                  <p className="text-[13px] font-semibold text-white leading-tight">{x.label}</p>
                  <p className="text-[11.5px] text-white/45 leading-snug mt-0.5">{x.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 11 — COMPETITIVE LANDSCAPE
// ─────────────────────────────────────────────────────────────────────────────

function CompetitiveSlide() {
  type Mark = 'check' | 'cross' | 'half'
  interface Row { feature: string; vektrum: Mark; built: Mark; procore: Mark; banks: Mark; stripe: Mark }

  const rows: Row[] = [
    { feature: '10-condition release gate (server-side)', vektrum: 'check', built: 'cross', procore: 'cross', banks: 'cross', stripe: 'cross' },
    { feature: 'zation separated from execution',  vektrum: 'check', built: 'cross', procore: 'cross', banks: 'half',  stripe: 'cross' },
    { feature: 'Rail-agnostic (Stripe + external)',       vektrum: 'check', built: 'cross', procore: 'cross', banks: 'half',  stripe: 'cross' },
    { feature: 'AI draw review as precondition',          vektrum: 'check', built: 'cross', procore: 'cross', banks: 'cross', stripe: 'cross' },
    { feature: 'Hash-chained audit log',                  vektrum: 'check', built: 'cross', procore: 'half',  banks: 'cross', stripe: 'cross' },
    { feature: 'Hourly reconciliation + SLA escalation',  vektrum: 'check', built: 'half',  procore: 'cross', banks: 'cross', stripe: 'half'  },
    { feature: 'Admin cannot release funds',              vektrum: 'check', built: 'half',  procore: 'half',  banks: 'cross', stripe: 'cross' },
    { feature: 'Construction-native controls',            vektrum: 'check', built: 'check', procore: 'check', banks: 'cross', stripe: 'cross' },
  ]

  const cols: { key: keyof Row; label: string; highlight?: boolean }[] = [
    { key: 'vektrum', label: 'Vektrum',     highlight: true },
    { key: 'built',   label: 'Built Tech' },
    { key: 'procore', label: 'Procore' },
    { key: 'banks',   label: 'Lender internal' },
    { key: 'stripe',  label: 'Stripe / MT' },
  ]

  function Cell({ type }: { type: Mark }) {
    if (type === 'check') return <Tick />
    if (type === 'half')  return <Half />
    return <Cross />
  }

  return (
    <div className="relative flex flex-col justify-center h-full px-20 py-16 overflow-hidden">
      <DotGrid opacity={0.15} />

      <div className="relative z-10 max-w-[980px] mx-auto w-full">
        <Eyebrow>Competitive Landscape</Eyebrow>

        <div className="flex items-end justify-between mb-7">
          <h2 className="text-[42px] font-black tracking-[-0.038em] text-white leading-[1.02]">
            Others track, manage, or execute.
            <br />
            <span className="text-white/38">Vektrum controls authorization.</span>
          </h2>
          <p className="text-[12px] text-white/38 max-w-[280px] leading-relaxed text-right pb-1">
            Construction platforms manage workflow. Payment processors move money.
            Neither enforces whether a specific release is allowed.
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.07] overflow-hidden">
          <div
            className="grid border-b border-white/[0.06]"
            style={{ gridTemplateColumns: '1fr repeat(5, 112px)' }}
          >
            <div className="px-5 py-3">
              <p className="text-[10px] text-white/32 uppercase tracking-wider">Capability</p>
            </div>
            {cols.map((col) => (
              <div
                key={col.key}
                className={cn(
                  'px-4 py-3 text-center border-l border-white/[0.04]',
                  col.highlight ? 'bg-vektrum-blue/[0.08]' : '',
                )}
              >
                <p className={cn(
                  'text-[10.5px] font-bold uppercase tracking-wider',
                  col.highlight ? 'text-blue-400' : 'text-white/38',
                )}>
                  {col.label}
                </p>
              </div>
            ))}
          </div>

          {rows.map((row, i) => (
            <div
              key={row.feature}
              className={cn(
                'grid border-b border-white/[0.04] last:border-b-0',
                i % 2 === 0 ? '' : 'bg-white/[0.013]',
              )}
              style={{ gridTemplateColumns: '1fr repeat(5, 112px)' }}
            >
              <div className="px-5 py-3.5 flex items-center">
                <p className="text-[12.5px] text-white/70">{row.feature}</p>
              </div>
              {cols.map((col) => (
                <div
                  key={col.key}
                  className={cn(
                    'flex items-center justify-center px-4 py-3.5 border-l border-white/[0.04]',
                    col.highlight ? 'bg-vektrum-blue/[0.045]' : '',
                  )}
                >
                  <Cell type={row[col.key] as Mark} />
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-6 mt-4">
          {[
            { node: <Tick />,  label: 'Full support' },
            { node: <Half />,  label: 'Partial / limited' },
            { node: <Cross />, label: 'Not supported' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              {item.node}
              <p className="text-[11px] text-white/32">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 12 — BUSINESS MODEL
// ─────────────────────────────────────────────────────────────────────────────

function BusinessModelSlide() {
  const tiers = [
    {
      name:    'Standalone',
      rate:    '1.00%',
      desc:    'Self-service. No retainer. No setup.',
      example: '$500,000 release → $5,000 governance fee',
      badge:   'Entry',
      border:  'border-vektrum-blue/22',
      bg:      'bg-vektrum-blue/[0.05]',
      badgeBg: 'bg-vektrum-blue/10 border-vektrum-blue/25 text-blue-300',
    },
    {
      name:    'Institutional',
      rate:    '0.70%',
      desc:    'Retainer-backed. Volume pricing.',
      example: '$500,000 release → $3,500 governance fee',
      badge:   'Retainer',
      border:  'border-blue-400/18',
      bg:      'bg-blue-400/[0.035]',
      badgeBg: 'bg-blue-400/10 border-blue-400/22 text-blue-300',
    },
    {
      name:    'Enterprise',
      rate:    '0.65%',
      desc:    'Negotiated annually. Integration-led.',
      example: '$500,000 release → $3,250 governance fee',
      badge:   'Custom',
      border:  'border-purple-500/18',
      bg:      'bg-purple-500/[0.04]',
      badgeBg: 'bg-purple-500/10 border-purple-500/22 text-purple-400',
    },
  ]

  const principles = [
    { label: 'Pricing model',       value: 'Per-release governance fee' },
    { label: 'Minimum per release', value: '$50' },
    { label: 'Contractor cost',     value: '$0 — always free' },
    { label: 'Billed to',           value: 'Funder (on top of milestone)' },
    { label: 'Rail-agnostic',       value: 'Stripe Connect + external/manual' },
  ]

  return (
    <div className="relative flex flex-col justify-center h-full px-20 py-16 overflow-hidden">
      <DotGrid opacity={0.15} />
      <Glow className="w-[500px] h-[400px] bottom-0 right-0 translate-x-1/4 translate-y-1/4" />

      <div className="relative z-10 max-w-[980px] mx-auto w-full">
        <Eyebrow>Business Model</Eyebrow>

        <div className="grid grid-cols-[1fr_300px] gap-12 items-start">

          <div>
            <h2 className="text-[44px] font-black tracking-[-0.038em] text-white leading-[1.02] mb-5">
              Priced on what moves —
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-emerald-500">
                not on seats.
              </span>
            </h2>

            <p className="text-[14px] text-white/50 leading-relaxed mb-9 max-w-[440px]">
              A governance fee per verified disbursement. Contractors are always free.
              Revenue scales with capital flow, not headcount.
            </p>

            <div className="space-y-3">
              {tiers.map((t) => (
                <div key={t.name} className={cn('rounded-xl border p-5', t.border, t.bg)}>
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex items-baseline gap-3">
                      <p className="text-[22px] font-black text-white tabular-nums leading-none">{t.rate}</p>
                      <p className="text-[14px] font-semibold text-white/75">{t.name}</p>
                    </div>
                    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border flex-shrink-0', t.badgeBg)}>
                      {t.badge}
                    </span>
                  </div>
                  <p className="text-[12.5px] text-white/58 mb-1">{t.desc}</p>
                  <p className="text-[11px] text-white/38 font-mono">{t.example}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.022] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/[0.06]">
              <p className="text-[10px] font-black text-white/45 uppercase tracking-wider">Model Principles</p>
              <p className="text-[11px] text-white/32 mt-0.5">Mirrors billing.ts + /pricing</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              {principles.map((p, i) => (
                <div key={p.label} className={cn('flex items-start justify-between gap-3', i > 0 ? 'pt-3 border-t border-white/[0.04]' : '')}>
                  <p className="text-[11.5px] text-white/48 leading-snug">{p.label}</p>
                  <p className="text-[12px] font-semibold text-white text-right leading-snug">{p.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 13 — TRACTION / CURRENT STATE
// ─────────────────────────────────────────────────────────────────────────────

function TractionSlide() {
  const built = [
    'Production-grade v1 infrastructure — gate, rails, reconciliation',
    'Stripe Connect automated rail (end-to-end)',
    'External / manual execution rail with confirmation + SLA tracking',
    'Hash-chained audit log with admin dual-logging',
    'AI draw review with provider fallback chain',
    'Interactive public demo (funder · contractor · admin personas)',
  ]

  const now = [
    'Seeking pilot funders + lending partners',
    'Investor conversations for initial round',
    'Design-partner program for construction lenders',
  ]

  return (
    <div className="relative flex flex-col justify-center h-full px-20 py-16 overflow-hidden">
      <DotGrid opacity={0.15} />
      <Glow className="w-[500px] h-[380px] bottom-0 left-1/2 -translate-x-1/2 translate-y-1/4" />

      <div className="relative z-10 max-w-[980px] mx-auto w-full">
        <Eyebrow>Current State</Eyebrow>

        <h2 className="text-[44px] font-black tracking-[-0.038em] text-white leading-[1.02] mb-10">
          Shipped. Running.
          <br />
          <span className="text-white/38">Opening to pilot partners.</span>
        </h2>

        <div className="grid grid-cols-2 gap-5">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-7">
            <div className="flex items-center gap-2 mb-5">
              <CheckCircle2 size={15} className="text-emerald-400" />
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-300">
                Built today
              </p>
            </div>
            <ul className="space-y-3">
              {built.map((x) => (
                <li key={x} className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0 mt-[7px]" />
                  <p className="text-[13px] text-white/65 leading-relaxed">{x}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-vektrum-blue/25 bg-vektrum-blue/[0.05] p-7">
            <div className="flex items-center gap-2 mb-5">
              <ArrowRight size={15} className="text-blue-300" />
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-300">
                Now
              </p>
            </div>
            <ul className="space-y-3 mb-6">
              {now.map((x) => (
                <li key={x} className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0 mt-[7px]" />
                  <p className="text-[13px] text-white/65 leading-relaxed">{x}</p>
                </li>
              ))}
            </ul>
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-4">
              <p className="text-[11px] text-white/45 leading-relaxed">
                No paying-customer claims are represented in this deck.
                Revenue begins when the first pilot funder moves a live release.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 14 — FOUNDERS & BOARD
// ─────────────────────────────────────────────────────────────────────────────

function FoundersSlide() {
  const founders = [
    {
      initials: 'AM',
      name:     'Adam Morgan',
      title:    'Co-Founder & Chief Product Officer',
      bullets:  [
        '10+ years construction project management — residential and commercial projects $100K–$1M+',
        'Owner/Operator, Morgan Renovations: full-cycle estimating, budgeting, scheduling, crew, and client relations',
        'Built Vektrum\'s technical architecture: Supabase backend, Stripe Connect, API webhooks, release gate, rail abstraction',
        'Self-taught software engineer; product design driven by direct construction payment enforcement experience',
      ],
    },
    {
      initials: 'TW',
      name:     'Tanner Walstad',
      title:    'Co-Founder & Chief Commercial Officer',
      bullets:  [
        'Sales, marketing, and GTM across institutional software — Canary Speech AI, Altol Consulting, World Financial Group',
        'Independently built the original Vektrum marketplace concept for construction payment dispute resolution',
        'Accountable for commercial strategy, institutional lender partnerships, and market positioning',
        'Brings compliance signaling, enterprise sales cycles, and governance requirements to lender conversations',
      ],
    },
    {
      initials: 'PW',
      name:     'Phillip Walstad',
      title:    'Board Member & Strategic Advisor',
      bullets:  [
        'Serial entrepreneur — Co-Founder of Canary Speech (healthcare AI, voice biomarker technology)',
        'Founded / co-founded Compass Group (US + Latin America), Study&Work, Turnkey Social',
        'Core expertise: startup formation, fundraising, go-to-market, product development, team building',
        'Provides governance oversight, capital strategy, and operational guidance from multi-sector scaling experience',
      ],
    },
  ]

  return (
    <div className="relative flex flex-col justify-center h-full px-20 py-14 overflow-hidden">
      <DotGrid opacity={0.15} />
      <Glow className="w-[520px] h-[400px] -top-24 right-0 translate-x-1/4" />

      <div className="relative z-10 max-w-[1000px] mx-auto w-full">
        <Eyebrow>Founders &amp; Board</Eyebrow>

        <h2 className="text-[42px] font-black tracking-[-0.038em] text-white leading-[1.02] mb-3">
          Built by operators who lived the problem.
        </h2>
        <p className="text-[14px] text-white/50 leading-relaxed mb-8 max-w-[640px]">
          Not fintech generalists. Operators from construction finance who watched the same
          preventable failures repeat — and built the enforcement layer they needed.
        </p>

        <div className="grid grid-cols-3 gap-4">
          {founders.map((f) => (
            <div key={f.name} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-vektrum-blue/30 to-blue-500/20 border border-vektrum-blue/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-[12px] font-black text-blue-200 tracking-wider">{f.initials}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-white leading-tight">{f.name}</p>
                  <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-blue-300/80 leading-snug mt-0.5">{f.title}</p>
                </div>
              </div>
              <ul className="space-y-2">
                {f.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-blue-400/60 flex-shrink-0 mt-[7px]" />
                    <p className="text-[11px] text-white/58 leading-snug">{b}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 15 — CLOSING
// ─────────────────────────────────────────────────────────────────────────────

function ClosingSlide() {
  return (
    <div className="relative flex flex-col items-center justify-center h-full px-16 py-20 text-center overflow-hidden">
      <DotGrid />
      <Glow className="w-[720px] h-[560px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

      <div aria-hidden className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-vektrum-blue/45 to-transparent" />

      <div className="relative z-10 max-w-[860px] mx-auto">

        <p className="text-[11px] font-black tracking-[0.22em] text-vektrum-blue uppercase mb-6">
          Closing
        </p>

        <h1 className="text-[58px] font-black tracking-[-0.045em] text-white leading-[0.96] mb-7">
          The standard
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-br from-blue-300 via-blue-400 to-vektrum-blue">
            release-control layer
          </span>
          <br />
          for construction capital.
        </h1>

        <p className="text-[17px] text-white/60 leading-[1.6] max-w-[560px] mx-auto mb-12">
          Money does not move unless all release conditions pass. Vektrum governs
          authorization. Vektrum does not hold funds directly.
        </p>

        <div className="grid grid-cols-3 gap-4 max-w-[680px] mx-auto mb-14">
          {[
            { label: 'Pilot partners',    desc: 'Funders + construction lenders' },
            { label: 'Integration',       desc: 'Existing treasury / escrow / Stripe' },
            { label: 'Investor conversations', desc: 'Seed / Series A discussions' },
          ].map((c) => (
            <div key={c.label} className="rounded-xl border border-white/[0.08] bg-white/[0.025] px-5 py-4 text-left">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-300 mb-1.5">
                {c.label}
              </p>
              <p className="text-[12px] text-white/55 leading-snug">{c.desc}</p>
            </div>
          ))}
        </div>

        <div className="inline-flex flex-col items-center gap-2">
          <p className="text-[13px] text-white/70 font-mono tracking-wider">
            operations@vektrum.io
          </p>
          <p className="text-[10px] text-white/22 tracking-[0.15em] uppercase">
            Confidential · {new Date().getFullYear()}
          </p>
        </div>
      </div>

      <div aria-hidden className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// API ARCHITECTURE SLIDE
// ─────────────────────────────────────────────────────────────────────────────

function ApiArchitectureSlide() {
  const stages = [
    {
      num: '01',
      label: 'Auth Guards',
      color: 'blue',
      borderColor: 'border-blue-500/30',
      bgColor: 'bg-blue-500/[0.06]',
      iconColor: 'text-blue-300',
      labelColor: 'text-blue-300',
      items: ['JWT session verification', 'Role enforcement (funder-only)', 'MFA / AAL2 for funders & admins', 'Deal participant access check'],
    },
    {
      num: '02',
      label: 'AI Precondition',
      color: 'violet',
      borderColor: 'border-violet-500/30',
      bgColor: 'bg-violet-500/[0.06]',
      iconColor: 'text-violet-300',
      labelColor: 'text-violet-300',
      items: ['48 h result TTL cache', 'Photo + doc risk filter', 'Admin override with TTL', 'Blocks if inconclusive'],
    },
    {
      num: '03',
      label: '10-Condition Gate',
      color: 'vektrum',
      borderColor: 'border-vektrum-blue/50',
      bgColor: 'bg-vektrum-blue/[0.10]',
      iconColor: 'text-blue-300',
      labelColor: 'text-blue-400',
      items: ['Milestone + deal state checks', 'Active contract required', 'Duplicate release guard', 'Rail-specific validation'],
      highlight: true,
    },
    {
      num: '04',
      label: 'Execution',
      color: 'emerald',
      borderColor: 'border-emerald-500/30',
      bgColor: 'bg-emerald-500/[0.06]',
      iconColor: 'text-emerald-300',
      labelColor: 'text-emerald-300',
      items: ['Stripe / external dispatch', 'Release + billing record', 'Ledger increment (atomic)', 'Immutable audit entry'],
    },
  ]

  const endpoints = [
    { method: 'POST', path: '/api/milestones/[id]/release',             desc: 'Stripe rail — triggers all 4 layers' },
    { method: 'POST', path: '/api/milestones/[id]/authorize-external',  desc: 'External rail — auth + gate only' },
    { method: 'POST', path: '/api/releases/[id]/confirm-external',      desc: 'Funder confirms off-platform payment' },
    { method: 'POST', path: '/api/releases/[id]/mark-external-failed',  desc: 'Admin marks failed with justification' },
  ]

  return (
    <div className="relative flex flex-col justify-center h-full px-20 py-14 overflow-hidden">
      <DotGrid opacity={0.14} />
      <Glow className="w-[600px] h-[500px] top-0 right-0 translate-x-1/4 -translate-y-1/4 bg-blue-500/[0.07]" />
      <Glow className="w-[440px] h-[380px] bottom-0 left-0 -translate-x-1/3 translate-y-1/3 bg-violet-500/[0.06]" />

      <div className="relative z-10 max-w-[1060px] mx-auto w-full">
        <Eyebrow>API Architecture</Eyebrow>

        <div className="flex gap-12 mt-2">

          {/* Left: description + async channels */}
          <div className="w-[240px] flex-shrink-0 flex flex-col justify-center">
            <h2 className="text-[32px] font-black tracking-[-0.034em] text-white leading-[1.05] mb-3">
              Four layers.
              <br />
              <span className="text-white/38">No bypass path.</span>
            </h2>
            <p className="text-[12.5px] text-white/52 leading-relaxed mb-7">
              Every release request passes through all four validation layers in sequence.
              A block at any layer terminates the request — no layer can be skipped by
              role, flag, or calling convention.
            </p>

            <div className="space-y-3">
              <p className="text-[9.5px] font-black uppercase tracking-[0.18em] text-white/28 mb-1">Async channels</p>
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                  <Gauge size={12} className="text-white/45" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-white/65 leading-tight">Reconciliation engine</p>
                  <p className="text-[10.5px] text-white/38 leading-snug">Hourly · 6 pass · SLA escalation</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                  <Zap size={12} className="text-white/45" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-white/65 leading-tight">Stripe webhooks</p>
                  <p className="text-[10.5px] text-white/38 leading-snug">HMAC-verified · idempotent · failure-wins</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: pipeline + endpoints */}
          <div className="flex-1 min-w-0">

            {/* Pipeline stages */}
            <div className="flex items-stretch gap-2 mb-4">
              {stages.map((stage, i) => (
                <div key={stage.num} className="flex items-center gap-2 flex-1 min-w-0">
                  <div className={cn(
                    'flex-1 rounded-xl border p-3.5 flex flex-col min-w-0',
                    stage.borderColor,
                    stage.bgColor,
                    stage.highlight && 'ring-1 ring-vektrum-blue/30',
                  )}>
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <span className={cn('text-[9px] font-black font-mono tracking-wider', stage.labelColor)}>
                        {stage.num}
                      </span>
                      <span className={cn('text-[11px] font-bold leading-tight', stage.highlight ? 'text-white' : 'text-white/80')}>
                        {stage.label}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {stage.items.map((item) => (
                        <div key={item} className="flex items-start gap-1.5">
                          <div className={cn('w-1 h-1 rounded-full mt-1.5 flex-shrink-0', `bg-${stage.color}-400`)} />
                          <p className="text-[10px] text-white/48 leading-snug">{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {i < stages.length - 1 && (
                    <ArrowRight size={12} className="text-white/20 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>

            {/* Block on any failure */}
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-2.5 mb-4 text-center">
              <p className="text-[11.5px] text-white/50">
                <span className="text-white/75 font-semibold">Blocks on any failure.</span>
                {' '}No layer may be short-circuited by caller identity, feature flag, or environment override.
              </p>
            </div>

            {/* Endpoint badges */}
            <div className="grid grid-cols-2 gap-2">
              {endpoints.map((ep) => (
                <div key={ep.path} className="rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2.5 flex items-start gap-2.5">
                  <span className="text-[9px] font-black font-mono tracking-wider text-vektrum-blue bg-vektrum-blue/15 rounded px-1.5 py-0.5 flex-shrink-0 mt-0.5">
                    {ep.method}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[9.5px] font-mono text-white/60 truncate leading-tight">{ep.path}</p>
                    <p className="text-[10px] text-white/38 leading-snug mt-0.5">{ep.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div aria-hidden className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DECK SHELL + NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────

const SLIDES = [
  { id: 'cover',       label: 'Vektrum',           component: CoverSlide },
  { id: 'problem',     label: 'Problem',            component: ProblemSlide },
  { id: 'insight',     label: 'Insight',            component: InsightSlide },
  { id: 'solution',    label: 'Solution',           component: SolutionSlide },
  { id: 'gate',        label: 'Release Gate',       component: ReleaseGateSlide },
  { id: 'ai',          label: 'AI Precondition',    component: AiPreconditionSlide },
  { id: 'rails',       label: 'Execution Rails',    component: ExecutionRailsSlide },
  { id: 'api-arch',    label: 'API Architecture',   component: ApiArchitectureSlide },
  { id: 'trust',       label: 'Trust · Audit',      component: TrustOpsSlide },
  { id: 'roles',       label: 'Role Separation',    component: RolesSlide },
  { id: 'market',      label: 'Market',             component: MarketSlide },
  { id: 'competitive', label: 'Competitive',        component: CompetitiveSlide },
  { id: 'model',       label: 'Business Model',     component: BusinessModelSlide },
  { id: 'traction',    label: 'Traction',           component: TractionSlide },
  { id: 'founders',    label: 'Founders',           component: FoundersSlide },
  { id: 'closing',     label: 'Closing',            component: ClosingSlide },
] as const

export default function PitchPage() {
  const [current, setCurrent] = useState(0)

  const prev = useCallback(() => setCurrent((c) => Math.max(0, c - 1)), [])
  const next = useCallback(() => setCurrent((c) => Math.min(SLIDES.length - 1, c + 1)), [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (['ArrowRight', 'ArrowDown', ' '].includes(e.key)) { e.preventDefault(); next() }
      if (['ArrowLeft', 'ArrowUp'].includes(e.key))           { e.preventDefault(); prev() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev])

  return (
    <div data-pitch-container className="relative bg-[#07091a] overflow-hidden" style={{ height: '100dvh' }}>

      {/* Print CSS — all slides visible, full-page per slide */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: landscape; margin: 0; }
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          [data-pitch-nav] { display: none !important; }
          [data-pitch-container] { position: relative !important; height: auto !important; overflow: visible !important; background: #07091a !important; }
          [data-pitch-slides-wrapper] { position: relative !important; height: auto !important; }
          [data-pitch-slide] { position: relative !important; height: 100vh !important; opacity: 1 !important; transform: none !important; break-after: page !important; page-break-after: always !important; display: block !important; pointer-events: none !important; }
          [data-pitch-slide]:last-child { break-after: avoid !important; page-break-after: avoid !important; }
        }
      ` }} />

      {/* Progress bar */}
      <div data-pitch-nav className="fixed top-0 inset-x-0 z-50 h-[2px] bg-white/[0.04]" aria-hidden>
        <div
          className="h-full bg-gradient-to-r from-vektrum-blue to-blue-400 transition-all duration-500 ease-in-out"
          style={{ width: `${((current + 1) / SLIDES.length) * 100}%` }}
        />
      </div>

      {/* Wordmark */}
      <div data-pitch-nav className="fixed top-5 left-7 z-50">
        <p className="text-[10px] font-black tracking-[0.22em] text-white/28 uppercase select-none">
          Vektrum
        </p>
      </div>

      {/* Slide label */}
      <div data-pitch-nav className="fixed top-5 right-7 z-50">
        <p className="text-[10px] text-white/22 uppercase tracking-[0.15em] font-medium select-none">
          {SLIDES[current].label}
        </p>
      </div>

      {/* Slides */}
      <div data-pitch-slides-wrapper className="relative h-full">
        {SLIDES.map(({ id, component: Slide }, i) => (
          <div
            key={id}
            data-pitch-slide
            className={cn(
              'absolute inset-0 transition-all duration-500 ease-in-out',
              i === current
                ? 'opacity-100 translate-y-0 z-10 pointer-events-auto'
                : i < current
                  ? 'opacity-0 -translate-y-3 z-0 pointer-events-none'
                  : 'opacity-0  translate-y-3 z-0 pointer-events-none',
            )}
          >
            <Slide />
          </div>
        ))}
      </div>

      {/* Bottom nav */}
      <div data-pitch-nav className="fixed bottom-7 inset-x-0 z-50 flex items-center justify-center gap-4 select-none">
        <button
          onClick={prev}
          disabled={current === 0}
          aria-label="Previous slide"
          className="w-8 h-8 rounded-full border border-white/[0.10] bg-white/[0.04] flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.09] hover:border-white/[0.18] disabled:opacity-20 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft size={14} />
        </button>

        <div className="flex items-center gap-1.5">
          {SLIDES.map(({ id, label }, i) => (
            <button
              key={id}
              onClick={() => setCurrent(i)}
              aria-label={`Go to ${label}`}
              className={cn(
                'rounded-full transition-all duration-300',
                i === current
                  ? 'w-6 h-[7px] bg-blue-400'
                  : 'w-[7px] h-[7px] bg-white/18 hover:bg-white/35',
              )}
            />
          ))}
        </div>

        <button
          onClick={next}
          disabled={current === SLIDES.length - 1}
          aria-label="Next slide"
          className="w-8 h-8 rounded-full border border-white/[0.10] bg-white/[0.04] flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.09] hover:border-white/[0.18] disabled:opacity-20 disabled:cursor-not-allowed transition-all"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Slide counter */}
      <div data-pitch-nav className="fixed bottom-7 right-7 z-50 select-none">
        <p className="text-[11px] font-mono text-white/25 tabular-nums">
          {String(current + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}
        </p>
      </div>

      {/* Export PDF button */}
      <button
        data-pitch-nav
        onClick={() => window.print()}
        aria-label="Export as PDF"
        title="Export all slides as PDF"
        className="fixed bottom-7 left-7 z-50 flex items-center gap-1.5 px-3 h-8 rounded-full border border-white/[0.10] bg-white/[0.04] text-white/40 hover:text-white/75 hover:bg-white/[0.08] hover:border-white/[0.18] transition-all select-none"
      >
        <Printer size={12} />
        <span className="text-[10px] font-medium tracking-wide">PDF</span>
      </button>
    </div>
  )
}
