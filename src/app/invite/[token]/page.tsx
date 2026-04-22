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
    <div className="relative min-h-screen bg-[#0D1B2A] flex flex-col items-center justify-center px-4 py-16 overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-gradient-to-b from-vektrum-blue/10 to-transparent rounded-full blur-3xl" />

      {/* Brand header */}
      <div className="relative mb-10">
        <VektrumWordmark showTagline />
      </div>

      <div className="relative w-full max-w-lg">

        {/* ── Loading ── */}
        {state.phase === 'loading' && (
          <div
            className="rounded-2xl border border-white/[0.08] bg-[#111827] p-10 text-center"
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03)' }}
          >
            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-vektrum-blue" aria-hidden="true" />
            <p className="text-sm font-medium text-white">Loading your invite…</p>
            <p className="mt-1 text-xs text-white/40">Verifying invite token</p>
          </div>
        )}

        {/* ── Invalid / not found ── */}
        {state.phase === 'invalid' && (
          <div
            className="rounded-2xl border border-red-500/20 bg-[#111827] p-8 text-center"
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03)' }}
          >
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
              <AlertCircle className="h-6 w-6 text-red-400" aria-hidden="true" />
            </div>
            <h1 className="font-display text-lg font-bold text-white">
              Invite link no longer valid
            </h1>
            <p className="mt-2 text-sm text-white/55">
              This link may have already been used, revoked, or expired.
              Ask the contractor to generate a new invite link.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center gap-1.5 rounded-xl border border-white/[0.1] bg-white/[0.05] px-5 py-2.5 text-sm font-semibold text-white/60 hover:bg-white/[0.08] hover:text-white transition-all"
            >
              Learn about Vektrum
            </Link>
          </div>
        )}

        {/* ── Error ── */}
        {state.phase === 'error' && (
          <div
            className="rounded-2xl border border-red-500/20 bg-[#111827] p-8 text-center"
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03)' }}
          >
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
              <AlertCircle className="h-6 w-6 text-red-400" aria-hidden="true" />
            </div>
            <h1 className="font-display text-lg font-bold text-white">Something went wrong</h1>
            <p className="mt-2 text-sm text-white/55">{state.message}</p>
            <button
              onClick={fetchPreview}
              className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-vektrum-blue px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-vektrum-blue/30 hover:bg-vektrum-blue-hover transition-all"
            >
              Try again
            </button>
          </div>
        )}

        {/* ── Preview (main state) — #1 growth surface ── */}
        {state.phase === 'preview' && (
          <div
            className="rounded-2xl border border-white/[0.08] bg-[#111827] overflow-hidden"
            style={{ boxShadow: '0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)' }}
          >
            {/* Top accent bar */}
            <div className="h-[3px] w-full bg-vektrum-blue" />

            {/* Header */}
            <div className="px-6 pt-6 pb-5 border-b border-white/[0.06]">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-vektrum-blue/25 bg-vektrum-blue/10 px-3 py-1 mb-3">
                <div className="h-1.5 w-1.5 rounded-full bg-vektrum-blue animate-pulse" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-vektrum-blue">
                  Deal Invitation
                </span>
              </div>
              <h1 className="font-display text-[1.75rem] font-bold tracking-[-0.03em] text-white leading-tight">
                {state.data.deal.title}
              </h1>
              {state.data.deal.description && (
                <p className="mt-2 text-sm leading-relaxed text-white/55">
                  {state.data.deal.description}
                </p>
              )}
            </div>

            {/* Deal amount — the financial hero */}
            <div className="px-6 py-6 bg-white/[0.03] border-b border-white/[0.06]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35 mb-2">
                Total deal value
              </p>
              <p className="font-display text-5xl font-bold tabular-nums tracking-[-0.03em] text-white">
                {formatMoney(state.data.deal.total_amount)}
              </p>
              <p className="mt-1.5 text-sm text-white/40">
                Protected by Vektrum&rsquo;s 7-condition release gate
              </p>
            </div>

            {/* Deal details */}
            <div className="px-6 py-5 space-y-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.08]">
                  <Building2 className="h-4 w-4 text-white/60" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/30">Contractor</p>
                  <p className="text-sm font-semibold text-white/80">{state.data.deal.contractor_name}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-vektrum-amber/10 border border-vektrum-amber/20">
                  <Clock className="h-4 w-4 text-vektrum-amber" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/30">Invite expires</p>
                  <p className="text-sm font-semibold text-white/80">
                    {new Date(state.data.invite.expires_at).toLocaleDateString('en-US', {
                      month: 'long', day: 'numeric', year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* Trust signals grid */}
            <div className="px-6 py-5 border-b border-white/[0.06]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30 mb-3">
                How your funds are protected
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {TRUST_SIGNALS.map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="flex items-start gap-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 py-2.5">
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-vektrum-blue/10 mt-0.5">
                      <Icon size={12} className="text-vektrum-blue" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white/80">{label}</p>
                      <p className="text-[11px] leading-snug text-white/40 mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Accept CTA */}
            <div className="px-6 py-5">
              <button
                onClick={handleAccept}
                className="group flex w-full items-center justify-center gap-2.5 min-h-[52px] rounded-xl bg-vektrum-blue px-6 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-vektrum-blue/30 transition-all hover:bg-vektrum-blue-hover hover:shadow-xl hover:shadow-vektrum-blue/40 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue active:scale-[0.99]"
              >
                <Shield size={16} aria-hidden="true" />
                Accept &amp; Enter Deal Room
                <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </button>
              <p className="mt-3 text-center text-[12px] text-white/30">
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
          <div
            className="rounded-2xl border border-white/[0.08] bg-[#111827] p-10 text-center"
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03)' }}
          >
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-vektrum-blue/10">
              <Loader2 className="h-6 w-6 animate-spin text-vektrum-blue" aria-hidden="true" />
            </div>
            <p className="text-base font-semibold text-white">Setting up your deal room…</p>
            <p className="mt-1.5 text-sm text-white/45">Assigning funder role and verifying access.</p>
          </div>
        )}

        {/* ── Accepted ── */}
        {state.phase === 'accepted' && (
          <div
            className="rounded-2xl border border-emerald-500/20 bg-[#111827] overflow-hidden"
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03)' }}
          >
            <div className="h-[3px] w-full bg-emerald-500" />
            <div className="p-8 text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
                <CheckCircle2 className="h-7 w-7 text-emerald-400" aria-hidden="true" />
              </div>
              <div>
                <h1 className="font-display text-xl font-bold text-white">
                  You&rsquo;re in the deal room
                </h1>
                <p className="mt-2 text-sm text-white/55">
                  You&rsquo;ve been assigned as funder for{' '}
                  <strong className="text-white">{state.dealTitle}</strong>.
                  Redirecting you now…
                </p>
              </div>
              <Link
                href={`/dashboard/deals/${state.dealId}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-vektrum-blue px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-vektrum-blue/30 hover:bg-vektrum-blue-hover transition-all"
              >
                Open deal room
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        )}

        {/* Footer trust stamp */}
        <div className="mt-8 flex items-center justify-center gap-2 text-[12px] text-white/25">
          <Shield size={12} className="text-vektrum-blue" aria-hidden="true" />
          <span>Protected by Vektrum · Payments powered by Stripe</span>
        </div>
      </div>
    </div>
  )
}
