'use client'

import { useState } from 'react'
import { CheckCircle2, Clock, Brain, Shield, AlertCircle, Lock, ChevronDown, ChevronUp } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface Milestone {
  title: string
  amount: number
  status: 'released' | 'approved' | 'ready_for_review' | 'in_progress' | 'not_started' | 'disputed'
  releasedAgo?: string
  aiScore?: number
  riskLevel?: string
  findings?: string[]
  disputedLineItem?: string
  disputeReason?: string
  fundsReleased?: number
  fundsHeld?: number
}

interface Props {
  milestones: Milestone[]
  releaseGateConditions: string[]
  dealTotal: number
  dealReleased: number
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

// ── Component ────────────────────────────────────────────────────────────────

export function DemoMilestoneList({ milestones, releaseGateConditions, dealTotal, dealReleased }: Props) {
  return (
    <div className="space-y-4">
      {milestones.map((ms, i) => (
        <DemoMilestoneCard
          key={i}
          milestone={ms}
          index={i + 1}
          releaseGateConditions={releaseGateConditions}
          dealTotal={dealTotal}
          dealReleased={dealReleased}
        />
      ))}
    </div>
  )
}

// ── Milestone Card ───────────────────────────────────────────────────────────

function DemoMilestoneCard({
  milestone: ms,
  index,
  releaseGateConditions,
  dealTotal,
  dealReleased,
}: {
  milestone: Milestone
  index: number
  releaseGateConditions: string[]
  dealTotal: number
  dealReleased: number
}) {
  // Released milestones start collapsed; disputed and all other statuses start expanded
  const [expanded, setExpanded] = useState(ms.status !== 'released')

  const statusConfig = {
    released: { label: 'Released', color: 'text-emerald-400', bg: 'bg-emerald-500/[0.08] border-emerald-500/20', border: 'border-l-vektrum-green' },
    approved: { label: 'Approved', color: 'text-vektrum-blue', bg: 'bg-vektrum-blue/10 border-vektrum-blue/20', border: '' },
    ready_for_review: { label: 'Ready for Review', color: 'text-amber-400', bg: 'bg-amber-500/[0.08] border-amber-500/20', border: '' },
    in_progress: { label: 'In Progress', color: 'text-white/55', bg: 'bg-surface-3 border-white/[0.08]', border: '' },
    not_started: { label: 'Not Started', color: 'text-white/30', bg: 'bg-surface-3 border-white/[0.08]', border: '' },
    disputed: { label: 'Disputed', color: 'text-red-400', bg: 'bg-red-500/[0.08] border-red-500/20', border: 'border-l-vektrum-red' },
  }

  const cfg = statusConfig[ms.status]

  // ── Released milestone: collapsed row ──
  if (ms.status === 'released' && !expanded) {
    return (
      <div className={`rounded-xl border border-white/[0.08] bg-surface-2 shadow-sm overflow-hidden border-l-4 ${cfg.border}`}>
        <div className="px-5 py-4 flex items-center gap-3">
          <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" aria-hidden="true" />
          <span className="text-[14px] font-semibold text-white flex-1 min-w-0 truncate">{ms.title}</span>
          <span className="text-[13px] font-semibold text-white tabular-nums flex-shrink-0">{fmt(ms.amount)}</span>
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${cfg.bg} ${cfg.color} flex-shrink-0`}>
            {cfg.label}
          </span>
          <span className="text-[12px] text-white/55 flex-shrink-0 hidden sm:inline">Released {ms.releasedAgo}</span>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline-flex items-center gap-1 text-[12px] text-vektrum-blue hover:text-vektrum-blue-hover transition-colors flex-shrink-0"
          >
            <ChevronDown size={14} aria-hidden="true" />
            Details
          </button>
        </div>
      </div>
    )
  }

  // ── Disputed milestone: always expanded with red styling ──
  if (ms.status === 'disputed') {
    const releasedPct = dealTotal > 0 ? Math.round((dealReleased / dealTotal) * 100) : 0
    return (
      <div className={`rounded-xl border border-white/[0.08] bg-surface-2 shadow-sm overflow-hidden border-l-4 ${cfg.border}`}>
        {/* Dispute banner */}
        <div className="bg-red-500/[0.08] border-b border-red-500/20 px-5 py-4">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
            <div>
              <p className="text-[14px] font-semibold text-red-400">Dispute Active &mdash; Priority 1</p>
              <p className="mt-1 text-[13px] text-red-400">{ms.disputedLineItem}</p>
              <p className="mt-1 text-[12px] text-white/55 leading-relaxed">{ms.disputeReason}</p>
            </div>
          </div>
        </div>

        {/* Header row */}
        <div className="px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500/[0.08] text-[12px] font-bold text-red-400">
              {index}
            </span>
            <div>
              <p className="text-[14px] font-semibold text-white">{ms.title}</p>
              <p className="text-[12px] text-white/55 mt-0.5">{fmt(ms.amount)}</p>
            </div>
          </div>
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${cfg.bg} ${cfg.color}`}>
            {cfg.label}
          </span>
        </div>

        {/* Fund split chips */}
        <div className="px-5 pb-4 flex flex-wrap gap-3">
          {ms.fundsReleased != null && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.08] px-4 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Released</p>
              <p className="text-[14px] font-bold tabular-nums text-emerald-400">{fmt(ms.fundsReleased)}</p>
            </div>
          )}
          {ms.fundsHeld != null && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/[0.08] px-4 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Held &mdash; Under Dispute</p>
              <p className="text-[14px] font-bold tabular-nums text-red-400">{fmt(ms.fundsHeld)}</p>
            </div>
          )}
        </div>

        {/* AI findings */}
        {ms.findings && ms.findings.length > 0 && (
          <div className="px-5 pb-4">
            <div className="rounded-lg border border-white/[0.08] bg-surface-3 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Brain size={14} className="text-red-400" aria-hidden="true" />
                <span className="text-[13px] font-semibold text-white">AI Draw Review Findings</span>
                {ms.aiScore != null && (
                  <span className="text-[12px] font-bold text-red-400 tabular-nums ml-auto">Score: {ms.aiScore}/100</span>
                )}
              </div>
              <ul className="space-y-1.5">
                {ms.findings.map((f, i) => (
                  <li key={i} className={`text-[12px] ${f.startsWith('\u26a0') ? 'text-red-400' : 'text-emerald-400'}`}>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Summary note */}
        <div className="border-t border-white/[0.05] px-5 py-3 text-[12px] text-white/55">
          All other milestones have been released. {fmt(dealReleased)} ({releasedPct}%) of total funds disbursed.
        </div>
      </div>
    )
  }

  // ── Expanded view for all statuses (including released when toggled open) ──
  return (
    <div className={`rounded-xl border border-white/[0.08] bg-surface-2 shadow-sm overflow-hidden ${cfg.border ? `border-l-4 ${cfg.border}` : ''}`}>
      <div className="px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-3 text-[12px] font-bold text-white/55">
            {index}
          </span>
          <div>
            <p className="text-[14px] font-semibold text-white">{ms.title}</p>
            <p className="text-[12px] text-white/55 mt-0.5">{fmt(ms.amount)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${cfg.bg} ${cfg.color}`}>
            {cfg.label}
          </span>
          {ms.status === 'released' && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="inline-flex items-center gap-1 text-[12px] text-vektrum-blue hover:text-vektrum-blue-hover transition-colors"
            >
              <ChevronUp size={14} aria-hidden="true" />
              Hide
            </button>
          )}
        </div>
      </div>

      {/* Released state */}
      {ms.status === 'released' && (
        <div className="border-t border-white/[0.05] px-5 py-3 flex items-center gap-2 text-[13px] text-emerald-400">
          <CheckCircle2 size={14} aria-hidden="true" />
          Released &mdash; {ms.releasedAgo}
        </div>
      )}

      {/* Approved state — show AI review */}
      {ms.status === 'approved' && ms.aiScore && (
        <div className="border-t border-white/[0.05]">
          <div className="px-5 py-4 space-y-3">
            {/* AI Review Panel */}
            <div className="rounded-lg border border-vektrum-blue/20 bg-vektrum-blue/10 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Brain size={14} className="text-vektrum-blue" aria-hidden="true" />
                <span className="text-[13px] font-semibold text-vektrum-blue">AI Draw Review</span>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Score</p>
                  <p className="text-xl font-bold text-vektrum-blue tabular-nums">{ms.aiScore}/100</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Risk</p>
                  <p className="text-[14px] font-semibold text-emerald-400">{ms.riskLevel}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Recommendation</p>
                  <p className="text-[14px] font-semibold text-emerald-400">Approve</p>
                </div>
              </div>
              <ul className="space-y-1.5">
                {ms.findings?.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-[12px] text-vektrum-blue">
                    <CheckCircle2 size={12} aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Approve button (demo — disabled) */}
            <button
              type="button"
              disabled
              className="w-full rounded-lg bg-vektrum-blue/40 px-4 py-2.5 text-[13px] font-medium text-white/50 cursor-not-allowed"
              title="Demo mode — approval requires funder login"
            >
              Approve Draw
            </button>

            {/* Release button (disabled) */}
            <button
              type="button"
              disabled
              className="w-full rounded-lg border border-white/[0.08] bg-surface-2 px-4 py-2.5 text-[13px] font-medium text-white/55 opacity-60 cursor-not-allowed"
              title="Demo mode — no real releases"
            >
              <Lock size={12} className="inline mr-1.5" aria-hidden="true" />
              Release Funds (Demo)
            </button>

            {/* 8-condition gate checklist */}
            <div className="rounded-lg border border-white/[0.08] bg-surface-2 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield size={14} className="text-vektrum-blue" aria-hidden="true" />
                <span className="text-[12px] font-semibold text-white">8-Condition Release Gate</span>
              </div>
              <ul className="space-y-2">
                {releaseGateConditions.map((c, i) => (
                  <li key={i} className="flex items-center gap-2 text-[12px] text-emerald-400">
                    <CheckCircle2 size={12} className="flex-shrink-0" aria-hidden="true" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Ready for review state */}
      {ms.status === 'ready_for_review' && (
        <div className="border-t border-white/[0.05] px-5 py-3 flex items-center gap-2 text-[13px] text-amber-400">
          <AlertCircle size={14} aria-hidden="true" />
          AI Review Requested &mdash; pending analysis
        </div>
      )}

      {/* In progress state */}
      {ms.status === 'in_progress' && (
        <div className="border-t border-white/[0.05] px-5 py-3 flex items-center gap-2 text-[13px] text-white/55">
          <Clock size={14} aria-hidden="true" />
          Work in progress
        </div>
      )}
    </div>
  )
}
