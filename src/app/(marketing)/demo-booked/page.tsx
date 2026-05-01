import type { Metadata } from 'next'
import { DemoBookedClient } from './demo-booked-client'

export const metadata: Metadata = {
  title: 'Demo Scheduled',
  description: 'Your Vektrum walkthrough is confirmed. We look forward to showing you governed construction disbursements.',
  robots: { index: false, follow: false },
}

/**
 * /demo-booked — thank-you page shown after a prospect books a walkthrough.
 *
 * Server component shell; fires fbq('track', 'Schedule') on the client via
 * <DemoBookedClient /> so the pixel event runs after hydration without
 * making the whole page a client component.
 */
export default function DemoBookedPage() {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-16 bg-vektrum-bg">
      <DemoBookedClient />
      <div className="text-center space-y-6 max-w-md">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/[0.08]">
          {/* ✓ */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-8 w-8 text-emerald-400"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <div>
          <h1 className="font-display text-3xl font-bold text-white">
            You&rsquo;re on the calendar
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-white/60">
            We&rsquo;ll walk you through Vektrum&rsquo;s 10-condition release gate,
            AI-assisted draw review, and append-only audit trail. Check your inbox
            for a calendar invite.
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-6 py-4 text-left space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-400/80">
            What we&rsquo;ll cover
          </p>
          <ul className="space-y-1.5 text-sm text-white/65">
            <li>→ Release gate: 10 conditions before any draw moves</li>
            <li>→ AI-assisted review — informs, never approves</li>
            <li>→ Append-only, hash-chained audit trail</li>
            <li>→ Partner rail options: Stripe, title, escrow, treasury</li>
          </ul>
        </div>

        <a
          href="/"
          className="inline-block text-sm font-medium text-blue-300 hover:text-blue-200 hover:underline"
        >
          Back to Vektrum
        </a>
      </div>
    </main>
  )
}
