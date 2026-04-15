'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Shield,
  CheckCircle,
  AlertCircle,
  Clock,
  Building2,
  DollarSign,
  ArrowRight,
  Loader2,
  Lock,
} from 'lucide-react'
import { formatMoney } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface InvitePreview {
  invite: {
    id: string
    status: string
    expires_at: string
    invited_email: string | null
  }
  deal: {
    id: string
    title: string
    description: string | null
    total_amount: number
    status: string
    contractor_name: string
  }
}

type PageState =
  | { phase: 'loading' }
  | { phase: 'preview'; data: InvitePreview }
  | { phase: 'invalid'; reason: 'not_found' | 'expired' | 'used' }
  | { phase: 'accepting' }
  | { phase: 'accepted'; dealId: string; dealTitle: string }
  | { phase: 'error'; message: string }

// ─── Component ────────────────────────────────────────────────────────────────

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const [state, setState] = useState<PageState>({ phase: 'loading' })

  // ── Fetch invite preview ───────────────────────────────────────────────────
  const fetchPreview = useCallback(async () => {
    try {
      const res = await fetch(`/api/invites/${token}`)
      if (res.status === 404) {
        setState({ phase: 'invalid', reason: 'not_found' })
        return
      }
      if (!res.ok) {
        setState({ phase: 'error', message: 'Something went wrong loading this invite. Try refreshing.' })
        return
      }
      const data: InvitePreview = await res.json()
      setState({ phase: 'preview', data })
    } catch {
      setState({ phase: 'error', message: 'Network error. Check your connection and try again.' })
    }
  }, [token])

  useEffect(() => {
    fetchPreview()
  }, [fetchPreview])

  // ── Accept handler ─────────────────────────────────────────────────────────
  const handleAccept = async () => {
    setState({ phase: 'accepting' })
    try {
      const res = await fetch(`/api/invites/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const body = await res.json()

      if (res.status === 401) {
        // Not logged in — redirect to login with return URL
        router.push(`/auth/login?redirect=/invite/${token}`)
        return
      }

      if (res.status === 403) {
        setState({
          phase: 'error',
          message: body.error ?? 'You do not have permission to accept this invite.',
        })
        return
      }

      if (res.status === 409) {
        setState({
          phase: 'error',
          message: body.error ?? 'This deal already has a funder assigned.',
        })
        return
      }

      if (!res.ok) {
        setState({
          phase: 'error',
          message: body.error ?? 'Failed to accept the invite. Please try again.',
        })
        return
      }

      const previewDeal =
        state.phase === 'accepting'
          ? null
          : (state as { phase: 'preview'; data: InvitePreview }).data?.deal

      setState({
        phase: 'accepted',
        dealId: body.deal_id,
        dealTitle: previewDeal?.title ?? 'your new deal',
      })

      // Auto-redirect after 2.5 seconds
      setTimeout(() => {
        router.push(`/dashboard/deals/${body.deal_id}`)
      }, 2500)
    } catch {
      setState({
        phase: 'error',
        message: 'Network error. Check your connection and try again.',
      })
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-vektrum-bg flex flex-col items-center justify-center px-4 py-12">
      {/* Logo / brand bar */}
      <div className="mb-8 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-vektrum-blue">
          <Shield className="h-4 w-4 text-white" aria-hidden="true" />
        </div>
        <span className="text-sm font-bold tracking-wider text-vektrum-text uppercase">
          Vektrum
        </span>
      </div>

      <div className="w-full max-w-md">
        {/* ── Loading ── */}
        {state.phase === 'loading' && (
          <div className="rounded-xl border border-vektrum-border bg-vektrum-surface p-8 text-center shadow-sm">
            <Loader2 className="mx-auto mb-3 h-7 w-7 animate-spin text-vektrum-blue" aria-hidden="true" />
            <p className="text-sm text-vektrum-muted">Loading your invite…</p>
          </div>
        )}

        {/* ── Invalid / not found ── */}
        {state.phase === 'invalid' && (
          <div className="rounded-xl border border-vektrum-red-border bg-vektrum-red-bg p-8 text-center shadow-sm">
            <AlertCircle className="mx-auto mb-3 h-8 w-8 text-vektrum-red" aria-hidden="true" />
            <h1 className="mb-2 text-base font-bold text-vektrum-text">
              This invite link is no longer valid
            </h1>
            <p className="mb-6 text-sm text-vektrum-muted">
              It may have already been used, revoked by the contractor, or expired.
              Ask the contractor to generate a new link.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg bg-vektrum-blue px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-vektrum-blue-hover"
            >
              Go to dashboard
            </Link>
          </div>
        )}

        {/* ── Error ── */}
        {state.phase === 'error' && (
          <div className="rounded-xl border border-vektrum-red-border bg-vektrum-red-bg p-8 text-center shadow-sm">
            <AlertCircle className="mx-auto mb-3 h-8 w-8 text-vektrum-red" aria-hidden="true" />
            <h1 className="mb-2 text-base font-bold text-vektrum-text">Something went wrong</h1>
            <p className="mb-6 text-sm text-vektrum-muted">{state.message}</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={fetchPreview}
                className="rounded-lg border border-vektrum-border bg-vektrum-surface px-4 py-2.5 text-sm font-semibold text-vektrum-text transition-colors hover:bg-vektrum-surface-alt"
              >
                Try again
              </button>
              <Link
                href="/dashboard"
                className="text-center text-sm text-vektrum-muted hover:text-vektrum-text transition-colors"
              >
                Go to dashboard
              </Link>
            </div>
          </div>
        )}

        {/* ── Preview (main state) ── */}
        {state.phase === 'preview' && (
          <div className="rounded-xl border border-vektrum-border bg-vektrum-surface shadow-sm">
            {/* Header */}
            <div className="border-b border-vektrum-border-subtle px-6 py-5">
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-vektrum-blue">
                Deal Invitation
              </p>
              <h1 className="text-xl font-bold text-vektrum-text">
                {state.data.deal.title}
              </h1>
              {state.data.deal.description && (
                <p className="mt-1.5 text-sm text-vektrum-muted leading-relaxed">
                  {state.data.deal.description}
                </p>
              )}
            </div>

            {/* Deal details */}
            <div className="px-6 py-5 space-y-3">
              {/* Contractor */}
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-vektrum-blue-subtle">
                  <Building2 className="h-4 w-4 text-vektrum-blue" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs text-vektrum-faint">Contractor</p>
                  <p className="text-sm font-semibold text-vektrum-text">
                    {state.data.deal.contractor_name}
                  </p>
                </div>
              </div>

              {/* Deal value */}
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-vektrum-green-bg">
                  <DollarSign className="h-4 w-4 text-vektrum-green" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs text-vektrum-faint">Total deal value</p>
                  <p className="text-sm font-semibold text-vektrum-text">
                    {formatMoney(state.data.deal.total_amount)}
                  </p>
                </div>
              </div>

              {/* Expiry */}
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-vektrum-amber-bg">
                  <Clock className="h-4 w-4 text-vektrum-amber" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs text-vektrum-faint">Invite expires</p>
                  <p className="text-sm font-semibold text-vektrum-text">
                    {new Date(state.data.invite.expires_at).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* Security note */}
            <div className="mx-6 mb-5 flex items-start gap-2.5 rounded-lg border border-vektrum-blue-border bg-vektrum-blue-subtle px-3.5 py-3 text-xs text-vektrum-blue">
              <Lock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
              <span>
                Accepting this invite links your funder account to this deal room.
                Milestone payments are governed by Vektrum's 7-condition release gate — funds are
                held by Stripe and released only with your explicit approval.
              </span>
            </div>

            {/* Accept button */}
            <div className="px-6 pb-6">
              <button
                onClick={handleAccept}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-vektrum-blue px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-vektrum-blue-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-vektrum-blue focus-visible:ring-offset-2 active:scale-[0.99]"
              >
                Accept &amp; Enter Deal Room
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <p className="mt-2.5 text-center text-xs text-vektrum-faint">
                You must be signed in as a Funder to accept.
              </p>
            </div>
          </div>
        )}

        {/* ── Accepting (loading) ── */}
        {state.phase === 'accepting' && (
          <div className="rounded-xl border border-vektrum-border bg-vektrum-surface p-8 text-center shadow-sm">
            <Loader2 className="mx-auto mb-3 h-7 w-7 animate-spin text-vektrum-blue" aria-hidden="true" />
            <p className="text-sm font-semibold text-vektrum-text">Setting up your deal room…</p>
            <p className="mt-1 text-xs text-vektrum-muted">This takes just a moment.</p>
          </div>
        )}

        {/* ── Accepted ── */}
        {state.phase === 'accepted' && (
          <div className="rounded-xl border border-vektrum-green-border bg-vektrum-green-bg p-8 text-center shadow-sm">
            <CheckCircle className="mx-auto mb-3 h-8 w-8 text-vektrum-green" aria-hidden="true" />
            <h1 className="mb-2 text-base font-bold text-vektrum-text">
              You're in the deal room
            </h1>
            <p className="mb-6 text-sm text-vektrum-muted">
              You've been assigned as the funder for{' '}
              <strong className="text-vektrum-text">{state.dealTitle}</strong>.
              Redirecting you now…
            </p>
            <Link
              href={`/dashboard/deals/${state.dealId}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-vektrum-blue px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-vektrum-blue-hover"
            >
              Go to deal room
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        )}

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-vektrum-faint">
          Protected by Vektrum · Trust. Built In.
        </p>
      </div>
    </div>
  )
}
