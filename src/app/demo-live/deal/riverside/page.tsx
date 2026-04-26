'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, ChevronDown, ChevronUp, Brain, FileText, Paperclip, Sparkles } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import { riverside } from '@/lib/demo-data'
import type { DemoMilestoneStatus } from '@/lib/demo-data'
import { DrawRequestModal } from '@/components/demo/DrawRequestModal'
import { ReleaseFundsModal } from '@/components/demo/ReleaseFundsModal'
import { AiReviewModal } from '@/components/demo/AiReviewModal'
import { UploadDocumentModal } from '@/components/demo/UploadDocumentModal'

const deal = riverside

const STATUS_CONFIG: Record<DemoMilestoneStatus, { label: string; badge: string; border: string }> = {
  released:        { label: 'Released',         badge: 'bg-emerald-500/[0.12] text-emerald-400 border border-emerald-500/20',    border: 'border-l-4 border-emerald-500' },
  approved:        { label: 'Approved',          badge: 'bg-vektrum-blue/10 text-vektrum-blue border border-vektrum-blue/20',      border: 'border-l-4 border-vektrum-blue' },
  ready_for_review:{ label: 'Ready for Review',  badge: 'bg-amber-500/[0.12] text-amber-400 border border-amber-500/20',          border: 'border-l-4 border-amber-500' },
  in_progress:     { label: 'In Progress',       badge: 'bg-white/[0.06] text-white/50 border border-white/[0.08]',               border: 'border-l-4 border-white/20' },
  not_started:     { label: 'Not Started',       badge: 'bg-white/[0.04] text-white/65 border border-white/[0.06]',               border: 'border-l-4 border-white/[0.08]' },
  disputed:        { label: 'Disputed',          badge: 'bg-red-500/[0.12] text-red-400 border border-red-500/20',                border: 'border-l-4 border-red-500' },
}

export default function RiversideDealPage() {
  const searchParams = useSearchParams()
  const from = searchParams.get('from')
  const backHref = from === 'contractor' ? '/demo-live/contractor' : from === 'admin' ? '/demo-live/admin' : '/demo-live/funder'
  const backLabel = from === 'contractor' ? '← Back to contractor dashboard' : from === 'admin' ? '← Back to admin dashboard' : '← Back to funder dashboard'

  const [overrides, setOverrides] = useState<Record<string, DemoMilestoneStatus>>({})
  const [newlyReleased, setNewlyReleased] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [drawModal, setDrawModal] = useState(false)
  const [releaseModal, setReleaseModal] = useState(false)
  const [aiModal, setAiModal] = useState(false)
  const [uploadModal, setUploadModal] = useState(false)

  function getStatus(id: string, defaultStatus: DemoMilestoneStatus): DemoMilestoneStatus {
    return overrides[id] ?? defaultStatus
  }

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
      {/* Back link */}
      <Link href={backHref} className="inline-flex items-center gap-1 text-[13px] text-white/55 hover:text-vektrum-blue transition-colors">
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
                {/* Row */}
                <div className="px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {status === 'released' && <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-white truncate">{ms.name}</p>
                      <p className="text-[12px] text-white/55 mt-0.5">{formatCurrency(ms.amount)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* AI score chip for approved milestones */}
                    {status === 'approved' && ms.aiScore && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-vektrum-blue/[0.08] border border-vektrum-blue/20 px-2 py-0.5 text-[11px] font-medium text-vektrum-blue">
                        <Brain size={11} /> AI: {ms.aiScore}/100
                      </span>
                    )}

                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cfg.badge}`}>
                      {cfg.label}
                    </span>

                    {/* Action buttons */}
                    {status === 'approved' && from !== 'contractor' && (
                      <button
                        type="button"
                        onClick={() => setReleaseModal(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        Release Funds
                      </button>
                    )}
                    {status === 'ready_for_review' && (
                      <>
                        <button
                          type="button"
                          onClick={() => setDrawModal(true)}
                          className="bg-vektrum-blue hover:bg-vektrum-blue-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                          Request Draw
                        </button>
                        <button
                          type="button"
                          onClick={() => setAiModal(true)}
                          className="border border-vektrum-blue/30 text-vektrum-blue bg-surface-3 hover:bg-vektrum-blue/[0.08] px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors"
                        >
                          <Sparkles size={14} /> Request AI Review
                        </button>
                        <button
                          type="button"
                          onClick={() => setUploadModal(true)}
                          className="text-white/65 hover:text-vektrum-blue transition-colors"
                          title="Upload document"
                        >
                          <Paperclip size={16} />
                        </button>
                      </>
                    )}
                    {status === 'in_progress' && (
                      <span className="bg-white/[0.04] text-white/65 cursor-not-allowed px-4 py-2 rounded-lg text-sm">
                        Awaiting Review
                      </span>
                    )}

                    {/* Expand toggle */}
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

                {/* Expanded content */}
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
            { name: 'Deal Agreement — Vektrum_Deal_Agreement.pdf', date: 'Signed January 22, 2026' },
            { name: 'Insurance Certificate — Insurance_Cert_WebbConstruction.pdf', date: 'January 22, 2026' },
            { name: 'Project Schedule — Master_Schedule_v2.pdf', date: 'January 27, 2026' },
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

      {/* Activity Timeline */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/55">Activity</h2>
        <div className="space-y-3">
          {[
            { text: 'Deal created — Sarah Chen & Marcus Webb', date: 'January 22, 2026' },
            { text: 'Foundation & Site Prep milestone released — $480,000', date: 'February 21, 2026' },
            { text: 'AI Draw Review completed for Framing — score 87/100', date: 'March 10, 2026' },
            { text: 'Milestone approved by Sarah Chen', date: 'March 12, 2026' },
            { text: 'Draw requested for MEP Rough-In — $680,000', date: 'April 15, 2026' },
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
      <DrawRequestModal
        open={drawModal}
        milestone={{ name: 'MEP Rough-In', amount: 680_000 }}
        onConfirm={() => {
          setDrawModal(false)
          setOverrides((prev) => ({ ...prev, 'ms-rv-3': 'in_progress' }))
        }}
        onClose={() => setDrawModal(false)}
      />
      <ReleaseFundsModal
        open={releaseModal}
        milestone={{ name: 'Framing & Structural Steel', amount: 720_000 }}
        approvalDate="March 12, 2026"
        onConfirm={() => {
          setOverrides((prev) => ({ ...prev, 'ms-rv-2': 'released' }))
          setNewlyReleased((prev) => new Set([...prev, 'ms-rv-2']))
        }}
        onClose={() => setReleaseModal(false)}
      />
      <AiReviewModal
        open={aiModal}
        onClose={() => setAiModal(false)}
        milestoneContext={{ name: 'MEP Rough-In', amount: 680_000 }}
      />
      <UploadDocumentModal open={uploadModal} onClose={() => setUploadModal(false)} />
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
