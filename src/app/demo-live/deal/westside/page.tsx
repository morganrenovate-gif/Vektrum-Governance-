'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, ChevronDown, ChevronUp, FileText, Sparkles } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import { westside } from '@/lib/demo-data'
import type { DemoMilestoneStatus } from '@/lib/demo-data'
import { AiReviewModal } from '@/components/demo/AiReviewModal'

const deal = westside

const STATUS_CONFIG: Record<DemoMilestoneStatus, { label: string; badge: string; border: string }> = {
  released:        { label: 'Released',         badge: 'bg-emerald-500/[0.12] text-emerald-400 border border-emerald-500/20',    border: 'border-l-4 border-emerald-500' },
  approved:        { label: 'Approved',          badge: 'bg-vektrum-blue/10 text-vektrum-blue border border-vektrum-blue/20',      border: 'border-l-4 border-vektrum-blue' },
  ready_for_review:{ label: 'Ready for Review',  badge: 'bg-amber-500/[0.12] text-amber-400 border border-amber-500/20',          border: 'border-l-4 border-amber-500' },
  in_progress:     { label: 'In Progress',       badge: 'bg-white/[0.06] text-white/50 border border-white/[0.08]',               border: 'border-l-4 border-white/20' },
  not_started:     { label: 'Not Started',       badge: 'bg-white/[0.04] text-white/65 border border-white/[0.06]',               border: 'border-l-4 border-white/[0.08]' },
  disputed:        { label: 'Disputed',          badge: 'bg-red-500/[0.12] text-red-400 border border-red-500/20',                border: 'border-l-4 border-red-500' },
}

export default function WestsideDealPage() {
  const searchParams = useSearchParams()
  const from = searchParams.get('from')
  const backHref = from === 'contractor' ? '/demo-live/contractor' : from === 'admin' ? '/demo-live/admin' : '/demo-live/funder'
  const backLabel = from === 'contractor' ? '← Back to contractor dashboard' : from === 'admin' ? '← Back to admin dashboard' : '← Back to funder dashboard'

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [aiModal, setAiModal] = useState(false)

  const pct = deal.total > 0 ? Math.round((deal.released / deal.total) * 100) : 0

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
        <StatTile label="Released" value={formatCurrency(deal.released)} green />
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
            const cfg = STATUS_CONFIG[ms.status]
            const isExpanded = expanded[ms.id] ?? false

            return (
              <div key={ms.id} className={`rounded-xl border border-white/[0.08] bg-surface-2 shadow-sm overflow-hidden ${cfg.border}`}>
                <div className="px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {ms.status === 'released' && <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-white truncate">{ms.name}</p>
                      <p className="text-[12px] text-white/55 mt-0.5">{formatCurrency(ms.amount)}</p>
                      {ms.status === 'in_progress' && (
                        <p className="text-[12px] text-white/75 mt-0.5">Work in progress — draw not yet submitted</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cfg.badge}`}>
                      {cfg.label}
                    </span>

                    {ms.status === 'in_progress' && (
                      <button
                        type="button"
                        onClick={() => setAiModal(true)}
                        className="border border-vektrum-blue/30 text-vektrum-blue bg-surface-3 hover:bg-vektrum-blue/[0.08] px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors"
                      >
                        <Sparkles size={14} /> Request AI Review
                      </button>
                    )}

                    {ms.status === 'released' && (
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
                    {ms.status === 'released' && ms.releasedAt && (
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
            { name: 'Deal Agreement — Westside_Medical_Agreement.pdf', date: 'Signed March 23, 2026' },
            { name: 'Insurance Certificate — Insurance_Cert_ReyesDev.pdf', date: 'March 23, 2026' },
            { name: 'Project Schedule — Westside_Schedule_v1.pdf', date: 'March 26, 2026' },
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
            { text: 'Deal created — Sarah Chen & Diane Reyes', date: 'March 23, 2026' },
            { text: 'Insurance certificate uploaded', date: 'March 23, 2026' },
            { text: 'Site Work & Utilities milestone released — $475,000', date: '15 days ago' },
            { text: 'Structural Frame & Enclosure work started', date: '10 days ago' },
            { text: 'Progress inspection scheduled for Structural Frame', date: '5 days ago' },
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
      <AiReviewModal
        open={aiModal}
        onClose={() => setAiModal(false)}
        milestoneContext={{ name: 'Structural Frame & Enclosure', amount: 1_425_000 }}
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
