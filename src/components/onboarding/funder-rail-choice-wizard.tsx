'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2,
  ArrowRight,
  Shield,
  CreditCard,
  Building2,
  Clock,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fireConfetti } from './confetti'

interface FunderRailChoiceWizardProps {
  fullName:        string | null
  stripeConnected: boolean
  currentRail:     'stripe' | 'external_rail' | 'not_configured' | null
}

type RailChoice = 'stripe' | 'external_rail' | 'not_configured'

export function FunderRailChoiceWizard({
  fullName,
  stripeConnected,
  currentRail,
}: FunderRailChoiceWizardProps) {
  const router = useRouter()
  const [selected, setSelected] = useState<RailChoice | null>(currentRail ?? null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const firstName = fullName?.split(' ')[0]

  // Persist the rail choice and route to the appropriate next step.
  // Stripe → kicks off Stripe Connect (existing flow, unchanged).
  // External / not-configured → marks rail on profile and routes to dashboard.
  async function handleContinue() {
    if (!selected) return
    setSubmitting(true)
    setError(null)

    try {
      // Persist the rail choice first — even for the Stripe path, so the
      // funder's intent is recorded before redirecting to Stripe.
      const railRes = await fetch('/api/funder/disbursement-rail', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ rail: selected }),
      })
      if (!railRes.ok) {
        const data = await railRes.json().catch(() => ({}))
        setError(data.error ?? 'Could not save your selection. Please try again.')
        setSubmitting(false)
        return
      }

      if (selected === 'stripe') {
        // Existing Stripe Connect flow — unchanged.
        const res = await fetch('/api/stripe/connect', { method: 'POST' })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? 'Failed to start Stripe onboarding. Please try again.')
          setSubmitting(false)
          return
        }
        window.location.href = data.url
        return
      }

      // External rail or set-up-later — mark onboarding complete and continue.
      await fetch('/api/onboarding', { method: 'PATCH' })
      fireConfetti()
      await new Promise((r) => setTimeout(r, 600))
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Network error. Please check your connection and try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="rounded-2xl border border-white/[0.08] bg-surface-2 shadow-lg overflow-hidden">
          <div className="p-8 pb-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-vektrum-blue/10">
              <Shield size={28} className="text-blue-400" aria-hidden="true" />
            </div>
            <div className="mt-5">
              <h2 className="font-display text-xl font-bold tracking-[-0.025em] text-white">
                Welcome{firstName ? `, ${firstName}` : ''}
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-white/65">
                Choose how disbursement execution will be handled for your deals.
                You can connect Stripe, use an external rail, or finish payment
                setup later.
              </p>
              <p className="mt-2 text-[12px] leading-relaxed text-white/45">
                Vektrum is a draw-governance and authorization-readiness layer.
                Vektrum does not hold funds, act as escrow, act as a lender, or
                act as a money transmitter. Your selected rail executes
                disbursement after required release conditions and authorization
                are complete.
              </p>
            </div>

            <div className="mt-6">
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/45 mb-3">
                Choose your disbursement rail
              </p>

              <div className="grid gap-3">
                <RailOption
                  id="stripe"
                  selected={selected === 'stripe'}
                  onSelect={() => setSelected('stripe')}
                  icon={CreditCard}
                  iconTone="blue"
                  title="Stripe Connect"
                  body="Connect Stripe if you want Stripe to handle platform payment execution for eligible deals."
                  cta="Connect Stripe"
                  badge={stripeConnected ? 'Connected' : undefined}
                />

                <RailOption
                  id="external_rail"
                  selected={selected === 'external_rail'}
                  onSelect={() => setSelected('external_rail')}
                  icon={Building2}
                  iconTone="emerald"
                  title="External or partner rail"
                  body="Use this if disbursements will be handled by a lender, title company, escrow partner, fund control provider, loan servicer, or another approved payment process."
                  cta="Use external rail"
                />

                <RailOption
                  id="not_configured"
                  selected={selected === 'not_configured'}
                  onSelect={() => setSelected('not_configured')}
                  icon={Clock}
                  iconTone="amber"
                  title="Set up later"
                  body="Continue into Vektrum and configure the payment rail before any release can be executed."
                  cta="Set up later"
                />
              </div>
            </div>

            {error && (
              <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-red-500/20 bg-red-500/[0.08] px-4 py-3">
                <AlertCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-[12px] text-red-400 leading-relaxed">{error}</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end border-t border-white/[0.08] px-8 py-5 gap-3">
            <Button
              variant="primary"
              size="sm"
              loading={submitting}
              onClick={handleContinue}
              disabled={!selected || submitting}
            >
              {selected === 'stripe' && !stripeConnected
                ? 'Continue to Stripe'
                : 'Continue to dashboard'}
              <ArrowRight size={14} className="ml-1" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <p className="mt-4 text-center text-[12px] text-white/55">
          You can change your disbursement rail anytime in{' '}
          <a href="/dashboard/settings" className="text-blue-300 hover:text-blue-200 hover:underline">
            Settings
          </a>
          .
        </p>
      </div>
    </div>
  )
}

// ─── Option card ──────────────────────────────────────────────────────────────

interface RailOptionProps {
  id:        RailChoice
  selected:  boolean
  onSelect:  () => void
  icon:      React.ElementType
  iconTone:  'blue' | 'emerald' | 'amber'
  title:     string
  body:      string
  cta:       string
  badge?:    string
}

function RailOption({
  id, selected, onSelect, icon: Icon, iconTone, title, body, cta, badge,
}: RailOptionProps) {
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
      data-rail-option={id}
      className={[
        'group relative flex items-start gap-4 rounded-xl border px-4 py-4 text-left transition-all',
        selected
          ? 'border-vektrum-blue bg-vektrum-blue/[0.06]'
          : 'border-white/[0.08] bg-surface-3 hover:border-white/[0.18] hover:bg-surface-3/80',
      ].join(' ')}
    >
      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${toneBg}`}>
        <Icon size={20} className={toneText} aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[14px] font-semibold text-white">{title}</p>
          {badge && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/[0.10] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
              <CheckCircle2 size={10} aria-hidden="true" />
              {badge}
            </span>
          )}
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-white/65">{body}</p>
        <p className={`mt-2 text-[11px] font-semibold uppercase tracking-[0.10em] ${selected ? 'text-blue-300' : 'text-white/40 group-hover:text-white/60'}`}>
          {cta}
        </p>
      </div>
      <div className="flex-shrink-0 mt-1">
        <span
          aria-hidden="true"
          className={[
            'block h-4 w-4 rounded-full border-2',
            selected
              ? 'border-vektrum-blue bg-vektrum-blue'
              : 'border-white/[0.20]',
          ].join(' ')}
        />
      </div>
    </button>
  )
}
