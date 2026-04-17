'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, AlertCircle, Brain, FileText, ChevronDown, ChevronUp } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import { harborDisputeMilestones } from '@/lib/demo-data'
import type { DisputeMilestone } from '@/lib/demo-data'
import { ResolveDisputeModal } from '@/components/demo/ResolveDisputeModal'
import { AiReviewModal } from '@/components/demo/AiReviewModal'

const DEAL_TITLE = 'Harbor Logistics Center — Partial Dispute'
const DEAL_TOTAL = 9_100_000
const DEAL_FUNDED = 9_100_000
const DEAL_RELEASED = 7_640_000

export default function HarborDisputeDealPage() {
  const searchParams = useSearchParams()
  const from = searchParams.get('from')
  const backHref = from === 'admin' ? '/demo-live/admin' : from === 'contractor' ? '/demo-live/contractor' : '/demo-live/funder'
  const backLabel = from === 'admin' ? '← Back to admin dashboard' : from === 'contractor' ? '← Back to contractor dashboard' : '← Back to funder dashboard'

  const [resolveModal, setResolveModal] = useState(false)
  const [aiModal, setAiModal] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const pct = DEAL_TOTAL > 0 ? Math.round((DEAL_RELEASED / DEAL_TOTAL) * 100) : 0

  return (
    <div className="page-container section space-y-8">
      <Link href={backHref} className="inline-flex items-center gap-1 text-[13px] text-vektrum-muted hover:text-vektrum-blue transition-colors">
        {backLabel}
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="font-display text-2xl font-bold text-vektrum-text">{DEAL_TITLE}</h1>
            <span className="inline-flex items-center rounded-full border border-green-200 bg-green-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700">
              ACTIVE
            </span>
          </div>
          <p className="text-sm text-vektrum-muted">
            Marcus Webb &middot; Sarah Chen &middot; Started 180 days ago
          </p>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Total" value={formatCurrency(DEAL_TOTAL)} />
        <StatTile label="Funded" value={formatCurrency(DEAL_FUNDED)} />
        <StatTile label="Released" value={formatCurrency(DEAL_RELEASED)} green />
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
          {harborDisputeMilestones.map((ms) => {
            if (ms.status === 'disputed') {
              return <DisputedCard key={ms.id} ms={ms} onResolve={() => setResolveModal(true)} onViewAi={() => setAiModal(true)} />
            }
            if (ms.fundsReleased != null && ms.fundsHeld != null) {
              return <PartialReleaseCard key={ms.id} ms={ms} />
            }
            return <ReleasedCard key={ms.id} ms={ms} expanded={expanded[ms.id] ?? false} onToggle={() => setExpanded((prev) => ({ ...prev, [ms.id]: !prev[ms.id] }))} />
          })}
        </div>
      </section>

      {/* Isolation callout */}
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
        <p className="text-sm font-semibold text-blue-800 mb-1">Vektrum Milestone Isolation</p>
        <p className="text-sm text-blue-700 leading-relaxed">
          The dispute on Milestone 5 does not freeze the rest of the project. Milestones 1–4 have already released {formatCurrency(7_640_000)} (84% of total). Milestone 6 has released the undisputed portion ({formatCurrency(1_633_000)}). Only the {formatCurrency(487_000)} in dispute is held.
        </p>
      </div>

      {/* Documents */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-vektrum-muted">Documents</h2>
        <div className="space-y-2">
          {[
            { name: 'Deal Agreement — Harbor_Logistics_Agreement.pdf', date: 'Signed January 15, 2025' },
            { name: 'Insurance Certificate — Insurance_Cert_WebbConstruction.pdf', date: 'January 15, 2025' },
            { name: 'Change Order CO-004 (unsigned) — CO-004_HVAC.pdf', date: 'April 10, 2025' },
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
            { text: 'Site Preparation & Grading released — $320,000', date: '60 days ago' },
            { text: 'Building Envelope & Roofing released — $2,640,000', date: '14 days ago' },
            { text: 'AI Draw Review flagged HVAC procurement — score 34/100', date: '3 days ago' },
            { text: 'Dispute opened on Milestone 5 — $487,000 held', date: '3 days ago' },
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
      <ResolveDisputeModal
        open={resolveModal}
        onConfirm={() => {}}
        onClose={() => setResolveModal(false)}
      />
      <AiReviewModal
        open={aiModal}
        onClose={() => setAiModal(false)}
        milestoneContext={{ name: 'HVAC Equipment Procurement', amount: 487_000 }}
      />
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ReleasedCard({ ms, expanded, onToggle }: { ms: DisputeMilestone; expanded: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-xl border border-vektrum-border bg-white shadow-sm overflow-hidden border-l-4 border-green-500">
      <div className="px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-gray-900 truncate">{ms.name}</p>
            <p className="text-[12px] text-gray-500 mt-0.5">{formatCurrency(ms.amount)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-green-100 text-green-700 border border-green-200">
            Released
          </span>
          {ms.releasedAt && <span className="text-[12px] text-gray-500 hidden sm:inline">Released {ms.releasedAt}</span>}
          <button type="button" onClick={onToggle} className="inline-flex items-center gap-1 text-[12px] text-blue-600 hover:text-blue-800 transition-colors">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {expanded ? 'Hide' : 'Details'}
          </button>
        </div>
      </div>
      <div className={`overflow-hidden transition-all duration-300 ${expanded ? 'max-h-96' : 'max-h-0'}`}>
        <div className="border-t border-gray-100 px-5 py-4 space-y-3">
          {ms.releasedAt && (
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
        </div>
      </div>
    </div>
  )
}

function DisputedCard({ ms, onResolve, onViewAi }: { ms: DisputeMilestone; onResolve: () => void; onViewAi: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 shadow-sm overflow-hidden border-l-4 border-red-500">
      {/* Dispute banner */}
      <div className="px-5 py-4">
        <div className="flex items-start gap-2 mb-3">
          <AlertCircle size={18} className="text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[14px] font-semibold text-red-700">⚠ Dispute Active — Priority 1</p>
            <p className="text-[13px] text-red-600 mt-0.5">{ms.disputedLineItem}</p>
          </div>
        </div>

        <p className="text-sm text-gray-700 leading-relaxed mb-4">{ms.disputeReason}</p>

        {/* AI findings */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Brain size={14} className="text-red-600" />
            <span className="text-sm font-semibold text-gray-900">AI Draw Review Findings</span>
            {ms.aiScore != null && (
              <span className="text-sm font-bold text-red-600 tabular-nums ml-auto">Score: {ms.aiScore}/100</span>
            )}
          </div>
          {ms.findings && (
            <ul className="space-y-1.5">
              {ms.findings.map((f, i) => (
                <li key={i} className={`text-sm ${f.startsWith('⚠') ? 'text-amber-600' : 'text-green-600'}`}>
                  {f}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Amount & name */}
        <div className="flex items-center gap-3 mb-4">
          <div>
            <p className="text-[14px] font-semibold text-gray-900">{ms.name}</p>
            <p className="text-[12px] text-gray-500">{formatCurrency(ms.amount)}</p>
          </div>
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-red-100 text-red-700 border border-red-200 ml-auto">
            Disputed
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={onResolve}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Resolve Dispute
          </button>
          <button
            type="button"
            onClick={onViewAi}
            className="border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            View AI Analysis
          </button>
        </div>
      </div>
    </div>
  )
}

function PartialReleaseCard({ ms }: { ms: DisputeMilestone }) {
  return (
    <div className="rounded-xl border border-vektrum-border bg-white shadow-sm overflow-hidden border-l-4 border-green-500">
      <div className="px-5 py-4">
        <div className="flex items-center gap-3 mb-3">
          <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
          <div>
            <p className="text-[14px] font-semibold text-gray-900">{ms.name}</p>
            <p className="text-[12px] text-gray-500">{formatCurrency(ms.amount)}</p>
          </div>
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-green-100 text-green-700 border border-green-200 ml-auto">
            Partial Release
          </span>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Released</p>
            <p className="text-[14px] font-bold tabular-nums text-green-700">{formatCurrency(ms.fundsReleased ?? 0)}</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Held — Under Dispute</p>
            <p className="text-[14px] font-bold tabular-nums text-red-600">{formatCurrency(ms.fundsHeld ?? 0)}</p>
          </div>
        </div>
      </div>
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
