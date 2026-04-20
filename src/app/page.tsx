import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  Shield,
  GitBranch,
  FileText,
  ArrowRight,
  Lock,
  CheckCircle2,
  Zap,
  Building2,
  TrendingUp,
  X,
  BadgeCheck,
  Star,
  AlertCircle,
  Banknote,
} from 'lucide-react'
import { DemoScene } from '@/components/homepage/demo-scene'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="flex flex-col">

      {/* ─── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#0D1B2A]">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-b from-vektrum-blue/15 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 right-0 w-[500px] h-[500px] bg-gradient-to-l from-vektrum-blue/8 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 pt-24 pb-16 sm:pt-32 sm:pb-20">
          <div className="lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center lg:pt-8">

            {/* LEFT */}
            <div>
              <div className="animate-fade-in mb-6 flex items-center justify-center lg:justify-start gap-3">
                <div className="h-px w-5 bg-vektrum-blue" />
                <p className="text-[11px] tracking-[0.12em] uppercase text-vektrum-blue font-semibold">
                  Construction Draw Governance
                </p>
              </div>

              <h1 className="animate-fade-in font-display text-center lg:text-left text-[2.75rem] font-bold tracking-[-0.04em] text-white sm:text-6xl lg:text-[4rem] lg:leading-[1.05] leading-[1.08]">
                Every dollar.<br />
                Every draw.<br />
                <em className="not-italic text-white/50">Governed.</em>
              </h1>

              <p className="animate-fade-in-delay mx-auto lg:mx-0 mt-6 max-w-lg text-center lg:text-left text-[17px] leading-relaxed text-white/60">
                Vektrum enforces milestone-based releases, isolates disputes to individual draws,
                and ensures funds move only when work is verified.
              </p>

              <div className="animate-fade-in-delay-3 mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-3">
                <Link
                  href="/auth/signup"
                  className="group inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-vektrum-blue px-8 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-vektrum-blue/30 transition-all hover:bg-vektrum-blue-hover hover:shadow-xl hover:shadow-vektrum-blue/40 hover:-translate-y-0.5"
                >
                  Start a deal — it&apos;s free
                  <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
                <a
                  href="#demo"
                  className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-7 py-3 text-[14px] font-semibold text-white/70 hover:bg-white/10 hover:text-white transition-all"
                >
                  See how it works
                  <span className="text-white/40">↓</span>
                </a>
              </div>

              {/* Proof stats */}
              <div className="mt-10 flex gap-8 justify-center lg:justify-start pt-8 border-t border-white/[0.08]">
                <div className="flex flex-col gap-1">
                  <span className="font-display text-[28px] font-bold text-white leading-none tracking-[-0.03em]">7</span>
                  <span className="text-[12px] text-white/40">Server-side release conditions</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-display text-[19px] font-bold text-white leading-none tracking-[-0.02em] pt-1">Non-custodial</span>
                  <span className="text-[12px] text-white/40">Funds held by Stripe, not Vektrum</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-display text-[28px] font-bold text-white leading-none tracking-[-0.03em]">∞</span>
                  <span className="text-[12px] text-white/40">Audit trail, forever</span>
                </div>
              </div>
            </div>

            {/* RIGHT — product card */}
            <div className="hidden lg:block lg:mt-2">
              <div
                className="rounded-2xl border border-white/10 bg-[#111827] overflow-hidden transition-transform duration-500 hover:-translate-y-1"
                style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)' }}
              >
                <div className="flex items-center gap-1.5 border-b border-white/[0.06] bg-white/[0.02] px-4 py-3">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                  <div className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                  <div className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                  <div className="mx-auto flex items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.03] px-3 py-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-vektrum-blue" />
                    <span className="text-[11px] text-white/30">app.vektrum.io — Deal Dashboard</span>
                  </div>
                </div>

                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/30 mb-1">Active Deal</p>
                      <p className="text-[15px] font-semibold text-white">Harbor Logistics Center</p>
                      <p className="font-display text-[26px] font-bold text-white tracking-[-0.03em] leading-none mt-1">$9,000,000</p>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.08em] px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Active</span>
                  </div>

                  <div className="space-y-1.5 mt-3">
                    <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-emerald-500/15 bg-emerald-500/5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                        <div>
                          <p className="text-[12px] font-medium text-white/80">Site Preparation</p>
                          <p className="text-[10px] text-white/35">Completed &amp; verified</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[12px] font-semibold tabular-nums text-white">$320,000</span>
                        <span className="text-[9px] font-bold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">Released</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-red-500/20 bg-red-500/5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                        <div>
                          <p className="text-[12px] font-medium text-white/80">Concrete Sub-grade</p>
                          <p className="text-[10px] text-white/35">Review hold — isolated</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[12px] font-semibold tabular-nums text-white">$15,000</span>
                        <span className="text-[9px] font-bold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">Dispute</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2 h-2 rounded-full bg-vektrum-blue flex-shrink-0" />
                        <div>
                          <p className="text-[12px] font-medium text-white/80">Structural Steel</p>
                          <p className="text-[10px] text-white/35">Processing normally</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[12px] font-semibold tabular-nums text-white">$2,180,000</span>
                        <span className="text-[9px] font-bold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded bg-vektrum-blue/15 text-vektrum-blue">In Progress</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2 h-2 rounded-full bg-white/20 flex-shrink-0" />
                        <div>
                          <p className="text-[12px] font-medium text-white/80">MEP Systems</p>
                          <p className="text-[10px] text-white/35">Queued</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[12px] font-semibold tabular-nums text-white">$1,640,000</span>
                        <span className="text-[9px] font-bold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/40">Upcoming</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 px-3.5 py-3 rounded-xl border border-vektrum-blue/20 bg-vektrum-blue/[0.07] mt-1">
                    <Zap size={13} className="text-vektrum-blue mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[12px] font-semibold text-vektrum-blue">$15K locked · $8,985,000 flowing</p>
                      <p className="text-[11px] text-white/40 mt-0.5 leading-relaxed">The dispute is isolated to its milestone. Every other payment proceeds on schedule.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ─── The Defining Scenario ─────────────────────────────────────────── */}
      <section className="bg-[#031226] py-20 sm:py-28 border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="grid gap-16 lg:grid-cols-2 lg:items-center">

            {/* Left: copy */}
            <div>
              <div className="mb-6 flex items-center gap-3">
                <div className="h-px w-5 bg-vektrum-blue" />
                <p className="text-[11px] tracking-[0.12em] uppercase text-vektrum-blue font-semibold">
                  The defining scenario
                </p>
              </div>
              <h2 className="font-display text-[2.75rem] sm:text-5xl lg:text-[3.5rem] font-bold tracking-[-0.04em] text-white leading-[1.05]">
                A $15K dispute.<br />
                A $9M project<br />
                <em className="not-italic text-white/40">unaffected.</em>
              </h2>
              <p className="mt-6 text-[16px] leading-relaxed text-white/55 max-w-md">
                In every other system, a disputed payment freezes the job. In Vektrum,
                disputes are isolated to their milestone. The rest of the project keeps
                moving. That&apos;s not a feature — it&apos;s the architecture.
              </p>

              <div className="mt-8 flex flex-col gap-5">
                {[
                  {
                    icon: Lock,
                    title: 'Milestone isolation by design',
                    desc: 'Each milestone is an independent financial unit. One dispute cannot freeze another.',
                    bg: 'bg-vektrum-blue/10',
                    color: 'text-vektrum-blue',
                  },
                  {
                    icon: CheckCircle2,
                    title: '7-condition server-side gate',
                    desc: 'Every release passes 7 checks simultaneously. No manual override. No spreadsheet.',
                    bg: 'bg-vektrum-blue/10',
                    color: 'text-vektrum-blue',
                  },
                  {
                    icon: GitBranch,
                    title: 'Immutable audit trail',
                    desc: 'No update. No delete. Every status change timestamped and actor-logged, forever.',
                    bg: 'bg-vektrum-blue/10',
                    color: 'text-vektrum-blue',
                  },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-4">
                    <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${item.bg}`}>
                      <item.icon size={16} className={item.color} />
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-white mb-1">{item.title}</p>
                      <p className="text-[13px] leading-relaxed text-white/45">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

            </div>

            {/* Right: scenario card */}
            <div
              className="rounded-2xl border border-white/[0.08] bg-[#111827] p-8"
              style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}
            >
              <div className="flex items-start justify-between pb-5 mb-5 border-b border-white/[0.07]">
                <div>
                  <p className="text-[16px] font-semibold text-white">Harbor Logistics Center</p>
                  <p className="font-display text-[22px] font-bold text-white/80 tracking-[-0.03em] mt-0.5">$9,000,000 total value</p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.08em] px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Active</span>
              </div>

              <div className="space-y-2">
                {[
                  { name: 'Site Preparation', amount: '$320,000', status: 'Released', dot: 'bg-emerald-500', badge: 'bg-emerald-500/15 text-emerald-400', row: 'border-emerald-500/15 bg-emerald-500/5' },
                  { name: 'Concrete Sub-grade', amount: '$15,000', status: 'Locked', dot: 'bg-red-500', badge: 'bg-red-500/15 text-red-400', row: 'border-red-500/20 bg-red-500/5' },
                  { name: 'Structural Steel', amount: '$2,180,000', status: 'Active', dot: 'bg-vektrum-blue', badge: 'bg-vektrum-blue/15 text-vektrum-blue', row: 'border-white/[0.06] bg-white/[0.02]' },
                  { name: 'MEP Systems', amount: '$1,640,000', status: 'Queued', dot: 'bg-white/20', badge: 'bg-white/[0.06] text-white/40', row: 'border-white/[0.06] bg-white/[0.02]' },
                  { name: 'Finishes & Cert', amount: '$4,845,000', status: 'Queued', dot: 'bg-white/20', badge: 'bg-white/[0.06] text-white/40', row: 'border-white/[0.06] bg-white/[0.02]' },
                ].map((m) => (
                  <div key={m.name} className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border ${m.row}`}>
                    <div className="flex items-center gap-2.5">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${m.dot}`} />
                      <span className="text-[13px] font-medium text-white/80">{m.name}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-[13px] font-semibold tabular-nums text-white">{m.amount}</span>
                      <span className={`text-[9px] font-bold uppercase tracking-[0.06em] px-2 py-0.5 rounded ${m.badge}`}>{m.status}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 pt-5 border-t border-white/[0.07] space-y-2">
                <div className="flex justify-between">
                  <span className="text-[13px] text-white/40">Locked in dispute</span>
                  <span className="text-[13px] font-semibold text-red-400">$15,000</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[13px] text-white/40">Continuing to flow</span>
                  <span className="text-[13px] font-semibold text-emerald-400">$8,985,000</span>
                </div>
                <div className="mt-3 p-3.5 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/15">
                  <p className="text-[13px] leading-relaxed text-white/55">
                    <strong className="text-emerald-400">99.83% of project value unaffected.</strong> The $15K dispute resolves in its own lane. No stoppage. No negotiation over the whole job.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ─── Proof Layer ───────────────────────────────────────────────────── */}
      <section className="bg-vektrum-bg py-20 sm:py-24">
  <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-12">
    
    {/* Section Header */}
    <div>
      <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-vektrum-blue">
        <span className="block h-px w-8 bg-vektrum-blue" />
        System architecture
      </div>

      <h2 className="mt-5 font-display text-[3.25rem] font-bold tracking-[-0.05em] text-vektrum-text sm:text-6xl">
        Releases, enforced.
      </h2>
    </div>

    {/* 2 Column Grid */}
    <div className="mt-12 grid gap-8 lg:grid-cols-2">

      {/* LEFT — RELEASE GATE */}
      <div className="rounded-2xl border border-vektrum-border bg-white p-8">
        <span className="inline-block rounded-full bg-vektrum-blue/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-vektrum-blue">
          Release Gate
        </span>

        <h3 className="mt-6 font-display text-[24px] font-bold tracking-[-0.03em] text-vektrum-text">
          Money moves only when conditions pass.
        </h3>

        <p className="mt-4 text-[15px] leading-relaxed text-vektrum-muted">
          Every payout is enforced server-side. If one condition fails, the release does not run.
          Disputes stay isolated to their milestone, not the entire project.
        </p>

        <ul className="mt-8 flex flex-col gap-4">
          {[
            '7 conditions checked simultaneously',
            'Milestone must be approved',
            'No active dispute on that milestone',
            'Contractor payout account verified',
            'No duplicate or conflicting release',
            'Funds available in custody',
            'Final approval remains human-controlled',
          ].map((item) => (
            <li key={item} className="flex items-start gap-3">
              <span className="text-vektrum-blue text-[18px] leading-none">→</span>
              <span className="text-[14px] leading-relaxed text-vektrum-muted">
                {item}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* RIGHT — PERPLEXITY FLOW */}
      <div className="rounded-2xl border border-vektrum-border bg-white p-8">
        <span className="inline-block rounded-full bg-vektrum-blue/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-vektrum-blue">
          Perplexity Computer
        </span>

        <h3 className="mt-6 font-display text-[24px] font-bold tracking-[-0.03em] text-vektrum-text">
          AI reviews every draw before approval.
        </h3>

        <p className="mt-4 text-[15px] leading-relaxed text-vektrum-muted">
          Perplexity analyzes draw submissions for missing documents, conflicts, and readiness risks
          before the release gate runs. It surfaces a structured summary for approval.
        </p>

        <ul className="mt-8 flex flex-col gap-4">
          {[
            'Draw package submitted by contractor',
            'Missing documents automatically flagged',
            'Conflicting change orders detected',
            'Milestone readiness evaluated',
            'Summary surfaced to approver',
            'Supports decision — does not control release',
          ].map((item) => (
            <li key={item} className="flex items-start gap-3">
              <span className="text-vektrum-blue text-[18px] leading-none">→</span>
              <span className="text-[14px] leading-relaxed text-vektrum-muted">
                {item}
              </span>
            </li>
          ))}
        </ul>
      </div>

    </div>
  </div>
</section>

      {/* ─── Competitive Gap Table ─────────────────────────────────────────── */}
     
<section className="bg-[#031226] py-20 sm:py-28">
  <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-12">
    <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
      <div>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-vektrum-blue">
          <span className="block h-px w-4 bg-vektrum-blue" />
          Market position
        </div>

        <h2 className="mt-4 font-display text-4xl font-bold tracking-[-0.04em] text-white sm:text-5xl lg:text-[4rem] lg:leading-[0.95]">
          The gap nobody else fills.
        </h2>

        <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-white/60">
          Procore is built for $50M+ jobs. Traditional lenders do everything manually.
          The $500K–$25M segment — highest dispute rate, least protection — has no
          automated solution. Until now.
        </p>

        <div className="mt-10 flex flex-col gap-6">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-vektrum-blue/10 text-vektrum-blue">
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect x="2" y="13" width="16" height="2.5" rx="1" fill="currentColor" opacity=".2" />
                <rect x="4" y="8" width="3" height="5" rx="0.75" fill="currentColor" opacity=".35" />
                <rect x="8.5" y="5" width="3" height="8" rx="0.75" fill="currentColor" opacity=".6" />
                <rect x="13" y="9" width="3" height="4" rx="0.75" fill="currentColor" opacity=".35" />
                <path d="M1 15.5h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>

            <div>
              <div className="text-[15px] font-semibold text-white">
                Procore ignores this market
              </div>
              <div className="mt-1 text-[14px] leading-relaxed text-white/55">
                Enterprise tooling for enterprise jobs. $500K–$25M projects don&apos;t fit
                the deal size or complexity threshold.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-vektrum-blue/10 text-vektrum-blue">
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  x="4"
                  y="2"
                  width="12"
                  height="16"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="currentColor"
                  fillOpacity=".08"
                />
                <path
                  d="M7 7h6M7 10h6M7 13h4"
                  stroke="currentColor"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <div>
              <div className="text-[15px] font-semibold text-white">
                Traditional lenders are manual
              </div>
              <div className="mt-1 text-[14px] leading-relaxed text-white/55">
                Paper draw requests, manual inspection, spreadsheet tracking. No
                enforcement layer. No dispute isolation.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-vektrum-blue/10 text-vektrum-blue">
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M11.5 2L4 11h6.5L8.5 18 16 9h-6.5L11.5 2Z"
                  fill="currentColor"
                  fillOpacity=".15"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div>
              <div className="text-[15px] font-semibold text-white">
                Vektrum owns this segment
              </div>
              <div className="mt-1 text-[14px] leading-relaxed text-white/55">
                Automated governance, Stripe-backed fund custody, milestone isolation —
                purpose-built for mid-market construction.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
          <div className="mb-5 text-[11px] font-bold uppercase tracking-[0.1em] text-white/35">
            Deal size coverage
          </div>

          <div className="mb-6 flex justify-between text-[11px] text-white/25">
            <span>$100K</span>
            <span>$1M</span>
            <span>$10M</span>
            <span>$100M+</span>
          </div>

          <div className="space-y-5">
            <div className="grid grid-cols-[100px_1fr_80px] items-center gap-3">
              <div className="text-[15px] font-semibold text-white/85">Procore</div>
              <div className="h-2 rounded-full bg-white/8">
                <div className="ml-auto h-2 w-[40%] rounded-full bg-white/20" />
              </div>
              <div className="text-right text-[13px] text-white/55">$50M+</div>
            </div>

            <div className="grid grid-cols-[100px_1fr_80px] items-center gap-3">
              <div className="text-[15px] font-semibold text-white/85">Trad. lender</div>
              <div className="h-2 rounded-full bg-white/8">
                <div className="h-2 w-full rounded-full bg-white/20" />
              </div>
              <div className="text-right text-[13px] text-white/55">Any (manual)</div>
            </div>

            <div className="grid grid-cols-[100px_1fr_80px] items-center gap-3">
              <div className="text-[15px] font-bold text-vektrum-blue">Vektrum</div>
              <div className="h-2 rounded-full bg-white/8">
                <div className="h-2 w-[55%] rounded-full bg-vektrum-blue" />
              </div>
              <div className="text-right text-[13px] font-semibold text-vektrum-blue">
                $500K–$25M
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
          <div className="grid gap-5 text-center sm:grid-cols-3">
            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-white/35">
                Milestone isolation
              </div>
              <div className="text-[22px] text-white/80">
                ✗ · ✗ · <span className="text-vektrum-blue">✓</span>
              </div>
              <div className="mt-1 text-[10px] text-white/25">Procore · Trad. · Vektrum</div>
            </div>

            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-white/35">
                Auto release gate
              </div>
              <div className="text-[22px] text-white/80">
                ✗ · ✗ · <span className="text-vektrum-blue">✓</span>
              </div>
              <div className="mt-1 text-[10px] text-white/25">Procore · Trad. · Vektrum</div>
            </div>

            
            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-white/35">
                Contractor free
              </div>
              <div className="text-[22px] text-white/80">
                ✗ · ✗ · <span className="text-vektrum-blue">✓</span>
              </div>
              <div className="mt-1 text-[10px] text-white/25">Procore · Trad. · Vektrum</div>
            </div>

          </div>
        </div>
      </div>
    </div>
  </div>
</section>

      {/* ─── Core Protections ──────────────────────────────────────────────── */}
      <section className="bg-white py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="text-center mb-16">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-vektrum-blue">Core protections</span>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-[-0.025em] text-vektrum-text sm:text-3xl lg:text-[2.5rem] lg:leading-[1.1]">Every dollar governed</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Shield, title: 'Milestone isolation', desc: 'Each milestone stands alone. One dispute never freezes a project.', bg: 'bg-vektrum-blue/10', color: 'text-vektrum-blue' },
              { icon: Lock, title: '7-condition release gate', desc: 'Every release passes 7 enforced conditions before funds move.', bg: 'bg-vektrum-amber-bg', color: 'text-vektrum-amber' },
              { icon: GitBranch, title: 'Immutable audit trail', desc: 'Every action is logged permanently. No edits. No deletion.', bg: 'bg-vektrum-green-bg', color: 'text-vektrum-green' },
              { icon: Zap, title: 'AI pre-clearance', desc: 'Draws are pre-cleared before funders ever review them.', bg: 'bg-vektrum-blue/10', color: 'text-vektrum-blue' },
            ].map((card) => (
              <div key={card.title} className="rounded-2xl border border-vektrum-border bg-vektrum-surface p-8 hover:border-vektrum-blue/40 hover:shadow-lg hover:shadow-vektrum-blue/10 transition-all duration-300">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.bg} mb-5`}>
                  <card.icon size={20} className={card.color} />
                </div>
                <h3 className="text-[15px] font-semibold text-vektrum-text tracking-[-0.01em]">{card.title}</h3>
                <p className="mt-3 text-[13px] leading-relaxed text-vektrum-muted">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Every party, protected ────────────────────────────────────────── */}
      <section className="bg-vektrum-bg py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="mb-14">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px w-5 bg-vektrum-blue" />
              <p className="text-[11px] tracking-[0.12em] uppercase text-vektrum-blue font-semibold">Who it&apos;s built for</p>
            </div>
            <h2 className="font-display text-[2.75rem] sm:text-5xl font-bold tracking-[-0.04em] text-vektrum-text leading-[1.05]">
              Every party, protected.
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {/* Funders */}
            <div className="rounded-2xl border border-vektrum-border bg-white p-8 flex flex-col">
              <span className="inline-block text-[10px] font-bold uppercase tracking-[0.1em] px-3 py-1 rounded-full bg-vektrum-blue/10 text-vektrum-blue mb-6 self-start">
                Funders
              </span>
              <h3 className="font-display text-[22px] font-bold tracking-[-0.03em] text-vektrum-text leading-snug mb-3">
                Release only what&apos;s earned.
              </h3>
              <p className="text-[14px] leading-relaxed text-vektrum-muted mb-6">
                Full control over every disbursement. No surprises. No manual chasing.
              </p>
              <ul className="flex flex-col gap-6 mt-auto">
                {[
                  'Approve each milestone before a dollar moves',
                  'Full audit trail for every disbursement',
                  'Change orders tracked and gated',
                  '7-condition server-side release enforcement',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <ArrowRight size={14} className="mt-0.5 flex-shrink-0 text-vektrum-blue" />
                    <span className="text-[13px] leading-relaxed text-vektrum-muted">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contractors */}
            <div className="rounded-2xl border border-vektrum-border bg-white p-8 flex flex-col">
              <span className="inline-block text-[10px] font-bold uppercase tracking-[0.1em] px-3 py-1 rounded-full bg-vektrum-blue/10 text-vektrum-blue mb-6 self-start">
                Contractors
              </span>
              <h3 className="font-display text-[22px] font-bold tracking-[-0.03em] text-vektrum-text leading-snug mb-3">
                Get paid when you deliver.
              </h3>
              <p className="text-[14px] leading-relaxed text-vektrum-muted mb-6">
                Milestone-based payouts. No net-90 terms. Immutable proof of approval.
              </p>
              <ul className="flex flex-col gap-3 mt-auto">
                {[
                  'Milestone payouts — no 90-day net terms',
                  'Immutable proof that work was approved',
                  'Disputes isolate one milestone, not the job',
                  'Direct deposit via Stripe Connect. Always free to join.',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <ArrowRight size={14} className="mt-0.5 flex-shrink-0 text-vektrum-blue" />
                    <span className="text-[13px] leading-relaxed text-vektrum-muted">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Lenders */}
            <div className="rounded-2xl border border-vektrum-border bg-white p-8 flex flex-col">
              <span className="inline-block text-[10px] font-bold uppercase tracking-[0.1em] px-3 py-1 rounded-full bg-vektrum-blue/10 text-vektrum-blue mb-6 self-start">
                Lenders
              </span>
              <h3 className="font-display text-[22px] font-bold tracking-[-0.03em] text-vektrum-text leading-snug mb-3">
                Your draw process, systematized.
              </h3>
              <p className="text-[14px] leading-relaxed text-vektrum-muted mb-6">
                Portfolio-level visibility. No paper. No spreadsheets.
              </p>
              <ul className="flex flex-col gap-3 mt-auto">
                {[
                  'Milestone approvals without touching paper',
                  'Release gates run server-side, not in Excel',
                  'Audit trails for compliance and due diligence',
                  'Portfolio risk scores and readiness dashboards',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <ArrowRight size={14} className="mt-0.5 flex-shrink-0 text-vektrum-blue" />
                    <span className="text-[13px] leading-relaxed text-vektrum-muted">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Four steps. Zero ambiguity. ───────────────────────────────────── */}
      <section className="bg-white py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="mb-14">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px w-5 bg-vektrum-blue" />
              <p className="text-[11px] tracking-[0.12em] uppercase text-vektrum-blue font-semibold">The process</p>
            </div>
            <h2 className="font-display text-[2.75rem] sm:text-5xl font-bold tracking-[-0.04em] text-vektrum-text leading-[1.05]">
              Four steps. Zero ambiguity.
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-vektrum-muted max-w-lg">
              From deal creation to final disbursement, every action is gated, logged, and enforced.
            </p>
          </div>

          <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-4 bg-vektrum-border rounded-2xl overflow-hidden border border-vektrum-border">
            {[
              { step: '01', title: 'Create the deal', desc: 'Contractor creates a deal with defined milestones, amounts, and conditions. Contract value is set upfront — no ambiguity.', icon: FileText, bg: 'bg-vektrum-blue/10', color: 'text-vektrum-blue' },
              { step: '02', title: 'Fund via Stripe', desc: 'Funder deposits via Stripe Connect or Licensed Escrow/Lender. Funds are held in managed accounts — Vektrum governs release but never touches the money.', icon: Shield, bg: 'bg-vektrum-blue/10', color: 'text-vektrum-blue' },
              { step: '03', title: 'Complete & approve', desc: 'Contractor marks work done. AI pre-clears documents. Funder reviews and approves each milestone independently — no bundling.', icon: CheckCircle2, bg: 'bg-vektrum-green-bg', color: 'text-vektrum-green' },
              { step: '04', title: 'Release payment', desc: 'All 7 conditions verified server-side via Perplexity Computer. Funds transfer to contractor via Stripe. Immutably logged. No exceptions.', icon: Zap, bg: 'bg-vektrum-green-bg', color: 'text-vektrum-green' },
            ].map((item) => (
              <div key={item.step} className="bg-white p-8 relative">
                <div className="flex items-start justify-between mb-6">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${item.bg}`}>
                    <item.icon size={20} className={item.color} />
                  </div>
                  <span className="font-display text-[3rem] font-bold text-vektrum-fog leading-none tracking-[-0.05em]">{item.step}</span>
                </div>
                <h3 className="text-[16px] font-semibold text-vektrum-text tracking-[-0.01em] mb-3">{item.title}</h3>
                <p className="text-[13px] leading-relaxed text-vektrum-muted">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Demo CTA ──────────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 bg-vektrum-canvas text-white">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-[-0.025em] mb-3">See Vektrum in Action</h2>
          <p className="text-white/70 mb-6">Watch a live walkthrough of milestone-gated payments, AI draw review, and dispute resolution.</p>
          <Link href="/demo-live" className="inline-block bg-white text-vektrum-canvas font-semibold px-8 py-3 rounded-xl hover:bg-white/90 transition-colors">
            View Interactive Demo →
          </Link>
        </div>
      </section>

      {/* ─── Final CTA ─────────────────────────────────────────────────────── */}
      <section className="bg-[#0D1B2A] py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 text-center">
          <h2 className="font-display text-2xl font-bold tracking-[-0.025em] text-white sm:text-3xl lg:text-[2.5rem] lg:leading-[1.1] text-balance">
            Your first deal is free.
          </h2>
          <p className="mt-4 mx-auto max-w-md text-[15px] text-white/50">
            No credit card at signup. Contractors always join free. Funder pays when funding starts.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
            <Link
              href="/auth/signup"
              className="group inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-vektrum-blue px-7 py-3 text-[14px] font-semibold text-white shadow-lg shadow-vektrum-blue/30 hover:bg-vektrum-blue-hover transition-all"
            >
              Create your account
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/15 bg-white/5 px-7 py-3 text-[14px] font-semibold text-white/70 hover:bg-white/10 transition-all"
            >
              View pricing
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ────────────────────────────────────────────────────────── */}
      <footer className="bg-[#0a0f1a] border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-16">
          <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <p className="font-display text-[20px] font-bold text-white tracking-[-0.03em] mb-3">
                Vektrum<span className="text-vektrum-blue">.</span>
              </p>
              <p className="text-[13px] leading-relaxed text-white/35 max-w-[200px]">
                Construction payment governance. Funds release only when work is verified.
              </p>
            </div>

            {/* Platform */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/30 mb-4">Platform</p>
              <ul className="flex flex-col gap-3">
                {[
                  { label: 'Get started', href: '/auth/signup' },
                  { label: 'Sign in', href: '/auth/login' },
                  { label: 'Dashboard', href: '/dashboard' },
                  { label: 'Pricing', href: '/pricing' },
                ].map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-[14px] text-white/50 hover:text-white transition-colors">{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* For */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/30 mb-4">For</p>
              <ul className="flex flex-col gap-3">
                {[
                  { label: 'Funders', href: '/lenders' },
                  { label: 'Contractors', href: '/contractors' },
                  { label: 'Founders', href: '/founders' },
                ].map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-[14px] text-white/50 hover:text-white transition-colors">{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/30 mb-4">Company</p>
              <ul className="flex flex-col gap-3">
                {[
                  { label: 'About', href: '/about' },
                  { label: 'Security', href: '/security' },
                  { label: 'Terms', href: '/terms' },
                  { label: 'Privacy', href: '/privacy' },
                  { label: 'Contact', href: '/contact' },
                ].map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-[14px] text-white/50 hover:text-white transition-colors">{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-14 pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <p className="text-[12px] text-white/25">© 2026 Vektrum. All rights reserved.</p>
            <p className="text-[11px] text-white/20 text-right max-w-sm leading-relaxed">
              Funds are held in Stripe Connect managed accounts, not by Vektrum. Vektrum governs disbursement. Vektrum never holds or transmits funds.
            </p>
          </div>
        </div>
      </footer>

    </div>
  )
}
