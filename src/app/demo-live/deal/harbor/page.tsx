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
  released: { label: 'Released', badge: 'bg-green-100 text-green-700 border border-green-200', border: 'border-l-4 border-green-500' },
  approved: { label: 'Approved', badge: 'bg-blue-100 text-blue-700 border border-blue-200', border: 'border-l-4 border-blue-400' },
  ready_for_review: { label: 'Ready for Review', badge: 'bg-yellow-100 text-yellow-700 border border-yellow-200', border: 'border-l-4 border-yellow-400' },
  in_progress: { label: 'In Progress', badge: 'bg-slate-100 text-slate-600 border border-slate-200', border: 'border-l-4 border-slate-300' },
  not_started: { label: 'Not Started', badge: 'bg-gray-100 text-gray-500 border border-gray-200', border: 'border-l-4 border-gray-200' },
  disputed: { label: 'Disputed', badge: 'bg-red-100 text-red-700 border border-red-200', border: 'border-l-4 border-red-500' },
}

export default function HarborDealPage() {
  const searchParams = useSearchParams()
  const from = searchParams.get('from')
  const backHref = from === 'contractor' ? '/demo-live/contractor' : from === 'admin' ? '/demo-live/admin' : '/demo-live/funder'
  const backLabel = from === 'contractor' ? '← Back to contractor dashboard' : from === 'admin' ? '← Back to admin dashboard' : '← Back to funder dashboard'

  const [overrides, setOverrides] = useState<Record<string, DemoMilestoneStatus>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [releaseModal, setReleaseModal] = useState(false)

  function getStatus(id: string, defaultStatus: DemoMilestoneStatus): DemoMilestoneStatus {
    return overrides[id] ?? defaultStatus
  }

  const pct = deal.total > 0 ? Math.round((deal.released / deal.total) * 100) : 0

  return (
    <div className="page-container section space-y-8">
      <Link href={backHref} className="inline-flex items-center gap-1 text-[13px] text-vektrum-muted hover:text-vektrum-blue transition-colors">
        {backLabel}
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="font-display text-2xl font-bold text-vektrum-text">{deal.title}</h1>
            <span className="inline-flex items-center rounded-full border border-green-200 bg-green-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700">
              ACTIVE
            </span>
          </div>
          <p className="text-sm text-vektrum-muted">
            {deal.contractor} &middot; {deal.funder} &middot; Started {deal.startedAgo}
          </p>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Total" value={formatCurrency(deal.total)} />
        <StatTile label="Funded" value={formatCurrency(deal.funded)} />
        <StatTile label="Released" value={formatCurrency(deal.released)} green />
        <div className="rounded-lg border border-vektrum-border bg-vektrum-surface px-5 py-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">Progress</p>
          <p className="mt-1.5 font-display text-xl font-bold tabular-nums text-vektrum-text">{pct}%</p>
          <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-green-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {/* Milestones */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-vektrum-muted">Milestones</h2>
        <div className="space-y-4">
          {deal.milestones.map((ms) => {
            const status = getStatus(ms.id, ms.status)
            const cfg = STATUS_CONFIG[status]
            const isExpanded = expanded[ms.id] ?? false

            return (
              <div key={ms.id} className={`rounded-xl border border-vektrum-border bg-white shadow-sm overflow-hidden ${cfg.border}`}>
                <div className="px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {status === 'released' && <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-gray-900 truncate">{ms.name}</p>
                      <p className="text-[12px] text-gray-500 mt-0.5">{formatCurrency(ms.amount)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {status === 'approved' && ms.aiScore && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-medium text-blue-700">
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
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        Release Funds
                      </button>
                    )}

                    {status === 'in_progress' && (
                      <span className="bg-gray-100 text-gray-400 cursor-not-allowed px-4 py-2 rounded-lg text-sm">
                        In Progress
                      </span>
                    )}

                    {(status === 'released' || status === 'approved') && (
                      <button
                        type="button"
                        onClick={() => setExpanded((prev) => ({ ...prev, [ms.id]: !isExpanded }))}
                        className="inline-flex items-center gap-1 text-[12px] text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {isExpanded ? 'Hide' : 'Details'}
                      </button>
                    )}
                  </div>
                </div>

                <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-96' : 'max-h-0'}`}>
                  <div className="border-t border-gray-100 px-5 py-4 space-y-3">
                    {status === 'released' && ms.releasedAt && (
                      <p className="text-sm text-green-600 flex items-center gap-1.5">
                        <CheckCircle2 size={14} /> Released {ms.releasedAt}
                      </p>
                    )}
                    {ms.documents.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Documents</p>
                        <ul className="space-y-1">
                          {ms.documents.map((doc, i) => (
                            <li key={i} className="text-sm text-gray-600 flex items-center gap-1.5">
                              <FileText size={12} className="text-gray-400" /> {doc}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {status === 'approved' && ms.aiScore && (
                      <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                        <p className="text-sm text-blue-700 font-medium">AI Score: {ms.aiScore}/100 &middot; Risk: {ms.aiRisk} &middot; Recommendation: {ms.aiRecommendation}</p>
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
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-vektrum-muted">Documents</h2>
        <div className="space-y-2">
          {[
            { name: 'Deal Agreement — Harbor_Logistics_Agreement.pdf', date: 'Signed January 15, 2025' },
            { name: 'Insurance Certificate — Insurance_Cert_WebbConstruction.pdf', date: 'January 15, 2025' },
            { name: 'Project Schedule — Harbor_Master_Schedule_v3.pdf', date: 'January 20, 2025' },
          ].map((doc, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
              <FileText size={16} className="text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 truncate">{doc.name}</p>
                <p className="text-xs text-gray-400">{doc.date}</p>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 bg-gray-100 rounded px-2 py-0.5">PDF</span>
            </div>
          ))}
        </div>
      </section>

      {/* Activity Timeline */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-vektrum-muted">Activity</h2>
        <div className="space-y-3">
          {[
            { text: 'Deal created — Sarah Chen & Marcus Webb', date: 'January 15, 2025' },
            { text: 'Site Preparation & Grading released — $320,000', date: '14 days ago' },
            { text: 'Concrete Sub-grade & Foundations released — $1,840,000', date: '7 days ago' },
            { text: 'Structural Steel Erection released — $2,180,000', date: '3 days ago' },
            { text: 'AI Draw Review for Building Envelope — score 92/100', date: '2 days ago' },
          ].map((event, i) => (
            <div key={i} className="flex items-start gap-3 text-sm">
              <div className="mt-1.5 h-2 w-2 rounded-full bg-blue-400 flex-shrink-0" />
              <div>
                <p className="text-gray-700">{event.text}</p>
                <p className="text-xs text-gray-400">{event.date}</p>
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
        }}
        onClose={() => setReleaseModal(false)}
      />
    </div>
  )
}

function StatTile({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return (
    <div className="rounded-lg border border-vektrum-border bg-vektrum-surface px-5 py-5 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">{label}</p>
      <p className={`mt-1.5 font-display text-xl font-bold tabular-nums ${green ? 'text-green-600' : 'text-vektrum-text'}`}>{value}</p>
    </div>
  )
}
