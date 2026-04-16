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
    released: { label: 'Released', color: 'text-vektrum-green', bg: 'bg-vektrum-green-bg border-vektrum-green-border', border: 'border-l-vektrum-green' },
    approved: { label: 'Approved', color: 'text-vektrum-blue', bg: 'bg-vektrum-blue-subtle border-vektrum-blue-border', border: '' },
    ready_for_review: { label: 'Ready for Review', color: 'text-vektrum-amber', bg: 'bg-vektrum-amber-bg border-vektrum-amber-border', border: '' },
    in_progress: { label: 'In Progress', color: 'text-vektrum-muted', bg: 'bg-vektrum-surface-alt border-vektrum-border', border: '' },
    not_started: { label: 'Not Started', color: 'text-vektrum-faint', bg: 'bg-vektrum-surface-alt border-vektrum-border', border: '' },
    disputed: { label: 'Disputed', color: 'text-vektrum-red', bg: 'bg-vektrum-red-bg border-vektrum-red-border', border: 'border-l-vektrum-red' },
  }

  const cfg = statusConfig[ms.status]

  // ── Released milestone: collapsed row ──
  if (ms.status === 'released' && !expanded) {
    return (
      <div className={`rounded-xl border border-vektrum-border bg-vektrum-surface shadow-sm overflow-hidden border-l-4 ${cfg.border}`}>
        <div className="px-5 py-4 flex items-center gap-3">
          <CheckCircle2 size={16} className="text-vektrum-green flex-shrink-0" aria-hidden="true" />
          <span className="text-[14px] font-semibold text-vektrum-text flex-1 min-w-0 truncate">{ms.title}</span>
          <span className="text-[13px] font-semibold text-vektrum-text tabular-nums flex-shrink-0">{fmt(ms.amount)}</span>
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${cfg.bg} ${cfg.color} flex-shrink-0`}>
            {cfg.label}
          </span>
          <span className="text-[12px] text-vektrum-muted flex-shrink-0 hidden sm:inline">Released {ms.releasedAgo}</span>
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
      <div className={`rounded-xl border border-vektrum-border bg-vektrum-surface shadow-sm overflow-hidden border-l-4 ${cfg.border}`}>
        {/* Dispute banner */}
        <div className="bg-vektrum-red-bg border-b border-vektrum-red-border px-5 py-4">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-vektrum-red mt-0.5 flex-shrink-0" aria-hidden="true" />
            <div>
              <p className="text-[14px] font-semibold text-vektrum-red">Dispute Active &mdash; Priority 1</p>
              <p className="mt-1 text-[13px] text-vektrum-red">{ms.disputedLineItem}</p>
              <p className="mt-1 text-[12px] text-vektrum-muted leading-relaxed">{ms.disputeReason}</p>
            </div>
          </div>
        </div>

        {/* Header row */}
        <div className="px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-vektrum-red-bg text-[12px] font-bold text-vektrum-red">
              {index}
            </span>
            <div>
              <p className="text-[14px] font-semibold text-vektrum-text">{ms.title}</p>
              <p className="text-[12px] text-vektrum-muted mt-0.5">{fmt(ms.amount)}</p>
            </div>
          </div>
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${cfg.bg} ${cfg.color}`}>
            {cfg.label}
          </span>
        </div>

        {/* Fund split chips */}
        <div className="px-5 pb-4 flex flex-wrap gap-3">
          {ms.fundsReleased != null && (
            <div className="rounded-lg border border-vektrum-green-border bg-vektrum-green-bg px-4 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">Released</p>
              <p className="text-[14px] font-bold tabular-nums text-vektrum-green">{fmt(ms.fundsReleased)}</p>
            </div>
          )}
          {ms.fundsHeld != null && (
            <div className="rounded-lg border border-vektrum-red-border bg-vektrum-red-bg px-4 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">Held &mdash; Under Dispute</p>
              <p className="text-[14px] font-bold tabular-nums text-vektrum-red">{fmt(ms.fundsHeld)}</p>
            </div>
          )}
        </div>

        {/* AI findings */}
        {ms.findings && ms.findings.length > 0 && (
          <div className="px-5 pb-4">
            <div className="rounded-lg border border-vektrum-border bg-vektrum-surface-alt p-4">
              <div className="flex items-center gap-2 mb-3">
                <Brain size={14} className="text-vektrum-red" aria-hidden="true" />
                <span className="text-[13px] font-semibold text-vektrum-text">AI Draw Review Findings</span>
                {ms.aiScore != null && (
                  <span className="text-[12px] font-bold text-vektrum-red tabular-nums ml-auto">Score: {ms.aiScore}/100</span>
                )}
              </div>
              <ul className="space-y-1.5">
                {ms.findings.map((f, i) => (
                  <li key={i} className={`text-[12px] ${f.startsWith('\u26a0') ? 'text-vektrum-red' : 'text-vektrum-green'}`}>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Summary note */}
        <div className="border-t border-vektrum-border-subtle px-5 py-3 text-[12px] text-vektrum-muted">
          All other milestones have been released. {fmt(dealReleased)} ({releasedPct}%) of total funds disbursed.
        </div>
      </div>
    )
  }

  // ── Expanded view for all statuses (including released when toggled open) ──
  return (
    <div className={`rounded-xl border border-vektrum-border bg-vektrum-surface shadow-sm overflow-hidden ${cfg.border ? `border-l-4 ${cfg.border}` : ''}`}>
      <div className="px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-vektrum-surface-alt text-[12px] font-bold text-vektrum-muted">
            {index}
          </span>
          <div>
            <p className="text-[14px] font-semibold text-vektrum-text">{ms.title}</p>
            <p className="text-[12px] text-vektrum-muted mt-0.5">{fmt(ms.amount)}</p>
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
        <div className="border-t border-vektrum-border-subtle px-5 py-3 flex items-center gap-2 text-[13px] text-vektrum-green">
          <CheckCircle2 size={14} aria-hidden="true" />
          Released &mdash; {ms.releasedAgo}
        </div>
      )}

      {/* Approved state — show AI review */}
      {ms.status === 'approved' && ms.aiScore && (
        <div className="border-t border-vektrum-border-subtle">
          <div className="px-5 py-4 space-y-3">
            {/* AI Review Panel */}
            <div className="rounded-lg border border-vektrum-blue-border bg-vektrum-blue-subtle p-4">
              <div className="flex items-center gap-2 mb-3">
                <Brain size={14} className="text-vektrum-blue" aria-hidden="true" />
                <span className="text-[13px] font-semibold text-vektrum-blue">AI Draw Review</span>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">Score</p>
                  <p className="text-xl font-bold text-vektrum-blue tabular-nums">{ms.aiScore}/100</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">Risk</p>
                  <p className="text-[14px] font-semibold text-vektrum-green">{ms.riskLevel}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">Recommendation</p>
                  <p className="text-[14px] font-semibold text-vektrum-green">Approve</p>
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

            {/* Approve button (non-functional) */}
            <button
              type="button"
              className="w-full rounded-lg bg-vektrum-blue px-4 py-2.5 text-[13px] font-medium text-white cursor-default"
              title="Demo mode — approval simulated"
            >
              Approve Draw
            </button>

            {/* Release button (disabled) */}
            <button
              type="button"
              disabled
              className="w-full rounded-lg border border-vektrum-border bg-vektrum-surface px-4 py-2.5 text-[13px] font-medium text-vektrum-muted opacity-60 cursor-not-allowed"
              title="Demo mode — no real releases"
            >
              <Lock size={12} className="inline mr-1.5" aria-hidden="true" />
              Release Funds (Demo)
            </button>

            {/* 7-condition gate checklist */}
            <div className="rounded-lg border border-vektrum-border bg-vektrum-surface p-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield size={14} className="text-vektrum-blue" aria-hidden="true" />
                <span className="text-[12px] font-semibold text-vektrum-text">7-Condition Release Gate</span>
              </div>
              <ul className="space-y-2">
                {releaseGateConditions.map((c, i) => (
                  <li key={i} className="flex items-center gap-2 text-[12px] text-vektrum-green">
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
        <div className="border-t border-vektrum-border-subtle px-5 py-3 flex items-center gap-2 text-[13px] text-vektrum-amber">
          <AlertCircle size={14} aria-hidden="true" />
          AI Review Requested &mdash; pending analysis
        </div>
      )}

      {/* In progress state */}
      {ms.status === 'in_progress' && (
        <div className="border-t border-vektrum-border-subtle px-5 py-3 flex items-center gap-2 text-[13px] text-vektrum-muted">
          <Clock size={14} aria-hidden="true" />
          Work in progress
        </div>
      )}
    </div>
  )
}
