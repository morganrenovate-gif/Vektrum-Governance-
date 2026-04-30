'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function DealError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Vektrum] Deal page error:', error)
  }, [error])

  return (
    <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-16">
      <div className="max-w-md mx-auto">
        {/* Breadcrumb */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue rounded transition-colors mb-8"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Back to dashboard
        </Link>

        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.08] p-8 text-center space-y-5">
          {/* Icon */}
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
            <AlertTriangle size={20} className="text-red-400" aria-hidden="true" />
          </div>

          {/* Copy */}
          <div className="space-y-1.5">
            <h2 className="font-display text-xl font-bold text-white">
              Deal couldn&rsquo;t load
            </h2>
            <p className="text-sm text-white/85">
              There was a problem loading this deal. No funds have been moved or
              affected.
            </p>
            {error.digest && (
              <p className="text-[11px] font-mono text-white/70 mt-2">
                Error: {error.digest}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              onClick={reset}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-vektrum-blue px-5 py-2.5 text-sm font-semibold text-white shadow-blue transition-all hover:bg-vektrum-blue-hover"
            >
              <RefreshCw size={14} aria-hidden="true" />
              Try again
            </button>
            <Link
              href="/dashboard"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-white/[0.16] bg-white/[0.05] px-5 py-2.5 text-sm font-semibold text-white/90 hover:bg-white/[0.1] hover:text-white hover:border-white/[0.24] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue transition-all"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              Dashboard
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-[12px] text-white/65">
          Vektrum&rsquo;s release gate requires server-side verification. Any pending
          approvals are still in their last known state.
        </p>
      </div>
    </div>
  )
}
