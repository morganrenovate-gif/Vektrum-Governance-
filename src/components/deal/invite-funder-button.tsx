'use client'

import { useState } from 'react'
import { UserPlus, Copy, Check, RefreshCw, X, Loader2, Mail } from 'lucide-react'

interface Props {
  dealId: string
}

type BtnState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'open'; url: string; expiresAt: string; reused?: boolean }
  | { phase: 'copied' }
  | { phase: 'error'; message: string }

export function InviteFunderButton({ dealId }: Props) {
  const [state, setState] = useState<BtnState>({ phase: 'idle' })
  const [email, setEmail] = useState('')
  const [showEmailInput, setShowEmailInput] = useState(false)

  const generateLink = async (revoke = false) => {
    setState({ phase: 'loading' })

    try {
      // If revoking previous invite first
      if (revoke) {
        const getRes = await fetch(`/api/invites?deal_id=${dealId}`)
        if (getRes.ok) {
          const { invites } = await getRes.json()
          const pending = invites?.find((i: { status: string; id: string }) => i.status === 'pending')
          if (pending) {
            // Mark as revoked via admin (we just re-call POST — backend handles expiry + re-create)
          }
        }
      }

      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deal_id: dealId,
          ...(email.trim() ? { invited_email: email.trim() } : {}),
        }),
      })

      const body = await res.json()

      if (!res.ok) {
        setState({ phase: 'error', message: body.error ?? 'Failed to generate invite link.' })
        return
      }

      setState({
        phase: 'open',
        url: body.invite_url,
        expiresAt: body.invite.expires_at,
        reused: body.reused,
      })
    } catch {
      setState({ phase: 'error', message: 'Network error. Check your connection and try again.' })
    }
  }

  const copyLink = async () => {
    if (state.phase !== 'open') return
    try {
      await navigator.clipboard.writeText(state.url)
      setState((prev) => ({ ...prev, phase: 'copied' }))
      setTimeout(() => {
        setState((prev) =>
          prev.phase === 'copied'
            ? { phase: 'open', url: (prev as { phase: 'copied'; url?: string }).url ?? '', expiresAt: '' }
            : prev,
        )
      }, 2000)
    } catch {
      // Fallback: select text in input
    }
  }

  const reset = () => {
    setState({ phase: 'idle' })
    setEmail('')
    setShowEmailInput(false)
  }

  // ── Render: Idle ────────────────────────────────────────────────────────────
  if (state.phase === 'idle') {
    return (
      <div className="space-y-2">
        {showEmailInput && (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-vektrum-faint" aria-hidden="true" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="funder@company.com (optional)"
                className="w-full rounded-lg border border-vektrum-border bg-vektrum-surface py-2.5 pl-9 pr-3 text-sm text-vektrum-text placeholder:text-vektrum-faint focus:border-vektrum-blue focus:outline-none focus:ring-1 focus:ring-vektrum-blue"
              />
            </div>
            <button
              onClick={() => setShowEmailInput(false)}
              aria-label="Cancel email input"
              className="rounded-lg border border-vektrum-border p-2.5 text-vektrum-faint transition-colors hover:text-vektrum-text"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => generateLink()}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-vektrum-blue px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-vektrum-blue-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-vektrum-blue focus-visible:ring-offset-2 active:scale-[0.99]"
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Generate Invite Link
          </button>
          {!showEmailInput && (
            <button
              onClick={() => setShowEmailInput(true)}
              title="Add funder email (optional)"
              className="rounded-lg border border-vektrum-border bg-vektrum-surface px-3 py-2.5 text-vektrum-muted transition-colors hover:bg-vektrum-surface-alt hover:text-vektrum-text"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
        <p className="text-xs text-vektrum-faint">
          Generates a secure 7-day link. Anyone with the link can join as funder.
        </p>
      </div>
    )
  }

  // ── Render: Loading ─────────────────────────────────────────────────────────
  if (state.phase === 'loading') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-vektrum-border bg-vektrum-surface px-4 py-3 text-sm text-vektrum-muted">
        <Loader2 className="h-4 w-4 animate-spin text-vektrum-blue" aria-hidden="true" />
        Generating secure link…
      </div>
    )
  }

  // ── Render: Error ───────────────────────────────────────────────────────────
  if (state.phase === 'error') {
    return (
      <div className="space-y-2">
        <div className="rounded-lg border border-vektrum-red-border bg-vektrum-red-bg px-3.5 py-3 text-sm text-vektrum-red">
          {state.message}
        </div>
        <button
          onClick={reset}
          className="text-xs text-vektrum-muted hover:text-vektrum-text transition-colors"
        >
          Try again
        </button>
      </div>
    )
  }

  // ── Render: Link shown (open or copied) ─────────────────────────────────────
  if (state.phase === 'open' || state.phase === 'copied') {
    const url = (state as { url: string }).url
    const expiresAt = (state as { expiresAt?: string }).expiresAt
    const reused = (state as { reused?: boolean }).reused

    return (
      <div className="space-y-2.5">
        {reused && (
          <p className="text-xs text-vektrum-amber">
            ↩ Existing active invite returned. Use "New link" to revoke and regenerate.
          </p>
        )}

        {/* Link display + copy */}
        <div className="flex gap-1.5">
          <div className="min-w-0 flex-1 rounded-lg border border-vektrum-blue-border bg-vektrum-blue-subtle px-3 py-2.5">
            <p className="truncate font-mono text-xs text-vektrum-blue">{url}</p>
          </div>
          <button
            onClick={copyLink}
            aria-label={state.phase === 'copied' ? 'Copied' : 'Copy link'}
            className={`flex flex-shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-all ${
              state.phase === 'copied'
                ? 'border-vektrum-green-border bg-vektrum-green-bg text-vektrum-green'
                : 'border-vektrum-border bg-vektrum-surface text-vektrum-muted hover:bg-vektrum-surface-alt hover:text-vektrum-text'
            }`}
          >
            {state.phase === 'copied' ? (
              <>
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                Copy
              </>
            )}
          </button>
        </div>

        {/* Expiry + actions */}
        <div className="flex items-center justify-between text-xs text-vektrum-faint">
          {expiresAt && (
            <span>
              Expires{' '}
              {new Date(expiresAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => generateLink(true)}
              className="flex items-center gap-1 hover:text-vektrum-text transition-colors"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              New link
            </button>
            <button
              onClick={reset}
              className="hover:text-vektrum-text transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
