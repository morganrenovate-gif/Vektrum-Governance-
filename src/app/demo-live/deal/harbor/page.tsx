'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, ChevronDown, ChevronUp, Brain, FileText, Sparkles } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import { getFreshHarborDeal } from '@/lib/demo-data'
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

export default function HarborDealPage() {
  const searchParams = useSearchParams()
  const from = searchParams.get('from')
  const backHref = from === 'contractor' ? '/demo-live/contractor' : from === 'admin' ? '/demo-live/admin' : '/demo-live/funder'
  const backLabel = from === 'contractor' ? '← Back to contractor dashboard' : from === 'admin' ? '← Back to admin dashboard' : '← Back to funder dashboard'

  // Defensive: each component instance gets its own deep clone of the
  // canonical Harbor deal so any future mutation cannot leak across mounts
  // or back into the shared canonical export. Empty dep array — clones once
  // per mount.
  const deal = useMemo(() => getFreshHarborDeal(), [])

  const [overrides, setOverrides] = useState<Record<string, DemoMilestoneStatus>>({})
  const [newlyReleased, setNewlyReleased] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [releaseModal, setReleaseModal] = useState(false)
  // Submit-for-Review modal — null when closed, otherwise the milestone the
  // contractor is submitting. Contractor-only flow.
  const [submitModal, setSubmitModal] = useState<{ id: string; name: string; amount: number } | null>(null)
  // Activity events appended in this session by demo actions (release
  // authorization, contractor submission). Rendered alongside the canonical
  // static activity entries below. Frontend-only state — no API/DB calls.
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

  // Contractor "Submit for Review" target: the first in_progress milestone in
  // canonical order. Only this milestone is contractor-submittable in the demo
  // — later in_progress milestones are too early in the sequence. Computed
  // from canonical data (not from overrides) so the target stays pinned even
  // after the contractor submits and the milestone moves to ready_for_review.
  const submittableMilestoneId = deal.milestones.find((m) => m.status === 'in_progress')?.id ?? null

  // Recompute released total whenever user releases a milestone in this session
  const totalReleased =
    deal.released +
    deal.milestones
      .filter((ms) => newlyReleased.has(ms.id))
      .reduce((sum, ms) => sum + ms.amount, 0)

  const pct = deal.total > 0 ? Math.round((totalReleased / deal.total) * 100) : 0

  return (
    <div className="min-h-screen bg-surface-0">
    <div className="page-container section space-y-8">
      <Link href={backHref} className="inline-flex items-center gap-1 text-[13px] text-white/55 hover:text-blue-300 transition-colors">
        {backLabel}
      </Link>

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

      {/* Milestones */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/55">Milestones</h2>
        <div className="space-y-4">
          {deal.milestones.map((ms) => {
            const status = getStatus(ms.id, ms.status)
            const cfg = STATUS_CONFIG[status]
            const isExpanded = expanded[ms.id] ?? false

            return (
              <div key={ms.id} className={`rounded-xl border border-white/[0.08] bg-surface-2 shadow-sm overflow-hidden ${cfg.border}`}>
                <div className="px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {status === 'released' && <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-white truncate">{ms.name}</p>
                      <p className="text-[12px] text-white/55 mt-0.5">{formatCurrency(ms.amount)}</p>
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

                    {/* Contractor: submit the next in_progress milestone for review. */}
                    {status === 'in_progress' && from === 'contractor' && ms.id === submittableMilestoneId && (
                      <button
                        type="button"
                        onClick={() => setSubmitModal({ id: ms.id, name: ms.name, amount: ms.amount })}
                        className="inline-flex items-center gap-1.5 bg-vektrum-blue hover:bg-vektrum-blue-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        <Sparkles size={14} /> Submit for Review
                      </button>
                    )}

                    {/* All other in_progress cases: read-only pill */}
                    {status === 'in_progress' && !(from === 'contractor' && ms.id === submittableMilestoneId) && (
                      <span className="bg-white/[0.04] text-white/65 cursor-not-allowed px-4 py-2 rounded-lg text-sm">
                        In Progress
                      </span>
                    )}

                    {/* Submitted by contractor — pending funder review (any viewer). */}
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

                <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-96' : 'max-h-0'}`}>
                  <div className="border-t border-white/[0.06] px-5 py-4 space-y-3">
                    {status === 'released' && ms.releasedAt && (
                      <p className="text-sm text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 size={14} /> Released {ms.releasedAt}
                      </p>
                    )}
                    {ms.documents.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-white/75 mb-1.5">Documents</p>
                        <ul className="space-y-1">
                          {ms.documents.map((doc, i) => (
                            <li key={i} className="text-sm text-white/55 flex items-center gap-1.5">
                              <FileText size={12} className="text-white/75" /> {doc}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {status === 'approved' && ms.aiScore && (
                      <div className="rounded-lg bg-vektrum-blue/[0.08] border border-vektrum-blue/20 p-3">
                        <p className="text-sm text-white/65 font-medium">AI Score: {ms.aiScore}/100 &middot; Risk: {ms.aiRisk} &middot; Recommendation: {ms.aiRecommendation}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

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

      {/* Activity Timeline — canonical events first, then any in-session
          events appended by the release / submit flows. The appended block
          is what Demosmith and other watchers look for to confirm the
          release was authorized. */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/55">Activity</h2>
        <div className="space-y-3">
          {[
            { text: 'Deal created — Sarah Chen & Marcus Webb', date: 'October 25, 2025' },
            { text: 'Site Preparation & Grading released — $320,000', date: '14 days ago' },
            { text: 'Concrete Sub-grade & Foundations released — $1,840,000', date: '7 days ago' },
            { text: 'AI Draw Review for Structural Steel Erection — score 91/100', date: '3 days ago' },
            { text: 'Structural Steel Erection approved — awaiting release', date: '2 days ago' },
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

      {/* Modals */}
      <ReleaseFundsModal
        open={releaseModal}
        milestone={{ name: 'Structural Steel Erection', amount: 2_180_000 }}
        onConfirm={() => {
          setOverrides((prev) => ({ ...prev, 'ms-hb-3': 'released' }))
          setNewlyReleased((prev) => new Set([...prev, 'ms-hb-3']))
          // Append a visible activity/audit-feed event so external watchers
          // (Demosmith) can confirm the release was authorized. Frontend
          // state only — no API or production audit_log call.
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

      {/* Contractor: Submit for Review modal — moves the milestone from
          in_progress → ready_for_review in demo state. Frontend only. */}
      <DrawRequestModal
        open={submitModal !== null}
        milestone={submitModal ?? { id: '', name: '', amount: 0 }}
        onConfirm={() => {
          if (submitModal) {
            setOverrides((prev) => ({ ...prev, [submitModal.id]: 'ready_for_review' }))
            // Activity-feed parity: contractor submission is also
            // user-visible audit evidence.
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
