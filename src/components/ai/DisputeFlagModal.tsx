'use client'

import { useState, useTransition } from 'react'
import { X, AlertTriangle, ChevronDown } from 'lucide-react'
import { flagMilestoneDisputed } from '@/lib/actions/disputes'
import type { DisputeReason } from '@/lib/actions/disputes'

// ── Types ─────────────────────────────────────────────────────────────────────

export type { DisputeReason }

const REASON_LABELS: Record<DisputeReason, string> = {
  incomplete_documentation: 'Incomplete documentation',
  work_not_verified: 'Work not verified complete',
  invoice_amount_mismatch: 'Invoice amount mismatch',
  lien_waiver_missing: 'Lien waiver missing',
  change_order_not_approved: 'Change order not approved',
  other: 'Other (describe below)',
}

type Props = {
  milestoneId: string
  milestoneName: string
  milestoneAmount: number
  onClose: () => void
  onSuccess: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DisputeFlagModal({
  milestoneId,
  milestoneName,
  milestoneAmount,
  onClose,
  onSuccess,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [reason, setReason] = useState<DisputeReason | ''>('')
  const [context, setContext] = useState('')
  const [error, setError] = useState<string | null>(null)

  const requiresContext = reason === 'other'
  const contextLength = context.trim().length
  const canSubmit = reason !== '' && (!requiresContext || contextLength > 0)

  function handleSubmit() {
    if (!canSubmit || !reason) return
    setError(null)

    startTransition(async () => {
      const result = await flagMilestoneDisputed({
        milestoneId,
        reason,
        context: context.trim() || undefined,
      })

      if (result.success) {
        onSuccess()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget && !isPending) onClose() }}
    >
      <div className="w-full max-w-md rounded-xl border border-white/[0.08] bg-surface-2 shadow-2xl shadow-black/40 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
              <AlertTriangle size={15} className="text-red-400" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-white">Flag as disputed</p>
              <p className="text-[11px] text-white/30">{milestoneName}</p>
            </div>
          </div>
          {!isPending && (
            <button onClick={onClose} className="text-white/65 hover:text-white transition-colors">
              <X size={17} />
            </button>
          )}
        </div>

        <div className="p-6 space-y-5">

          {/* Amount locked notice */}
          <div className="flex items-center gap-2.5 rounded-xl border border-red-500/15 bg-red-500/5 px-4 py-3">
            <AlertTriangle size={13} className="text-red-400 flex-shrink-0" />
            <p className="text-[12px] text-red-300/80 leading-relaxed">
              <strong className="text-red-300">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(milestoneAmount)}
              </strong>{' '}
              will be locked. All other milestones continue normally.
            </p>
          </div>

          {/* Reason dropdown */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-white/30 mb-2">
              Dispute reason <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as DisputeReason)}
                disabled={isPending}
                className="w-full appearance-none rounded-xl border border-white/[0.08] bg-surface-3 px-4 py-2.5 pr-9 text-[13px] text-white focus:border-vektrum-blue focus:outline-none disabled:opacity-50 cursor-pointer"
              >
                <option value="" disabled>Select a reason...</option>
                {(Object.entries(REASON_LABELS) as [DisputeReason, string][]).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
            </div>
          </div>

          {/* Context field */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-white/30 mb-2">
              Additional context
              {requiresContext
                ? <span className="text-red-400"> *</span>
                : <span className="font-normal normal-case tracking-normal"> (optional)</span>
              }
            </label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value.slice(0, 500))}
              disabled={isPending}
              rows={3}
              placeholder={
                requiresContext
                  ? 'Describe the specific issue...'
                  : 'Any additional context to help resolve quickly...'
              }
              className="w-full rounded-xl border border-white/[0.08] bg-surface-3 px-4 py-3 text-[13px] text-white placeholder:text-white/30 focus:border-vektrum-blue focus:outline-none resize-none disabled:opacity-50"
            />
            <p className="text-right text-[11px] text-white/30 mt-1">{contextLength}/500</p>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
              <p className="text-[13px] text-red-400">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || isPending}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-500 px-5 py-3 text-[14px] font-semibold text-white hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {isPending ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Flagging...
                </>
              ) : (
                <>
                  <AlertTriangle size={14} />
                  Flag as disputed
                </>
              )}
            </button>
            <button
              onClick={onClose}
              disabled={isPending}
              className="rounded-xl border border-white/[0.14] bg-white/[0.04] px-4 py-3 text-[14px] font-semibold text-white/80 hover:bg-surface-3 hover:text-white disabled:opacity-40 transition-all"
            >
              Cancel
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
