'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Shield,
  CheckCircle2,
  AlertCircle,
  Clock,
  Building2,
  ArrowRight,
  Loader2,
  Lock,
  BadgeCheck,
  FileCheck,
} from 'lucide-react'
import { formatMoney } from '@/lib/utils'
import { VektrumWordmark } from '@/components/ui/vektrum-logo'

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

// ─── Trust signals shown on the invite page ───────────────────────────────────

const TRUST_SIGNALS = [
  {
    icon: Lock,
    label: 'Funds held by Stripe',
    desc: 'Vektrum governs release — never holds your capital',
  },
  {
    icon: Shield,
    label: '7-condition release gate',
    desc: 'Payments move only with your explicit approval',
  },
  {
    icon: FileCheck,
    label: 'Immutable audit trail',
    desc: 'Every action logged with timestamp — no edits, no deletes',
  },
  {
    icon: BadgeCheck,
    label: 'Single-use secure link',
    desc: 'This invite token expires after acceptance',
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const [state, setState] = useState<PageState>({ phase: 'loading' })

  // Store preview data to access after phase transition
  const [previewData, setPreviewData] = useState<InvitePreview | null>(null)

  // ── Fetch invite preview ───────────────────────────────────────────────────
  const fetchPreview = useCallback(async () => {
    setState({ phase: 'loading' })
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
      setPreviewData(data)
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
        router.push(`/auth/login?redirect=/invite/${token}`)
        return
      }

      if (res.status === 403) {
        setState({ phase: 'error', message: body.error ?? 'You do not have permission to accept this invite.' })
        return
      }

      if (res.status === 409) {
        setState({ phase: 'error', message: body.error ?? 'This deal already has a funder assigned.' })
        return
      }

      if (!res.ok) {
        setState({ phase: 'error', message: body.error ?? 'Failed to accept the invite. Please try again.' })
        return
      }

      setState({
        phase: 'accepted',
        dealId: body.deal_id,
        dealTitle: previewData?.deal?.title ?? 'your new deal',
      })

      setTimeout(() => {
        router.push(`/dashboard/deals/${body.deal_id}`)
      }, 2500)
    } catch {
      setState({ phase: 'error', message: 'Network error. Check your connection and try again.' })
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-vektrum-bg flex flex-col items-center justify-center px-4 py-12">
      {/* Brand header */}
      <div className="mb-8">
        <VektrumWordmark showTagline />
      </div>

      <div className="w-full max-w-lg">

        {/* ── Loading ── */}
        {state.phase === 'loading' && (
          <div className="rounded-2xl border border-vektrum-border bg-vektrum-surface p-10 text-center shadow-md">
            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-vektrum-blue" aria-hidden="true" />
            <p className="text-sm font-medium text-vektrum-text">Loading your invite…</p>
            <p className="mt-1 text-xs text-vektrum-muted">Verifying invite token</p>
          </div>
        )}

        {/* ── Invalid / not found ── */}
        {state.phase === 'invalid' && (
          <div className="rounded-2xl border border-vektrum-red-border bg-vektrum-surface p-8 text-center shadow-md">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-vektrum-red-bg">
              <AlertCircle className="h-6 w-6 text-vektrum-red" aria-hidden="true" />
            </div>
            <h1 className="font-display text-lg font-bold text-vektrum-text">
              Invite link no longer valid
            </h1>
            <p className="mt-2 text-sm text-vektrum-muted">
              This link may have already been used, revoked, or expired.
              Ask the contractor to generate a new invite link.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center gap-1.5 rounded-lg border border-vektrum-border bg-vektrum-surface px-5 py-2.5 text-sm font-semibold text-vektrum-muted hover:bg-vektrum-surface-alt transition-all"
            >
              Learn about Vektrum
            </Link>
          </div>
        )}

        {/* ── Error ── */}
        {state.phase === 'error' && (
          <div className="rounded-2xl border border-vektrum-red-border bg-vektrum-surface p-8 text-center shadow-md">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-vektrum-red-bg">
              <AlertCircle className="h-6 w-6 text-vektrum-red" aria-hidden="true" />
            </div>
            <h1 className="font-display text-lg font-bold text-vektrum-text">Something went wrong</h1>
            <p className="mt-2 text-sm text-vektrum-muted">{state.message}</p>
            <button
              onClick={fetchPreview}
              className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-vektrum-blue px-5 py-2.5 text-sm font-semibold text-white shadow-blue hover:bg-vektrum-blue-hover transition-all"
            >
              Try again
            </button>
          </div>
        )}

        {/* ── Preview (main state) — #1 growth surface ── */}
        {state.phase === 'preview' && (
          <div className="rounded-2xl border border-vektrum-border bg-vektrum-surface shadow-lg overflow-hidden">
            {/* Top accent bar */}
            <div className="h-1 w-full bg-vektrum-blue" />

            {/* Header */}
            <div className="px-6 pt-6 pb-5 border-b border-vektrum-border-subtle">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-vektrum-blue-border bg-vektrum-blue-subtle px-3 py-1 mb-3">
                <div className="h-1.5 w-1.5 rounded-full bg-vektrum-blue animate-pulse-slow" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-vektrum-blue">
                  Deal Invitation
                </span>
              </div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-vektrum-text">
                {state.data.deal.title}
              </h1>
              {state.data.deal.description && (
                <p className="mt-2 text-sm leading-relaxed text-vektrum-muted">
                  {state.data.deal.description}
                </p>
              )}
            </div>

            {/* Deal amount — the financial hero */}
            <div className="px-6 py-6 bg-vektrum-bg border-b border-vektrum-border-subtle">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-vektrum-muted mb-1.5">
                Total deal value
              </p>
              <p className="font-display text-5xl font-bold tabular-nums tracking-tight text-vektrum-text">
                {formatMoney(state.data.deal.total_amount)}
              </p>
              <p className="mt-1.5 text-sm text-vektrum-muted">
                Protected by Vektrum's 7-condition release gate
              </p>
            </div>

            {/* Deal details */}
            <div className="px-6 py-5 space-y-3 border-b border-vektrum-border-subtle">
              {/* Contractor */}
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-vektrum-blue-subtle">
                  <Building2 className="h-4 w-4 text-vektrum-blue" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-vektrum-faint">Contractor</p>
                  <p className="text-sm font-semibold text-vektrum-text">
                    {state.data.deal.contractor_name}
                  </p>
                </div>
              </div>

              {/* Expiry */}
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-vektrum-amber-bg">
                  <Clock className="h-4 w-4 text-vektrum-amber" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-vektrum-faint">Invite expires</p>
                  <p className="text-sm font-semibold text-vektrum-text">
                    {new Date(state.data.invite.expires_at).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* Trust signals grid */}
            <div className="px-6 py-5 border-b border-vektrum-border-subtle">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-vektrum-faint mb-3">
                How your funds are protected
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {TRUST_SIGNALS.map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="flex items-start gap-2.5 rounded-lg bg-vektrum-bg px-3 py-2.5">
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-vektrum-blue-subtle mt-0.5">
                      <Icon size={12} className="text-vektrum-blue" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-vektrum-text">{label}</p>
                      <p className="text-[11px] leading-snug text-vektrum-muted mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Accept CTA */}
            <div className="px-6 py-5">
              <button
                onClick={handleAccept}
                className="group flex w-full items-center justify-center gap-2.5 min-h-[52px] rounded-xl bg-vektrum-blue px-6 py-3.5 text-[15px] font-semibold text-white shadow-blue transition-all hover:bg-vektrum-blue-hover hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue active:scale-[0.99]"
              >
                <Shield size={16} aria-hidden="true" />
                Accept &amp; Enter Deal Room
                <ArrowRight
                  size={15}
                  className="transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </button>
              <p className="mt-3 text-center text-[12px] text-vektrum-faint">
                You must be signed in with a Funder account to accept.
                {' '}
                <Link href="/auth/signup" className="text-vektrum-blue hover:underline">
                  Create a free account
                </Link>
              </p>
            </div>
          </div>
        )}

        {/* ── Accepting (processing) ── */}
        {state.phase === 'accepting' && (
          <div className="rounded-2xl border border-vektrum-border bg-vektrum-surface p-10 text-center shadow-md">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-vektrum-blue-subtle">
              <Loader2 className="h-6 w-6 animate-spin text-vektrum-blue" aria-hidden="true" />
            </div>
            <p className="text-base font-semibold text-vektrum-text">Setting up your deal room…</p>
            <p className="mt-1.5 text-sm text-vektrum-muted">Assigning funder role and verifying access.</p>
          </div>
        )}

        {/* ── Accepted ── */}
        {state.phase === 'accepted' && (
          <div className="rounded-2xl border border-vektrum-green-border bg-vektrum-surface shadow-lg overflow-hidden">
            <div className="h-1 w-full bg-vektrum-green" />
            <div className="p-8 text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-vektrum-green-bg">
                <CheckCircle2 className="h-7 w-7 text-vektrum-green" aria-hidden="true" />
              </div>
              <div>
                <h1 className="font-display text-xl font-bold text-vektrum-text">
                  You&rsquo;re in the deal room
                </h1>
                <p className="mt-2 text-sm text-vektrum-muted">
                  You&rsquo;ve been assigned as funder for{' '}
                  <strong className="text-vektrum-text">{state.dealTitle}</strong>.
                  Redirecting you now…
                </p>
              </div>
              <Link
                href={`/dashboard/deals/${state.dealId}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-vektrum-blue px-6 py-2.5 text-sm font-semibold text-white shadow-blue hover:bg-vektrum-blue-hover transition-all"
              >
                Open deal room
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        )}

        {/* Footer trust stamp */}
        <div className="mt-6 flex items-center justify-center gap-2 text-[12px] text-vektrum-faint">
          <Shield size={12} className="text-vektrum-blue" aria-hidden="true" />
          <span>Protected by Vektrum · Payments powered by Stripe</span>
        </div>
      </div>
    </div>
  )
}
