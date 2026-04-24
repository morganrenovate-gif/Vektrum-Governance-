'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react'
import {
  confirmDealFromContract,
} from '@/lib/actions/analyze-contract'
import type { ProposedMilestone, DealMetadata } from '@/lib/actions/analyze-contract'

// ── Types ─────────────────────────────────────────────────────────────────────

type EditableMilestone = ProposedMilestone & { _id: string }

type Props = {
  initialMilestones: ProposedMilestone[]
  totalValue: number
  missingClauses: string[]
  retainageSummary: string
  metadata: DealMetadata
  onStartOver: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2)
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

// ── Condition editor ──────────────────────────────────────────────────────────

function ConditionList({
  conditions,
  onChange,
}: {
  conditions: string[]
  onChange: (updated: string[]) => void
}) {
  return (
    <div className="space-y-1.5">
      {conditions.map((c, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={c}
            onChange={(e) => {
              const next = [...conditions]
              next[i] = e.target.value
              onChange(next)
            }}
            className="flex-1 rounded-lg border border-white/[0.08] bg-surface-3 px-3 py-1.5 text-[13px] text-white placeholder:text-white/65 focus:border-vektrum-blue focus:outline-none"
            placeholder="Completion condition"
          />
          <button
            onClick={() => onChange(conditions.filter((_, j) => j !== i))}
            className="text-white/65 hover:text-red-400 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...conditions, ''])}
        className="text-[12px] text-vektrum-blue hover:text-vektrum-blue-hover transition-colors flex items-center gap-1"
      >
        <Plus size={12} /> Add condition
      </button>
    </div>
  )
}

// ── Single milestone card ─────────────────────────────────────────────────────

function MilestoneEditCard({
  milestone,
  index,
  onChange,
  onRemove,
}: {
  milestone: EditableMilestone
  index: number
  onChange: (updated: EditableMilestone) => void
  onRemove: () => void
}) {
  const [expanded, setExpanded] = useState(index === 0)

  return (
    <div className="rounded-xl border border-white/[0.08] bg-surface-2 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.08]/50">
        <span className="font-mono text-[11px] font-semibold text-white/65 w-5 text-center">
          {String(index + 1).padStart(2, '0')}
        </span>
        <input
          value={milestone.name}
          onChange={(e) => onChange({ ...milestone, name: e.target.value })}
          className="flex-1 bg-transparent text-[14px] font-semibold text-white focus:outline-none placeholder:text-white/65"
          placeholder="Milestone name"
        />
        <div className="flex items-center gap-1 mr-1">
          <span className="text-[13px] text-white/65">$</span>
          <input
            type="number"
            value={milestone.amount || ''}
            onChange={(e) => onChange({ ...milestone, amount: parseFloat(e.target.value) || 0 })}
            className="w-28 bg-transparent text-right text-[14px] font-semibold tabular-nums text-white focus:outline-none"
            placeholder="0"
          />
        </div>
        {milestone.flags.length > 0 && (
          <AlertTriangle size={14} className="text-amber-400 flex-shrink-0" />
        )}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-white/65 hover:text-white transition-colors"
        >
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        <button
          onClick={onRemove}
          className="text-white/65 hover:text-red-400 transition-colors ml-1"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {expanded && (
        <div className="px-5 py-4 space-y-4">
          {milestone.flags.length > 0 && (
            <div className="space-y-1.5">
              {milestone.flags.map((flag, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2"
                >
                  <AlertTriangle size={12} className="text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[12px] text-amber-300/80 leading-relaxed">{flag}</p>
                </div>
              ))}
            </div>
          )}

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/65 mb-2">
              Release conditions
            </p>
            <ConditionList
              conditions={milestone.conditions}
              onChange={(conditions) => onChange({ ...milestone, conditions })}
            />
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/65 mb-1">
              Retainage %
            </p>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                max="100"
                value={milestone.retainage_pct || ''}
                onChange={(e) =>
                  onChange({ ...milestone, retainage_pct: parseFloat(e.target.value) || 0 })
                }
                className="w-16 rounded-lg border border-white/[0.08] bg-surface-3 px-2.5 py-1.5 text-[13px] text-white focus:border-vektrum-blue focus:outline-none"
              />
              <span className="text-[13px] text-white/65">%</span>
            </div>
          </div>

          {milestone.notes && (
            <div className="rounded-lg border border-white/[0.08]/50 bg-surface-3/50 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/65 mb-1">
                Contract note
              </p>
              <p className="text-[12px] text-white/55 leading-relaxed">{milestone.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function MilestoneReviewScreen({
  initialMilestones,
  totalValue,
  missingClauses,
  retainageSummary,
  metadata,
  onStartOver,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [milestones, setMilestones] = useState<EditableMilestone[]>(
    initialMilestones.map((m) => ({ ...m, _id: uid() })),
  )

  const runningTotal = milestones.reduce((sum, m) => sum + (m.amount || 0), 0)
  const totalMismatch = Math.abs(runningTotal - totalValue) > 1 && totalValue > 0

  function updateMilestone(id: string, updated: EditableMilestone) {
    setMilestones((prev) => prev.map((m) => (m._id === id ? updated : m)))
  }

  function removeMilestone(id: string) {
    setMilestones((prev) => prev.filter((m) => m._id !== id))
  }

  function addMilestone() {
    setMilestones((prev) => [
      ...prev,
      {
        _id: uid(),
        name: '',
        amount: 0,
        conditions: [],
        sequence_order: prev.length + 1,
        retainage_pct: 0,
        notes: '',
        flags: [],
      },
    ])
  }

  function handleConfirm() {
    setSubmitError(null)
    startTransition(async () => {
      const result = await confirmDealFromContract({
        metadata,
        milestones: milestones.map(({ _id, ...m }) => m),
        totalValue: runningTotal,
        importedViaAI: true,
      })

      if (result.success) {
        router.push(`/dashboard/deals/${result.dealId}`)
      } else {
        setSubmitError(result.error)
      }
    })
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-vektrum-blue mb-1">
            AI Contract Import
          </p>
          <h1 className="text-[1.75rem] font-bold tracking-[-0.03em] text-white">
            Review proposed milestones
          </h1>
        </div>
        <button
          onClick={onStartOver}
          className="flex items-center gap-1.5 text-[13px] text-white/55 hover:text-white transition-colors"
        >
          <ArrowLeft size={14} />
          Start over
        </button>
      </div>

      {/* Missing clauses banner */}
      {missingClauses.length > 0 && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-4 py-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-semibold text-amber-300 mb-1.5">
                Missing or ambiguous clauses detected
              </p>
              <ul className="space-y-0.5">
                {missingClauses.map((c, i) => (
                  <li key={i} className="text-[12px] text-amber-300/70 leading-relaxed">
                    · {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Retainage summary */}
      {retainageSummary && (
        <div className="rounded-xl border border-white/[0.08]/60 bg-surface-2 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/65 mb-1">
            Retainage terms (from contract)
          </p>
          <p className="text-[13px] text-white/55 leading-relaxed">{retainageSummary}</p>
        </div>
      )}

      {/* Milestone cards */}
      <div className="space-y-3">
        {milestones.map((m, i) => (
          <MilestoneEditCard
            key={m._id}
            milestone={m}
            index={i}
            onChange={(updated) => updateMilestone(m._id, updated)}
            onRemove={() => removeMilestone(m._id)}
          />
        ))}
      </div>

      {/* Add milestone */}
      <button
        onClick={addMilestone}
        className="w-full rounded-xl border border-dashed border-white/[0.08] py-3.5 text-[13px] font-semibold text-white/55 hover:border-vektrum-blue/50 hover:text-vektrum-blue transition-all flex items-center justify-center gap-2"
      >
        <Plus size={15} />
        Add milestone
      </button>

      {/* Running total */}
      <div className="rounded-xl border border-white/[0.08] bg-surface-2 px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/65">
            Total milestone value
          </p>
          {totalMismatch && (
            <p className="text-[11px] text-amber-400 mt-0.5">
              Contract total: {formatCurrency(totalValue)} · Difference:{' '}
              {formatCurrency(Math.abs(runningTotal - totalValue))}
            </p>
          )}
        </div>
        <p className={`text-[22px] font-bold tracking-[-0.03em] ${totalMismatch ? 'text-amber-400' : 'text-white'}`}>
          {formatCurrency(runningTotal)}
        </p>
      </div>

      {submitError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
          <p className="text-[13px] text-red-400">{submitError}</p>
        </div>
      )}

      {/* Confirm */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleConfirm}
          disabled={isPending || milestones.length === 0}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-vektrum-blue px-6 py-3.5 text-[14px] font-semibold text-white shadow-lg shadow-vektrum-blue/25 hover:bg-vektrum-blue-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isPending ? (
            <>
              <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Creating deal...
            </>
          ) : (
            <>
              <CheckCircle2 size={15} />
              Confirm &amp; create deal
            </>
          )}
        </button>
        <button
          onClick={onStartOver}
          className="rounded-xl border border-white/[0.08] px-5 py-3.5 text-[14px] font-semibold text-white/55 hover:bg-surface-3 transition-all"
        >
          Cancel
        </button>
      </div>

      <p className="text-center text-[11px] text-white/65">
        AI-generated milestones. Review all amounts and conditions before confirming.
        The release gate runs independently server-side.
      </p>
    </div>
  )
}
