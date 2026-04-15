'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ArrowRight, X, Zap, Shield, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Profile } from '@/lib/types'
import { fireConfetti } from './confetti'

interface OnboardingWizardProps {
  profile: Profile
}

type Step = 1 | 2 | 3

const TOTAL_STEPS = 3

// ─── Step content ─────────────────────────────────────────────────────────────

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
                : 'w-5 bg-vektrum-border',
          ].join(' ')}
        />
      ))}
    </div>
  )
}

function Step1({ role }: { role: Profile['role'] }) {
  const isContractor = role === 'contractor'
  return (
    <div className="space-y-5">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-vektrum-blue/10">
        <Shield size={28} className="text-vektrum-blue" />
      </div>
      <div>
        <h2 className="text-xl font-bold tracking-[-0.025em] text-vektrum-text">
          {isContractor
            ? 'Get paid when you deliver'
            : "Release only what\u2019s earned"}
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-vektrum-muted">
          {isContractor
            ? 'Vektrum tracks every milestone, every approval, and every dollar. No 90-day net terms. No disputes freezing your whole project.'
            : 'Every disbursement passes 7 server-side checks before a dollar moves. Milestones approved, funds available, no disputes, contractor verified.'}
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
              '7-condition release gate — every check runs server-side',
              'Full audit trail — immutable, timestamped, actor-logged',
              "Dispute isolation \u2014 a $15K disagreement won\u2019t freeze a $9M job",
            ]
        ).map((item) => (
          <li key={item} className="flex items-start gap-2.5">
            <CheckCircle2
              size={15}
              className="mt-0.5 flex-shrink-0 text-vektrum-green"
            />
            <span className="text-[13px] leading-relaxed text-vektrum-muted">
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Step2({ role }: { role: Profile['role'] }) {
  const isContractor = role === 'contractor'
  return (
    <div className="space-y-5">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-vektrum-amber-bg">
        <Zap size={28} className="text-vektrum-amber" />
      </div>
      <div>
        <h2 className="text-xl font-bold tracking-[-0.025em] text-vektrum-text">
          {isContractor ? 'Create your first deal' : 'Your portfolio at a glance'}
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-vektrum-muted">
          {isContractor
            ? 'Set up a deal in minutes. Define milestones, set amounts, and invite your funder. Vektrum governs every release from there.'
            : 'Every funded deal shows live readiness scores, pending approvals, and capital deployment — all in one dashboard.'}
        </p>
      </div>
      <div className="rounded-xl border border-vektrum-border bg-vektrum-surface-alt p-4">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-vektrum-faint">
          {isContractor ? 'Typical setup time' : 'Average portfolio view'}
        </p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-vektrum-text">
          {isContractor ? '< 5 min' : 'Real-time'}
        </p>
        <p className="mt-1 text-[12px] text-vektrum-muted">
          {isContractor
            ? 'From account to first funded milestone'
            : 'Capital summary, release queue, and risk scores'}
        </p>
      </div>
    </div>
  )
}

function Step3({ role }: { role: Profile['role'] }) {
  return (
    <div className="space-y-5">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-vektrum-green-bg">
        <CreditCard size={28} className="text-vektrum-green" />
      </div>
      <div>
        <h2 className="text-xl font-bold tracking-[-0.025em] text-vektrum-text">
          {role === 'contractor' ? 'Connect your bank' : 'Ready to fund a deal'}
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-vektrum-muted">
          {role === 'contractor'
            ? 'Connect your bank account via Stripe Connect to receive milestone payments directly. No intermediary holds your money.'
            : 'Vektrum never holds funds. Stripe holds the funds. Vektrum holds the rules. Your capital stays in your Stripe account until every condition is met.'}
        </p>
      </div>
      <div className="rounded-xl border border-vektrum-green-border bg-vektrum-green-bg p-4">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-vektrum-green">
          Stripe-powered
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-vektrum-muted">
          {role === 'contractor'
            ? 'Stripe Connect Express — bank-grade security, instant payouts, zero markup on transfer fees.'
            : 'Stripe holds escrow. Vektrum governs release. Fees passed through at cost — never marked up.'}
        </p>
      </div>
      {role === 'contractor' && (
        <div className="inline-flex items-center gap-1.5 rounded-full border border-vektrum-amber-border bg-vektrum-amber-bg px-3 py-1">
          <span className="text-[11px] font-medium text-vektrum-amber">
            Connect Stripe from your dashboard settings after setup
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export function OnboardingWizard({ profile }: OnboardingWizardProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [completing, setCompleting] = useState(false)
  const [visible, setVisible] = useState(true)

  const completeOnboarding = useCallback(
    async (withConfetti = false) => {
      setCompleting(true)
      try {
        await fetch('/api/onboarding', { method: 'PATCH' })
        if (withConfetti) {
          fireConfetti()
          // Small delay so user sees the confetti before reload
          await new Promise((r) => setTimeout(r, 800))
        }
        router.refresh()
      } catch {
        // Fail silently — wizard closes, dashboard still works
      } finally {
        setCompleting(false)
        setVisible(false)
      }
    },
    [router],
  )

  const handleNext = () => {
    if (step < TOTAL_STEPS) {
      setStep((s) => (s + 1) as Step)
    } else {
      completeOnboarding(true)
    }
  }

  const handleSkip = () => {
    completeOnboarding(false)
  }

  if (!visible) return null

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-vektrum-canvas/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Vektrum"
    >
      {/* Panel */}
      <div className="relative w-full max-w-md animate-slide-up rounded-2xl border border-vektrum-border bg-vektrum-surface shadow-2xl shadow-vektrum-canvas/30">
        {/* Skip button */}
        <button
          onClick={handleSkip}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-vektrum-faint hover:bg-vektrum-surface-alt hover:text-vektrum-muted transition-colors"
          aria-label="Skip onboarding"
          disabled={completing}
        >
          <X size={16} />
        </button>

        {/* Content */}
        <div className="p-8 pb-6">
          {step === 1 && <Step1 role={profile.role} />}
          {step === 2 && <Step2 role={profile.role} />}
          {step === 3 && <Step3 role={profile.role} />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-vektrum-border px-8 py-5">
          <StepIndicator current={step} total={TOTAL_STEPS} />

          <div className="flex items-center gap-3">
            {step > 1 && (
              <button
                onClick={() => setStep((s) => (s - 1) as Step)}
                className="text-[13px] font-medium text-vektrum-muted hover:text-vektrum-text transition-colors"
                disabled={completing}
              >
                Back
              </button>
            )}
            <Button
              variant="primary"
              size="sm"
              loading={completing}
              onClick={handleNext}
            >
              {step < TOTAL_STEPS ? (
                <>
                  Next
                  <ArrowRight size={14} className="ml-1" />
                </>
              ) : (
                "Let's go"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
