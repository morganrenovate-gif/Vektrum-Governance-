'use client'

// Advisor 5 (Fintech Risk): Stripe status must be clearly communicated.
// stripe_payouts_enabled = true → fully active, false → onboarding incomplete or restricted.
// Advisor 10 (Adversarial): Warn clearly that changing Stripe accounts mid-deal
// does NOT affect funds already in transit. Display this unconditionally.

import { useState } from 'react'
import type { Profile } from '@/lib/types'
import { CheckCircle2, AlertCircle, ExternalLink, Info, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StripeTabProps {
  profile: Profile
}

export function StripeTab({ profile }: StripeTabProps) {
  const isConnected = !!profile.stripe_account_id
  // Local state mirrors profile.stripe_payouts_enabled so a manual refresh
  // can update the UI without a full page reload.
  const [payoutsEnabled, setPayoutsEnabled] = useState(profile.stripe_payouts_enabled)
  const [connecting, setConnecting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshSuccess, setRefreshSuccess] = useState<string | null>(null)

  async function handleConnectStripe() {
    setConnecting(true)
    setError(null)
    setRefreshSuccess(null)
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

  async function handleRefreshStatus() {
    setRefreshing(true)
    setError(null)
    setRefreshSuccess(null)
    try {
      const res = await fetch('/api/contractor/stripe/status/refresh', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not refresh Stripe status. Please try again.')
        return
      }
      setPayoutsEnabled(data.stripe_payouts_enabled as boolean)
      setRefreshSuccess(
        data.stripe_payouts_enabled
          ? 'Stripe status updated — payouts are now enabled.'
          : 'Stripe status refreshed. Payouts are not yet enabled; check your Stripe dashboard for required information.',
      )
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-bold text-white">Stripe Connect</h2>
        <p className="mt-1 text-sm text-white/55">
          {profile.role === 'contractor'
            ? 'Your connected Stripe account is where released milestone payments are deposited.'
            : 'Your connected Stripe account is used to fund deals and release milestone payments.'}
        </p>
      </div>

      {/* Status card */}
      <div className="rounded-xl border border-white/[0.08] bg-surface-2 p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={cn(
              'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full mt-0.5',
              isConnected && payoutsEnabled
                ? 'bg-emerald-500/[0.08]'
                : isConnected
                ? 'bg-amber-500/[0.08]'
                : 'bg-surface-3'
            )}>
              {isConnected && payoutsEnabled ? (
                <CheckCircle2 size={16} className="text-emerald-400" aria-hidden="true" />
              ) : (
                <AlertCircle size={16} className={isConnected ? 'text-amber-400' : 'text-white/70'} aria-hidden="true" />
              )}
            </div>
            <div>
              <p className="text-[14px] font-semibold text-white">
                {isConnected && payoutsEnabled
                  ? 'Stripe account active'
                  : isConnected
                  ? 'Stripe onboarding incomplete'
                  : 'No Stripe account connected'}
              </p>
              <p className="text-[12px] text-white/55 mt-0.5">
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
            <div className="flex flex-shrink-0 items-center gap-2">
              {/* Refresh status — syncs stripe_payouts_enabled from Stripe directly */}
              {profile.role === 'contractor' && (
                <button
                  onClick={handleRefreshStatus}
                  disabled={refreshing}
                  title="Refresh Stripe status"
                  aria-label="Refresh Stripe status"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-surface-2 px-3 py-2 text-[13px] font-semibold text-white hover:bg-surface-3 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {refreshing
                    ? <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                    : <RefreshCw size={13} aria-hidden="true" />}
                  {refreshing ? 'Refreshing…' : 'Refresh status'}
                </button>
              )}
              <a
                href="https://connect.stripe.com/express_login"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-surface-2 px-4 py-2 text-[13px] font-semibold text-white hover:bg-surface-3 transition-all"
              >
                Manage in Stripe
                <ExternalLink size={12} aria-hidden="true" />
              </a>
            </div>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-500/20 bg-vektrum-red-subtle px-4 py-3">
            <AlertCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-[12px] text-red-400 leading-relaxed">{error}</p>
          </div>
        )}

        {/* Refresh success banner */}
        {refreshSuccess && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.08] px-4 py-3">
            <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-[12px] text-emerald-300 leading-relaxed">{refreshSuccess}</p>
          </div>
        )}

        {/* Advisor 10: Warn unconditionally about account switching mid-deal */}
        {isConnected && (
          <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-vektrum-blue/25 bg-vektrum-blue/[0.12] px-4 py-3">
            <Info size={13} className="text-blue-300 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-[12px] text-blue-200 leading-relaxed">
              <strong>Changing your connected account</strong> will not affect funds already in transit on existing milestones.
              Payments for any milestone already in the release process will continue to route to the account on file at the time of release.
            </p>
          </div>
        )}
      </div>

    </div>
  )
}
