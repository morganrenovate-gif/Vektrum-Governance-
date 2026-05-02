'use client'

// Funder-only tab. Shows the current disbursement rail and lets the funder
// switch between Stripe Connect / external rail / not configured.
//
// Hard guarantees:
//   - Switching to 'stripe' here does NOT auto-connect Stripe; it captures
//     intent. A separate "Connect Stripe" CTA kicks off /api/stripe/connect.
//   - Switching to 'external_rail' or 'not_configured' does NOT delete or
//     modify stripe_account_id; the existing Stripe Connect link is
//     preserved so a later switch back to Stripe doesn't require re-onboarding.
//   - Vektrum records authorization readiness; the selected rail executes
//     disbursement after required release conditions and authorization
//     are complete. The deterministic release gate continues to enforce
//     all 10 conditions server-side.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/lib/types'
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Rail = 'stripe' | 'external_rail' | 'not_configured'

interface DisbursementRailTabProps {
  profile: Profile
}

export function DisbursementRailTab({ profile }: DisbursementRailTabProps) {
  const router = useRouter()
  const [rail, setRail] = useState<Rail | null>(profile.disbursement_rail)
  const [saving, setSaving] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const stripeConnected = !!profile.stripe_account_id

  async function saveRail(next: Rail) {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/funder/disbursement-rail', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ rail: next }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not save your selection. Please try again.')
        return
      }
      setRail(next)
      setSuccess(
        next === 'stripe'
          ? 'Stripe Connect selected as your disbursement rail.'
          : next === 'external_rail'
            ? 'External rail selected as your disbursement rail.'
            : 'Disbursement rail set to "Not configured". You can revisit this anytime.',
      )
      router.refresh()
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleConnectStripe() {
    setConnecting(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/connect', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to start Stripe onboarding. Please try again.')
        return
      }
      window.location.href = data.url
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setConnecting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-bold text-white">Disbursement rail</h2>
        <p className="mt-1 text-sm text-white/65 leading-relaxed">
          Choose how disbursement execution will be handled for your deals.
          Vektrum records authorization readiness; your selected rail executes
          disbursement after required release conditions and authorization
          are complete.
        </p>
      </div>

      <div className="grid gap-3">
        <RailOptionCard
          id="stripe"
          selected={rail === 'stripe'}
          disabled={saving}
          onSelect={() => saveRail('stripe')}
          icon={CreditCard}
          iconTone="blue"
          title="Stripe Connect"
          body="Connect Stripe if you want Stripe to handle platform payment execution for eligible deals."
          status={
            rail === 'stripe'
              ? stripeConnected
                ? { label: 'Stripe account connected', tone: 'ok' }
                : { label: 'Stripe not yet connected', tone: 'warn' }
              : null
          }
        />
        <RailOptionCard
          id="external_rail"
          selected={rail === 'external_rail'}
          disabled={saving}
          onSelect={() => saveRail('external_rail')}
          icon={Building2}
          iconTone="emerald"
          title="External or partner rail"
          body="Use this if disbursements will be handled by a lender, title company, escrow partner, fund control provider, loan servicer, or another approved payment process."
        />
        <RailOptionCard
          id="not_configured"
          selected={rail === 'not_configured'}
          disabled={saving}
          onSelect={() => saveRail('not_configured')}
          icon={Clock}
          iconTone="amber"
          title="Not configured"
          body="Continue using Vektrum and configure the payment rail before any release can be executed."
        />
      </div>

      {/* Stripe connect CTA — only when Stripe is the selected rail and not yet connected */}
      {rail === 'stripe' && !stripeConnected && (
        <div className="rounded-xl border border-vektrum-blue/25 bg-vektrum-blue/[0.06] p-5">
          <p className="text-[13px] font-semibold text-blue-200">
            Connect your Stripe account
          </p>
          <p className="mt-1 text-[12px] text-white/65 leading-relaxed">
            Stripe Connect Express handles platform payment execution.
            You can manage payouts, statements, and account details from the
            Stripe dashboard after connecting.
          </p>
          <button
            onClick={handleConnectStripe}
            disabled={connecting}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-vektrum-blue px-4 py-2 text-[13px] font-semibold text-white hover:bg-vektrum-blue-hover transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {connecting && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            {connecting ? 'Connecting…' : 'Connect Stripe'}
          </button>
        </div>
      )}

      {rail === 'stripe' && stripeConnected && (
        <a
          href="https://connect.stripe.com/express_login"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-surface-2 px-4 py-2 text-[13px] font-semibold text-white hover:bg-surface-3 transition-all"
        >
          Manage in Stripe
          <ExternalLink size={12} aria-hidden="true" />
        </a>
      )}

      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-500/20 bg-red-500/[0.08] px-4 py-3">
          <AlertCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-[12px] text-red-400 leading-relaxed">{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.08] px-4 py-3">
          <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-[12px] text-emerald-300 leading-relaxed">{success}</p>
        </div>
      )}
    </div>
  )
}

// ─── Option card ──────────────────────────────────────────────────────────────

interface RailOptionCardProps {
  id:        Rail
  selected:  boolean
  disabled:  boolean
  onSelect:  () => void
  icon:      React.ElementType
  iconTone:  'blue' | 'emerald' | 'amber'
  title:     string
  body:      string
  status?:   { label: string; tone: 'ok' | 'warn' } | null
}

function RailOptionCard({
  id, selected, disabled, onSelect, icon: Icon, iconTone, title, body, status,
}: RailOptionCardProps) {
  const toneBg = iconTone === 'blue'
    ? 'bg-vektrum-blue/10'
    : iconTone === 'emerald'
      ? 'bg-emerald-500/[0.08]'
      : 'bg-amber-500/[0.08]'
  const toneText = iconTone === 'blue'
    ? 'text-blue-400'
    : iconTone === 'emerald'
      ? 'text-emerald-400'
      : 'text-amber-400'

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      disabled={disabled}
      data-rail-option={id}
      className={cn(
        'relative flex items-start gap-4 rounded-xl border px-4 py-4 text-left transition-all',
        selected
          ? 'border-vektrum-blue bg-vektrum-blue/[0.06]'
          : 'border-white/[0.08] bg-surface-2 hover:border-white/[0.18]',
        disabled && 'opacity-60 cursor-not-allowed',
      )}
    >
      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${toneBg}`}>
        <Icon size={20} className={toneText} aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[14px] font-semibold text-white">{title}</p>
          {selected && (
            <span className="inline-flex items-center gap-1 rounded-full border border-vektrum-blue/40 bg-vektrum-blue/[0.10] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-300">
              Selected
            </span>
          )}
          {status && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                status.tone === 'ok'
                  ? 'border-emerald-500/30 bg-emerald-500/[0.10] text-emerald-400'
                  : 'border-amber-500/30 bg-amber-500/[0.10] text-amber-400',
              )}
            >
              {status.label}
            </span>
          )}
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-white/65">{body}</p>
      </div>
    </button>
  )
}
