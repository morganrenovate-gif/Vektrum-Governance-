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
          className="inline-flex items-center gap-1.5 text-sm text-vektrum-muted hover:text-vektrum-text transition-colors mb-8"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Back to dashboard
        </Link>

        <div className="rounded-xl border border-vektrum-red-border bg-vektrum-red-bg p-8 text-center space-y-5">
          {/* Icon */}
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
            <AlertTriangle size={20} className="text-vektrum-red" aria-hidden="true" />
          </div>

          {/* Copy */}
          <div className="space-y-1.5">
            <h2 className="font-display text-xl font-bold text-vektrum-text">
              Deal couldn&rsquo;t load
            </h2>
            <p className="text-sm text-vektrum-muted">
              There was a problem loading this deal. No funds have been moved or
              affected.
            </p>
            {error.digest && (
              <p className="text-[11px] font-mono text-vektrum-faint mt-2">
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
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-vektrum-border bg-white px-5 py-2.5 text-sm font-semibold text-vektrum-muted transition-all hover:bg-vektrum-surface-alt"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              Dashboard
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-[12px] text-vektrum-faint">
          Vektrum&rsquo;s release gate requires server-side verification. Any pending
          approvals are still in their last known state.
        </p>
      </div>
    </div>
  )
}
