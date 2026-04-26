import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BOOK_CALL_URL, BOOK_CALL_EXTERNAL } from '@/lib/book-call'
import {
  Shield,
  GitBranch,
  FileText,
  ArrowRight,
  Lock,
  CheckCircle2,
  Zap,
  X,
  AlertCircle,
  Building2,
  CreditCard,
} from 'lucide-react'

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

      {/* ─── 1. Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#0D1B2A]">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-b from-vektrum-blue/15 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 right-0 w-[500px] h-[500px] bg-gradient-to-l from-vektrum-blue/8 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 pt-24 pb-16 sm:pt-32 sm:pb-20">
          <div className="lg:grid lg:grid-cols-2 lg:gap-14 lg:items-start lg:pt-6">

            {/* LEFT */}
            <div>
              <div className="animate-fade-in mb-6 flex items-center justify-center lg:justify-start gap-3">
                <div className="h-px w-5 bg-vektrum-blue" />
                <p className="text-[11px] tracking-[0.12em] uppercase text-vektrum-blue font-semibold">
                  Construction Draw Governance
                </p>
              </div>

              <h1 className="animate-fade-in font-display text-center lg:text-left text-[2.5rem] font-bold tracking-[-0.04em] text-white sm:text-5xl lg:text-[3.5rem] lg:leading-[1.1] leading-[1.08]">
                The conditional authorization<br />
                layer for construction<br />
                <em className="not-italic text-white/70">draws.</em>
              </h1>

              <p className="animate-fade-in-delay mx-auto lg:mx-0 mt-6 max-w-lg text-center lg:text-left text-[17px] leading-relaxed text-white/70">
                Vektrum is the conditional authorization layer for construction draws. Enforce
                your conditions. Issue the signal. Your licensed partner executes.
              </p>

              <div className="animate-fade-in-delay-3 mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-3">
                <Link
                  href="/auth/signup"
                  className="group inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-vektrum-blue px-8 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-vektrum-blue/30 transition-all hover:bg-vektrum-blue-hover hover:shadow-xl hover:shadow-vektrum-blue/40 hover:-translate-y-0.5"
                >
                  Start your first deal
                  <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href={BOOK_CALL_URL}
                  {...(BOOK_CALL_EXTERNAL ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/[0.07] px-7 py-3 text-[14px] font-semibold text-white/80 hover:bg-white/[0.12] hover:text-white transition-all"
                >
                  Book a call
                </Link>
              </div>

              {/* Proof stats */}
              <div className="mt-10 flex gap-8 justify-center lg:justify-start pt-8 border-t border-white/[0.08]">
                <div className="flex flex-col gap-1">
                  <span className="font-display text-[28px] font-bold text-white leading-none tracking-[-0.03em]">10</span>
                  <span className="text-[12px] text-white/55">Server-side release conditions</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-display text-[19px] font-bold text-white leading-none tracking-[-0.02em] pt-1">Two execution rails</span>
                  <span className="text-[12px] text-white/55">Vektrum does not hold funds — on either rail</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-display text-[19px] font-bold text-white leading-none tracking-[-0.02em] pt-1">Hash-chained</span>
                  <span className="text-[12px] text-white/55">Append-only audit log</span>
                </div>
              </div>
            </div>

            {/* RIGHT — release gate evaluation card */}
            <div className="hidden lg:block lg:mt-2">
              <div className="rounded-2xl border border-white/10 bg-[#111827] overflow-hidden shadow-deep">
                {/* Browser chrome */}
                <div className="flex items-center gap-1.5 border-b border-white/[0.06] bg-white/[0.02] px-4 py-3">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                  <div className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                  <div className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                  <div className="mx-auto flex items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.03] px-3 py-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-vektrum-blue" />
                    <span className="text-[11px] text-white/65">vektrum.io — Release Gate</span>
                  </div>
                </div>

                <div className="p-5">
                  {/* Card header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/55 mb-0.5">Gate Evaluation</p>
                      <p className="text-[13px] font-semibold text-white">Harbor Logistics — Structural Steel</p>
                      <p className="font-display text-[20px] font-bold text-white/90 tracking-[-0.03em] leading-none mt-1">$2,180,000</p>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.08em] px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex-shrink-0">Checking</span>
                  </div>

                  {/* 10 gate conditions */}
                  <div className="space-y-1">
                    {[
                      { label: 'Funder approval',            pass: true  },
                      { label: 'No active dispute',           pass: true  },
                      { label: 'No active hold',              pass: true  },
                      { label: 'Contractor account verified', pass: true  },
                      { label: 'Funded balance sufficient',   pass: true  },
                      { label: 'Sequential order',            pass: false, reason: 'Prior milestone unreleased' },
                      { label: 'No duplicate release',        pass: true  },
                      { label: 'Change order CO-004',         pass: false, reason: 'Approval pending' },
                      { label: 'Contract active',             pass: true  },
                      { label: 'Deal not frozen',             pass: true  },
                    ].map((cond, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-2.5 px-2.5 py-1.5 rounded-lg ${
                          cond.pass
                            ? 'bg-white/[0.02] border border-white/[0.04]'
                            : 'bg-red-500/[0.08] border border-red-500/20'
                        }`}
                      >
                        <div className={`mt-[3px] flex-shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center ${
                          cond.pass ? 'bg-emerald-500/20' : 'bg-red-500/20'
                        }`}>
                          {cond.pass
                            ? <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            : <X size={8} className="text-red-400" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[11px] font-medium leading-tight ${
                            cond.pass ? 'text-white/65' : 'text-white/85'
                          }`}>
                            {cond.label}
                          </p>
                          {cond.reason && (
                            <p className="text-[10px] text-red-400/80 mt-0.5 leading-tight">{cond.reason}</p>
                          )}
                        </div>
                        <span className={`text-[9px] font-bold uppercase tracking-wider flex-shrink-0 mt-[3px] ${
                          cond.pass ? 'text-emerald-500/50' : 'text-red-400'
                        }`}>
                          {cond.pass ? 'Pass' : 'Fail'}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Blocked banner */}
                  <div className="mt-3 flex items-center gap-2.5 px-3.5 py-3 rounded-xl border border-red-500/25 bg-red-500/[0.08]">
                    <X size={13} className="text-red-400 flex-shrink-0" />
                    <div>
                      <p className="text-[12px] font-semibold text-red-400">Release blocked — 2 conditions unmet</p>
                      <p className="text-[10px] text-white/50 mt-0.5">All 10 conditions must pass before funds move.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ─── 2. The $15K / $9M Scenario ───────────────────────────────────────── */}
      <section className="bg-[#031226] py-20 sm:py-28 border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="grid gap-16 lg:grid-cols-2 lg:items-center">

            {/* Left */}
            <div>
              <div className="mb-6 flex items-center gap-3">
                <div className="h-px w-5 bg-vektrum-blue" />
                <p className="text-[11px] tracking-[0.12em] uppercase text-vektrum-blue font-semibold">
                  The defining scenario
                </p>
              </div>
              <h2 className="font-display text-[2.75rem] sm:text-5xl font-bold tracking-[-0.04em] text-white leading-[1.05]">
                A $15K dispute.<br />
                A $9M project<br />
                <em className="not-italic text-white/60">unaffected.</em>
              </h2>
              <p className="mt-6 text-[16px] leading-relaxed text-white/65 max-w-md">
                In most systems, a disputed payment can freeze the job. In Vektrum, disputes
                are isolated to their milestone. The rest of the project keeps moving —
                because each milestone is an independent financial unit enforced at the gate.
              </p>

              <div className="mt-8 flex flex-col gap-5">
                {[
                  {
                    icon: Lock,
                    title: 'Milestone isolation by design',
                    desc: 'Each milestone is an independent financial unit. One dispute cannot touch another.',
                  },
                  {
                    icon: CheckCircle2,
                    title: '10-condition server-side gate',
                    desc: 'Every release passes 10 checks simultaneously. No manual override.',
                  },
                  {
                    icon: GitBranch,
                    title: 'Append-only, hash-chained audit log',
                    desc: 'Every status change timestamped and actor-logged — no updates, no deletes.',
                  },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-4">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-vektrum-blue/10">
                      <item.icon size={16} className="text-vektrum-blue" />
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-white mb-1">{item.title}</p>
                      <p className="text-[13px] leading-relaxed text-white/60">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: scenario card */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#111827] p-8 shadow-scene">
              <div className="flex items-start justify-between pb-5 mb-5 border-b border-white/[0.07]">
                <div>
                  <p className="text-[16px] font-semibold text-white">Harbor Logistics Center</p>
                  <p className="font-display text-[22px] font-bold text-white/80 tracking-[-0.03em] mt-0.5">$9,000,000 total value</p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.08em] px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Active</span>
              </div>

              <div className="space-y-2">
                {[
                  { name: 'Site Preparation',   amount: '$320,000',    status: 'Released', dot: 'bg-emerald-500', badge: 'bg-emerald-500/15 text-emerald-400', row: 'border-emerald-500/15 bg-emerald-500/5' },
                  { name: 'Concrete Sub-grade', amount: '$15,000',     status: 'Locked',   dot: 'bg-red-500',     badge: 'bg-red-500/15 text-red-400',           row: 'border-red-500/20 bg-red-500/5'        },
                  { name: 'Structural Steel',   amount: '$2,180,000',  status: 'Active',   dot: 'bg-vektrum-blue', badge: 'bg-vektrum-blue/15 text-vektrum-blue', row: 'border-white/[0.06] bg-white/[0.02]'  },
                  { name: 'MEP Systems',        amount: '$1,640,000',  status: 'Queued',   dot: 'bg-white/20',    badge: 'bg-white/[0.06] text-white/75',        row: 'border-white/[0.06] bg-white/[0.02]'  },
                  { name: 'Finishes & Cert',    amount: '$4,845,000',  status: 'Queued',   dot: 'bg-white/20',    badge: 'bg-white/[0.06] text-white/75',        row: 'border-white/[0.06] bg-white/[0.02]'  },
                ].map((m) => (
                  <div key={m.name} className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border ${m.row}`}>
                    <div className="flex items-center gap-2.5">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${m.dot}`} />
                      <span className="text-[13px] font-medium text-white/80">{m.name}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-[13px] font-semibold tabular-nums text-white">{m.amount}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-[0.06em] px-2 py-0.5 rounded ${m.badge}`}>{m.status}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 pt-5 border-t border-white/[0.07] space-y-2">
                <div className="flex justify-between">
                  <span className="text-[13px] text-white/75">Locked in dispute</span>
                  <span className="text-[13px] font-semibold text-red-400">$15,000</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[13px] text-white/75">Continuing to flow</span>
                  <span className="text-[13px] font-semibold text-emerald-400">$8,985,000</span>
                </div>
                <div className="mt-3 p-3.5 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/15">
                  <p className="text-[13px] leading-relaxed text-white/55">
                    <strong className="text-emerald-400">99.83% of project value unaffected.</strong>{' '}
                    The $15K dispute resolves in its own lane — no stoppage, no negotiation over the whole job.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ─── 3. Shift ──────────────────────────────────────────────────────────── */}
      <section className="bg-[#0A1628] border-t border-white/[0.06] py-16">
        <div className="max-w-3xl mx-auto px-6 sm:px-8 text-center">
          <div className="inline-flex items-center gap-3 mb-5">
            <div className="h-px w-5 bg-vektrum-blue" />
            <p className="text-[11px] tracking-[0.12em] uppercase text-vektrum-blue font-semibold">The shift</p>
            <div className="h-px w-5 bg-vektrum-blue" />
          </div>
          <h2 className="font-display text-[2rem] sm:text-[2.5rem] font-bold tracking-[-0.04em] text-white leading-[1.1]">
            Not a tool. An enforcement layer.
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-white/60 max-w-xl mx-auto">
            Project management software tracks what happens. Vektrum determines what
            can happen. Every release requires all conditions to pass, server-side,
            before any funds move.
          </p>
        </div>
      </section>

      {/* ─── 3b. How Vektrum fits your workflow ───────────────────────────────── */}
      <section className="bg-[#0D1B2A] py-20 sm:py-28 border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="mb-12 text-center">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="h-px w-5 bg-vektrum-blue" />
              <p className="text-[11px] tracking-[0.12em] uppercase text-vektrum-blue font-semibold">How Vektrum fits your workflow</p>
              <div className="h-px w-5 bg-vektrum-blue" />
            </div>
            <h2 className="font-display text-[2.75rem] sm:text-5xl font-bold tracking-[-0.04em] text-white leading-[1.05]">
              Two paths to the same enforcement layer.
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-white/55 max-w-xl mx-auto">
              Whether you&apos;re starting from scratch or plugging into existing infrastructure, Vektrum fits the same way: enforce your conditions, issue the signal, your partner executes.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">

            {/* Column 1 — Private & direct lenders */}
            <div className="rounded-2xl border border-vektrum-blue/25 bg-[#111827] p-8 flex flex-col">
              <div className="mb-5">
                <span className="inline-block rounded-full bg-vektrum-blue/10 border border-vektrum-blue/25 px-3.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-vektrum-blue mb-4">
                  Stripe Connect rail — for direct lenders
                </span>
                <h3 className="font-display text-[22px] font-bold tracking-[-0.03em] text-white leading-snug mb-3">
                  No existing draw infrastructure? Start in minutes.
                </h3>
                <p className="text-[14px] leading-relaxed text-white/60">
                  Replace spreadsheet-based draw approvals with a 10-condition gate, AI draw review, and a complete audit trail. Vektrum manages the full workflow — connect Stripe and you&apos;re live.
                </p>
              </div>
              <ul className="flex flex-col gap-2.5 mt-auto pt-5 border-t border-white/[0.07]">
                {[
                  'Hard money lenders, family offices, developer self-funding',
                  'Stripe Connect handles fund custody and contractor payouts',
                  'Full workflow: draw submission, AI review, 10-condition gate, release',
                  'Self-service setup — no integration required',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 size={13} className="mt-0.5 flex-shrink-0 text-vektrum-blue" />
                    <span className="text-[13px] leading-relaxed text-white/60">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 2 — Institutional lenders & title/escrow partners */}
            <div className="rounded-2xl border border-emerald-500/25 bg-[#111827] p-8 flex flex-col">
              <div className="mb-5">
                <span className="inline-block rounded-full bg-emerald-500/10 border border-emerald-500/25 px-3.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-400 mb-4">
                  External rail — for lenders with existing payment infrastructure
                </span>
                <h3 className="font-display text-[22px] font-bold tracking-[-0.03em] text-white leading-snug mb-3">
                  Already have a payment rail? Plug in the governance layer.
                </h3>
                <p className="text-[14px] leading-relaxed text-white/60">
                  Keep your licensed payment infrastructure. Vektrum enforces your conditions, then fires a signed authorization signal directly to your execution system. Your rail, your control, Vektrum&apos;s audit trail.
                </p>
              </div>
              <ul className="flex flex-col gap-2.5 mt-auto pt-5 border-t border-white/[0.07]">
                {[
                  'Banks, credit unions, construction loan servicers, title companies',
                  'Vektrum fires a signed release.authorized webhook to your endpoint',
                  'Your licensed system executes — Vektrum records the confirmation',
                  'API integration: confirm or fail via partner API endpoints',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 size={13} className="mt-0.5 flex-shrink-0 text-emerald-400" />
                    <span className="text-[13px] leading-relaxed text-white/60">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </div>
      </section>

      {/* ─── 3c. Where Vektrum plugs in ───────────────────────────────────────── */}
      <section className="bg-[#031226] py-20 sm:py-28 border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">

          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px w-5 bg-vektrum-blue" />
              <p className="text-[11px] tracking-[0.12em] uppercase text-vektrum-blue font-semibold">Where Vektrum plugs in</p>
            </div>
            <h2 className="font-display text-[2.75rem] sm:text-5xl font-bold tracking-[-0.04em] text-white leading-[1.05]">
              Two topologies.<br />One enforcement layer.
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-white/60 max-w-xl">
              Vektrum slots between approval and execution. Whether your payment runs through Stripe Connect or through an existing title, escrow, or treasury process — the gate is identical. Your rail stays yours.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">

            {/* ── Institutional / external rail ──────────────────────────────── */}
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-7 flex flex-col">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 flex-shrink-0">
                  <Building2 size={16} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-400 mb-0.5">Institutional · External rail</p>
                  <p className="text-[14px] font-semibold text-white leading-tight">Lender / Title / Escrow / Treasury</p>
                </div>
              </div>

              <div className="flex-1">
                {[
                  { icon: FileText,      label: 'Draw package submitted',           sub: 'Documentation, inspection reports, and lien waivers submitted in-platform',                                        vektrum: false, core: false },
                  { icon: Zap,           label: 'AI draw pre-review',               sub: 'Completeness, conflict detection, risk flags — informs the gate; AI does not decide',                              vektrum: true,  core: false },
                  { icon: Shield,        label: '10-condition release gate',         sub: 'Server-side, atomic, funder-triggered — pass or block with full audit record',                                   vektrum: true,  core: true  },
                  { icon: ArrowRight,    label: 'Signed authorization signal fired', sub: 'Vektrum issues authorization — your wire, ACH, check, or treasury system executes',                              vektrum: false, core: false },
                  { icon: CheckCircle2,  label: 'Reference + proof returned',        sub: 'Funder records payment method, bank reference, and proof document in Vektrum',                                   vektrum: true,  core: false },
                  { icon: GitBranch,     label: 'Audit + reconciliation',            sub: 'Ledger settled, SLA-tracked, confirmation permanently and immutably logged',                                     vektrum: true,  core: false },
                ].map(({ icon: Icon, label, sub, vektrum, core }, i, arr) => (
                  <div key={label}>
                    <div className={`flex items-start gap-3 px-3 py-2.5 rounded-xl${core ? ' bg-vektrum-blue/[0.08] border border-vektrum-blue/25' : ''}`}>
                      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg mt-0.5 ${core ? 'bg-vektrum-blue/20' : 'bg-white/[0.06]'}`}>
                        <Icon size={14} className={core ? 'text-white' : vektrum ? 'text-vektrum-blue' : 'text-white/50'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[13px] font-semibold text-white leading-tight">{label}</p>
                          {vektrum && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-vektrum-blue/15 text-vektrum-blue border border-vektrum-blue/20 flex-shrink-0">Vektrum</span>
                          )}
                        </div>
                        <p className="text-[11.5px] text-white/50 leading-snug mt-0.5">{sub}</p>
                      </div>
                    </div>
                    {i < arr.length - 1 && (
                      <div className="flex pl-[19px] h-4">
                        <div className="w-px h-full bg-white/[0.10]" />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] px-4 py-3">
                <p className="text-[12px] text-white/55 leading-relaxed">
                  <span className="text-emerald-400 font-semibold">Funds never touch Vektrum.</span>{' '}
                  Your existing payment infrastructure — title, escrow, wire, ACH — remains in place and fully under your control.
                </p>
              </div>
            </div>

            {/* ── Direct / Stripe Connect rail ───────────────────────────────── */}
            <div className="rounded-2xl border border-vektrum-blue/20 bg-vektrum-blue/[0.04] p-7 flex flex-col">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-vektrum-blue/15 flex-shrink-0">
                  <CreditCard size={16} className="text-vektrum-blue" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-vektrum-blue mb-0.5">Direct · Stripe Connect rail</p>
                  <p className="text-[14px] font-semibold text-white leading-tight">Private lender / family office / developer</p>
                </div>
              </div>

              <div className="flex-1">
                {[
                  { icon: Shield,        label: 'Funder deposits',                       sub: 'Capital held in Stripe-managed accounts — not by Vektrum',                                                           vektrum: false, core: false },
                  { icon: Zap,           label: 'AI draw pre-review',                    sub: 'Same precondition — completeness and risk flags before the gate evaluates',                                           vektrum: true,  core: false },
                  { icon: Lock,          label: '10-condition release gate',              sub: 'Stripe payouts condition included. All 10 must pass — server-side, no UI bypass',                                   vektrum: true,  core: true  },
                  { icon: CreditCard,    label: 'Stripe Connect automated execution',     sub: 'Vektrum instructs Stripe to transfer. Stripe controls movement. Fees at cost.',                                     vektrum: false, core: false },
                  { icon: CheckCircle2,  label: 'Contractor receives payment',            sub: 'Direct deposit. Full gross milestone amount — no fee deducted from contractor.',                                    vektrum: false, core: false },
                  { icon: GitBranch,     label: 'Audit + reconciliation',                 sub: 'Reconciled hourly against Stripe API. Hash-chained log entry at every step.',                                       vektrum: true,  core: false },
                ].map(({ icon: Icon, label, sub, vektrum, core }, i, arr) => (
                  <div key={label}>
                    <div className={`flex items-start gap-3 px-3 py-2.5 rounded-xl${core ? ' bg-vektrum-blue/[0.08] border border-vektrum-blue/25' : ''}`}>
                      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg mt-0.5 ${core ? 'bg-vektrum-blue/20' : 'bg-white/[0.06]'}`}>
                        <Icon size={14} className={core ? 'text-white' : vektrum ? 'text-vektrum-blue' : 'text-white/50'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[13px] font-semibold text-white leading-tight">{label}</p>
                          {vektrum && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-vektrum-blue/15 text-vektrum-blue border border-vektrum-blue/20 flex-shrink-0">Vektrum</span>
                          )}
                        </div>
                        <p className="text-[11.5px] text-white/50 leading-snug mt-0.5">{sub}</p>
                      </div>
                    </div>
                    {i < arr.length - 1 && (
                      <div className="flex pl-[19px] h-4">
                        <div className="w-px h-full bg-white/[0.10]" />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-xl border border-vektrum-blue/15 bg-vektrum-blue/[0.04] px-4 py-3">
                <p className="text-[12px] text-white/55 leading-relaxed">
                  <span className="text-vektrum-blue font-semibold">No existing payment infrastructure required.</span>{' '}
                  Stripe Connect handles fund custody and contractor payouts end-to-end.
                </p>
              </div>
            </div>

          </div>

          {/* Boundary clarification strip */}
          <div className="mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-6 py-5">
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
              {[
                'Vektrum does not replace title or escrow',
                'Vektrum does not execute wires',
                'Existing payment rails remain in place',
                'Stripe Connect is one supported rail — not required for every deployment',
              ].map((item) => (
                <p key={item} className="flex items-center gap-2 text-[12px] text-white/50">
                  <span className="inline-block h-1 w-1 rounded-full bg-white/25 flex-shrink-0" />
                  {item}
                </p>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* ─── 4. Release Gate + AI Precondition ────────────────────────────────── */}
      <section className="bg-[#F8F9FB] py-20 sm:py-28 border-t border-black/[0.06]">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">

          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px w-5 bg-vektrum-blue" />
              <p className="text-[11px] tracking-[0.12em] uppercase text-vektrum-blue font-semibold">Release gate</p>
            </div>
            <h2 className="font-display text-[2.75rem] sm:text-5xl font-bold tracking-[-0.04em] text-vektrum-text leading-[1.05]">
              10 conditions. No exceptions.
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-vektrum-muted max-w-xl">
              Every milestone release is evaluated server-side against 10 independent
              conditions simultaneously. If any condition fails, the release is blocked.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">

            {/* LEFT: the 10 conditions */}
            <div className="rounded-2xl border border-black/[0.07] bg-white p-8 shadow-lift">
              <div className="mb-6 flex items-center justify-between">
                <span className="inline-block rounded-full bg-vektrum-blue/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-vektrum-blue">
                  The 10-condition gate
                </span>
                <span className="text-[12px] text-vektrum-muted font-medium">All 10 must pass</span>
              </div>

              <ol className="space-y-2">
                {[
                  'Milestone approved by funder',
                  'No active dispute on this milestone',
                  'No active hold on this milestone',
                  'Contractor payment account verified',
                  'Funded balance covers this disbursement',
                  'Sequential milestone order satisfied',
                  'No duplicate release on this milestone',
                  'No unresolved change orders',
                  'Contract not voided',
                  'Deal not frozen or under admin suspension',
                ].map((cond, i) => (
                  <li key={i} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-[#F8F9FB] border border-black/[0.04]">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-vektrum-blue/10 flex items-center justify-center text-[11px] font-bold text-vektrum-blue tabular-nums">
                      {i + 1}
                    </span>
                    <span className="text-[13.5px] text-vektrum-muted">{cond}</span>
                  </li>
                ))}
              </ol>

              <div className="mt-5 flex items-start gap-3 px-4 py-3.5 rounded-xl bg-red-50 border border-red-100">
                <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-[13px] text-red-700 font-medium leading-relaxed">
                  If any condition fails, the release is blocked until the underlying issue is resolved.
                </p>
              </div>
            </div>

            {/* RIGHT: AI precondition (visually subordinate) */}
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-black/[0.07] bg-white p-7 shadow-lift">
                <span className="inline-block rounded-full bg-vektrum-blue/10 px-3.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-vektrum-blue mb-4">
                  AI Precondition
                </span>
                <h3 className="font-display text-[18px] font-bold tracking-[-0.02em] text-vektrum-text leading-snug mb-3">
                  Runs before the gate.
                </h3>

                <p className="text-[13px] leading-relaxed text-vektrum-muted mb-4">
                  Before the 10-condition gate runs, Vektrum AI reviews the draw package:
                  document completeness, conflict detection, milestone readiness. If the risk
                  level is critical or the assessment is older than 48 hours, the release
                  is blocked before the gate evaluates.
                </p>

                <div className="space-y-2 mb-4">
                  {[
                    'Draw package completeness',
                    'Conflict detection',
                    'Milestone readiness score',
                    'Risk level evaluation',
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-vektrum-blue/60 flex-shrink-0" />
                      <span className="text-[12.5px] text-vektrum-muted">{item}</span>
                    </div>
                  ))}
                </div>


                <div className="pt-3 border-t border-black/[0.06]">
                  <p className="text-[12px] font-semibold text-vektrum-text text-center tracking-[0.02em]">
                    AI informs · gate decides
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-black/[0.07] bg-white px-5 py-4 shadow-lift">
                <p className="text-[12.5px] text-vektrum-muted leading-relaxed">
                  <strong className="text-vektrum-text">The gate is not AI-driven.</strong>{' '}
                  AI is an independent precondition. Once the draw clears the AI check, the
                  10-condition gate makes the final enforcement decision.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ─── 5. Category Difference ────────────────────────────────────────────── */}
      <section className="bg-white py-20 sm:py-28 border-t border-black/[0.06]">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">

          <div className="mb-12 text-center">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="h-px w-5 bg-vektrum-blue" />
              <p className="text-[11px] tracking-[0.12em] uppercase text-vektrum-blue font-semibold">Category difference</p>
              <div className="h-px w-5 bg-vektrum-blue" />
            </div>
            <h2 className="font-display text-[2.75rem] sm:text-5xl font-bold tracking-[-0.04em] text-vektrum-text leading-[1.05]">
              Workflow tools track.<br />Vektrum enforces.
            </h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">

            {/* Without enforcement */}
            <div className="rounded-2xl border border-black/[0.07] bg-[#F8F9FB] p-8 shadow-float">
              <div className="mb-6">
                <span className="inline-block rounded-full bg-black/[0.06] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-vektrum-muted">
                  Without enforcement
                </span>
                <h3 className="mt-4 font-display text-[20px] font-bold tracking-[-0.03em] text-vektrum-text leading-snug">
                  Approvals tracked. Releases manual.
                </h3>
              </div>
              <ul className="space-y-3">
                {[
                  'Draw requests submitted via email',
                  'Approvals tracked in spreadsheets',
                  'Releases triggered manually — no condition check',
                  'Dispute spreads across the entire project',
                  'Audit trail means inbox export',
                  'Nothing automatically blocks a bad release',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <X size={13} className="mt-[3px] flex-shrink-0 text-red-400/70" />
                    <span className="text-[13.5px] text-vektrum-muted">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* With Vektrum */}
            <div className="rounded-2xl border border-vektrum-blue/20 bg-white p-8 shadow-lift">
              <div className="mb-6">
                <span className="inline-block rounded-full bg-vektrum-blue/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-vektrum-blue">
                  With Vektrum
                </span>
                <h3 className="mt-4 font-display text-[20px] font-bold tracking-[-0.03em] text-vektrum-text leading-snug">
                  Releases blocked unless conditions pass.
                </h3>
              </div>
              <ul className="space-y-3">
                {[
                  'Draw packages submitted in-platform with documentation',
                  'AI precondition evaluates completeness and risk first',
                  '10 conditions verified server-side before any funds move',
                  'Dispute isolated to its milestone — rest of project continues',
                  'Append-only, hash-chained audit log — no edits, no deletes',
                  'Release blocked at condition failure — automatically, always',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 size={13} className="mt-[3px] flex-shrink-0 text-vektrum-blue" />
                    <span className="text-[13.5px] text-vektrum-muted">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </div>
      </section>

      {/* ─── 6. Prevention ──────────────────────────────────────────────────────── */}
      <section className="bg-[#031226] py-20 sm:py-28 border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">

          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px w-5 bg-vektrum-blue" />
              <p className="text-[11px] tracking-[0.12em] uppercase text-vektrum-blue font-semibold">Prevention</p>
            </div>
            <h2 className="font-display text-[2.75rem] sm:text-5xl font-bold tracking-[-0.04em] text-white leading-[1.05]">
              The gate stops this.
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-white/60 max-w-xl">
              Seven common construction payment failures — each blocked by the release
              gate before funds move.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: 'Inspection report not submitted',
                without: 'Release proceeds on assumption; disputed post-payment',
                condition: 'Condition 3 — active hold until documentation clears',
              },
              {
                title: 'Active dispute on this milestone',
                without: 'Payment contested after the fact; project stalls',
                condition: 'Condition 2 — milestone with dispute cannot release',
              },
              {
                title: 'Funded balance insufficient',
                without: 'Overdraw risk; funder scrambles to cover the shortfall',
                condition: 'Condition 5 — balance must cover full disbursement amount',
              },
              {
                title: 'Prior milestone unreleased',
                without: 'Out-of-sequence payments; accounting disputes follow',
                condition: 'Condition 6 — sequential order must be satisfied',
              },
              {
                title: 'Contractor account not connected',
                without: 'Payment fails at the bank level after funds are sent',
                condition: 'Condition 4 — contractor payment account must be verified',
              },
              {
                title: 'Unresolved change order',
                without: 'Scope and payment amount in conflict; post-release disputes',
                condition: 'Condition 8 — all change orders must be resolved first',
              },
              {
                title: 'Contract voided mid-project',
                without: 'Continued releases on a terminated agreement',
                condition: 'Condition 9 — contract must be in active status',
              },
            ].map((scenario) => (
              <div
                key={scenario.title}
                className="rounded-2xl border border-white/[0.08] bg-[#111827] p-6"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="text-[14px] font-semibold text-white leading-snug">{scenario.title}</h3>
                  <span className="flex-shrink-0 text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20">
                    Blocked
                  </span>
                </div>
                <p className="text-[12px] text-white/55 leading-relaxed mb-3">
                  <span className="text-white/55 font-medium">Without enforcement: </span>
                  {scenario.without}
                </p>
                <div className="flex items-start gap-2 pt-3 border-t border-white/[0.06]">
                  <Shield size={11} className="text-vektrum-blue mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-vektrum-blue/80 leading-relaxed">{scenario.condition}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 7. Role Clarity ────────────────────────────────────────────────────── */}
      <section className="bg-[#F8F9FB] py-20 sm:py-28 border-t border-black/[0.06]">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">

          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px w-5 bg-vektrum-blue" />
              <p className="text-[11px] tracking-[0.12em] uppercase text-vektrum-blue font-semibold">Role clarity</p>
            </div>
            <h2 className="font-display text-[2.75rem] sm:text-5xl font-bold tracking-[-0.04em] text-vektrum-text leading-[1.05]">
              Every party, protected.
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-vektrum-muted max-w-xl">
              Vektrum is built for three roles. Each has clearly defined permissions —
              and hard limits enforced at the gate layer.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">

            {/* Funders */}
            <div className="rounded-2xl border border-black/[0.07] bg-white p-8 flex flex-col shadow-float">
              <span className="inline-block text-[10px] font-bold uppercase tracking-[0.1em] px-3 py-1 rounded-full bg-vektrum-blue/10 text-vektrum-blue mb-6 self-start">
                Funders
              </span>
              <h3 className="font-display text-[21px] font-bold tracking-[-0.03em] text-vektrum-text leading-snug mb-3">
                Release only what&apos;s earned.
              </h3>
              <p className="text-[14px] leading-relaxed text-vektrum-muted mb-6">
                Full control over every disbursement. Vektrum does not hold funds. Capital is held in Stripe-managed accounts (Stripe Connect rail) or by the funder&apos;s institutional payment partner (external rail).
              </p>
              <ul className="flex flex-col gap-3 mt-auto">
                {[
                  'Approve each milestone before funds move',
                  'Only the funder can trigger a release',
                  'Full audit trail for every disbursement',
                  '10-condition gate enforced on every release',
                  'Institutional portfolios: external rail available',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <ArrowRight size={12} className="mt-0.5 flex-shrink-0 text-vektrum-blue" />
                    <span className="text-[13px] leading-relaxed text-vektrum-muted">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contractors */}
            <div className="rounded-2xl border border-black/[0.07] bg-white p-8 flex flex-col shadow-float">
              <span className="inline-block text-[10px] font-bold uppercase tracking-[0.1em] px-3 py-1 rounded-full bg-vektrum-blue/10 text-vektrum-blue mb-6 self-start">
                Contractors
              </span>
              <h3 className="font-display text-[21px] font-bold tracking-[-0.03em] text-vektrum-text leading-snug mb-3">
                Get paid when you deliver.
              </h3>
              <p className="text-[14px] leading-relaxed text-vektrum-muted mb-6">
                Milestone-based payouts. Immutable proof of approval. Disputes affect
                only the disputed milestone — not the whole job.
              </p>
              <ul className="flex flex-col gap-3 mt-auto">
                {[
                  'Receive full gross milestone amount — no fee deducted',
                  'Always free to join and participate',
                  'Disputes isolate one milestone, not the project',
                  'Immutable record that work was approved',
                  'Submit draw packages with documentation in-platform',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <ArrowRight size={12} className="mt-0.5 flex-shrink-0 text-vektrum-blue" />
                    <span className="text-[13px] leading-relaxed text-vektrum-muted">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Admins */}
            <div className="rounded-2xl border border-black/[0.07] bg-white p-8 flex flex-col shadow-float">
              <span className="inline-block text-[10px] font-bold uppercase tracking-[0.1em] px-3 py-1 rounded-full bg-vektrum-blue/10 text-vektrum-blue mb-6 self-start">
                Platform Admin
              </span>
              <h3 className="font-display text-[21px] font-bold tracking-[-0.03em] text-vektrum-text leading-snug mb-3">
                Oversight with hard limits.
              </h3>
              <p className="text-[14px] leading-relaxed text-vektrum-muted mb-6">
                Ops monitoring, dispute management, and audit review — with every
                privileged action requiring AAL2 MFA and written justification.
              </p>
              <ul className="flex flex-col gap-3 mt-auto">
                {[
                  'Monitor platform health via ops dashboard',
                  'Manage disputes and release-health alerts',
                  'Review admin audit log — peer attestation required',
                  'Cannot trigger milestone releases — gate enforces this',
                  'All privileged actions dual-logged with justification',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <ArrowRight size={12} className="mt-0.5 flex-shrink-0 text-vektrum-blue" />
                    <span className="text-[13px] leading-relaxed text-vektrum-muted">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </div>
      </section>

      {/* ─── 8. How Capital Moves ─────────────────────────────────────────────── */}
      <section className="bg-white py-20 sm:py-28 border-t border-black/[0.06]">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">

          <div className="mb-14">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px w-5 bg-vektrum-blue" />
              <p className="text-[11px] tracking-[0.12em] uppercase text-vektrum-blue font-semibold">The process</p>
            </div>
            <h2 className="font-display text-[2.75rem] sm:text-5xl font-bold tracking-[-0.04em] text-vektrum-text leading-[1.05]">
              How capital moves.
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-vektrum-muted max-w-lg">
              From deal creation to final disbursement, every action is gated, logged,
              and enforced. Release authorization is separate from payment execution —
              funds can move through Stripe Connect or your existing payment infrastructure.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                step: '01',
                icon: FileText,
                title: 'Deal created',
                desc: 'Contractor defines milestones, amounts, and conditions. Contract value is fixed upfront — no ambiguity on scope or payment.',
                bg: 'bg-vektrum-blue/10',
                color: 'text-vektrum-blue',
              },
              {
                step: '02',
                icon: Shield,
                title: 'Funder deposits',
                desc: 'Funder deposits capital. On Stripe Connect deals, funds are held in Stripe-managed accounts. On external-rail deals, funds are held by the funder\'s institutional payment partner. Vektrum governs authorization and does not hold funds directly.',
                bg: 'bg-vektrum-blue/10',
                color: 'text-vektrum-blue',
              },
              {
                step: '03',
                icon: CheckCircle2,
                title: 'Work submitted',
                desc: 'Contractor marks milestone complete and submits draw package. AI precondition runs. Funder reviews and approves independently.',
                bg: 'bg-emerald-500/[0.08]',
                color: 'text-emerald-400',
              },
              {
                step: '04',
                icon: Zap,
                title: 'Gate evaluates',
                desc: 'All 10 conditions verified server-side. If any fail, release is blocked with explanation. If all pass, funds move — immutably logged.',
                bg: 'bg-emerald-500/[0.08]',
                color: 'text-emerald-400',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-2xl border border-black/[0.07] bg-[#F8F9FB] p-7 relative shadow-float"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${item.bg}`}>
                    <item.icon size={20} className={item.color} />
                  </div>
                  <span className="font-display text-[3rem] font-bold text-black/[0.05] leading-none tracking-[-0.05em] select-none">
                    {item.step}
                  </span>
                </div>
                <h3 className="text-[15px] font-semibold text-vektrum-text tracking-[-0.01em] mb-2.5">{item.title}</h3>
                <p className="text-[13px] leading-relaxed text-vektrum-muted">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 9. Trust / Audit / Ops ───────────────────────────────────────────── */}
      <section className="bg-[#031226] py-20 sm:py-28 border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">

          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px w-5 bg-vektrum-blue" />
              <p className="text-[11px] tracking-[0.12em] uppercase text-vektrum-blue font-semibold">Trust infrastructure</p>
            </div>
            <h2 className="font-display text-[2.75rem] sm:text-5xl font-bold tracking-[-0.04em] text-white leading-[1.05]">
              Built to be audited.
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-white/60 max-w-xl">
              Every layer of Vektrum is designed for institutional scrutiny — append-only
              records, peer-reviewed admin actions, scheduled reconciliation.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: GitBranch,
                title: 'Append-only, hash-chained audit log',
                desc: 'Every approval, release, and status change is recorded permanently. No UPDATE path. No DELETE path. Every entry chained to the previous.',
              },
              {
                icon: Shield,
                title: 'Admin peer review attestation',
                desc: 'All admin privileged actions are dual-logged. Peer review is enforced at the database layer — reviewer cannot be the actor.',
              },
              {
                icon: Lock,
                title: 'Dispute isolation architecture',
                desc: 'A disputed milestone is locked at the milestone level. The deal continues. Other milestones flow on schedule — by design, not configuration.',
              },
              {
                icon: Zap,
                title: 'Scheduled reconciliation engine',
                desc: 'Multi-pass reconciliation runs on a schedule: Stripe transfer consistency, billing record completeness, deal ledger arithmetic, external-rail hygiene.',
              },
              {
                icon: FileText,
                title: 'Vektrum governs. Partners hold.',
                desc: 'Vektrum does not hold or custody funds — on either rail. On Stripe Connect deals, funds are held in Stripe-managed accounts. On external-rail deals, funds are held by the funder\'s institutional payment partner.',
              },
              {
                icon: AlertCircle,
                title: 'Gate supremacy — no bypass path',
                desc: 'No admin can override the release gate. No API endpoint bypasses the 10-condition check. The gate is the only path to fund movement.',
              },
            ].map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border border-white/[0.08] bg-[#111827] p-7"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-vektrum-blue/10 mb-5">
                  <card.icon size={18} className="text-vektrum-blue" />
                </div>
                <h3 className="text-[14px] font-semibold text-white leading-snug mb-2.5">{card.title}</h3>
                <p className="text-[13px] leading-relaxed text-white/55">{card.desc}</p>
              </div>
            ))}
          </div>

          {/* Legal boundary strip */}
          <div className="mt-10 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-3 text-center sm:text-left sm:divide-x sm:divide-white/[0.06]">
              <div className="sm:pr-6">
                <p className="text-[12px] text-white/85 leading-relaxed font-medium">
                  Vektrum does not hold funds — on either rail. On Stripe Connect deals, funds are held in Stripe-managed accounts. On external-rail deals, funds are held by the funder's institutional payment partner.
                </p>
              </div>
              <div className="sm:px-6">
                <p className="text-[12px] text-white/85 leading-relaxed font-medium">
                  Vektrum governs authorization. Vektrum does not hold, collect, forward, or transmit funds directly.
                </p>
              </div>
              <div className="sm:pl-6">
                <p className="text-[12px] text-white/85 leading-relaxed font-medium">
                  Vektrum is not a bank, payment processor, or money transmitter.
                </p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ─── 10. Demo CTA ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#0D1B2A] py-20 sm:py-28 border-t border-white/[0.06]">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-vektrum-blue/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-4xl mx-auto px-6 sm:px-8 text-center">
          <div className="mb-6 inline-flex items-center gap-3">
            <div className="h-px w-5 bg-vektrum-blue" />
            <p className="text-[11px] tracking-[0.12em] uppercase text-vektrum-blue font-semibold">Interactive demo</p>
            <div className="h-px w-5 bg-vektrum-blue" />
          </div>
          <h2 className="font-display text-[2.75rem] sm:text-5xl font-bold tracking-[-0.04em] text-white leading-[1.05]">
            See exactly what blocks a release in real time.
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed text-white/55 max-w-md mx-auto">
            Explore a fully simulated deal with real enforcement logic. Choose your role —
            all data is simulated.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3 max-w-xl mx-auto">
            {[
              { role: 'Funder', href: '/demo-live?role=funder', desc: 'Approve draws, trigger releases, watch the gate evaluate' },
              { role: 'Contractor', href: '/demo-live?role=contractor', desc: 'Submit draw packages, track milestone status' },
              { role: 'Admin', href: '/demo-live?role=admin', desc: 'Ops dashboard, audit log, dispute management' },
            ].map((r) => (
              <Link
                key={r.role}
                href={r.href}
                className="group rounded-xl border border-white/[0.08] bg-white/[0.04] px-5 py-5 text-left hover:bg-white/[0.08] hover:border-vektrum-blue/30 transition-all"
              >
                <p className="text-[13px] font-semibold text-white mb-1.5 group-hover:text-vektrum-blue transition-colors">
                  {r.role} view
                  <ArrowRight size={12} className="inline-block ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </p>
                <p className="text-[12px] text-white/50 leading-relaxed">{r.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 10b. Trust FAQ ──────────────────────────────────────────────────────── */}
      <section className="bg-surface-2 py-16 sm:py-20 border-t border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="text-center mb-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/65 mb-3">
              Trust &amp; Compliance
            </p>
            <h2 className="font-display text-2xl font-bold tracking-[-0.025em] text-white sm:text-3xl">
              Common questions from institutional buyers
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                q: 'Is Vektrum a payment processor?',
                a: 'No. Vektrum is a conditional authorization and audit layer. Payment execution happens through Stripe Connect or the customer\'s existing title, escrow, treasury, or banking process.',
              },
              {
                q: 'Does Vektrum hold funds?',
                a: 'No. Vektrum does not hold funds in its own bank account or act as escrow. For Stripe Connect releases, funds are held in Stripe-managed accounts. For external/manual releases, payment is executed outside Vektrum by the funder, title company, escrow company, or treasury process.',
              },
              {
                q: 'Does every customer need to use Stripe?',
                a: 'No. Stripe Connect is available for automated execution. Institutional customers can use external/manual execution through their existing payment process.',
              },
              {
                q: 'Does Vektrum replace title or escrow companies?',
                a: 'No. Vektrum can give title and escrow teams a release authorization and audit layer before they execute disbursements.',
              },
              {
                q: 'Does AI approve releases?',
                a: 'No. AI-assisted review flags missing documents, conflicts, and risk signals. The funder triggers release, and the deterministic release gate enforces whether release is allowed.',
              },
              {
                q: 'Can admins release funds?',
                a: 'No. Admins cannot trigger milestone releases. Privileged admin actions require AAL2 MFA, justification, and audit logging.',
              },
              {
                q: 'What happens if a condition fails?',
                a: 'The release is blocked until the issue is resolved. The system records the failed gate evaluation for audit visibility.',
              },
              {
                q: 'What happens if Vektrum shuts down?',
                a: 'Payment execution remains with Stripe Connect or the customer-controlled payment process. Customers can export deal and audit records at any time.',
              },
            ].map((item) => (
              <div
                key={item.q}
                className="rounded-xl border border-white/[0.07] bg-surface-3 px-5 py-5"
              >
                <p className="text-[13.5px] font-semibold text-white mb-1.5">{item.q}</p>
                <p className="text-[12.5px] leading-relaxed text-white/50">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 11. Pricing / Final CTA ─────────────────────────────────────────────── */}
      <section className="bg-[#031226] py-16 sm:py-20 border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">

          <div className="text-center mb-10">
            <h2 className="font-display text-[2rem] sm:text-[2.5rem] font-bold tracking-[-0.03em] text-white leading-[1.1]">
              1% per release. $50 minimum.
            </h2>
            <p className="mt-3 text-[15px] text-white/55">
              Contractors are always free. Funders pay after each verified disbursement — never before.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 mb-10">
            {[
              {
                tier: 'Standalone',
                rate: '1.00%',
                detail: 'No annual retainer required',
                note: 'Self-service, full platform access',
              },
              {
                tier: 'Institutional',
                rate: '0.70%',
                detail: 'Annual retainer applies',
                note: 'Dedicated onboarding, portfolio dashboard',
              },
              {
                tier: 'Enterprise',
                rate: '0.65%',
                detail: 'Negotiated annually',
                note: 'Custom terms, treasury rail integration',
              },
            ].map((t) => (
              <div
                key={t.tier}
                className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-6 py-6 text-center"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/55 mb-2">{t.tier}</p>
                <p className="font-display text-[2rem] font-bold text-white tracking-[-0.03em] leading-none mb-1">{t.rate}</p>
                <p className="text-[12px] text-vektrum-blue font-medium mb-1">{t.detail}</p>
                <p className="text-[11px] text-white/40">{t.note}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
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
              View full pricing
            </Link>
          </div>

        </div>
      </section>

    </div>
  )
}
