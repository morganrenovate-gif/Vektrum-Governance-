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
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-500/[0.08]">
          <AlertTriangle size={24} className="text-red-400" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-xl font-bold text-white">
            Invite link error
          </h1>
          <p className="text-sm text-white/55">
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
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-surface-2 px-5 py-2.5 text-sm font-semibold text-white/55 transition-all hover:bg-surface-3"
          >
            Learn about Vektrum
          </Link>
        </div>
      </div>
    </div>
  )
}
