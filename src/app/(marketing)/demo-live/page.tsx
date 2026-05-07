import type { Metadata } from 'next'
import Link from 'next/link'
import { Landmark, HardHat, Shield, ArrowRight, Play } from 'lucide-react'

// ISR: public marketing surface — no per-user data, safe to cache.
export const revalidate = 3600

// Self-canonical so /demo-live is not duplicated by search engines via any
// campaign UTM/redirect path. Title is set explicitly with a single " | Vektrum"
// suffix to avoid the "Demo — Vektrum | Vektrum" double-suffix pattern.
export const metadata: Metadata = {
  title: 'Interactive Construction Draw Demo | Vektrum',
  description:
    'Walk through Vektrum’s release gate as a funder, contractor, or admin. See how draw conditions are verified before release authorization, and how the audit trail captures the decision.',
  alternates: { canonical: 'https://vektrum.io/demo-live' },
  openGraph: {
    title: 'Interactive Construction Draw Demo | Vektrum',
    description:
      'Walk through Vektrum’s release gate as a funder, contractor, or admin — see how draw conditions are verified before release authorization.',
    url: 'https://vektrum.io/demo-live',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    title: 'Interactive Construction Draw Demo | Vektrum',
    description:
      'Walk through Vektrum’s release gate — funder, contractor, and admin views over the same draw.',
  },
}

const roles = [
  {
    role: 'Funder',
    name: 'Sarah Chen',
    company: 'Meridian Capital Partners',
    description: 'See portfolio overview, capital deployed, deal action queue, and draw request reviews.',
    href: '/demo-live/funder',
    icon: Landmark,
    badge: 'bg-vektrum-blue/10 text-blue-300 border-vektrum-blue/30',
    dot: 'bg-vektrum-blue',
  },
  {
    role: 'Contractor',
    name: 'Marcus Webb',
    company: 'Webb Construction Group',
    description: 'See your deals, milestone status, draw request flow, and payment history.',
    href: '/demo-live/contractor',
    icon: HardHat,
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    dot: 'bg-emerald-400',
  },
  {
    role: 'Admin',
    name: 'Platform Admin',
    company: 'Vektrum',
    description: 'See platform-wide stats, open disputes, user management, and audit log.',
    href: '/demo-live/admin',
    icon: Shield,
    badge: 'bg-amber-500/[0.08] text-amber-400 border-amber-500/20',
    dot: 'bg-vektrum-amber',
  },
] as const

export default function DemoLivePage() {
  return (
    <div className="relative min-h-screen bg-surface-0 overflow-hidden">

      {/* Ambient glow — matches hero */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-gradient-to-b from-vektrum-blue/12 to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 pt-24 pb-24 sm:pt-32 sm:pb-32">

        {/* ─── Header ──────────────────────────────────────────────────── */}
        <div className="text-center mb-16">
          <div className="mb-5 inline-flex items-center gap-3">
            <div className="h-px w-5 bg-vektrum-blue" />
            <p className="text-[11px] tracking-[0.12em] uppercase text-blue-300 font-semibold">
              Interactive Demo
            </p>
            <div className="h-px w-5 bg-vektrum-blue" />
          </div>

          <h1 className="font-display text-[2.75rem] sm:text-5xl font-bold tracking-[-0.04em] text-white leading-[1.05]">
            Explore the platform.
          </h1>
          <p className="mt-5 text-[16px] leading-relaxed text-white/55 max-w-sm mx-auto">
            Choose a role to walk through a live deal. All data is simulated.
          </p>
        </div>

        {/* ─── Role Cards ──────────────────────────────────────────────── */}
        <div className="grid gap-5 sm:grid-cols-3 max-w-4xl mx-auto">
          {roles.map((r) => (
            <Link
              key={r.role}
              href={r.href}
              className="group rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card p-7 flex flex-col transition-all duration-300 hover:-translate-y-1 hover:border-white/[0.14]"
              
            >
              {/* Icon + badge row */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.08]">
                  <r.icon size={17} className="text-white/70" aria-hidden="true" />
                </div>
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${r.badge}`}>
                  {r.role}
                </span>
              </div>

              {/* Identity */}
              <p className="text-[15px] font-semibold text-white leading-snug">{r.name}</p>
              <p className="text-[12px] text-white/75 mt-0.5">{r.company}</p>

              {/* Description */}
              <p className="mt-4 text-[13px] text-white/65 leading-relaxed flex-1">
                {r.description}
              </p>

              {/* CTA */}
              <div className="mt-6 pt-5 border-t border-white/[0.06] flex items-center justify-between">
                <span className="text-[13px] font-semibold text-blue-300">
                  Enter demo
                </span>
                <ArrowRight
                  size={14}
                  className="text-blue-300 transition-transform duration-200 group-hover:translate-x-1"
                />
              </div>
            </Link>
          ))}
        </div>

        {/* ─── Guided walkthrough CTA ──────────────────────────────────── */}
        <div className="mt-10 max-w-4xl mx-auto">
          <Link
            href="/demo-live/walkthrough"
            className="group flex items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-surface-2 shadow-card p-6 hover:border-white/[0.14] transition-all duration-300 hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-vektrum-blue/10 border border-vektrum-blue/25">
                <Play size={15} className="text-blue-300" aria-hidden="true" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-white leading-snug">
                  Guided 6-step walkthrough
                </p>
                <p className="text-[12px] text-white/55 mt-0.5">
                  From draw submission to authorized release — including a gate blocker and resolution.
                </p>
              </div>
            </div>
            <ArrowRight
              size={14}
              className="text-blue-300 flex-shrink-0 transition-transform duration-200 group-hover:translate-x-1"
            />
          </Link>
        </div>

        {/* ─── Footer note ─────────────────────────────────────────────── */}
        <p className="mt-10 text-center text-[12px] text-white/75 tracking-wide">
          No account required &nbsp;·&nbsp; Simulated data only &nbsp;·&nbsp; No real funds
        </p>

      </div>
    </div>
  )
}
