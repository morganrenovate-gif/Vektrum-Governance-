'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircle2, ChevronDown, ChevronUp, Brain, FileText, Sparkles,
  Shield, List, Info, PenLine,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import {
  getFreshHarborDeal,
  harborSovLineItems,
  harborDrawBrief,
  harborContract,
  harborDraw3Evidence,
  harborDealAuditTimeline,
} from '@/lib/demo-data'
import type { DemoMilestoneStatus } from '@/lib/demo-data'
import { useDemoAutoReset } from '@/lib/demo-data/use-demo-auto-reset'
import { ReleaseFundsModal } from '@/components/demo/ReleaseFundsModal'
import { DrawRequestModal } from '@/components/demo/DrawRequestModal'

const STATUS_CONFIG: Record<DemoMilestoneStatus, { label: string; badge: string; border: string }> = {
  released:        { label: 'Released',         badge: 'bg-emerald-500/[0.12] text-emerald-400 border border-emerald-500/20',    border: 'border-l-4 border-emerald-500' },
  approved:        { label: 'Approved',          badge: 'bg-vektrum-blue/20 text-blue-300 border border-vektrum-blue/40',         border: 'border-l-4 border-vektrum-blue' },
  ready_for_review:{ label: 'Ready for Review',  badge: 'bg-amber-500/[0.12] text-amber-400 border border-amber-500/20',          border: 'border-l-4 border-amber-500' },
  in_progress:     { label: 'In Progress',       badge: 'bg-white/[0.06] text-white/50 border border-white/[0.08]',               border: 'border-l-4 border-white/20' },
  not_started:     { label: 'Not Started',       badge: 'bg-white/[0.04] text-white/65 border border-white/[0.06]',               border: 'border-l-4 border-white/[0.08]' },
  disputed:        { label: 'Disputed',          badge: 'bg-red-500/[0.12] text-red-400 border border-red-500/20',                border: 'border-l-4 border-red-500' },
}

// 10-condition release gate displayed in the Deal Control Center
const GATE_CONDITIONS = [
  'Milestone status approved',
  'Protection status ready for release',
  'Sufficient funding confirmed',
  'Payout readiness verified',
  'Contractor onboarding complete',
  'No active duplicate release',
  'No open change orders',
  'Signed contract on file',
  'Sequential prerequisites satisfied',
  'Approved conditional lien waiver on file',
]

// 5-step workflow spine — where Draw #3 sits in the full deal lifecycle
const WORKFLOW_STEPS = [
  { label: 'Contract Executed', done: true  },
  { label: 'SOV Approved',      done: true  },
  { label: 'Draw Linked',       done: true  },
  { label: 'Evidence Reviewed', done: true  },
  { label: 'Authorize Release', done: false, active: true },
]

export default function HarborDealPage() {
  const searchParams = useSearchParams()
  const from = searchParams.get('from')
  const backHref  = from === 'contractor' ? '/demo-live/contractor' : from === 'admin' ? '/demo-live/admin' : '/demo-live/funder'
  const backLabel = from === 'contractor' ? '← Back to contractor dashboard' : from === 'admin' ? '← Back to admin dashboard' : '← Back to funder dashboard'

  // Defensive: each component instance gets its own deep clone of the
  // canonical Harbor deal so any future mutation cannot leak across mounts.
  const deal = useMemo(() => getFreshHarborDeal(), [])

  const [overrides, setOverrides]         = useState<Record<string, DemoMilestoneStatus>>({})
  const [newlyReleased, setNewlyReleased] = useState<Set<string>>(new Set())
  const [expanded, setExpanded]           = useState<Record<string, boolean>>({})
  const [releaseModal, setReleaseModal]   = useState(false)
  const [submitModal, setSubmitModal]     = useState<{ id: string; name: string; amount: number } | null>(null)
  const [releaseEvents, setReleaseEvents] = useState<Array<{ text: string; date: string }>>([])

  useDemoAutoReset(() => {
    setOverrides({})
    setNewlyReleased(new Set())
    setExpanded({})
    setReleaseModal(false)
    setSubmitModal(null)
    setReleaseEvents([])
  })

  function getStatus(id: string, defaultStatus: DemoMilestoneStatus): DemoMilestoneStatus {
    return overrides[id] ?? defaultStatus
  }

  // Contractor "Submit for Review" target: the first in_progress milestone.
  const submittableMilestoneId = deal.milestones.find((m) => m.status === 'in_progress')?.id ?? null

  const totalReleased =
    deal.released +
    deal.milestones
      .filter((ms) => newlyReleased.has(ms.id))
      .reduce((sum, ms) => sum + ms.amount, 0)

  const pct = deal.total > 0 ? Math.round((totalReleased / deal.total) * 100) : 0

  // SOV map: milestone_id → sov description
  const sovByMilestone = new Map(
    harborSovLineItems
      .filter((s) => s.milestone_id !== null)
      .map((s) => [s.milestone_id!, s])
  )

  const ms3Released = newlyReleased.has('ms-hb-3') || overrides['ms-hb-3'] === 'released'

  return (
    <div className="min-h-screen bg-surface-0">
    <div className="page-container section space-y-8">
      <Link href={backHref} className="inline-flex items-center gap-1 text-[13px] text-white/55 hover:text-blue-300 transition-colors">
        {backLabel}
      </Link>

      {/* ── Current Draw Hero ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-vektrum-blue/30 bg-vektrum-blue/[0.05] px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-400/70 mb-2">Current Draw</p>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[15px] font-semibold text-white">
              Draw #3 · Structural Steel Erection · {formatCurrency(2_180_000)}
            </p>
            <p className="text-[12px] text-white/50 mt-1">
              {ms3Released
                ? 'Release authorized — funds sent to execution rail.'
                : 'All 10 release conditions verified — awaiting funder authorization.'}
            </p>
          </div>
          {!ms3Released && (
            <span className="flex-shrink-0 inline-flex items-center rounded-full bg-emerald-500/[0.12] border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
              Release Ready
            </span>
          )}
          {ms3Released && (
            <span className="flex-shrink-0 inline-flex items-center rounded-full bg-vektrum-blue/[0.12] border border-vektrum-blue/30 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-300">
              Authorized
            </span>
          )}
        </div>
      </div>

      {/* ── 5-Step Workflow Spine ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/[0.06] bg-surface-2 px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-white/35 mb-3">
          Deal Progress — Harbor Logistics Center
        </p>
        <div className="flex items-start">
          {WORKFLOW_STEPS.map((step, i, arr) => (
            <div key={step.label} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center flex-1 min-w-0">
                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                  ms3Released && step.active
                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                    : step.done
                    ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                    : step.active
                    ? 'bg-vektrum-blue/20 border-2 border-vektrum-blue text-blue-300'
                    : 'bg-white/[0.04] border border-white/20 text-white/30'
                }`}>
                  {(step.done || (ms3Released && step.active)) ? '✓' : i + 1}
                </div>
                <p className={`text-[10px] mt-1.5 text-center leading-tight px-1 ${
                  ms3Released && step.active ? 'text-emerald-400 font-medium' :
                  step.done ? 'text-white/45' :
                  step.active ? 'text-blue-300 font-semibold' :
                  'text-white/25'
                }`}>
                  {step.label}
                </p>
              </div>
              {i < arr.length - 1 && (
                <div className={`h-px w-4 flex-shrink-0 mx-0.5 -mt-4 ${
                  step.done ? 'bg-emerald-500/30' : 'bg-white/[0.06]'
                }`} aria-hidden="true" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="font-display text-2xl font-bold text-white">{deal.title}</h1>
            <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/[0.08] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
              ACTIVE
            </span>
          </div>
          <p className="text-sm text-white/55">
            {deal.contractor} &middot; {deal.funder} &middot; Started {deal.startedAgo}
          </p>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Total" value={formatCurrency(deal.total)} />
        <StatTile label="Funded" value={formatCurrency(deal.funded)} />
        <StatTile label="Released" value={formatCurrency(totalReleased)} green />
        <div className="rounded-lg border border-white/[0.08] bg-surface-2 px-5 py-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/75">Progress</p>
          <p className="mt-1.5 font-display text-xl font-bold tabular-nums text-white">{pct}%</p>
          <div className="mt-2 h-1.5 rounded-full bg-surface-3 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {/* ── Deal Control Center — funder / admin view only ─────────────────── */}
      {from !== 'contractor' && (
        <section className="rounded-xl border border-vektrum-blue/20 bg-vektrum-blue/[0.05] overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-5 py-3.5">
            <Shield size={14} className="text-blue-400 flex-shrink-0" aria-hidden="true" />
            <p className="text-[13px] font-semibold text-white">Deal Control Center</p>
            {!ms3Released && (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/[0.12] border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                Release Ready
              </span>
            )}
            {ms3Released && (
              <span className="ml-auto inline-flex items-center rounded-full bg-vektrum-blue/[0.12] border border-vektrum-blue/30 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-300">
                Authorized
              </span>
            )}
          </div>

          <div className="px-5 py-4 space-y-4">
            {/* Release Readiness — ms-hb-3 */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40 mb-3">
                Release Readiness — Structural Steel Erection · {formatCurrency(2_180_000)}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5">
                {GATE_CONDITIONS.map((condition, i) => (
                  <div key={i} className="flex items-center gap-2 text-[12px] text-white/65">
                    <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" aria-hidden="true" />
                    {condition}
                  </div>
                ))}
              </div>
            </div>

            {/* Perplexity Draw Control Brief */}
            <div className="rounded-lg border border-white/[0.08] bg-surface-3 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Brain size={13} className="text-blue-400 flex-shrink-0" aria-hidden="true" />
                <p className="text-[12px] font-semibold text-white">
                  {harborDrawBrief.generated_by} Draw Control Brief
                </p>
                <span className="ml-auto text-[11px] text-white/40">{harborDrawBrief.generated_at}</span>
              </div>
              <p className="text-[12px] text-white/55 leading-relaxed mb-3">
                {harborDrawBrief.summary}
              </p>
              <div className="space-y-1 mb-3">
                {harborDrawBrief.findings.map((f, i) => (
                  <p key={i} className="text-[11px] text-white/55 font-mono">{f}</p>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-vektrum-blue/[0.12] border border-vektrum-blue/30 px-2.5 py-1 text-[11px] font-semibold text-blue-300">
                  <Brain size={11} aria-hidden="true" />
                  Score {harborDrawBrief.ai_score}/100 · Risk: {harborDrawBrief.risk_level}
                </span>
                <span className="text-[11px] text-white/50 flex-1">{harborDrawBrief.recommendation}</span>
              </div>
            </div>

            {/* Contract & DocuSign status */}
            <div className="rounded-lg border border-white/[0.08] bg-surface-3 p-4">
              <div className="flex items-center gap-2 mb-3">
                <PenLine size={13} className="text-emerald-400 flex-shrink-0" aria-hidden="true" />
                <p className="text-[12px] font-semibold text-white">
                  Contract — {harborContract.document_name}
                </p>
                <span className="ml-auto text-[11px] text-emerald-400 font-medium">Fully Executed</span>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[11px]">
                <div>
                  <span className="text-white/40">Funder signed:</span>
                  <span className="text-white/65 ml-1.5">{harborContract.funder_signed_at}</span>
                </div>
                <div>
                  <span className="text-white/40">Contractor signed:</span>
                  <span className="text-white/65 ml-1.5">{harborContract.contractor_signed_at}</span>
                </div>
                <div>
                  <span className="text-white/40">DocuSign envelope:</span>
                  <span className="text-white/55 ml-1.5 font-mono">
                    {harborContract.docusign_envelope_id?.slice(0, 20)}…
                  </span>
                </div>
                <div>
                  <span className="text-white/40">Contract value:</span>
                  <span className="text-white/65 ml-1.5">{formatCurrency(harborContract.contract_value)}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Evidence Reviewed — Draw #3 ───────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/55">
          Evidence — Draw #3 · Structural Steel Erection
        </h2>
        <div className="space-y-2">
          {harborDraw3Evidence.map((doc) => {
            const typeLabel: Record<typeof doc.type, string> = {
              inspection_report: 'Inspection',
              lien_waiver:       'Lien Waiver',
              draw_request:      'Draw Request',
              photo:             'Photo',
            }
            return (
              <div key={doc.id} className="flex items-center gap-3 rounded-lg border border-white/[0.08] bg-surface-2 px-4 py-3">
                <FileText size={14} className="text-white/55 flex-shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-white/70 truncate">{doc.name}</p>
                  <p className="text-[11px] text-white/40 mt-0.5">Uploaded {doc.uploaded_at}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-white/50 bg-white/[0.05] border border-white/[0.08] rounded px-2 py-0.5">
                    {typeLabel[doc.type]}
                  </span>
                  <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" aria-hidden="true" />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Contractor guided workflow ──────────────────────────────────────── */}
      {from === 'contractor' && (
        <section className="rounded-xl border border-white/[0.08] bg-surface-2 overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-5 py-3.5">
            <List size={14} className="text-blue-400 flex-shrink-0" aria-hidden="true" />
            <p className="text-[13px] font-semibold text-white">Your Progress — Harbor Logistics Center</p>
          </div>
          <div className="px-5 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0">
              {[
                { step: 1, label: 'Contract',           done: true  },
                { step: 2, label: 'Schedule of Values', done: true  },
                { step: 3, label: 'Draw Request',       done: true  },
                { step: 4, label: 'Evidence Docs',      done: true  },
                { step: 5, label: 'AI Review',          done: false },
              ].map((s, i, arr) => (
                <div key={s.step} className="flex items-center gap-2 sm:gap-0 sm:flex-1">
                  <div className={`flex items-center gap-2 flex-1 sm:flex-col sm:items-center sm:gap-1 ${
                    !s.done ? 'text-blue-300' : 'text-white/50'
                  }`}>
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold ${
                      s.done
                        ? 'bg-emerald-500/[0.15] border border-emerald-500/30 text-emerald-400'
                        : 'bg-vektrum-blue/20 border border-vektrum-blue/40 text-blue-300'
                    }`}>
                      {s.done ? '✓' : s.step}
                    </div>
                    <span className="text-[11px] font-medium sm:text-center">{s.label}</span>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="hidden sm:block h-px flex-1 bg-white/[0.08] mx-1" aria-hidden="true" />
                  )}
                </div>
              ))}
            </div>
            <p className="mt-3 text-[12px] text-white/40">
              Next: Request AI review for <strong className="text-white/65">Building Envelope &amp; Roofing</strong> — upload supporting documents to proceed.
            </p>
          </div>
        </section>
      )}

      {/* Milestones */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/55">Milestones</h2>
        <div className="space-y-4">
          {deal.milestones.map((ms) => {
            const status  = getStatus(ms.id, ms.status)
            const cfg     = STATUS_CONFIG[status]
            const isExpanded = expanded[ms.id] ?? false
            const sovItem = sovByMilestone.get(ms.id)

            return (
              <div key={ms.id} className={`rounded-xl border border-white/[0.08] bg-surface-2 shadow-sm overflow-hidden ${cfg.border}`}>
                <div className="px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {status === 'released' && <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-white truncate">{ms.name}</p>
                      <p className="text-[12px] text-white/55 mt-0.5">
                        {formatCurrency(ms.amount)}
                        {sovItem && (
                          <span className="ml-2 text-[11px] text-blue-400/70">
                            · SOV linked
                          </span>
                        )}
                        {!sovItem && (ms.status === 'in_progress' || ms.status === 'not_started') && from !== 'contractor' && (
                          <span className="ml-2 text-[11px] text-amber-400/70">
                            · No SOV link
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {status === 'approved' && ms.aiScore && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-vektrum-blue/[0.12] border border-vektrum-blue/30 px-2 py-0.5 text-[11px] font-medium text-blue-300">
                        <Brain size={11} /> AI: {ms.aiScore}/100
                      </span>
                    )}

                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cfg.badge}`}>
                      {cfg.label}
                    </span>

                    {status === 'approved' && from !== 'contractor' && (
                      <button
                        type="button"
                        onClick={() => setReleaseModal(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        Release Funds
                      </button>
                    )}

                    {status === 'approved' && from === 'contractor' && (
                      <span className="bg-vektrum-blue/[0.08] text-blue-300 border border-vektrum-blue/20 cursor-not-allowed px-4 py-2 rounded-lg text-sm">
                        Awaiting Funder Release
                      </span>
                    )}

                    {status === 'in_progress' && from === 'contractor' && ms.id === submittableMilestoneId && (
                      <button
                        type="button"
                        onClick={() => setSubmitModal({ id: ms.id, name: ms.name, amount: ms.amount })}
                        className="inline-flex items-center gap-1.5 bg-vektrum-blue hover:bg-vektrum-blue-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        <Sparkles size={14} /> Submit for Review
                      </button>
                    )}

                    {status === 'in_progress' && !(from === 'contractor' && ms.id === submittableMilestoneId) && (
                      <span className="bg-white/[0.04] text-white/65 cursor-not-allowed px-4 py-2 rounded-lg text-sm">
                        In Progress
                      </span>
                    )}

                    {status === 'ready_for_review' && (
                      <span className="bg-amber-500/[0.08] text-amber-400 border border-amber-500/20 cursor-not-allowed px-4 py-2 rounded-lg text-sm">
                        {from === 'contractor' ? 'Submitted — Awaiting Funder Review' : 'Awaiting Your Review'}
                      </span>
                    )}

                    {(status === 'released' || status === 'approved') && (
                      <button
                        type="button"
                        onClick={() => setExpanded((prev) => ({ ...prev, [ms.id]: !isExpanded }))}
                        className="inline-flex items-center gap-1 text-[12px] text-white/75 hover:text-white/70 transition-colors"
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {isExpanded ? 'Hide' : 'Details'}
                      </button>
                    )}
                  </div>
                </div>

                <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[600px]' : 'max-h-0'}`}>
                  <div className="border-t border-white/[0.06] px-5 py-4 space-y-3">
                    {status === 'released' && ms.releasedAt && (
                      <p className="text-sm text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 size={14} /> Released {ms.releasedAt}
                      </p>
                    )}
                    {ms.documents.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-white/75 mb-1.5">Supporting Documents</p>
                        <ul className="space-y-1">
                          {ms.documents.map((doc, i) => (
                            <li key={i} className="text-sm text-white/55 flex items-center gap-1.5">
                              <FileText size={12} className="text-white/75" /> {doc}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {/* SOV link advisory for approved milestone */}
                    {sovItem && status === 'approved' && (
                      <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2 flex items-center gap-2">
                        <List size={12} className="text-blue-400 flex-shrink-0" aria-hidden="true" />
                        <span className="text-[12px] text-white/55">
                          SOV: {sovItem.description} — {formatCurrency(sovItem.total_amount)} allocated
                        </span>
                      </div>
                    )}
                    {/* Perplexity Draw Control Brief — ms-hb-3 only */}
                    {ms.id === 'ms-hb-3' && status === 'approved' && (
                      <div className="rounded-lg bg-vektrum-blue/[0.06] border border-vektrum-blue/20 p-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Brain size={13} className="text-blue-400 flex-shrink-0" aria-hidden="true" />
                          <p className="text-[12px] font-semibold text-white/80">
                            {harborDrawBrief.generated_by} Draw Control Brief
                          </p>
                          <span className="ml-auto inline-flex items-center rounded-full bg-vektrum-blue/[0.12] border border-vektrum-blue/30 px-2 py-0.5 text-[10px] font-semibold text-blue-300">
                            {harborDrawBrief.ai_score}/100 · {harborDrawBrief.risk_level} risk
                          </span>
                        </div>
                        <p className="text-[12px] text-white/55 leading-relaxed mb-2">{harborDrawBrief.summary}</p>
                        <div className="space-y-0.5">
                          {harborDrawBrief.findings.map((f, i) => (
                            <p key={i} className="text-[11px] text-white/50 font-mono">{f}</p>
                          ))}
                        </div>
                        <p className="mt-2 text-[11px] text-blue-300/80 italic">{harborDrawBrief.recommendation}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Schedule of Values ─────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/55">Schedule of Values</h2>
        <div className="rounded-xl border border-white/[0.08] bg-surface-2 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-white/40">Line Item</th>
                  <th className="text-right px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-white/40">Contract Value</th>
                  <th className="text-right px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-white/40">Drawn</th>
                  <th className="text-right px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-white/40">Remaining</th>
                  <th className="text-center px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-white/40">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {harborSovLineItems.map((item) => {
                  const remaining = item.total_amount - item.drawn_amount
                  const isUnlinked = item.milestone_id === null
                  return (
                    <tr key={item.id} className={isUnlinked ? 'bg-amber-500/[0.02]' : ''}>
                      <td className="px-4 py-3 text-white/65 flex items-center gap-1.5">
                        {item.description}
                        {isUnlinked && (
                          <span title="Not linked to a milestone" className="text-amber-400/70">
                            <Info size={11} aria-label="No milestone link" />
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-white/55 tabular-nums">{formatCurrency(item.total_amount)}</td>
                      <td className="px-4 py-3 text-right text-emerald-400 tabular-nums">{formatCurrency(item.drawn_amount)}</td>
                      <td className="px-4 py-3 text-right text-white/55 tabular-nums">{formatCurrency(remaining)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          item.status === 'complete'  ? 'bg-emerald-500/[0.10] text-emerald-400 border border-emerald-500/20' :
                          item.status === 'approved'  ? 'bg-vektrum-blue/[0.12] text-blue-300 border border-vektrum-blue/30' :
                          'bg-white/[0.04] text-white/40 border border-white/[0.06]'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/[0.08]">
                  <td className="px-4 py-3 text-[11px] font-semibold text-white/50">Total</td>
                  <td className="px-4 py-3 text-right text-[11px] font-semibold text-white/65 tabular-nums">
                    {formatCurrency(harborSovLineItems.reduce((s, i) => s + i.total_amount, 0))}
                  </td>
                  <td className="px-4 py-3 text-right text-[11px] font-semibold text-emerald-400 tabular-nums">
                    {formatCurrency(harborSovLineItems.reduce((s, i) => s + i.drawn_amount, 0))}
                  </td>
                  <td className="px-4 py-3 text-right text-[11px] font-semibold text-white/55 tabular-nums">
                    {formatCurrency(harborSovLineItems.reduce((s, i) => s + (i.total_amount - i.drawn_amount), 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          {harborSovLineItems.some((i) => i.milestone_id === null) && (
            <div className="px-4 py-2.5 border-t border-white/[0.06] flex items-center gap-1.5">
              <Info size={11} className="text-amber-400/70 flex-shrink-0" aria-hidden="true" />
              <p className="text-[11px] text-white/40">
                One or more SOV line items are not linked to a milestone. Link them in the Milestones panel to enable draw-control tracking.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── Release Authorization CTA — funder / admin view ──────────────────── */}
      {from !== 'contractor' && !ms3Released && (
        <section className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] overflow-hidden">
          <div className="px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-400/70 mb-1">
                Authorize Release
              </p>
              <p className="text-[14px] font-semibold text-white">
                Structural Steel Erection — {formatCurrency(2_180_000)}
              </p>
              <p className="text-[12px] text-white/50 mt-0.5">
                10/10 conditions verified · Perplexity score 91/100 · AI Draw Review complete
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReleaseModal(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 text-[13px] font-semibold text-white transition-colors"
            >
              <CheckCircle2 size={14} aria-hidden="true" />
              Authorize Release
            </button>
          </div>
        </section>
      )}

      {/* Documents */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/55">Documents</h2>
        <div className="space-y-2">
          {[
            { name: 'Deal Agreement — Harbor_Logistics_Agreement.pdf', date: 'Signed October 25, 2025' },
            { name: 'Insurance Certificate — Insurance_Cert_WebbConstruction.pdf', date: 'October 25, 2025' },
            { name: 'Project Schedule — Harbor_Master_Schedule_v3.pdf', date: 'October 30, 2025' },
          ].map((doc, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-white/[0.08] bg-surface-3 px-4 py-3">
              <FileText size={16} className="text-white/75 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/55 truncate">{doc.name}</p>
                <p className="text-xs text-white/75">{doc.date}</p>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-white/75 bg-white/[0.06] rounded px-2 py-0.5">PDF</span>
            </div>
          ))}
        </div>
      </section>

      {/* Activity Timeline — driven by harborDealAuditTimeline */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/55">Activity</h2>
        <div className="space-y-3">
          {[
            ...harborDealAuditTimeline.map((event) => ({
              text: event.detail ?? event.action,
              date: event.timestamp,
            })),
            ...releaseEvents,
          ].map((event, i) => (
            <div key={i} className="flex items-start gap-3 text-sm">
              <div className="mt-1.5 h-2 w-2 rounded-full bg-vektrum-blue flex-shrink-0" />
              <div>
                <p className="text-white/55">{event.text}</p>
                <p className="text-xs text-white/75">{event.date}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Non-custody disclaimer */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 flex items-start gap-3">
        <Info size={14} className="text-white/30 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-[12px] text-white/35 leading-relaxed">
          Vektrum authorizes release — it does not hold funds or act as escrow. Payment execution is handled by your selected rail: Stripe Connect or your institutional partner process. Funds remain in custody of your payment provider until release is authorized and the execution rail confirms.
        </p>
      </div>

      {/* Modals */}
      <ReleaseFundsModal
        open={releaseModal}
        milestone={{ name: 'Structural Steel Erection', amount: 2_180_000 }}
        onConfirm={() => {
          setOverrides((prev) => ({ ...prev, 'ms-hb-3': 'released' }))
          setNewlyReleased((prev) => new Set([...prev, 'ms-hb-3']))
          setReleaseEvents((prev) => [
            ...prev,
            {
              text: 'Release authorized — Structural Steel Erection — $2,180,000 — funder authorized release; audit evidence recorded.',
              date: 'Just now',
            },
          ])
        }}
        onClose={() => setReleaseModal(false)}
      />

      <DrawRequestModal
        open={submitModal !== null}
        milestone={submitModal ?? { id: '', name: '', amount: 0 }}
        onConfirm={() => {
          if (submitModal) {
            setOverrides((prev) => ({ ...prev, [submitModal.id]: 'ready_for_review' }))
            setReleaseEvents((prev) => [
              ...prev,
              {
                text: `Draw submitted for review — ${submitModal.name} — contractor submitted draw package; audit evidence recorded.`,
                date: 'Just now',
              },
            ])
          }
          setSubmitModal(null)
        }}
        onClose={() => setSubmitModal(null)}
      />
    </div>
    </div>
  )
}

function StatTile({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-surface-2 px-5 py-5 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/75">{label}</p>
      <p className={`mt-1.5 font-display text-xl font-bold tabular-nums ${green ? 'text-emerald-400' : 'text-white'}`}>{value}</p>
    </div>
  )
}
