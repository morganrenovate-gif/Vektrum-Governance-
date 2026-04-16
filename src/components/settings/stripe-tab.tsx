'use client'

// Advisor 5 (Fintech Risk): Stripe status must be clearly communicated.
// stripe_payouts_enabled = true → fully active, false → onboarding incomplete or restricted.
// Advisor 10 (Adversarial): Warn clearly that changing Stripe accounts mid-deal
// does NOT affect funds already in transit. Display this unconditionally.

import { useState } from 'react'
import type { Profile } from '@/lib/types'
import { CheckCircle2, AlertCircle, ExternalLink, Info, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StripeTabProps {
  profile: Profile
}

export function StripeTab({ profile }: StripeTabProps) {
  const isConnected = !!profile.stripe_account_id
  const payoutsEnabled = profile.stripe_payouts_enabled
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      // Redirect to Stripe-hosted onboarding
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
        <h2 className="font-display text-lg font-bold text-vektrum-text">Stripe Payouts</h2>
        <p className="mt-1 text-sm text-vektrum-muted">
          Your connected Stripe account is where released milestone payments are deposited.
        </p>
      </div>

      {/* Status card */}
      <div className="rounded-xl border border-vektrum-border bg-vektrum-surface p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={cn(
              'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full mt-0.5',
              isConnected && payoutsEnabled
                ? 'bg-vektrum-green-bg'
                : isConnected
                ? 'bg-vektrum-amber-bg'
                : 'bg-vektrum-surface-alt'
            )}>
              {isConnected && payoutsEnabled ? (
                <CheckCircle2 size={16} className="text-vektrum-green" aria-hidden="true" />
              ) : (
                <AlertCircle size={16} className={isConnected ? 'text-vektrum-amber' : 'text-vektrum-faint'} aria-hidden="true" />
              )}
            </div>
            <div>
              <p className="text-[14px] font-semibold text-vektrum-text">
                {isConnected && payoutsEnabled
                  ? 'Stripe account active'
                  : isConnected
                  ? 'Stripe onboarding incomplete'
                  : 'No Stripe account connected'}
              </p>
              <p className="text-[12px] text-vektrum-muted mt-0.5">
                {isConnected && payoutsEnabled
                  ? `Account ID: ${profile.stripe_account_id?.slice(0, 8)}…${profile.stripe_account_id?.slice(-4)}`
                  : isConnected
                  ? 'Your Stripe account requires additional information before payouts can be enabled.'
                  : 'Connect a Stripe account to receive released milestone payments.'}
              </p>
            </div>
          </div>

          {/* CTA */}
          {!isConnected && (
            <button
              onClick={handleConnectStripe}
              disabled={connecting}
              className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-vektrum-blue px-4 py-2 text-[13px] font-semibold text-white hover:bg-vektrum-blue-hover transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {connecting && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              {connecting ? 'Connecting…' : 'Connect Stripe'}
            </button>
          )}
          {isConnected && (
            <a
              href="https://connect.stripe.com/express_login"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-vektrum-border bg-vektrum-surface px-4 py-2 text-[13px] font-semibold text-vektrum-text hover:bg-vektrum-surface-alt transition-all"
            >
              Manage in Stripe
              <ExternalLink size={12} aria-hidden="true" />
            </a>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-vektrum-red-border bg-vektrum-red-subtle px-4 py-3">
            <AlertCircle size={13} className="text-vektrum-red flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-[12px] text-vektrum-red leading-relaxed">{error}</p>
          </div>
        )}

        {/* Advisor 10: Warn unconditionally about account switching mid-deal */}
        {isConnected && (
          <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-vektrum-blue-border bg-vektrum-blue-subtle px-4 py-3">
            <Info size={13} className="text-vektrum-blue flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-[12px] text-vektrum-blue leading-relaxed">
              <strong>Changing your connected account</strong> will not affect funds already in transit on existing milestones.
              Payments for any milestone already in the release process will continue to route to the account on file at the time of release.
            </p>
          </div>
        )}
      </div>

      {/* Payout schedule — coming soon */}
      <div className="rounded-xl border border-vektrum-border bg-vektrum-surface p-6 shadow-sm opacity-60 cursor-not-allowed select-none">
        <div className="pointer-events-none flex items-start justify-between gap-4">
          <div>
            <p className="text-[14px] font-semibold text-vektrum-muted">Payout Schedule</p>
            <p className="text-[12px] text-vektrum-faint mt-0.5 max-w-sm">
              Configure automatic vs. manual payout timing for released milestone funds.
            </p>
          </div>
          <span className="flex-shrink-0 rounded-full border border-vektrum-amber-border bg-vektrum-amber-bg px-2.5 py-0.5 text-[10px] font-semibold text-vektrum-amber">
            Coming soon
          </span>
        </div>
      </div>
    </div>
  )
}
