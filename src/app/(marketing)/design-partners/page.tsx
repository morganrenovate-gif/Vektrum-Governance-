import Link from 'next/link'
import {
  ArrowRight, AlertTriangle, CheckCircle2, FileText, FileWarning, Mail,
  ShieldCheck, Sparkles, Users, Building2, Hammer, Banknote, ClipboardCheck,
  Workflow, ListChecks, Lock,
} from 'lucide-react'
import { MetaViewContent } from '@/components/analytics/MetaViewContent'
import { DesignPartnerApplyForm } from './design-partner-apply-form'

// Public marketing — no per-user data. Re-render at most every hour.
export const revalidate = 3600

export const metadata = {
  title: 'Vektrum Design Partner Program | Construction Draw Governance',
  description:
    'Apply to become a Vektrum design partner and help shape construction draw governance workflows for lien waivers, inspections, approvals, change orders, and release authorization.',
  alternates: { canonical: 'https://vektrum.io/design-partners' },
  openGraph: {
    title: 'Stop releasing draws on incomplete evidence.',
    description:
      'Help shape Vektrum’s release-control layer for construction draws, evidence, approvals, and authorization.',
    url: 'https://vektrum.io/design-partners',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    title: 'Stop releasing draws on incomplete evidence.',
    description:
      'Apply to become a Vektrum design partner. Construction draw governance for lien waivers, inspections, approvals, and release authorization.',
  },
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DesignPartnersPage() {
  return (
    <div className="flex flex-col">
      <MetaViewContent contentName="Design Partners" />

      {/* ─── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#0D1B2A] pt-20 pb-16 sm:pt-28 sm:pb-20">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(26,58,150,1) 1px, transparent 1px), linear-gradient(90deg, rgba(26,58,150,1) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-vektrum-blue-subtle/50 to-transparent rounded-full blur-3xl" />

        <div className="relative max-w-4xl mx-auto px-6 sm:px-8 lg:px-12 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-vektrum-blue/30 bg-vektrum-blue/[0.08] px-4 py-1.5 shadow-sm mb-8">
            <Sparkles size={12} className="text-blue-300" aria-hidden={true} />
            <span className="text-[12px] font-semibold tracking-[0.06em] text-blue-200">
              Design Partner Program
            </span>
          </div>

          <h1 className="font-display text-4xl font-bold tracking-[-0.035em] text-white sm:text-5xl text-balance">
            Stop releasing draws on incomplete evidence.
          </h1>
          <p className="mt-3 mx-auto max-w-2xl text-[18px] font-semibold text-white/85">
            Workflow tools track. Vektrum enforces.
          </p>
          <p className="mt-5 mx-auto max-w-2xl text-[15px] leading-relaxed text-white/65">
            Vektrum helps construction lenders, title/escrow partners, and builders verify
            draw conditions before release authorization, including lien waivers, inspections,
            change orders, approvals, and supporting evidence.
          </p>

          <div className="mt-8 flex flex-col items-center gap-2">
            <Link
              href="#apply"
              className="group inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-vektrum-blue px-7 py-3 text-[14px] font-semibold text-white shadow-lg shadow-vektrum-blue/30 hover:bg-vektrum-blue-hover transition-all"
            >
              Apply to become a design partner
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden={true} />
            </Link>
            <p className="mt-3 text-[12px] text-white/50">
              Limited first cohort. 30-minute fit call. No obligation.
            </p>
          </div>

          {/* ── Hero workflow visual — minimal SVG-free flow ────────────────── */}
          <div className="mt-12 mx-auto max-w-3xl rounded-2xl border border-white/[0.08] bg-surface-2 p-5 sm:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45 mb-4 text-left">
              Draw → Evidence → Authorization
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-left">
              <FlowTile icon={FileText}      title="Draw request"    body="Submitted by contractor" />
              <FlowTile icon={ListChecks}    title="Required conditions" body="Mapped to contract & SOV" />
              <FlowTile icon={FileWarning}   title="Missing evidence" body="Flagged before release" warn />
              <FlowTile icon={CheckCircle2}  title="Release readiness" body="All conditions verified" ok />
              <FlowTile icon={ShieldCheck}   title="Authorization & audit" body="Funder authorizes; rail executes" />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Pain section ───────────────────────────────────────────────────── */}
      <section className="border-t border-white/[0.06] bg-[#0A1322] py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12">
          <h2 className="font-display text-3xl font-bold tracking-[-0.025em] text-white sm:text-[2rem] text-balance">
            The draw process is still held together by email, PDFs, spreadsheets, and trust.
          </h2>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              'Missing lien waivers delay releases.',
              'Inspection evidence gets buried in email.',
              'Change orders create approval confusion.',
              'Nobody knows which condition actually blocked the draw.',
              'Teams lack a clean audit trail when a dispute shows up.',
            ].map((p) => (
              <li
                key={p}
                className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-surface-2 px-4 py-3"
              >
                <AlertTriangle size={16} className="text-amber-400 mt-0.5 flex-shrink-0" aria-hidden={true} />
                <span className="text-[14px] text-white/80 leading-relaxed">{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ─── Before / After section ─────────────────────────────────────────── */}
      <section className="border-t border-white/[0.06] bg-[#0D1B2A] py-16 sm:py-20">
        <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12">
          <h2 className="font-display text-3xl font-bold tracking-[-0.025em] text-white sm:text-[2rem] text-balance text-center">
            From scattered draw evidence to release-ready authorization.
          </h2>

          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-300 mb-3">
                Before Vektrum
              </p>
              <ul className="space-y-2.5">
                {[
                  'Draw request arrives.',
                  'Documents are scattered across email, PDFs, spreadsheets, and portals.',
                  'Approvals happen manually.',
                  'Release risk is unclear.',
                  'Audit trail is incomplete or hard to reconstruct.',
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-[13px] text-white/75">
                    <AlertTriangle size={13} className="text-amber-400 mt-0.5 flex-shrink-0" aria-hidden={true} />
                    {b}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-300 mb-3">
                With Vektrum
              </p>
              <ul className="space-y-2.5">
                {[
                  'Required conditions are mapped.',
                  'Evidence is checked against the draw.',
                  'Missing items are flagged.',
                  'Release readiness is visible.',
                  'Final authorization has a cleaner audit trail.',
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-[13px] text-white/80">
                    <CheckCircle2 size={13} className="text-emerald-400 mt-0.5 flex-shrink-0" aria-hidden={true} />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Workflow strip */}
          <div className="mt-8 rounded-2xl border border-white/[0.08] bg-surface-2 px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45 mb-3">
              Workflow
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-[12px] text-white/75">
              <span className="rounded-md bg-surface-3 px-2.5 py-1.5 font-medium">Contract / SOV</span>
              <ArrowRight size={12} className="text-white/35" aria-hidden={true} />
              <span className="rounded-md bg-surface-3 px-2.5 py-1.5 font-medium">Draw request</span>
              <ArrowRight size={12} className="text-white/35" aria-hidden={true} />
              <span className="rounded-md bg-surface-3 px-2.5 py-1.5 font-medium">Evidence</span>
              <ArrowRight size={12} className="text-white/35" aria-hidden={true} />
              <span className="rounded-md bg-surface-3 px-2.5 py-1.5 font-medium">Conditions checked</span>
              <ArrowRight size={12} className="text-white/35" aria-hidden={true} />
              <span className="rounded-md bg-surface-3 px-2.5 py-1.5 font-medium">Funder authorization</span>
              <ArrowRight size={12} className="text-white/35" aria-hidden={true} />
              <span className="rounded-md bg-surface-3 px-2.5 py-1.5 font-medium">Selected rail executes</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Design partner offer ───────────────────────────────────────────── */}
      <section className="border-t border-white/[0.06] bg-[#0A1322] py-16 sm:py-20">
        <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12">
          <h2 className="font-display text-3xl font-bold tracking-[-0.025em] text-white sm:text-[2rem] text-balance">
            Join the first Vektrum design partner cohort.
          </h2>
          <p className="mt-3 max-w-2xl text-[15px] text-white/65 leading-relaxed">
            This is for operators with real draw-release pain who want direct influence on
            how Vektrum is built.
          </p>

          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/[0.08] bg-surface-2 p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-300 mb-3">
                What design partners get
              </p>
              <ul className="space-y-2.5">
                {[
                  'Early access to the draw governance workflow.',
                  'Direct influence on product requirements.',
                  'A private working session around their current draw process.',
                  'Priority onboarding when the pilot opens.',
                  'Preferred founding-partner pricing if there is a fit.',
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-[13px] text-white/80">
                    <CheckCircle2 size={13} className="text-emerald-400 mt-0.5 flex-shrink-0" aria-hidden={true} />
                    {b}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-surface-2 p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-300 mb-3">
                What Vektrum asks for
              </p>
              <ul className="space-y-2.5">
                {[
                  'One kickoff call.',
                  'Two to four feedback sessions.',
                  'One real or anonymized draw workflow to model.',
                  'Honest feedback on pain, value, rollout requirements, and implementation blockers.',
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-[13px] text-white/80">
                    <ClipboardCheck size={13} className="text-blue-300 mt-0.5 flex-shrink-0" aria-hidden={true} />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-6 text-[13px] text-white/55">
            Structured 45–60 day design-partner window.
          </p>
        </div>
      </section>

      {/* ─── Who it is for ──────────────────────────────────────────────────── */}
      <section className="border-t border-white/[0.06] bg-[#0D1B2A] py-16 sm:py-20">
        <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12">
          <h2 className="font-display text-3xl font-bold tracking-[-0.025em] text-white sm:text-[2rem] text-balance">
            Who this is for.
          </h2>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Banknote,   label: 'Construction lenders' },
              { icon: Banknote,   label: 'Private funders' },
              { icon: ShieldCheck, label: 'Title and escrow partners' },
              { icon: Workflow,   label: 'Fund control teams' },
              { icon: Building2,  label: 'Developers and owner reps' },
              { icon: Hammer,     label: 'Builders and contractors with active draw workflows' },
              { icon: Users,      label: 'Construction finance operators' },
              { icon: ClipboardCheck, label: 'Draw administrators' },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-start gap-2.5 rounded-xl border border-white/[0.06] bg-surface-2 px-4 py-3"
              >
                <Icon size={15} className="text-blue-300 mt-0.5 flex-shrink-0" aria-hidden={true} />
                <span className="text-[13px] text-white/80 leading-snug">{label}</span>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border border-white/[0.08] bg-surface-2 p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55 mb-3">
              What design partners help shape
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {[
                'Draw release workflows',
                'Lien waiver requirements',
                'Inspection and evidence requirements',
                'Contract/SOV import',
                'Change order clearance',
                'Funder authorization',
                'External/manual payment rail workflows',
                'Audit and compliance evidence',
                'Contractor evidence submission',
              ].map((s) => (
                <li key={s} className="flex items-start gap-2 text-[13px] text-white/75">
                  <CheckCircle2 size={12} className="text-emerald-400 mt-1 flex-shrink-0" aria-hidden={true} />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ─── Application form ───────────────────────────────────────────────── */}
      <section
        id="apply"
        className="border-t border-white/[0.06] bg-[#0A1322] py-16 sm:py-20 scroll-mt-20"
      >
        <div className="max-w-2xl mx-auto px-6 sm:px-8 lg:px-12">
          <h2 className="font-display text-3xl font-bold tracking-[-0.025em] text-white sm:text-[2rem] text-balance text-center">
            Apply to become a design partner
          </h2>
          <p className="mt-3 text-[14px] text-white/65 text-center leading-relaxed">
            Limited first cohort. 30-minute fit call. No obligation.
          </p>

          <div className="mt-8">
            <DesignPartnerApplyForm />
          </div>
        </div>
      </section>

      {/* ─── What Vektrum is — and what it is not ───────────────────────────── */}
      <section className="border-t border-white/[0.06] bg-[#0D1B2A] py-16 sm:py-20">
        <div className="max-w-3xl mx-auto px-6 sm:px-8 lg:px-12">
          <h2 className="font-display text-3xl font-bold tracking-[-0.025em] text-white sm:text-[2rem] text-balance">
            What Vektrum is — and what it is not.
          </h2>
          <div className="mt-6 rounded-2xl border border-white/[0.08] bg-surface-2 p-6 space-y-4">
            <p className="text-[14px] text-white/80 leading-relaxed">
              Vektrum is not an escrow service, a lender, a bank, a money transmitter,
              or legal counsel. Vektrum does not hold funds or move money.
              Vektrum is a workflow and authorization-readiness layer designed to help
              teams evaluate whether required draw conditions are complete before
              release authorization.
            </p>
            <p className="text-[13px] text-white/65 leading-relaxed">
              Payment execution is handled by the customer&rsquo;s selected rail, such as
              Stripe Connect, a bank, title company, escrow partner, treasury team,
              loan servicer, or other external/manual rail.
            </p>
            <div className="flex items-center gap-2 pt-2 text-[12px] text-white/45">
              <Lock size={12} aria-hidden={true} />
              <span>The selected rail executes funds — Vektrum enforces the conditions before funds move.</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Product credibility ────────────────────────────────────────────── */}
      <section className="border-t border-white/[0.06] bg-[#0A1322] py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12">
          <h2 className="font-display text-3xl font-bold tracking-[-0.025em] text-white sm:text-[2rem] text-balance">
            Built for construction disbursement workflows.
          </h2>
          <p className="mt-3 max-w-2xl text-[14px] text-white/65 leading-relaxed">
            Designed around lien waivers, SOVs, change orders, inspections, and approvals.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <ProofCard
              icon={ShieldCheck}
              title="10-condition release gate"
              body="Deterministic checks for lien waivers, inspections, change orders, contracts, and approvals — runs before authorization."
            />
            <ProofCard
              icon={ListChecks}
              title="Append-only audit trail"
              body="Hash-chained, tamper-evident record of every release decision, approval, and supporting document."
            />
            <ProofCard
              icon={Workflow}
              title="Rail-neutral execution"
              body="Stripe Connect, bank wire, title, escrow, or treasury — Vektrum authorizes, your rail executes."
            />
          </div>
        </div>
      </section>

      {/* ─── Final CTA ──────────────────────────────────────────────────────── */}
      <section className="border-t border-white/[0.06] bg-[#0D1B2A] py-20 sm:py-24">
        <div className="max-w-3xl mx-auto px-6 sm:px-8 lg:px-12 text-center">
          <h2 className="font-display text-3xl font-bold tracking-[-0.025em] text-white sm:text-[2rem] text-balance">
            Interested in shaping Vektrum?
          </h2>
          <p className="mt-4 text-[15px] text-white/65 leading-relaxed">
            If your team manages construction draws, lien waivers, inspections, approvals,
            or release decisions, we want to learn from your workflow.
          </p>
          <div className="mt-8 flex flex-col items-center gap-2">
            <Link
              href="#apply"
              className="group inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-vektrum-blue px-7 py-3 text-[14px] font-semibold text-white shadow-lg shadow-vektrum-blue/30 hover:bg-vektrum-blue-hover transition-all"
            >
              Apply to become a design partner
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden={true} />
            </Link>
            <p className="mt-3 text-[12px] text-white/50">
              Limited first cohort. 30-minute fit call. No obligation.
            </p>
          </div>

          <div className="mt-10 inline-flex items-center gap-2 text-[12px] text-white/40">
            <Mail size={12} aria-hidden={true} />
            <span>Construction draw governance · release authorization · audit trail</span>
          </div>
        </div>
      </section>
    </div>
  )
}

// ── Inline components ────────────────────────────────────────────────────────

function FlowTile({
  icon: Icon, title, body, warn = false, ok = false,
}: {
  icon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>
  title: string
  body: string
  warn?: boolean
  ok?: boolean
}) {
  const tone = warn
    ? 'border-amber-500/25 bg-amber-500/[0.06]'
    : ok
      ? 'border-emerald-500/25 bg-emerald-500/[0.06]'
      : 'border-white/[0.08] bg-surface-3'
  const iconTone = warn ? 'text-amber-400' : ok ? 'text-emerald-400' : 'text-blue-300'
  return (
    <div className={`rounded-xl border ${tone} p-3`}>
      <Icon size={14} className={`${iconTone} mb-2`} aria-hidden={true} />
      <p className="text-[12px] font-semibold text-white leading-tight">{title}</p>
      <p className="mt-1 text-[11px] text-white/55 leading-snug">{body}</p>
    </div>
  )
}

function ProofCard({
  icon: Icon, title, body,
}: {
  icon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>
  title: string
  body: string
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-surface-2 p-5">
      <Icon size={16} className="text-blue-300 mb-3" aria-hidden={true} />
      <p className="text-[14px] font-semibold text-white">{title}</p>
      <p className="mt-1.5 text-[12px] text-white/65 leading-relaxed">{body}</p>
    </div>
  )
}
