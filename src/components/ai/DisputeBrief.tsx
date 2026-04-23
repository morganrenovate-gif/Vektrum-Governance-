'use client'

import { useState, useTransition } from 'react'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  ShieldAlert,
  ArrowRight,
  User,
} from 'lucide-react'
import { resolveDispute } from '@/lib/actions/disputes'
import { useRouter } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

export type Brief = {
  id: string
  milestone_id: string
  deal_id: string
  dispute_reason: string
  dispute_context: string | null
  submitted_items: { name: string; present: boolean; detail: string }[]
  missing_items: { item: string; requiredBy: string; severity: 'BLOCKING' | 'RECOMMENDED' }[]
  condition_gaps: { condition: string; status: 'MET' | 'PARTIAL' | 'UNMET'; explanation: string }[]
  resolution_steps: { step: number; action: string; responsibleParty: 'CONTRACTOR' | 'FUNDER' | 'EITHER'; detail: string }[]
  estimated_resolution_time: string
  project_status_summary: string
  status: 'OPEN' | 'RESOLVED'
  model_version: string | null
  created_at: string
  resolved_at: string | null
  milestone_amount: number
}

type Props = {
  brief: Brief | null
  role: 'funder' | 'contractor' | 'admin'
  milestoneId: string
  milestoneName: string
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionToggle({
  label,
  count,
  open,
  onToggle,
  accent,
}: {
  label: string
  count?: number
  open: boolean
  onToggle: () => void
  accent?: string
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center justify-between w-full text-left py-1"
    >
      <div className="flex items-center gap-2">
        <p className={`text-[11px] font-bold uppercase tracking-[0.12em] ${accent ?? 'text-white/30'}`}>
          {label}
        </p>
        {count !== undefined && (
          <span className="text-[10px] font-semibold text-white/30 bg-surface-3 px-1.5 py-0.5 rounded">
            {count}
          </span>
        )}
      </div>
      {open
        ? <ChevronUp size={13} className="text-white/30" />
        : <ChevronDown size={13} className="text-white/30" />
      }
    </button>
  )
}

function ResponsibleBadge({ party }: { party: 'CONTRACTOR' | 'FUNDER' | 'EITHER' }) {
  const styles = {
    CONTRACTOR: 'bg-vektrum-blue/10 text-vektrum-blue border-vektrum-blue/20',
    FUNDER: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    EITHER: 'bg-white/5 text-white/40 border-white/10',
  }
  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] ${styles[party]}`}>
      {party}
    </span>
  )
}

function BriefUnavailable() {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0d1520] px-5 py-4 flex items-start gap-3 mb-6">
      <ShieldAlert size={15} className="text-white/30 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-[13px] font-semibold text-white/50">Dispute brief unavailable</p>
        <p className="text-[12px] text-white/30 mt-0.5 leading-relaxed">
          The automated brief could not be generated. Please contact support or proceed with manual review. The dispute lock remains in effect.
        </p>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function DisputeBrief({ brief, role, milestoneId, milestoneName }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [resolveError, setResolveError] = useState<string | null>(null)
  const [showSubmitted, setShowSubmitted] = useState(true)
  const [showMissing, setShowMissing] = useState(true)
  const [showConditions, setShowConditions] = useState(false)
  const [showSteps, setShowSteps] = useState(true)

  if (!brief) return <BriefUnavailable />

  const blockingCount = brief.missing_items.filter((m) => m.severity === 'BLOCKING').length
  const unresolvedConditions = brief.condition_gaps.filter((c) => c.status !== 'MET').length
  const reasonLabel = brief.dispute_reason.replace(/_/g, ' ')

  function handleResolve() {
    setResolveError(null)
    startTransition(async () => {
      const result = await resolveDispute(milestoneId)
      if (result.success) {
        router.refresh()
      } else {
        setResolveError(result.error)
      }
    })
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#0d1520] overflow-hidden mb-6">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10">
            <AlertTriangle size={13} className="text-red-400" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-white">Dispute Brief</p>
            <p className="text-[11px] text-white/35 capitalize">{reasonLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          {brief.status === 'RESOLVED' ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-emerald-400">
              <CheckCircle2 size={11} />
              Resolved
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 border border-red-500/25 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-red-400">
              <AlertTriangle size={11} />
              Open
            </span>
          )}
          <div className="flex items-center gap-1.5 text-[11px] text-white/25">
            <Clock size={11} />
            {new Date(brief.created_at).toLocaleDateString()}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">

        {brief.dispute_context && (
          <div className="flex items-start gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <User size={13} className="text-white/30 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/30 mb-0.5">
                Funder&apos;s context
              </p>
              <p className="text-[13px] text-white/60 leading-relaxed">{brief.dispute_context}</p>
            </div>
          </div>
        )}

        {/* Project status */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/30 mb-1.5">
            Project status
          </p>
          <p className="text-[13px] text-white/65 leading-relaxed">{brief.project_status_summary}</p>
          <div className="mt-2.5 flex items-center gap-2">
            <Clock size={11} className="text-white/30" />
            <p className="text-[12px] text-white/40">
              Estimated resolution:{' '}
              <span className="text-white/60 font-medium">{brief.estimated_resolution_time}</span>
            </p>
          </div>
        </div>

        {/* Submitted items */}
        <div>
          <SectionToggle
            label="What was submitted"
            count={brief.submitted_items.length}
            open={showSubmitted}
            onToggle={() => setShowSubmitted((v) => !v)}
          />
          {showSubmitted && (
            <div className="mt-3 space-y-1.5">
              {brief.submitted_items.map((item, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 rounded-xl px-3.5 py-2.5 border ${
                    item.present
                      ? 'border-emerald-500/10 bg-emerald-500/[0.04]'
                      : 'border-red-500/15 bg-red-500/[0.05]'
                  }`}
                >
                  {item.present
                    ? <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                    : <XCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                  }
                  <div>
                    <p className="text-[13px] font-medium text-white/80">{item.name}</p>
                    {item.detail && (
                      <p className="mt-0.5 text-[12px] text-white/45 leading-relaxed">{item.detail}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Missing items */}
        {brief.missing_items.length > 0 && (
          <div>
            <SectionToggle
              label="What&apos;s missing"
              count={brief.missing_items.length}
              open={showMissing}
              onToggle={() => setShowMissing((v) => !v)}
              accent={blockingCount > 0 ? 'text-red-400' : 'text-amber-400'}
            />
            {showMissing && (
              <div className="mt-3 space-y-1.5">
                {brief.missing_items.map((item, i) => (
                  <div
                    key={i}
                    className={`rounded-xl px-3.5 py-3 border ${
                      item.severity === 'BLOCKING'
                        ? 'border-red-500/20 bg-red-500/[0.06]'
                        : 'border-amber-500/15 bg-amber-500/[0.05]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <p className="text-[13px] font-medium text-white/80">{item.item}</p>
                      <span className={`flex-shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] ${
                        item.severity === 'BLOCKING'
                          ? 'bg-red-500/10 text-red-400 border-red-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {item.severity}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/35">Required by: {item.requiredBy}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Condition gaps */}
        {unresolvedConditions > 0 && (
          <div>
            <SectionToggle
              label="Condition status"
              count={brief.condition_gaps.length}
              open={showConditions}
              onToggle={() => setShowConditions((v) => !v)}
            />
            {showConditions && (
              <div className="mt-3 space-y-1.5">
                {brief.condition_gaps.map((gap, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-3 rounded-xl px-3.5 py-2.5 border ${
                      gap.status === 'MET'
                        ? 'border-emerald-500/10 bg-emerald-500/[0.04]'
                        : gap.status === 'PARTIAL'
                        ? 'border-amber-500/15 bg-amber-500/[0.05]'
                        : 'border-red-500/15 bg-red-500/[0.05]'
                    }`}
                  >
                    {gap.status === 'MET'
                      ? <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                      : gap.status === 'PARTIAL'
                      ? <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                      : <XCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                    }
                    <div>
                      <p className="text-[13px] font-medium text-white/80">{gap.condition}</p>
                      <p className="mt-0.5 text-[12px] text-white/45 leading-relaxed">{gap.explanation}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Resolution steps */}
        <div>
          <SectionToggle
            label="How to resolve"
            count={brief.resolution_steps.length}
            open={showSteps}
            onToggle={() => setShowSteps((v) => !v)}
            accent="text-vektrum-blue"
          />
          {showSteps && (
            <div className="mt-3 space-y-2">
              {brief.resolution_steps.map((step, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3"
                >
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-vektrum-blue/15 text-[10px] font-bold text-vektrum-blue mt-0.5">
                    {step.step}
                  </span>
                  <div className="flex-1">
                    <p className="text-[13px] font-medium text-white/80 leading-snug">{step.action}</p>
                    {step.detail && (
                      <p className="mt-1 text-[12px] text-white/40 leading-relaxed">{step.detail}</p>
                    )}
                    <div className="mt-1.5">
                      <ResponsibleBadge party={step.responsibleParty} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Funder: Mark resolved */}
        {(role === 'funder' || role === 'admin') && brief.status === 'OPEN' && (
          <div className="pt-2 space-y-3">
            {resolveError && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
                <p className="text-[13px] text-red-400">{resolveError}</p>
              </div>
            )}
            <button
              onClick={handleResolve}
              disabled={isPending}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-[14px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isPending ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Clearing dispute...
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} />
                  Mark resolved — restore to approved
                </>
              )}
            </button>
            <p className="text-center text-[11px] text-white/25">
              Milestone will return to &lsquo;approved&rsquo; status. You can then trigger the release gate.
            </p>
          </div>
        )}

        {/* Contractor: action prompt */}
        {role === 'contractor' && brief.status === 'OPEN' && brief.resolution_steps.length > 0 && (
          <div className="flex items-start gap-2.5 rounded-xl border border-vektrum-blue/15 bg-vektrum-blue/5 px-4 py-3">
            <ArrowRight size={13} className="text-vektrum-blue flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-white/55 leading-relaxed">
              Complete the steps above and resubmit your draw package. The funder will review and can mark the dispute resolved once satisfied.
            </p>
          </div>
        )}

        {/* AI disclaimer */}
        <div className="flex items-start gap-2.5 rounded-xl border border-white/[0.04] bg-white/[0.02] px-3.5 py-3">
          <ShieldAlert size={12} className="text-white/20 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-white/25 leading-relaxed">
            Generated by Perplexity Computer
            {brief.model_version ? ` (${brief.model_version})` : ''}.
            Not legal advice. Human approval required to release funds.
          </p>
        </div>

      </div>
    </div>
  )
}
