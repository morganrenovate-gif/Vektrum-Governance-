'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ArrowRight, ArrowLeft, Shield, CreditCard, Loader2, AlertCircle, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fireConfetti } from './confetti'

interface StripeOnboardingWizardProps {
  role: 'contractor' | 'funder'
  stripeConnected: boolean
  fullName: string | null
}

type Step = 1 | 2 | 3

function StepIndicator({ current, total }: { current: Step; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={[
            'h-1.5 rounded-full transition-all duration-300',
            i + 1 < current
              ? 'w-5 bg-vektrum-green'
              : i + 1 === current
                ? 'w-8 bg-vektrum-blue'
                : 'w-5 bg-white/[0.08]',
          ].join(' ')}
        />
      ))}
    </div>
  )
}

export function StripeOnboardingWizard({
  role,
  stripeConnected,
  fullName,
}: StripeOnboardingWizardProps) {
  const router = useRouter()
  const isContractor = role === 'contractor'
  const [step, setStep] = useState<Step>(1)
  const [connecting, setConnecting] = useState(false)
  const [stripeError, setStripeError] = useState<string | null>(null)
  const [finishing, setFinishing] = useState(false)

  async function handleConnectStripe() {
    setConnecting(true)
    setStripeError(null)
    try {
      const res = await fetch('/api/stripe/connect', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setStripeError(data.error ?? 'Failed to start Stripe onboarding. Please try again.')
        return
      }
      window.location.href = data.url
    } catch {
      setStripeError('Network error. Please check your connection and try again.')
    } finally {
      setConnecting(false)
    }
  }

  async function handleFinish() {
    setFinishing(true)
    try {
      await fetch('/api/onboarding', { method: 'PATCH' })
      fireConfetti()
      await new Promise((r) => setTimeout(r, 800))
      router.push(isContractor ? '/dashboard' : '/dashboard')
      router.refresh()
    } catch {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Card */}
        <div className="rounded-2xl border border-white/[0.08] bg-surface-2 shadow-lg overflow-hidden">
          {/* Content */}
          <div className="p-8 pb-6">
            {/* Step 1: Welcome */}
            {step === 1 && (
              <div className="space-y-5">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-vektrum-blue/10">
                  <Shield size={28} className="text-blue-400" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold tracking-[-0.025em] text-white">
                    Welcome{fullName ? `, ${fullName.split(' ')[0]}` : ''}
                  </h2>
                  <p className="mt-2 text-[14px] leading-relaxed text-white/55">
                    {isContractor
                      ? 'Before you can create deals, we need to set up your payment account. This takes about 2 minutes.'
                      : 'Before you can fund deals, we need to connect your payment account. This takes about 2 minutes.'}
                  </p>
                </div>
                <ul className="space-y-2.5">
                  {(isContractor
                    ? [
                        'Milestone payouts — funds release when work is verified',
                        'Disputes isolate one milestone, not your whole project',
                        'Direct deposit to your bank via Stripe Connect',
                      ]
                    : [
                        '10-condition release gate — every check runs server-side',
                        'Full audit trail — immutable, timestamped, actor-logged',
                        'Stripe holds capital in Stripe-managed accounts until every release condition is met',
                      ]
                  ).map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <CheckCircle2
                        size={15}
                        className="mt-0.5 flex-shrink-0 text-emerald-400"
                      />
                      <span className="text-[13px] leading-relaxed text-white/55">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Step 2: Connect Stripe */}
            {step === 2 && (
              <div className="space-y-5">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/[0.08]">
                  <CreditCard size={28} className="text-amber-400" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold tracking-[-0.025em] text-white">
                    Connect Stripe
                  </h2>
                  <p className="mt-2 text-[14px] leading-relaxed text-white/55">
                    {isContractor
                      ? 'Connect your bank account via Stripe Connect Express to receive milestone payments directly.'
                      : 'Connect your Stripe account to fund deals and manage payments securely.'}
                  </p>
                </div>

                {stripeConnected ? (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08] p-4 flex items-start gap-3">
                    <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[13px] font-semibold text-emerald-400">
                        Stripe account connected
                      </p>
                      <p className="text-[12px] text-white/55 mt-0.5">
                        Your Stripe account is linked. You can proceed to the next step.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="rounded-xl border border-white/[0.08] bg-surface-3 p-4">
                      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white/70">
                        Stripe-powered
                      </p>
                      <p className="mt-1 text-[13px] leading-relaxed text-white/55">
                        {isContractor
                          ? 'Bank-grade security, instant payouts, zero markup on transfer fees.'
                          : 'Secure payment processing with transparent fee pass-through.'}
                      </p>
                    </div>

                    <button
                      onClick={handleConnectStripe}
                      disabled={connecting}
                      className="w-full flex items-center justify-center gap-2 rounded-lg bg-vektrum-blue px-4 py-3 text-[14px] font-semibold text-white hover:bg-vektrum-blue-hover transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {connecting && <Loader2 size={16} className="animate-spin" />}
                      {connecting ? 'Connecting…' : 'Connect with Stripe'}
                    </button>

                    {stripeError && (
                      <div className="flex items-start gap-2.5 rounded-lg border border-red-500/20 bg-red-500/[0.08] px-4 py-3">
                        <AlertCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-[12px] text-red-400 leading-relaxed">{stripeError}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Step 3: Done */}
            {step === 3 && (
              <div className="space-y-5">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/[0.08]">
                  <Zap size={28} className="text-emerald-400" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold tracking-[-0.025em] text-white">
                    You&rsquo;re all set
                  </h2>
                  <p className="mt-2 text-[14px] leading-relaxed text-white/55">
                    {isContractor
                      ? 'Your account is ready. Create your first deal and start getting paid for verified work.'
                      : 'Your account is ready. You can now fund deals and release milestone payments.'}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08] p-4">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-emerald-400">
                    Ready to go
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-white/55">
                    {isContractor
                      ? 'Head to your dashboard to create a deal, define milestones, and invite your funder.'
                      : 'Head to your dashboard to review deals, fund projects, and manage your portfolio.'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-white/[0.08] px-8 py-5">
            <StepIndicator current={step} total={3} />

            <div className="flex items-center gap-3">
              {step > 1 && (
                <button
                  onClick={() => setStep((s) => (s - 1) as Step)}
                  className="inline-flex items-center gap-1 text-[13px] font-medium text-white/55 hover:text-white transition-colors"
                >
                  <ArrowLeft size={14} />
                  Back
                </button>
              )}

              {step === 1 && (
                <Button variant="primary" size="sm" onClick={() => setStep(2)}>
                  Get started
                  <ArrowRight size={14} className="ml-1" />
                </Button>
              )}

              {step === 2 && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setStep(3)}
                  disabled={!stripeConnected}
                >
                  Continue
                  <ArrowRight size={14} className="ml-1" />
                </Button>
              )}

              {step === 3 && (
                <Button
                  variant="primary"
                  size="sm"
                  loading={finishing}
                  onClick={handleFinish}
                >
                  Go to Dashboard
                  <ArrowRight size={14} className="ml-1" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Skip link (below card) */}
        <p className="mt-4 text-center text-[12px] text-white/70">
          Having trouble?{' '}
          <a href="/dashboard/settings" className="text-blue-300 hover:text-blue-200 hover:underline">
            Go to Settings
          </a>
          {' '}to connect Stripe later.
        </p>
      </div>
    </div>
  )
}
