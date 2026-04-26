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

      setSuccess(`Invite sent to ${trimmed}. They will receive an email with instructions to set up their admin account.`)
      setEmail('')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-surface-2 px-5 py-5 shadow-sm">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-vektrum-blue/10">
          <Mail size={13} className="text-blue-400" aria-hidden="true" />
        </div>
        <h3 className="text-[13px] font-semibold text-white">Invite New Admin</h3>
      </div>
      <p className="text-[12px] text-white/75 mb-4">
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
            aria-label="Admin email address"
            className="w-full rounded-lg border border-white/[0.14] bg-surface-3 px-3 py-2 text-[13px] text-white placeholder:text-white/55 focus:outline-none focus:ring-2 focus:ring-vektrum-blue/50 focus:border-vektrum-blue transition-all"
          />
          <p className="text-xs text-white/70 mt-1">
            Invited users will receive admin access upon accepting. This action is logged in the audit trail.
          </p>
        </div>
        <button
          type="submit"
          disabled={sending || !email.trim() || !EMAIL_REGEX.test(email.trim())}
          className={cn(
            'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue',
            sending || !email.trim() || !EMAIL_REGEX.test(email.trim())
              ? 'bg-surface-3 text-white/55 border border-white/[0.08] cursor-not-allowed'
              : 'bg-vektrum-blue text-white hover:bg-vektrum-blue-hover'
          )}
        >
          <Send size={13} aria-hidden="true" />
          {sending ? 'Sending invite…' : 'Send Invite'}
        </button>
      </form>

      {success && (
        <div className="mt-3 rounded-lg bg-green-50 border border-green-200 px-4 py-3">
          <p className="text-[12px] font-medium text-green-700">{success}</p>
        </div>
      )}
      {error && (
        <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-[12px] font-medium text-red-600">{error}</p>
        </div>
      )}
    </div>
  )
}
