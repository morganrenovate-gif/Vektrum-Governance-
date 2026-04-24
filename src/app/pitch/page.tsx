'use client'

// ─── Vektrum Pitch Deck ───────────────────────────────────────────────────────
//
// Slide-based pitch deck for Series A fundraise.
// Navigation: arrow keys (←/→), spacebar, or click chevrons / dots.
// Designed for 1440×900+ presentation mode.
//
// Slides:
//   1  Hero               — The Release Gate for Construction Capital
//   2  Problem            — Trust, speed, accountability
//   3  Solution           — Programmable escrow
//   4  Release Gate       — 10 conditions, server-enforced
//   5  Competitive        — Capability matrix
//   6  Market             — TAM / SAM / SOM
//   7  Business Model     — Take rate on capital at rest
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import {
  ChevronLeft, ChevronRight, Shield, CheckCircle2, XCircle,
  DollarSign, AlertTriangle, FileCheck, CreditCard, Layers,
  Eye, Lock, Users, Cpu,
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
// SLIDE 1 — HERO
// ─────────────────────────────────────────────────────────────────────────────

function HeroSlide() {
  return (
    <div className="relative flex flex-col items-center justify-center h-full px-16 py-20 text-center overflow-hidden">
      <DotGrid />
      <Glow className="w-[720px] h-[560px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

      {/* Top accent line */}
      <div aria-hidden className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-vektrum-blue/45 to-transparent" />

      <div className="relative z-10 max-w-[880px] mx-auto">

        {/* Series badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-vektrum-blue/30 bg-vektrum-blue/[0.07] px-3.5 py-1.5 mb-11">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          <span className="text-[10px] font-black text-vektrum-blue tracking-[0.18em] uppercase">
            Series A · Construction Finance Infrastructure
          </span>
        </div>

        {/* Wordmark */}
        <p className="text-[12px] font-black tracking-[0.28em] text-white/30 uppercase mb-5">
          Vektrum
        </p>

        {/* Headline */}
        <h1 className="text-[66px] font-black tracking-[-0.045em] text-white leading-[0.91] mb-8">
          The Release Gate
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-br from-blue-300 via-blue-400 to-vektrum-blue">
            for Construction Capital
          </span>
        </h1>

        <p className="text-[17px] text-white/58 leading-[1.7] max-w-[600px] mx-auto mb-14">
          Programmable escrow with a 10-condition server-side release gate.
          Vektrum is the trust infrastructure between funders and contractors —
          automating draws without compromising compliance.
        </p>

        {/* Stat strip */}
        <div className="grid grid-cols-3 gap-4 max-w-[620px] mx-auto mb-14">
          {[
            { value: '$1.8T',  sub: 'US construction lending' },
            { value: '10',     sub: 'Server-side release conditions' },
            { value: '45 → 2', sub: 'Days per draw cycle' },
          ].map((s) => (
            <div key={s.sub} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-5 py-4">
              <p className="text-[32px] font-black text-white tracking-tight tabular-nums leading-none mb-1.5">
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
      stat:    '$13B+',
      meta:    'lost annually to draw fraud',
      title:   'No enforcement layer',
      body:    'Draw requests move through email threads, PDFs, and phone calls. Anyone can request a release — there is no programmatic gate, no condition engine, no server-side check.',
      accent:  { border: 'border-red-500/15', iconBg: 'bg-red-500/[0.07]', icon: 'text-red-400', stat: 'text-red-400' },
    },
    {
      icon:    FileCheck,
      stat:    '45 days',
      meta:    'average draw cycle time',
      title:   'Broken process',
      body:    'Funders, inspectors, title companies, and contractors pass documents in circles with no shared source of truth. Every stakeholder on a different timeline.',
      accent:  { border: 'border-amber-500/15', iconBg: 'bg-amber-500/[0.07]', icon: 'text-amber-400', stat: 'text-amber-400' },
    },
    {
      icon:    Eye,
      stat:    '0%',
      meta:    'immutable audit trail in legacy tools',
      title:   'Zero accountability',
      body:    'When disputes arise — and they do — there is no on-chain record of approvals, conditions, or capital flows. Litigation is expensive and outcomes are uncertain.',
      accent:  { border: 'border-red-500/15', iconBg: 'bg-red-500/[0.07]', icon: 'text-red-400', stat: 'text-red-400' },
    },
  ]

  return (
    <div className="relative flex flex-col justify-center h-full px-20 py-16 overflow-hidden">
      <DotGrid opacity={0.18} />
      <Glow className="w-[460px] h-[460px] -top-32 -right-20" />

      <div className="relative z-10 max-w-[980px] mx-auto w-full">
        <Eyebrow>The Problem</Eyebrow>

        <h2 className="text-[50px] font-black tracking-[-0.038em] text-white leading-[1.02] mb-4">
          Construction finance has
          <br />
          <span className="text-white/38">a trust problem.</span>
        </h2>

        <p className="text-[15px] text-white/50 mb-12 max-w-[500px] leading-relaxed">
          The $1.8T construction lending market runs on manual processes,
          misaligned incentives, and zero enforcement infrastructure.
        </p>

        <div className="grid grid-cols-3 gap-5">
          {cards.map((c) => {
            const Icon = c.icon
            return (
              <div key={c.title} className={cn('rounded-2xl border bg-white/[0.022] p-7', c.accent.border)}>
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-6', c.accent.iconBg)}>
                  <Icon size={16} className={c.accent.icon} />
                </div>
                <p className={cn('text-[38px] font-black tracking-tight tabular-nums leading-none mb-1', c.accent.stat)}>
                  {c.stat}
                </p>
                <p className="text-[11px] text-white/38 mb-5 leading-snug">{c.meta}</p>
                <h3 className="text-[14px] font-semibold text-white mb-2.5">{c.title}</h3>
                <p className="text-[13px] text-white/52 leading-relaxed">{c.body}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 3 — SOLUTION
// ─────────────────────────────────────────────────────────────────────────────

function SolutionSlide() {
  const flow = [
    {
      label:    'Funder',
      sub:      'Capital deposited into deal escrow',
      icon:     DollarSign,
      border:   'border-blue-500/20',
      bg:       'bg-blue-500/[0.05]',
      iconBg:   'bg-blue-500/[0.10]',
      iconText: 'text-blue-400',
    },
    {
      label:    'AI Precondition',
      sub:      'Multi-provider draw review — Perplexity → Anthropic → OpenAI',
      icon:     Cpu,
      border:   'border-purple-500/25',
      bg:       'bg-purple-500/[0.06]',
      iconBg:   'bg-purple-500/[0.12]',
      iconText: 'text-purple-400',
    },
    {
      label:    'Release Gate',
      sub:      '10 conditions, atomically enforced server-side',
      icon:     Shield,
      border:   'border-vektrum-blue/40',
      bg:       'bg-vektrum-blue/[0.10]',
      iconBg:   'bg-vektrum-blue/[0.18]',
      iconText: 'text-blue-300',
      core:     true,
    },
    {
      label:    'Contractor',
      sub:      'Stripe payout on gate pass — same day',
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

          {/* Left */}
          <div>
            <h2 className="text-[48px] font-black tracking-[-0.038em] text-white leading-[1.02] mb-6">
              Programmable escrow,
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-blue-500">
                not another dashboard.
              </span>
            </h2>

            <p className="text-[15px] text-white/54 leading-relaxed mb-9 max-w-[440px]">
              Vektrum places a programmable release gate between funder capital
              and contractor payouts. Every condition is enforced server-side —
              not in the UI, not in a PDF, not in someone's inbox.
            </p>

            <div className="space-y-3.5">
              {[
                'Conditions enforced in the database layer — cannot be bypassed via UI',
                'AI draw review with multi-provider fallback chain',
                'Hash-chained append-only audit log with tamper detection',
                'Native Stripe Connect payouts — no ACH delays',
                'DocuSign contract required before first milestone release',
                'Admin override requires AAL2 MFA + justification + audit trail',
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

          {/* Right — flow diagram */}
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
// SLIDE 4 — RELEASE GATE
// ─────────────────────────────────────────────────────────────────────────────

function ReleaseGateSlide() {
  const conditions = [
    { n: '01', label: 'Milestone approved',       desc: 'Funder has explicitly approved the milestone'             },
    { n: '02', label: 'Protection ready',          desc: 'protection_status = ready_for_release'                   },
    { n: '03', label: 'Sufficient funded balance', desc: 'Escrow holds enough capital to cover the release'        },
    { n: '04', label: 'Stripe payouts enabled',    desc: 'Contractor can receive Stripe Connect transfers'         },
    { n: '05', label: 'Onboarding complete',       desc: 'Contractor KYC / AML checks have passed'                },
    { n: '06', label: 'No existing release',       desc: 'Idempotency guard — prevents double-release'            },
    { n: '07', label: 'No open change orders',     desc: 'All change orders resolved before release can proceed'  },
    { n: '08', label: 'Signed contract',           desc: 'DocuSign envelope fully executed by all parties'        },
    { n: '09', label: 'Sequential ordering',       desc: 'Prior milestones cleared — prerequisites enforced'      },
    { n: '10', label: 'Approved lien waiver',      desc: 'Conditional lien waiver on file for this milestone'     },
  ]

  return (
    <div className="relative flex flex-col justify-center h-full px-20 py-14 overflow-hidden">
      <DotGrid opacity={0.15} />
      <Glow className="w-[500px] h-[500px] top-1/2 right-0 translate-x-1/3 -translate-y-1/2" />

      <div className="relative z-10 max-w-[980px] mx-auto w-full">
        <Eyebrow>The Release Gate</Eyebrow>

        <div className="grid grid-cols-[300px_1fr] gap-12 items-start">

          {/* Left */}
          <div>
            <h2 className="text-[44px] font-black tracking-[-0.038em] text-white leading-[1.02] mb-5">
              10 conditions.
              <br />
              <span className="text-white/38">Zero exceptions.</span>
            </h2>

            <p className="text-[13.5px] text-white/52 leading-relaxed mb-7">
              Every fund release passes all 10 checks atomically in a single
              server-side transaction. There is no UI path around this gate —
              it lives in the database layer, not the application layer.
            </p>

            {/* AI precondition */}
            <div className="rounded-xl border border-purple-500/22 bg-purple-500/[0.055] p-4.5 p-[18px]">
              <div className="flex items-center gap-2 mb-2.5">
                <Cpu size={12} className="text-purple-400" />
                <p className="text-[10px] font-black text-purple-400 uppercase tracking-[0.16em]">AI Precondition</p>
              </div>
              <p className="text-[12px] text-white/50 leading-relaxed">
                Runs <em className="text-white/70 not-italic font-semibold">before</em> the gate.
                Multi-provider chain:
                Perplexity sonar-pro → Anthropic claude-sonnet → OpenAI gpt-4o.
                Malformed responses default to{' '}
                <span className="text-red-400 font-bold">risk_level: critical</span> — gate blocked.
              </p>
            </div>

            {/* Integrity note */}
            <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
              <p className="text-[11px] text-white/40 leading-relaxed">
                All releases produce an append-only, hash-chained audit log entry.
                Modification triggers SQLSTATE 23001 at the DB level.
              </p>
            </div>
          </div>

          {/* Right — conditions grid */}
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
// SLIDE 5 — COMPETITIVE ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

function CompetitiveSlide() {
  type Mark = 'check' | 'cross' | 'half'
  interface Row { feature: string; vektrum: Mark; built: Mark; procore: Mark; banks: Mark; manual: Mark }

  const rows: Row[] = [
    { feature: 'Automated release gate',      vektrum: 'check', built: 'cross', procore: 'cross', banks: 'cross', manual: 'cross' },
    { feature: 'Server-side enforcement',     vektrum: 'check', built: 'cross', procore: 'cross', banks: 'cross', manual: 'cross' },
    { feature: 'AI-assisted draw review',     vektrum: 'check', built: 'cross', procore: 'cross', banks: 'cross', manual: 'cross' },
    { feature: 'Native Stripe payouts',       vektrum: 'check', built: 'half',  procore: 'cross', banks: 'cross', manual: 'cross' },
    { feature: 'Hash-chained audit log',      vektrum: 'check', built: 'cross', procore: 'half',  banks: 'cross', manual: 'cross' },
    { feature: 'Dispute resolution engine',   vektrum: 'check', built: 'half',  procore: 'half',  banks: 'cross', manual: 'cross' },
    { feature: 'DocuSign gate enforcement',   vektrum: 'check', built: 'cross', procore: 'half',  banks: 'cross', manual: 'cross' },
    { feature: 'Real-time ops monitoring',    vektrum: 'check', built: 'half',  procore: 'cross', banks: 'cross', manual: 'cross' },
  ]

  const cols: { key: keyof Row; label: string; highlight?: boolean }[] = [
    { key: 'vektrum', label: 'Vektrum',       highlight: true },
    { key: 'built',   label: 'Built Tech' },
    { key: 'procore', label: 'Procore' },
    { key: 'banks',   label: 'Banks' },
    { key: 'manual',  label: 'Manual' },
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
          <h2 className="text-[44px] font-black tracking-[-0.038em] text-white leading-[1.02]">
            The infrastructure gap
            <br />
            <span className="text-white/38">no one else has closed.</span>
          </h2>
          <p className="text-[12px] text-white/38 max-w-[260px] leading-relaxed text-right pb-1">
            Competitors offer dashboards and workflows. Vektrum is the only platform
            with server-side enforcement — the difference between a guardrail and a gate.
          </p>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-white/[0.07] overflow-hidden">
          {/* Header */}
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

          {/* Rows */}
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
                <p className="text-[13px] text-white/70">{row.feature}</p>
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

        {/* Legend */}
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
// SLIDE 6 — MARKET
// ─────────────────────────────────────────────────────────────────────────────

function MarketSlide() {
  const tiers = [
    {
      tier:    'TAM',
      value:   '$1.8T',
      desc:    'Annual US construction starts — all financed via draw-based loans',
      width:   'w-full',
      border:  'border-vektrum-blue/28',
      bg:      'bg-vektrum-blue/[0.12]',
      text:    'text-blue-300',
    },
    {
      tier:    'SAM',
      value:   '$420B',
      desc:    'Draw management in commercial + residential with digital tooling',
      width:   'w-3/4',
      border:  'border-blue-400/22',
      bg:      'bg-blue-400/[0.08]',
      text:    'text-blue-400',
    },
    {
      tier:    'SOM',
      value:   '$2.4B',
      desc:    '3-year target — mid-market lenders + high-volume contractors',
      width:   'w-[38%]',
      border:  'border-emerald-500/22',
      bg:      'bg-emerald-500/[0.08]',
      text:    'text-emerald-400',
    },
  ]

  const stats = [
    { value: '8.2%',  label: 'CAGR',         sub: 'Construction lending growth through 2030' },
    { value: '$13B',  label: 'Draw fraud',    sub: 'Estimated annual US loss in disbursement' },
    { value: '180K+', label: 'GCs',           sub: 'US general contractors in the SAM segment' },
    { value: '2,300+',label: 'Lenders',       sub: 'Community banks doing construction draws' },
  ]

  return (
    <div className="relative flex flex-col justify-center h-full px-20 py-16 overflow-hidden">
      <DotGrid opacity={0.15} />
      <Glow className="w-[540px] h-[360px] -top-28 left-1/2 -translate-x-1/2" />

      <div className="relative z-10 max-w-[980px] mx-auto w-full">
        <Eyebrow>Market Opportunity</Eyebrow>

        <div className="grid grid-cols-[1fr_270px] gap-14 items-center">

          {/* Left */}
          <div>
            <h2 className="text-[46px] font-black tracking-[-0.038em] text-white leading-[1.02] mb-5">
              $1.8T market.
              <br />
              <span className="text-white/38">Zero infrastructure.</span>
            </h2>
            <p className="text-[14px] text-white/50 leading-relaxed mb-11 max-w-[440px]">
              Construction lending is one of the largest and least-digitised credit
              markets in the US. The enforcement layer has seen zero investment —
              until now.
            </p>

            {/* TAM/SAM/SOM bars */}
            <div className="space-y-3.5">
              {tiers.map((t) => (
                <div key={t.tier} className="flex items-center gap-4">
                  <div className="w-11 flex-shrink-0">
                    <p className="text-[10px] font-black text-white/45 uppercase tracking-wider">{t.tier}</p>
                  </div>
                  <div className={cn('flex items-center h-11 rounded-xl border px-5 transition-all', t.bg, t.border, t.width)}>
                    <p className={cn('text-[16px] font-black tabular-nums', t.text)}>{t.value}</p>
                  </div>
                  <p className="text-[11px] text-white/38 leading-snug max-w-[190px]">{t.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right — stat cards */}
          <div className="space-y-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl border border-white/[0.07] bg-white/[0.022] px-5 py-4">
                <div className="flex items-baseline gap-2 mb-1">
                  <p className="text-[26px] font-black text-white tracking-tight tabular-nums">{s.value}</p>
                  <p className="text-[10px] font-bold text-white/38 uppercase tracking-wider">{s.label}</p>
                </div>
                <p className="text-[11px] text-white/38 leading-snug">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 7 — BUSINESS MODEL
// ─────────────────────────────────────────────────────────────────────────────

function BusinessModelSlide() {
  const streams = [
    {
      name:    'Transaction fee',
      model:   '15 – 25 bps per released draw',
      example: '$850K draw → $1,275 – $2,125 per release event',
      badge:   'Primary',
      border:  'border-vektrum-blue/22',
      bg:      'bg-vektrum-blue/[0.05]',
      badgeBg: 'bg-vektrum-blue/10 border-vektrum-blue/25 text-blue-300',
    },
    {
      name:    'Platform fee',
      model:   '$500 – $2,000 / month per lender',
      example: 'Seat-based ops dashboard + admin tooling + API access',
      badge:   'Recurring',
      border:  'border-blue-400/15',
      bg:      'bg-blue-400/[0.03]',
      badgeBg: 'bg-blue-400/10 border-blue-400/22 text-blue-300',
    },
    {
      name:    'Enterprise API',
      model:   'Custom contract, usage-based',
      example: 'White-label release gate for lender origination systems',
      badge:   'Expansion',
      border:  'border-purple-500/15',
      bg:      'bg-purple-500/[0.04]',
      badgeBg: 'bg-purple-500/10 border-purple-500/22 text-purple-400',
    },
  ]

  const unitEcon = [
    { label: 'Avg deal size',       value: '$850K',  em: false },
    { label: 'Avg draws / deal',    value: '10',     em: false },
    { label: 'Revenue / draw',      value: '~$170',  em: false },
    { label: 'Revenue / deal / yr', value: '~$1,700',em: true  },
    { label: 'Gross margin',        value: '~88%',   em: true  },
    { label: 'CAC (est.)',          value: '$2,800', em: false },
    { label: 'Payback period',      value: '~19 mo', em: false },
  ]

  const arr = [
    { yr: 'Y1', val: '$1.2M',  sub: '~700 deals' },
    { yr: 'Y2', val: '$4.8M',  sub: '~2,800 deals' },
    { yr: 'Y3', val: '$14M',   sub: '~8,200 deals' },
  ]

  return (
    <div className="relative flex flex-col justify-center h-full px-20 py-16 overflow-hidden">
      <DotGrid opacity={0.15} />
      <Glow className="w-[500px] h-[400px] bottom-0 right-0 translate-x-1/4 translate-y-1/4" />

      <div className="relative z-10 max-w-[980px] mx-auto w-full">
        <Eyebrow>Business Model</Eyebrow>

        <div className="grid grid-cols-[1fr_268px] gap-12 items-start">

          {/* Left */}
          <div>
            <h2 className="text-[46px] font-black tracking-[-0.038em] text-white leading-[1.02] mb-5">
              Take rate on
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-emerald-500">
                capital at rest.
              </span>
            </h2>

            <p className="text-[14px] text-white/50 leading-relaxed mb-9 max-w-[420px]">
              Revenue compounds with deal volume. As lenders run more draws through
              the gate, platform revenue scales with capital flow — not headcount.
            </p>

            <div className="space-y-3">
              {streams.map((s) => (
                <div key={s.name} className={cn('rounded-xl border p-5', s.border, s.bg)}>
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <p className="text-[14px] font-semibold text-white">{s.name}</p>
                    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border flex-shrink-0', s.badgeBg)}>
                      {s.badge}
                    </span>
                  </div>
                  <p className="text-[13px] text-white/68 mb-1">{s.model}</p>
                  <p className="text-[11px] text-white/38">{s.example}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right */}
          <div className="space-y-3">

            {/* Unit economics */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.022] overflow-hidden">
              <div className="px-5 py-3.5 border-b border-white/[0.06]">
                <p className="text-[10px] font-black text-white/38 uppercase tracking-wider">Unit Economics</p>
                <p className="text-[11px] text-white/28 mt-0.5">Per deal, annualised</p>
              </div>
              <div className="px-5 py-4 space-y-3">
                {unitEcon.map((row, i) => (
                  <div key={row.label} className={cn('flex items-center justify-between', i > 0 ? 'pt-3 border-t border-white/[0.04]' : '')}>
                    <p className="text-[12px] text-white/48">{row.label}</p>
                    <p className={cn('text-[13px] font-bold tabular-nums', row.em ? 'text-emerald-400' : 'text-white/75')}>
                      {row.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* ARR milestones */}
            <div className="rounded-xl border border-emerald-500/18 bg-emerald-500/[0.045] px-5 py-4">
              <p className="text-[10px] font-black text-emerald-400/65 uppercase tracking-wider mb-3.5">
                ARR Milestones
              </p>
              <div className="space-y-2.5">
                {arr.map((m) => (
                  <div key={m.yr} className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-white/28 w-5 flex-shrink-0">{m.yr}</span>
                    <p className="text-[16px] font-black text-emerald-400 tabular-nums w-16">{m.val}</p>
                    <p className="text-[11px] text-white/35">{m.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DECK SHELL + NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────

const SLIDES = [
  { id: 'hero',        label: 'Vektrum',         component: HeroSlide },
  { id: 'problem',     label: 'Problem',          component: ProblemSlide },
  { id: 'solution',    label: 'Solution',         component: SolutionSlide },
  { id: 'gate',        label: 'Release Gate',     component: ReleaseGateSlide },
  { id: 'competitive', label: 'Competitive',      component: CompetitiveSlide },
  { id: 'market',      label: 'Market',           component: MarketSlide },
  { id: 'model',       label: 'Business Model',   component: BusinessModelSlide },
] as const

export default function PitchPage() {
  const [current, setCurrent] = useState(0)

  const prev = useCallback(() => setCurrent((c) => Math.max(0, c - 1)), [])
  const next = useCallback(() => setCurrent((c) => Math.min(SLIDES.length - 1, c + 1)), [])

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (['ArrowRight', 'ArrowDown', ' '].includes(e.key)) { e.preventDefault(); next() }
      if (['ArrowLeft', 'ArrowUp'].includes(e.key))           { e.preventDefault(); prev() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev])

  return (
    <div className="relative bg-[#07091a] overflow-hidden" style={{ height: '100dvh' }}>

      {/* ── Progress bar ─────────────────────────────────────── */}
      <div className="fixed top-0 inset-x-0 z-50 h-[2px] bg-white/[0.04]" aria-hidden>
        <div
          className="h-full bg-gradient-to-r from-vektrum-blue to-blue-400 transition-all duration-500 ease-in-out"
          style={{ width: `${((current + 1) / SLIDES.length) * 100}%` }}
        />
      </div>

      {/* ── Wordmark ──────────────────────────────────────────── */}
      <div className="fixed top-5 left-7 z-50">
        <p className="text-[10px] font-black tracking-[0.22em] text-white/28 uppercase select-none">
          Vektrum
        </p>
      </div>

      {/* ── Slide label ───────────────────────────────────────── */}
      <div className="fixed top-5 right-7 z-50">
        <p className="text-[10px] text-white/22 uppercase tracking-[0.15em] font-medium select-none">
          {SLIDES[current].label}
        </p>
      </div>

      {/* ── Slides ────────────────────────────────────────────── */}
      <div className="relative h-full">
        {SLIDES.map(({ id, component: Slide }, i) => (
          <div
            key={id}
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

      {/* ── Bottom navigation ─────────────────────────────────── */}
      <div className="fixed bottom-7 inset-x-0 z-50 flex items-center justify-center gap-4 select-none">

        {/* Prev */}
        <button
          onClick={prev}
          disabled={current === 0}
          aria-label="Previous slide"
          className="w-8 h-8 rounded-full border border-white/[0.10] bg-white/[0.04] flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.09] hover:border-white/[0.18] disabled:opacity-20 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft size={14} />
        </button>

        {/* Dots */}
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

        {/* Next */}
        <button
          onClick={next}
          disabled={current === SLIDES.length - 1}
          aria-label="Next slide"
          className="w-8 h-8 rounded-full border border-white/[0.10] bg-white/[0.04] flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.09] hover:border-white/[0.18] disabled:opacity-20 disabled:cursor-not-allowed transition-all"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* ── Slide counter ─────────────────────────────────────── */}
      <div className="fixed bottom-7 right-7 z-50 select-none">
        <p className="text-[11px] font-mono text-white/25 tabular-nums">
          {String(current + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}
        </p>
      </div>
    </div>
  )
}
