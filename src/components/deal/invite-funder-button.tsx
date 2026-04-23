'use client'

import { useState } from 'react'
import { UserPlus, Copy, Check, RefreshCw, Loader2, Mail, AlertTriangle } from 'lucide-react'

interface Props {
  dealId: string
}

type BtnState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'sent'; url: string; expiresAt: string; email: string }
  | { phase: 'email_failed'; url: string; expiresAt: string; email: string }
  | { phase: 'open'; url: string; expiresAt: string }
  | { phase: 'copied'; url: string; expiresAt: string; prevPhase: 'sent' | 'email_failed' | 'open' }
  | { phase: 'error'; message: string }

export function InviteFunderButton({ dealId }: Props) {
  const [state, setState] = useState<BtnState>({ phase: 'idle' })
  const [email, setEmail] = useState('')

  const sendInvite = async (revoke = false) => {
    setState({ phase: 'loading' })
    const trimmedEmail = email.trim()

    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deal_id: dealId,
          ...(trimmedEmail ? { invited_email: trimmedEmail } : {}),
        }),
      })

      const body = await res.json()

      if (!res.ok) {
        setState({ phase: 'error', message: body.error ?? 'Failed to create invite.' })
        return
      }

      const url: string = body.invite_url
      const expiresAt: string = body.invite.expires_at

      if (trimmedEmail) {
        if (body.email_sent) {
          setState({ phase: 'sent', url, expiresAt, email: trimmedEmail })
        } else {
          setState({ phase: 'email_failed', url, expiresAt, email: trimmedEmail })
        }
      } else {
        setState({ phase: 'open', url, expiresAt })
      }
    } catch {
      setState({ phase: 'error', message: 'Network error. Check your connection and try again.' })
    }
  }

  const copyLink = async (url: string, returnPhase: 'sent' | 'email_failed' | 'open') => {
    try {
      await navigator.clipboard.writeText(url)
      const cur = state as Extract<BtnState, { url: string; expiresAt: string }>
      setState({ phase: 'copied', url, expiresAt: cur.expiresAt, prevPhase: returnPhase })
      setTimeout(() => {
        setState((prev) => {
          if (prev.phase !== 'copied') return prev
          if (prev.prevPhase === 'sent') return { phase: 'sent', url: prev.url, expiresAt: prev.expiresAt, email: (state as { email?: string }).email ?? '' }
          if (prev.prevPhase === 'email_failed') return { phase: 'email_failed', url: prev.url, expiresAt: prev.expiresAt, email: (state as { email?: string }).email ?? '' }
          return { phase: 'open', url: prev.url, expiresAt: prev.expiresAt }
        })
      }, 2000)
    } catch {
      // clipboard unavailable — user sees the link in the box
    }
  }

  const reset = () => {
    setState({ phase: 'idle' })
    setEmail('')
  }

  // ── Shared: link box + copy button ──────────────────────────────────────────
  const LinkBox = ({ url, isCopied, onCopy }: { url: string; isCopied: boolean; onCopy: () => void }) => (
    <div className="flex gap-1.5">
      <div className="min-w-0 flex-1 rounded-lg border border-vektrum-blue/25 bg-vektrum-blue/10 px-3 py-2.5">
        <p className="truncate font-mono text-xs text-vektrum-blue">{url}</p>
      </div>
      <button
        onClick={onCopy}
        aria-label={isCopied ? 'Copied' : 'Copy link'}
        className={`flex flex-shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-all ${
          isCopied
            ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400'
            : 'border-white/[0.1] bg-white/[0.05] text-white/55 hover:bg-white/[0.08] hover:text-white'
        }`}
      >
        {isCopied ? <><Check className="h-3.5 w-3.5" />Copied</> : <><Copy className="h-3.5 w-3.5" />Copy</>}
      </button>
    </div>
  )

  const ExpiryRow = ({ expiresAt, onNew }: { expiresAt: string; onNew: () => void }) => (
    <div className="flex items-center justify-between text-xs text-white/35">
      {expiresAt && (
        <span>Expires {new Date(expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
      )}
      <div className="flex gap-3">
        <button onClick={onNew} className="flex items-center gap-1 hover:text-white transition-colors">
          <RefreshCw className="h-3 w-3" />New link
        </button>
        <button onClick={reset} className="hover:text-white transition-colors">Done</button>
      </div>
    </div>
  )

  // ── Render: Idle ────────────────────────────────────────────────────────────
  if (state.phase === 'idle') {
    return (
      <div className="space-y-2">
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" aria-hidden="true" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendInvite()}
            placeholder="funder@company.com"
            className="w-full rounded-lg border border-white/[0.1] bg-surface-3 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-white/25 focus:border-vektrum-blue focus:outline-none focus:ring-1 focus:ring-vektrum-blue"
          />
        </div>
        <button
          onClick={() => sendInvite()}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-vektrum-blue px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-vektrum-blue-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-vektrum-blue focus-visible:ring-offset-2 active:scale-[0.99]"
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          {email.trim() ? 'Send Invite' : 'Generate Link'}
        </button>
        <p className="text-xs text-white/35">
          Enter an email to send the invite directly, or leave blank to get a copy-able link.
        </p>
      </div>
    )
  }

  // ── Render: Loading ─────────────────────────────────────────────────────────
  if (state.phase === 'loading') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-surface-3 px-4 py-3 text-sm text-white/55">
        <Loader2 className="h-4 w-4 animate-spin text-vektrum-blue" aria-hidden="true" />
        {email.trim() ? 'Sending invite…' : 'Generating secure link…'}
      </div>
    )
  }

  // ── Render: Error ───────────────────────────────────────────────────────────
  if (state.phase === 'error') {
    return (
      <div className="space-y-2">
        <div className="rounded-lg border border-red-500/20 bg-red-500/[0.07] px-3.5 py-3 text-sm text-red-400">
          {state.message}
        </div>
        <button onClick={reset} className="text-xs text-white/40 hover:text-white transition-colors">
          Try again
        </button>
      </div>
    )
  }

  // ── Render: Invite sent ─────────────────────────────────────────────────────
  if (state.phase === 'sent') {
    const isCopied = false
    return (
      <div className="space-y-2.5">
        <div className="flex items-center gap-2 rounded-lg border border-vektrum-green-border bg-vektrum-green-bg px-3.5 py-3 text-sm text-vektrum-green">
          <Check className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          Invite sent to <strong className="ml-1">{state.email}</strong>
        </div>
        <LinkBox url={state.url} isCopied={isCopied} onCopy={() => copyLink(state.url, 'sent')} />
        <ExpiryRow expiresAt={state.expiresAt} onNew={() => { setEmail(''); sendInvite(true) }} />
      </div>
    )
  }

  // ── Render: Email failed (invite created, email didn't send) ─────────────────
  if (state.phase === 'email_failed') {
    const isCopied = false
    return (
      <div className="space-y-2.5">
        <div className="flex items-start gap-2 rounded-lg border border-vektrum-amber-border bg-vektrum-amber-bg px-3.5 py-3 text-sm text-vektrum-amber">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <span>Invite created but email to <strong>{state.email}</strong> failed. Copy the link below and send it manually.</span>
        </div>
        <LinkBox url={state.url} isCopied={isCopied} onCopy={() => copyLink(state.url, 'email_failed')} />
        <ExpiryRow expiresAt={state.expiresAt} onNew={() => { setEmail(''); sendInvite(true) }} />
      </div>
    )
  }

  // ── Render: Link only (no email entered) ────────────────────────────────────
  if (state.phase === 'open') {
    const isCopied = false
    return (
      <div className="space-y-2.5">
        <LinkBox url={state.url} isCopied={isCopied} onCopy={() => copyLink(state.url, 'open')} />
        <ExpiryRow expiresAt={state.expiresAt} onNew={() => sendInvite(true)} />
      </div>
    )
  }

  // ── Render: Copied (brief) ──────────────────────────────────────────────────
  if (state.phase === 'copied') {
    const returnPhase = state.prevPhase
    return (
      <div className="space-y-2.5">
        {returnPhase === 'sent' && (
          <div className="flex items-center gap-2 rounded-lg border border-vektrum-green-border bg-vektrum-green-bg px-3.5 py-3 text-sm text-vektrum-green">
            <Check className="h-4 w-4 flex-shrink-0" />
            Invite sent
          </div>
        )}
        {returnPhase === 'email_failed' && (
          <div className="flex items-start gap-2 rounded-lg border border-vektrum-amber-border bg-vektrum-amber-bg px-3.5 py-3 text-sm text-vektrum-amber">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            Email failed — share the link manually
          </div>
        )}
        <LinkBox url={state.url} isCopied={true} onCopy={() => {}} />
        <ExpiryRow expiresAt={state.expiresAt} onNew={() => sendInvite(true)} />
      </div>
    )
  }

  return null
}
