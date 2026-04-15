'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, LayoutDashboard } from 'lucide-react'
import Link from 'next/link'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Vektrum] Dashboard error:', error)
  }, [error])

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-vektrum-red-border bg-vektrum-red-bg p-8 text-center space-y-5">
          {/* Icon */}
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
            <AlertTriangle size={20} className="text-vektrum-red" aria-hidden="true" />
          </div>

          {/* Copy */}
          <div className="space-y-1.5">
            <h2 className="font-display text-xl font-bold text-vektrum-text">
              Dashboard error
            </h2>
            <p className="text-sm text-vektrum-muted">
              The dashboard couldn&rsquo;t load. Your deals and funds are unaffected.
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
              Reload dashboard
            </button>
            <Link
              href="/"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-vektrum-border bg-white px-5 py-2.5 text-sm font-semibold text-vektrum-muted transition-all hover:bg-vektrum-surface-alt"
            >
              <LayoutDashboard size={14} aria-hidden="true" />
              Go home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
