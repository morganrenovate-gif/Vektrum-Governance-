'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCheck } from 'lucide-react'

export function MarkAllReadButton() {
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)
  const router = useRouter()

  const handleClick = async () => {
    setLoading(true)
    try {
      await fetch('/api/notifications/mark-read', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ all: true }),
      })
      setDone(true)
      // Refresh the server component so read_at changes are reflected
      router.refresh()
    } catch {
      // Silent — user can retry
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <span className="flex items-center gap-1.5 text-[12px] text-white/40">
        <CheckCheck size={13} aria-hidden="true" />
        All marked as read
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-md border border-white/[0.10] px-3 py-1.5 text-[12px] font-medium text-white/55 hover:text-white/85 hover:border-white/20 hover:bg-white/[0.04] transition-colors disabled:opacity-40"
    >
      <CheckCheck size={13} aria-hidden="true" />
      {loading ? 'Marking…' : 'Mark all as read'}
    </button>
  )
}
