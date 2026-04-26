'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCcw, CheckCircle2, Loader2 } from 'lucide-react'

type Variant = 'banner' | 'admin'
type ResetState = 'idle' | 'loading' | 'done'

interface DemoResetButtonProps {
  variant?: Variant
}

/**
 * Resets the demo to its starting point.
 *
 * Because demo state is stored in React component state (not a database),
 * a reset is achieved by calling POST /api/demo/reset (safety-gated) and
 * then navigating back to /demo-live — which unmounts all deal pages and
 * returns every milestone, modal, and override to its initial value.
 */
export function DemoResetButton({ variant = 'banner' }: DemoResetButtonProps) {
  const router = useRouter()
  const [resetState, setResetState] = useState<ResetState>('idle')

  async function handleReset() {
    if (resetState !== 'idle') return

    setResetState('loading')

    try {
      await fetch('/api/demo/reset', { method: 'POST' })
    } catch {
      // Swallow fetch errors — the navigation achieves the reset regardless.
    }

    setResetState('done')

    // Brief confirmation, then navigate to the demo entry point.
    setTimeout(() => {
      router.push('/demo-live')
    }, 1100)
  }

  if (variant === 'banner') {
    return (
      <button
        type="button"
        onClick={handleReset}
        disabled={resetState !== 'idle'}
        className={`
          inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-[11px] font-bold
          transition-all duration-200 disabled:cursor-default
          ${resetState === 'done'
            ? 'bg-emerald-500 text-white'
            : resetState === 'loading'
            ? 'bg-emerald-600 text-white opacity-80'
            : 'bg-emerald-500 text-white hover:bg-emerald-400'
          }
        `}
      >
        {resetState === 'loading' && <Loader2 size={11} className="animate-spin" />}
        {resetState === 'done' && <CheckCircle2 size={11} />}
        {resetState === 'idle' && <RotateCcw size={11} />}
        {resetState === 'done' ? '✓ Reset' : resetState === 'loading' ? 'Resetting…' : 'Reset Demo'}
      </button>
    )
  }

  // admin variant — wider button with label
  return (
    <div className="flex items-center gap-4 rounded-xl border border-white/[0.08] bg-surface-2 px-5 py-4">
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-white">Reset Demo Environment</p>
        <p className="mt-0.5 text-[12px] text-white/55">
          Returns all deals and milestones to their starting state for the next visitor.
        </p>
      </div>
      <button
        type="button"
        onClick={handleReset}
        disabled={resetState !== 'idle'}
        className={`
          inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold
          border transition-all duration-200 disabled:cursor-default
          ${resetState === 'done'
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
            : 'border-white/[0.14] bg-white/[0.06] text-white/80 hover:bg-white/[0.10] hover:border-white/[0.22] hover:text-white'
          }
        `}
      >
        {resetState === 'loading' && <Loader2 size={14} className="animate-spin" />}
        {resetState === 'done' && <CheckCircle2 size={14} />}
        {resetState === 'idle' && <RotateCcw size={14} />}
        {resetState === 'loading' ? 'Resetting…' : resetState === 'done' ? 'Demo reset' : 'Reset Demo'}
      </button>
    </div>
  )
}
