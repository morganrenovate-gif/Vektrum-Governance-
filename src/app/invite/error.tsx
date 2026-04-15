'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import Link from 'next/link'

export default function InviteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Vektrum] Invite page error:', error)
  }, [error])

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-vektrum-red-bg">
          <AlertTriangle size={24} className="text-vektrum-red" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-xl font-bold text-vektrum-text">
            Invite link error
          </h1>
          <p className="text-sm text-vektrum-muted">
            This invite link couldn&rsquo;t be loaded. Please check the link and try again,
            or ask the contractor to send a new invite.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            onClick={reset}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-vektrum-blue px-5 py-2.5 text-sm font-semibold text-white shadow-blue transition-all hover:bg-vektrum-blue-hover"
          >
            <RefreshCw size={14} aria-hidden="true" />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-vektrum-border bg-vektrum-surface px-5 py-2.5 text-sm font-semibold text-vektrum-muted transition-all hover:bg-vektrum-surface-alt"
          >
            Learn about Vektrum
          </Link>
        </div>
      </div>
    </div>
  )
}
