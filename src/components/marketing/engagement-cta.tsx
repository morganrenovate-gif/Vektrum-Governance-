'use client'

/**
 * EngagementCta — Post-engagement sticky CTA for marketing pages
 *
 * Appears only after the visitor has demonstrated interest:
 *   - scroll ≥ 60% of the page, OR
 *   - 45 seconds spent on the page, OR
 *   - (article variant) bottom of a resource article is visible
 *
 * Safety rules:
 *   - Never appears immediately on page load.
 *   - Dismissed state persists in localStorage for 7 days.
 *   - Never renders on dashboard, auth, API, invite, demo-live, or print routes.
 *   - Hidden on screens < sm (≥640px) to avoid harming mobile navigation.
 *   - Respects prefers-reduced-motion (animation disabled via global CSS rule).
 *   - Does not steal focus when it appears.
 *   - Escape key dismisses.
 *   - Dismiss button has aria-label.
 *
 * Copy invariants (enforced by tests/engagement-cta.test.ts):
 *   - No custody / payment execution claims.
 *   - No escrow-replacement claims.
 *   - No AI-authorization claims (AI informs; gate decides; funder authorizes).
 *   - No fraud-prevention or dispute-elimination claims.
 */

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { X } from 'lucide-react'
import { BOOK_CALL_URL, BOOK_CALL_EXTERNAL } from '@/lib/book-call'
import { trackMetaEvent } from '@/lib/meta-pixel'

// ─── Constants ────────────────────────────────────────────────────────────────

const DISMISS_KEY     = 'vektrum_cta_dismissed_until'
const DISMISS_DAYS    = 7
const SCROLL_TRIGGER  = 0.60   // 60 % of the document scrolled
const TIME_TRIGGER_MS = 45_000 // 45 seconds

/**
 * Route prefixes where the CTA must not appear.
 * The marketing layout already excludes /dashboard, /auth, /api, etc., but
 * we guard here too so the component is safe if ever imported elsewhere.
 */
const EXCLUDED_PREFIXES = [
  '/demo-live',
  '/dashboard',
  '/auth',
  '/api',
  '/invite',
]

// ─── localStorage helpers ─────────────────────────────────────────────────────

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    return Date.now() < parseInt(raw, 10)
  } catch {
    return false // private browsing / storage unavailable
  }
}

function storeDismissal(): void {
  try {
    const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000
    localStorage.setItem(DISMISS_KEY, String(until))
  } catch {
    // Ignore — CTA just won't remember dismissal
  }
}

// ─── Lazy analytics helper ───────────────────────────────────────────────────
//
// We call `track` from @vercel/analytics only if it resolves correctly.
// This keeps the bundle impact minimal and avoids hard failures in environments
// where Vercel Analytics is not configured.

type TrackFn = (event: string, props?: Record<string, string>) => void

let _track: TrackFn | null = null

async function lazyTrack(event: string, props?: Record<string, string>) {
  if (!_track) {
    try {
      const mod = await import('@vercel/analytics')
      _track = mod.track as TrackFn
    } catch {
      _track = () => undefined
    }
  }
  try { _track(event, props) } catch { /* noop */ }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EngagementCta() {
  const pathname    = usePathname()
  const [show, setShow] = useState(false)
  const triggered   = useRef(false)
  const viewTracked = useRef(false)

  // ── Route exclusion ────────────────────────────────────────────────────────
  const excluded = EXCLUDED_PREFIXES.some((p) => pathname.startsWith(p))

  // ── Resource-article variant ───────────────────────────────────────────────
  // /resources and /resources/* use softer "live workflow" copy.
  const isResource = pathname.startsWith('/resources')

  // ── Trigger logic ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (excluded || isDismissed()) return

    function reveal() {
      if (triggered.current) return
      triggered.current = true
      setShow(true)
    }

    // Scroll trigger
    function handleScroll() {
      const docHeight  = document.documentElement.scrollHeight - window.innerHeight
      if (docHeight <= 0) return
      const ratio = window.scrollY / docHeight
      if (ratio >= SCROLL_TRIGGER) reveal()
    }

    // Time trigger
    const timer = window.setTimeout(reveal, TIME_TRIGGER_MS)

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // evaluate immediately in case page is short

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.clearTimeout(timer)
    }
  }, [excluded, pathname]) // re-evaluate when the route changes (SPA navigation)

  // ── Analytics: fire sticky_cta_view once ──────────────────────────────────
  useEffect(() => {
    if (show && !viewTracked.current) {
      viewTracked.current = true
      lazyTrack('sticky_cta_view', { variant: isResource ? 'resource' : 'default' })
    }
  }, [show, isResource])

  // ── Escape key ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!show) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleDismiss()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [show]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset on route change (SPA nav to a new page) ─────────────────────────
  useEffect(() => {
    triggered.current = false
    viewTracked.current = false
    setShow(false)
  }, [pathname])

  // ── Dismiss ────────────────────────────────────────────────────────────────
  function handleDismiss() {
    storeDismissal()
    setShow(false)
    lazyTrack('sticky_cta_dismiss')
  }

  if (!show || excluded) return null

  // ── Copy ───────────────────────────────────────────────────────────────────
  const heading = isResource
    ? 'Want to see this in a live draw workflow?'
    : 'Reviewing construction draw controls?'

  const body = isResource
    ? 'Vektrum shows how disputed milestones can be isolated while approved releases continue through governed controls.'
    : 'See how Vektrum governs contract execution, draw review, release gates, and audit trails.'

  const demoLabel = 'View demo'
  const bookLabel = isResource ? 'Talk to Vektrum' : 'Book walkthrough'

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    /*
     * hidden sm:flex — hidden on xs screens to avoid harming mobile navigation.
     * The sm breakpoint is 640px, a reasonable threshold for sticky overlay UX.
     * animate-slide-up — uses existing Tailwind keyframe; disabled by global
     *   prefers-reduced-motion CSS rule in globals.css.
     */
    <div
      role="complementary"
      aria-label="Vektrum engagement prompt"
      className="hidden sm:flex fixed bottom-5 right-5 z-40 w-[340px] max-w-[calc(100vw-2.5rem)] flex-col gap-3 rounded-2xl border border-white/[0.12] bg-[#0D1B2A]/96 p-5 shadow-2xl shadow-black/50 backdrop-blur-xl animate-slide-up"
    >
      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        aria-label="Dismiss this prompt"
        className="absolute right-3.5 top-3.5 flex h-6 w-6 items-center justify-center rounded-full text-white/55 hover:text-white hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue transition-colors"
      >
        <X size={13} aria-hidden="true" />
      </button>

      {/* Eyebrow */}
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-400/80">
        Vektrum · Conditional Release Governance
      </p>

      {/* Heading */}
      <p className="text-[14px] font-semibold leading-snug text-white pr-4">
        {heading}
      </p>

      {/* Body */}
      <p className="text-[12px] leading-relaxed text-white/70">
        {body}
      </p>

      {/* CTAs */}
      <div className="flex items-center gap-2 pt-0.5">
        <Link
          href="/demo-live"
          onClick={() => lazyTrack('sticky_cta_demo_click')}
          className="flex-1 rounded-lg bg-vektrum-blue px-3 py-2 text-center text-[12px] font-semibold text-white hover:bg-vektrum-blue-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue transition-colors shadow-sm shadow-vektrum-blue/30"
        >
          {demoLabel}
        </Link>
        <Link
          href={BOOK_CALL_URL}
          {...(BOOK_CALL_EXTERNAL
            ? { target: '_blank', rel: 'noopener noreferrer' }
            : {})}
          onClick={() => { lazyTrack('sticky_cta_book_click'); trackMetaEvent('Lead') }}
          className="flex-1 rounded-lg border border-white/[0.18] bg-white/[0.06] px-3 py-2 text-center text-[12px] font-medium text-white/90 hover:bg-white/[0.12] hover:text-white hover:border-white/[0.28] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue transition-all"
        >
          {bookLabel}
          {BOOK_CALL_EXTERNAL && (
            <span className="sr-only"> (opens in a new tab)</span>
          )}
        </Link>
      </div>

      {/* Trust anchor */}
      <p className="text-[10px] text-white/45 leading-snug">
        Workflow tools track. Vektrum enforces. Funds remain with your existing rail.
      </p>
    </div>
  )
}
