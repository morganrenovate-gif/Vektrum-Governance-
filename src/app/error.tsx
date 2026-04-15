'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // In production, log to your error tracking service here
    console.error('[Vektrum] Unhandled error:', error)
  }, [error])

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center space-y-6">
        {/* Icon */}
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-vektrum-red-bg">
          <AlertTriangle size={24} className="text-vektrum-red" aria-hidden="true" />
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-bold text-vektrum-text">
            Something went wrong
          </h1>
          <p className="text-sm leading-relaxed text-vektrum-muted">
            An unexpected error occurred. Your data is safe — no funds have been moved.
            {error.digest && (
              <span className="mt-1 block text-[11px] font-mono text-vektrum-faint">
                Error ID: {error.digest}
              </span>
            )}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={reset}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-vektrum-blue px-5 py-2.5 text-sm font-semibold text-white shadow-blue transition-all hover:bg-vektrum-blue-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue"
          >
            <RefreshCw size={14} aria-hidden="true" />
            Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-vektrum-border bg-vektrum-surface px-5 py-2.5 text-sm font-semibold text-vektrum-muted shadow-xs transition-all hover:bg-vektrum-surface-alt hover:text-vektrum-text"
          >
            <Home size={14} aria-hidden="true" />
            Back to dashboard
          </Link>
        </div>

        {/* Trust signal */}
        <p className="text-[11px] text-vektrum-faint">
          Vektrum never moves funds without server-side verification. Your balance is unaffected.
        </p>
      </div>
    </div>
  )
}
