'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, AlertCircle, Brain, FileText, ChevronDown, ChevronUp } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import { harborDisputeMilestones } from '@/lib/demo-data'
import type { DisputeMilestone } from '@/lib/demo-data'
import { useDemoAutoReset } from '@/lib/demo-data/use-demo-auto-reset'
import { ResolveDisputeModal } from '@/components/demo/ResolveDisputeModal'
import { AiReviewModal } from '@/components/demo/AiReviewModal'

// Pull HVAC milestone once so the modal receives the same data the card shows.
// Single source of truth: score, risk, and findings come from demo-data, not
// from a second hardcoded copy in this file.
const HVAC_MS = harborDisputeMilestones.find((m) => m.id === 'ms-hbd-5')!

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
  const [disputeResolved, setDisputeResolved] = useState(false)

  useDemoAutoReset(() => {
    setResolveModal(false)
    setAiModal(false)
    setExpanded({})
    setDisputeResolved(false)
  })

  const pct = DEAL_TOTAL > 0 ? Math.round((DEAL_RELEASED / DEAL_TOTAL) * 100) : 0

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
            <h1 className="font-display text-2xl font-bold text-white">{DEAL_TITLE}</h1>
            <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/[0.08] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
              ACTIVE
            </span>
          </div>
          <p className="text-sm text-white/55">
            Marcus Webb &middot; Sarah Chen &middot; Started 180 days ago
          </p>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Total" value={formatCurrency(DEAL_TOTAL)} />
        <StatTile label="Funded" value={formatCurrency(DEAL_FUNDED)} />
        <StatTile label="Released" value={formatCurrency(DEAL_RELEASED)} green />
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
          {harborDisputeMilestones.map((ms) => {
            if (ms.status === 'disputed') {
              if (disputeResolved) {
                return <ResolvedCard key={ms.id} ms={ms} />
              }
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
      <div className="rounded-xl border border-vektrum-blue/30 bg-vektrum-blue/[0.10] p-4">
        <p className="text-sm font-semibold text-blue-300 mb-1">Vektrum Milestone Isolation</p>
        <p className="text-sm text-white/55 leading-relaxed">
          The dispute on Milestone 5 does not freeze the rest of the project. Milestones 1–4 have already released {formatCurrency(7_640_000)} (84% of total). Milestone 6 has released the undisputed portion ({formatCurrency(1_633_000)}). Only the {formatCurrency(487_000)} in dispute is held.
        </p>
      </div>

      {/* Documents */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/55">Documents</h2>
        <div className="space-y-2">
          {[
            { name: 'Deal Agreement — Harbor_Logistics_Agreement.pdf', date: 'Signed October 25, 2025' },
            { name: 'Insurance Certificate — Insurance_Cert_WebbConstruction.pdf', date: 'October 25, 2025' },
            { name: 'Change Order CO-004 (unsigned) — CO-004_HVAC.pdf', date: 'April 10, 2026' },
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
            { text: 'Deal created — Sarah Chen & Marcus Webb', date: 'October 25, 2025' },
            { text: 'Site Preparation & Grading released — $320,000', date: '60 days ago' },
            { text: 'Building Envelope & Roofing released — $2,640,000', date: '14 days ago' },
            { text: 'AI Draw Review flagged HVAC procurement — score 34/100', date: '3 days ago' },
            { text: 'Dispute opened on Milestone 5 — $487,000 held', date: '3 days ago' },
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
      <ResolveDisputeModal
        open={resolveModal}
        onConfirm={() => setDisputeResolved(true)}
        onClose={() => setResolveModal(false)}
      />
      <AiReviewModal
        open={aiModal}
        onClose={() => setAiModal(false)}
        milestoneContext={{ name: HVAC_MS.name, amount: HVAC_MS.amount }}
        aiReview={{
          score:          HVAC_MS.aiScore!,
          risk:           HVAC_MS.aiRisk!,
          findings:       HVAC_MS.findings ?? [],
          recommendation: 'Hold funds pending resolution of invoice mismatch and change order CO-004 signature from funder. AI score (34/100) does not clear the release threshold.',
        }}
      />
    </div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ReleasedCard({ ms, expanded, onToggle }: { ms: DisputeMilestone; expanded: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-sm overflow-hidden border-l-4 border-emerald-500">
      <div className="px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-white truncate">{ms.name}</p>
            <p className="text-[12px] text-white/55 mt-0.5">{formatCurrency(ms.amount)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-500/[0.12] text-emerald-400 border border-emerald-500/20">
            Released
          </span>
          {ms.releasedAt && <span className="text-[12px] text-white/75 hidden sm:inline">Released {ms.releasedAt}</span>}
          <button type="button" onClick={onToggle} className="inline-flex items-center gap-1 text-[12px] text-white/75 hover:text-white/70 transition-colors">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {expanded ? 'Hide' : 'Details'}
          </button>
        </div>
      </div>
      <div className={`overflow-hidden transition-all duration-300 ${expanded ? 'max-h-96' : 'max-h-0'}`}>
        <div className="border-t border-white/[0.06] px-5 py-4 space-y-3">
          {ms.releasedAt && (
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
}

function DisputedCard({ ms, onResolve, onViewAi }: { ms: DisputeMilestone; onResolve: () => void; onViewAi: () => void }) {
  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/[0.08] shadow-sm overflow-hidden border-l-4 border-red-500">
      {/* Dispute banner */}
      <div className="px-5 py-4">
        <div className="flex items-start gap-2 mb-3">
          <AlertCircle size={18} className="text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[14px] font-semibold text-red-400">⚠ Dispute Active — Priority 1</p>
            <p className="text-[13px] text-red-400/80 mt-0.5">{ms.disputedLineItem}</p>
          </div>
        </div>

        <p className="text-sm text-white/55 leading-relaxed mb-4">{ms.disputeReason}</p>

        {/* AI findings */}
        <div className="rounded-lg border border-white/[0.08] bg-surface-3 p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Brain size={14} className="text-red-400" />
            <span className="text-sm font-semibold text-white">AI Draw Review Findings</span>
            {ms.aiScore != null && (
              <span className="text-sm font-bold text-red-400 tabular-nums ml-auto">Score: {ms.aiScore}/100</span>
            )}
          </div>
          {ms.findings && (
            <ul className="space-y-1.5">
              {ms.findings.map((f, i) => (
                <li key={i} className={`text-sm ${f.startsWith('⚠') ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {f}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Amount & name */}
        <div className="flex items-center gap-3 mb-4">
          <div>
            <p className="text-[14px] font-semibold text-white">{ms.name}</p>
            <p className="text-[12px] text-white/55">{formatCurrency(ms.amount)}</p>
          </div>
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-red-500/[0.12] text-red-400 border border-red-500/20 ml-auto">
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
            className="border border-white/[0.12] text-white/55 bg-surface-3 hover:bg-white/[0.06] px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            View AI Analysis
          </button>
        </div>
      </div>
    </div>
  )
}

function ResolvedCard({ ms }: { ms: DisputeMilestone }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-sm overflow-hidden border-l-4 border-emerald-500">
      <div className="px-5 py-4 flex items-center gap-3">
        <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-white truncate">{ms.name}</p>
          <p className="text-[12px] text-white/55 mt-0.5">{formatCurrency(ms.amount)}</p>
        </div>
        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-500/[0.12] text-emerald-400 border border-emerald-500/20">
          Dispute Resolved
        </span>
      </div>
      <div className="border-t border-white/[0.06] px-5 py-3">
        <p className="text-sm text-emerald-400 flex items-center gap-1.5">
          <CheckCircle2 size={13} />
          Claim rejected — $487,000 returned to funded balance. Contractor notified.
        </p>
      </div>
    </div>
  )
}

function PartialReleaseCard({ ms }: { ms: DisputeMilestone }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-sm overflow-hidden border-l-4 border-emerald-500">
      <div className="px-5 py-4">
        <div className="flex items-center gap-3 mb-3">
          <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
          <div>
            <p className="text-[14px] font-semibold text-white">{ms.name}</p>
            <p className="text-[12px] text-white/55">{formatCurrency(ms.amount)}</p>
          </div>
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-500/[0.12] text-emerald-400 border border-emerald-500/20 ml-auto">
            Partial Release
          </span>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.08] px-4 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/75">Released</p>
            <p className="text-[14px] font-bold tabular-nums text-emerald-400">{formatCurrency(ms.fundsReleased ?? 0)}</p>
          </div>
          <div className="rounded-lg border border-red-500/20 bg-red-500/[0.08] px-4 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/75">Held — Under Dispute</p>
            <p className="text-[14px] font-bold tabular-nums text-red-400">{formatCurrency(ms.fundsHeld ?? 0)}</p>
          </div>
        </div>
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
