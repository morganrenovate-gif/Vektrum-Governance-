'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, ChevronDown, ChevronUp, Brain, FileText } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import { harbor } from '@/lib/demo-data'
import type { DemoMilestoneStatus } from '@/lib/demo-data'
import { ReleaseFundsModal } from '@/components/demo/ReleaseFundsModal'

const deal = harbor

const STATUS_CONFIG: Record<DemoMilestoneStatus, { label: string; badge: string; border: string }> = {
  released:        { label: 'Released',         badge: 'bg-emerald-500/[0.12] text-emerald-400 border border-emerald-500/20',    border: 'border-l-4 border-emerald-500' },
  approved:        { label: 'Approved',          badge: 'bg-vektrum-blue/10 text-vektrum-blue border border-vektrum-blue/20',      border: 'border-l-4 border-vektrum-blue' },
  ready_for_review:{ label: 'Ready for Review',  badge: 'bg-amber-500/[0.12] text-amber-400 border border-amber-500/20',          border: 'border-l-4 border-amber-500' },
  in_progress:     { label: 'In Progress',       badge: 'bg-white/[0.06] text-white/50 border border-white/[0.08]',               border: 'border-l-4 border-white/20' },
  not_started:     { label: 'Not Started',       badge: 'bg-white/[0.04] text-white/30 border border-white/[0.06]',               border: 'border-l-4 border-white/[0.08]' },
  disputed:        { label: 'Disputed',          badge: 'bg-red-500/[0.12] text-red-400 border border-red-500/20',                border: 'border-l-4 border-red-500' },
}

export default function HarborDealPage() {
  const searchParams = useSearchParams()
  const from = searchParams.get('from')
  const backHref = from === 'contractor' ? '/demo-live/contractor' : from === 'admin' ? '/demo-live/admin' : '/demo-live/funder'
  const backLabel = from === 'contractor' ? '← Back to contractor dashboard' : from === 'admin' ? '← Back to admin dashboard' : '← Back to funder dashboard'

  const [overrides, setOverrides] = useState<Record<string, DemoMilestoneStatus>>({})
  const [newlyReleased, setNewlyReleased] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [releaseModal, setReleaseModal] = useState(false)

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
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Progress</p>
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
                      <span className="inline-flex items-center gap-1 rounded-full bg-vektrum-blue/[0.08] border border-vektrum-blue/20 px-2 py-0.5 text-[11px] font-medium text-vektrum-blue">
                        <Brain size={11} /> AI: {ms.aiScore}/100
                      </span>
                    )}

                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cfg.badge}`}>
                      {cfg.label}
                    </span>

                    {status === 'approved' && (
                      <button
                        type="button"
                        onClick={() => setReleaseModal(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        Release Funds
                      </button>
                    )}

                    {status === 'in_progress' && (
                      <span className="bg-white/[0.04] text-white/30 cursor-not-allowed px-4 py-2 rounded-lg text-sm">
                        In Progress
                      </span>
                    )}

                    {(status === 'released' || status === 'approved') && (
                      <button
                        type="button"
                        onClick={() => setExpanded((prev) => ({ ...prev, [ms.id]: !isExpanded }))}
                        className="inline-flex items-center gap-1 text-[12px] text-white/40 hover:text-white/70 transition-colors"
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
                        <p className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-1.5">Documents</p>
                        <ul className="space-y-1">
                          {ms.documents.map((doc, i) => (
                            <li key={i} className="text-sm text-white/55 flex items-center gap-1.5">
                              <FileText size={12} className="text-white/40" /> {doc}
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
              <FileText size={16} className="text-white/40 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/55 truncate">{doc.name}</p>
                <p className="text-xs text-white/40">{doc.date}</p>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-white/40 bg-white/[0.06] rounded px-2 py-0.5">PDF</span>
            </div>
          ))}
        </div>
      </section>

      {/* Activity Timeline */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/55">Activity</h2>
        <div className="space-y-3">
          {[
            { text: 'Deal created — Sarah Chen & Marcus Webb', date: 'October 25, 2025' },
            { text: 'Site Preparation & Grading released — $320,000', date: '14 days ago' },
            { text: 'Concrete Sub-grade & Foundations released — $1,840,000', date: '7 days ago' },
            { text: 'Structural Steel Erection released — $2,180,000', date: '3 days ago' },
            { text: 'AI Draw Review for Building Envelope — score 92/100', date: '2 days ago' },
          ].map((event, i) => (
            <div key={i} className="flex items-start gap-3 text-sm">
              <div className="mt-1.5 h-2 w-2 rounded-full bg-vektrum-blue flex-shrink-0" />
              <div>
                <p className="text-white/55">{event.text}</p>
                <p className="text-xs text-white/40">{event.date}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Modals */}
      <ReleaseFundsModal
        open={releaseModal}
        milestone={{ name: 'Building Envelope & Roofing', amount: 2_640_000 }}
        onConfirm={() => {
          setOverrides((prev) => ({ ...prev, 'ms-hb-4': 'released' }))
          setNewlyReleased((prev) => new Set([...prev, 'ms-hb-4']))
        }}
        onClose={() => setReleaseModal(false)}
      />
    </div>
    </div>
  )
}

function StatTile({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-surface-2 px-5 py-5 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">{label}</p>
      <p className={`mt-1.5 font-display text-xl font-bold tabular-nums ${green ? 'text-emerald-400' : 'text-white'}`}>{value}</p>
    </div>
  )
}
