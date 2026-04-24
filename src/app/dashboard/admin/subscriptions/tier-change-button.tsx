'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronDown, Check, AlertTriangle, Loader2 } from 'lucide-react'
import { getFeeDescription } from '@/lib/engine/billing'
import type { SubscriptionTier } from '@/lib/engine/billing'

const TIERS: SubscriptionTier[] = ['standalone', 'institutional', 'enterprise']

const TIER_LABELS: Record<SubscriptionTier, string> = {
  standalone:    'Standalone',
  institutional: 'Institutional',
  enterprise:    'Enterprise',
}

const TIER_COLORS: Record<SubscriptionTier, string> = {
  standalone:    'text-white/85',
  institutional: 'text-vektrum-blue',
  enterprise:    'text-amber-400',
}

interface TierChangeButtonProps {
  profileId:       string
  currentTier:     SubscriptionTier
  funderName:      string
  hasActiveDeals:  boolean
}

export function TierChangeButton({
  profileId,
  currentTier,
  funderName,
  hasActiveDeals,
}: TierChangeButtonProps) {
  const [isOpen,         setIsOpen]         = useState(false)
  const [selectedTier,   setSelectedTier]   = useState<SubscriptionTier | null>(null)
  const [justification,  setJustification]  = useState('')
  const [loading,        setLoading]        = useState(false)
  const [error,          setError]          = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [appliedTier,    setAppliedTier]    = useState<SubscriptionTier>(currentTier)

  function openModal(tier: SubscriptionTier) {
    if (tier === appliedTier) return
    setSelectedTier(tier)
    setJustification('')
    setError(null)
    setIsOpen(true)
  }

  function closeModal() {
    setIsOpen(false)
    setSelectedTier(null)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedTier) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/subscriptions/${profileId}/tier`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          tier:                selectedTier,
          admin_justification: justification,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Failed to update tier.')
        setLoading(false)
        return
      }

      setAppliedTier(selectedTier)
      setSuccessMessage(data.message ?? `Tier updated to ${selectedTier}.`)
      setIsOpen(false)
      setTimeout(() => setSuccessMessage(null), 5000)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative">
      {/* Tier dropdown trigger */}
      <div className="flex items-center gap-2">
        <div className="relative group">
          <button
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.05] px-3 py-1.5 text-[12px] font-medium hover:bg-white/[0.08] transition-colors"
            onClick={() => {}}
          >
            <span className={TIER_COLORS[appliedTier]}>{TIER_LABELS[appliedTier]}</span>
            <ChevronDown size={11} className="text-white/65" />
          </button>

          {/* Dropdown */}
          <div className="absolute top-full left-0 z-10 mt-1 hidden group-focus-within:block group-hover:block w-44 rounded-xl border border-white/[0.1] bg-surface-2 shadow-xl py-1">
            {TIERS.map((tier) => (
              <button
                key={tier}
                onClick={() => openModal(tier)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-[12px] hover:bg-white/[0.06] transition-colors ${
                  tier === appliedTier ? 'opacity-40 cursor-default' : ''
                }`}
              >
                {tier === appliedTier && <Check size={11} className="text-emerald-400" />}
                {tier !== appliedTier && <span className="w-[11px]" />}
                <span className={TIER_COLORS[tier]}>{TIER_LABELS[tier]}</span>
                <span className="ml-auto text-white/65 text-[10px] tabular-nums">
                  {tier === 'standalone' ? '1.00%' : tier === 'institutional' ? '0.70%' : '0.65%'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {successMessage && (
          <span className="text-[11px] text-emerald-400 flex items-center gap-1">
            <Check size={10} /> Saved
          </span>
        )}
      </div>

      {/* Confirmation modal */}
      {isOpen && selectedTier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-surface-1 shadow-2xl p-6">
            <h3 className="text-[15px] font-semibold text-white mb-1">
              Change Subscription Tier
            </h3>
            <p className="text-[13px] text-white/75 mb-5">
              Updating <span className="text-white/80">{funderName}</span> from{' '}
              <span className={TIER_COLORS[appliedTier]}>{TIER_LABELS[appliedTier]}</span> to{' '}
              <span className={TIER_COLORS[selectedTier]}>{TIER_LABELS[selectedTier]}</span>
            </p>

            {hasActiveDeals && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 mb-4">
                <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-[12px] text-amber-300">
                  This funder has active unfunded deals. The new rate will only apply to deals
                  funded after this change — existing deals are unaffected.
                </p>
              </div>
            )}

            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 mb-4">
              <p className="text-[11px] text-white/65 uppercase tracking-wider mb-1 font-semibold">New fee</p>
              <p className="text-[13px] text-white">{getFeeDescription(selectedTier)}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-white/85 mb-1.5">
                  Admin justification <span className="text-red-400" aria-hidden="true">*</span>
                  <span className="sr-only">(required)</span>
                </label>
                <textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Document the business reason for this tier change (e.g. 'Agreed enterprise rate per contract signed 2026-04-23')"
                  className="w-full rounded-xl border border-white/[0.14] bg-white/[0.05] px-3 py-2 text-[13px] text-white placeholder:text-white/55 resize-none focus:outline-none focus:ring-2 focus:ring-vektrum-blue/50 focus:border-vektrum-blue/40"
                  rows={3}
                  minLength={10}
                  required
                />
              </div>

              {error && (
                <p className="text-[12px] text-red-400 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex items-center gap-3 pt-1">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={loading}
                  disabled={loading || justification.trim().length < 10}
                >
                  {loading ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      Saving…
                    </>
                  ) : (
                    'Confirm Change'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={closeModal}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
