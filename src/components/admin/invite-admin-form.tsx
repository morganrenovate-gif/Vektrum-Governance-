'use client'

import { useState } from 'react'
import { Mail, Send } from 'lucide-react'
import { cn } from '@/lib/utils'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function InviteAdminForm() {
  const [email, setEmail]       = useState('')
  const [sending, setSending]   = useState(false)
  const [success, setSuccess]   = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSuccess(null)
    setError(null)

    const trimmed = email.trim().toLowerCase()

    if (!trimmed || !EMAIL_REGEX.test(trimmed)) {
      setError('Please enter a valid email address.')
      return
    }

    setSending(true)

    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Request failed' }))
        setError(data.error ?? 'Failed to send invite.')
        return
      }

      setSuccess(`Invite sent to ${trimmed}`)
      setEmail('')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-xl border border-vektrum-border bg-vektrum-surface px-5 py-5 shadow-sm">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-vektrum-blue-subtle">
          <Mail size={13} className="text-vektrum-blue" aria-hidden="true" />
        </div>
        <h3 className="text-[13px] font-semibold text-vektrum-text">Invite New Admin</h3>
      </div>
      <p className="text-[12px] text-vektrum-muted mb-4">
        Send an email invite to a new user with admin privileges. They will receive a sign-up link.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1">
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError(null)
              setSuccess(null)
            }}
            placeholder="admin@company.com"
            className="w-full rounded-lg border border-vektrum-border bg-vektrum-bg px-3 py-2 text-[13px] text-vektrum-text placeholder:text-vektrum-faint focus:outline-none focus:ring-2 focus:ring-vektrum-blue/30 focus:border-vektrum-blue transition-all"
          />
        </div>
        <button
          type="submit"
          disabled={sending}
          className={cn(
            'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium transition-all',
            sending
              ? 'bg-vektrum-surface-alt text-vektrum-faint border border-vektrum-border cursor-not-allowed'
              : 'bg-vektrum-blue text-white hover:bg-vektrum-blue-hover'
          )}
        >
          <Send size={13} aria-hidden="true" />
          {sending ? 'Sending…' : 'Send Invite'}
        </button>
      </form>

      {success && (
        <p className="mt-3 text-[12px] font-medium text-vektrum-green">{success}</p>
      )}
      {error && (
        <p className="mt-3 text-[12px] font-medium text-red-600">{error}</p>
      )}
    </div>
  )
}
