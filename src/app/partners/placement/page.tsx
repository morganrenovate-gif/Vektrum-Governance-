import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Shield,
  GitBranch,
  CheckCircle2,
  ArrowDown,
  Building2,
  CreditCard,
  Lock,
  FileText,
  Webhook,
  AlertCircle,
} from 'lucide-react'
import { PrintButton } from '@/components/ui/print-button'
import { BOOK_CALL_URL, BOOK_CALL_EXTERNAL } from '@/lib/book-call'

export const metadata: Metadata = {
  title: 'Where Vektrum Plugs In | Partner Overview',
  description:
    'Conditional authorization infrastructure for construction disbursements. How Vektrum fits with title companies, escrow, lenders, and institutional partners.',
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-300 mb-2">
      {children}
    </p>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-[1.25rem] font-bold tracking-[-0.02em] text-white mb-4">
      {children}
    </h2>
  )
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <CheckCircle2 size={13} className="text-blue-300 flex-shrink-0 mt-[3px]" aria-hidden="true" />
      <span className="text-[13px] leading-relaxed text-white/65">{children}</span>
    </li>
  )
}

function NoBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="flex-shrink-0 mt-[6px] w-1 h-1 rounded-full bg-red-400/60" aria-hidden="true" />
      <span className="text-[13px] leading-relaxed text-white/65">{children}</span>
    </li>
  )
}

function FlowStep({
  label,
  sub,
  highlight = false,
  last = false,
}: {
  label: string
  sub?: string
  highlight?: boolean
  last?: boolean
}) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={`w-full rounded-xl px-4 py-3 text-center ${
          highlight
            ? 'bg-vektrum-blue/[0.12] border border-vektrum-blue/30'
            : 'bg-white/[0.04] border border-white/[0.08]'
        }`}
      >
        <p className={`text-[12.5px] font-semibold ${highlight ? 'text-white' : 'text-white/75'}`}>
          {label}
        </p>
        {sub && (
          <p className={`text-[11px] mt-0.5 ${highlight ? 'text-blue-300' : 'text-white/60'}`}>
            {sub}
          </p>
        )}
      </div>
      {!last && (
        <div className="flex flex-col items-center py-1">
          <div className="w-px h-3 bg-white/[0.12]" />
          <ArrowDown size={12} className="text-white/20" />
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PartnerPlacementPage() {
  return (
    <div className="bg-[#0A1628] min-h-screen">
      <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12 py-12 sm:py-16 space-y-12 print:py-8 print:space-y-8">

        {/* ── 1. Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-px w-5 bg-vektrum-blue flex-shrink-0" />
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-300">
                Partner Overview
              </p>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-[-0.035em] text-white leading-[1.1] mb-4">
              Where Vektrum Plugs In
            </h1>
            <p className="text-[15px] font-semibold text-blue-300 mb-3">
              Conditional authorization infrastructure for construction disbursements.
            </p>
            <p className="text-[14px] leading-relaxed text-white/60 max-w-2xl">
              Vektrum sits before payment execution. It evaluates whether a construction draw is
              allowed to release, then records the authorization, proof, and audit trail.
              Existing payment rails remain in place.
            </p>
            <p className="mt-4 text-[12px] text-white/60">
              Partner inquiries:{' '}
              <a href="mailto:operations@vektrum.io" className="text-blue-300 hover:underline">
                operations@vektrum.io
              </a>
            </p>
          </div>
          <div className="flex-shrink-0 print:hidden">
            <PrintButton />
          </div>
        </div>

        {/* ── Positioning strip ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: Shield,    label: 'Authorizes or blocks release',      sub: 'Server-side 10-condition gate' },
            { icon: GitBranch, label: 'Records proof and audit evidence',   sub: 'Append-only, hash-chained log' },
            { icon: Lock,      label: 'Authorization separated from execution', sub: 'Your payment rail stays in place' },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={label} className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3.5 flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-vektrum-blue/10 mt-0.5">
                <Icon size={15} className="text-blue-300" aria-hidden="true" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-white">{label}</p>
                <p className="text-[11.5px] text-white/65 mt-0.5">{sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── 2 + 3. Problem + Workflow ──────────────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-2">

          {/* Problem */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#111827] p-6">
            <SectionLabel>The Problem</SectionLabel>
            <SectionHeading>Manual approvals don&apos;t enforce release conditions.</SectionHeading>
            <p className="text-[13px] leading-relaxed text-white/55 mb-5">
              Construction disbursements often rely on manual approval chains, emails, spreadsheets,
              and fragmented documentation. By the time a lien issue, missing waiver, disputed
              milestone, or contract problem is discovered, funds may have already moved.
            </p>
            <ul className="space-y-2.5">
              {[
                'Draw approval does not always equal safe release',
                'Title and escrow teams need evidence before disbursement',
                'Lenders need enforceable controls, not just policy',
                'Contractors need faster clarity on what is missing',
                'Disputes should not freeze unrelated milestones',
              ].map((item) => (
                <Bullet key={item}>{item}</Bullet>
              ))}
            </ul>
          </div>

          {/* Workflow */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#111827] p-6">
            <SectionLabel>Institutional / External Workflow</SectionLabel>
            <SectionHeading>Where Vektrum fits.</SectionHeading>
            <div className="space-y-0.5">
              <FlowStep label="Lender / Title / Escrow / Treasury" sub="Sends draw package and release context" />
              <FlowStep
                label="Vektrum Authorization Layer"
                sub="10-condition release gate evaluated server-side"
                highlight
              />
              <FlowStep label="Pass / Block decision + audit event" sub="Failed conditions block release; reason recorded" />
              <FlowStep label="Partner-controlled payment execution" sub="Wire · ACH · check · or Stripe Connect" />
              <FlowStep label="Payment reference and proof returned" sub="Method, reference, actor, timestamp" />
              <FlowStep label="Vektrum audit and reconciliation" sub="Append-only, hash-chained record" last />
            </div>
            <p className="mt-5 text-[11.5px] leading-relaxed text-white/60 border-t border-white/[0.06] pt-4">
              Vektrum does not replace the payment process. It enforces whether the release is
              allowed before that process executes.
            </p>
          </div>
        </div>

        {/* ── 4. Two Execution Models ────────────────────────────────────────── */}
        <div>
          <SectionLabel>Execution Models</SectionLabel>
          <SectionHeading>Two supported rails.</SectionHeading>
          <div className="grid gap-5 lg:grid-cols-2">

            {/* External / Manual */}
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10">
                  <Building2 size={17} className="text-emerald-400" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[14px] font-bold text-white">External / Manual Execution</p>
                  <p className="text-[11px] text-emerald-400/70">Institutional partners · existing infrastructure</p>
                </div>
              </div>
              <p className="text-[12px] text-white/65 mb-3">Best for:</p>
              <ul className="space-y-1 mb-5">
                {['Title companies', 'Escrow companies', 'Construction lenders', 'Credit funds', 'Institutional treasury teams'].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-[12.5px] text-white/65">
                    <span className="w-1 h-1 rounded-full bg-emerald-400/50 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <ol className="space-y-2 mb-5">
                {[
                  'Vektrum evaluates release conditions',
                  'Release is authorized or blocked',
                  'Partner executes payment outside Vektrum',
                  'Partner records method, reference, proof, actor, and timestamp',
                  'Vektrum stores the audit trail',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="flex-shrink-0 flex h-4 w-4 items-center justify-center rounded-full bg-white/[0.06] text-[9px] font-bold text-white/50 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-[12.5px] text-white/60 leading-snug">{step}</span>
                  </li>
                ))}
              </ol>
              <p className="text-[11.5px] leading-relaxed text-emerald-400/70 border-t border-emerald-500/15 pt-3">
                Payment is executed by the partner-controlled process. Vektrum governs
                authorization and records proof.
              </p>
            </div>

            {/* Stripe Connect */}
            <div className="rounded-2xl border border-vektrum-blue/20 bg-vektrum-blue/[0.03] p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-vektrum-blue/10">
                  <CreditCard size={17} className="text-blue-300" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[14px] font-bold text-white">Stripe Connect Automated Execution</p>
                  <p className="text-[11px] text-blue-300/70">Direct and private lenders · automated disbursement</p>
                </div>
              </div>
              <p className="text-[12px] text-white/65 mb-3">Best for:</p>
              <ul className="space-y-1 mb-5">
                {['Private lenders', 'Direct lenders', 'Operators without existing disbursement infrastructure'].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-[12.5px] text-white/65">
                    <span className="w-1 h-1 rounded-full bg-vektrum-blue/50 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <ol className="space-y-2 mb-5">
                {[
                  'Vektrum evaluates release conditions',
                  'Funder triggers release',
                  'Stripe Connect executes the automated transfer',
                  'Vektrum records the release and reconciliation state',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="flex-shrink-0 flex h-4 w-4 items-center justify-center rounded-full bg-white/[0.06] text-[9px] font-bold text-white/50 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-[12.5px] text-white/60 leading-snug">{step}</span>
                  </li>
                ))}
              </ol>
              <p className="text-[11.5px] leading-relaxed text-blue-300/70 border-t border-vektrum-blue/15 pt-3">
                For Stripe Connect releases, payment execution runs through Stripe Connect
                infrastructure.
              </p>
            </div>
          </div>
        </div>

        {/* ── 5. Release Gate ────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#111827] p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
            <div>
              <SectionLabel>Release Gate</SectionLabel>
              <SectionHeading>Every release is checked before execution.</SectionHeading>
              <p className="text-[13px] leading-relaxed text-white/55 max-w-xl -mt-2">
                Before any milestone release is authorized, all 10 conditions are evaluated
                simultaneously on the server. If any required condition fails, the release is
                blocked until resolved.
              </p>
            </div>
            <div className="flex-shrink-0">
              <div className="rounded-xl border border-vektrum-blue/20 bg-vektrum-blue/[0.06] px-4 py-3 text-center min-w-[80px]">
                <p className="font-display text-3xl font-bold text-white">10</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-300 mt-0.5">Conditions</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              'Milestone approved by the funder',
              'Milestone protection status ready',
              'Sufficient funded balance including platform fee',
              'Contractor payout readiness verified',
              'Contractor onboarding complete',
              'No existing release on this milestone',
              'No open change orders',
              'Signed contract on file',
              'Sequential ordering and prerequisites satisfied (where required)',
              'Approved lien waiver on file (where required)',
            ].map((condition, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3.5 py-2.5">
                <span className="flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-vektrum-blue/10 text-[9px] font-bold text-blue-300 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-[12.5px] text-white/65 leading-snug">{condition}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11.5px] text-white/60 leading-relaxed">
            Customers may add configured release requirements on top of the core gate.
          </p>
        </div>

        {/* ── 6. API Surface ─────────────────────────────────────────────────── */}
        <div>
          <SectionLabel>Partner API</SectionLabel>
          <SectionHeading>Integration surface for execution-rail partners.</SectionHeading>
          <p className="text-[13px] leading-relaxed text-white/55 mb-5 -mt-2">
            The API lets partners confirm execution after Vektrum authorizes release. It does not
            allow partners to bypass the release gate. All calls are scoped to partner-associated
            deals, rate-limited, and written to the audit log.
          </p>
          <div className="space-y-3">
            {[
              {
                method: 'GET',
                path: '/api/partner/releases/:id',
                purpose: 'View release status, rail, milestone, amount, and confirmation state.',
                color: 'emerald',
              },
              {
                method: 'POST',
                path: '/api/partner/releases/:id/confirm',
                purpose: 'Confirm external payment execution — supply method, reference, proof, actor, and timestamp. Idempotent.',
                color: 'blue',
              },
              {
                method: 'POST',
                path: '/api/partner/releases/:id/fail',
                purpose: 'Mark external execution as failed. Cancels balance reservation and preserves audit visibility.',
                color: 'blue',
              },
            ].map((ep) => {
              const methodStyle =
                ep.color === 'emerald'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-vektrum-blue/10 text-blue-300 border-vektrum-blue/20'
              return (
                <div
                  key={ep.path}
                  className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3.5 flex flex-col sm:flex-row sm:items-start gap-3"
                >
                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${methodStyle}`}>
                      {ep.method}
                    </span>
                    <code className="text-[12.5px] font-mono text-white/80">{ep.path}</code>
                  </div>
                  <p className="text-[12.5px] leading-relaxed text-white/50 sm:ml-2">{ep.purpose}</p>
                </div>
              )
            })}
          </div>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {['Scoped API keys', 'Partner-specific access', 'Audit logging on every call', 'No direct fund movement'].map((item) => (
              <div key={item} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-center">
                <p className="text-[11.5px] text-white/65 leading-snug">{item}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── 7 + 8. What Partners Get / What Vektrum Does Not Do ────────────── */}
        <div className="grid gap-6 lg:grid-cols-2">

          {/* Partners get */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#111827] p-6">
            <SectionLabel>What Partners Get</SectionLabel>
            <SectionHeading>Compatible with existing workflows.</SectionHeading>
            <ul className="space-y-2.5">
              {[
                'Clear pass / block decision before disbursement',
                'Fewer unsupported releases',
                'Cleaner lien waiver and milestone evidence',
                'Milestone-level dispute isolation',
                'Audit-ready release history',
                'Compatibility with existing payment processes',
                'API-ready integration path',
                'No requirement to replace title, escrow, bank, or treasury workflows',
              ].map((item) => (
                <Bullet key={item}>{item}</Bullet>
              ))}
            </ul>
          </div>

          {/* What Vektrum does not do */}
          <div className="rounded-2xl border border-red-500/15 bg-red-500/[0.03] p-6">
            <SectionLabel>Scope Boundary</SectionLabel>
            <SectionHeading>What Vektrum does not do.</SectionHeading>
            <ul className="space-y-2.5">
              {[
                'Does not hold funds in its own bank account',
                'Does not act as escrow',
                'Does not execute wires',
                'Does not replace title companies',
                'Does not make credit decisions',
                'Does not provide legal advice',
                'AI does not approve payments — AI informs; the gate decides',
              ].map((item) => (
                <NoBullet key={item}>{item}</NoBullet>
              ))}
            </ul>
            <p className="mt-5 text-[11.5px] leading-relaxed text-white/60 border-t border-white/[0.06] pt-4">
              Vektrum governs authorization and records proof. Payment execution remains with
              Stripe Connect or the customer&apos;s partner-controlled process.
            </p>
          </div>
        </div>

        {/* ── 9. Closing CTA ─────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-vektrum-blue/20 bg-vektrum-blue/[0.04] p-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="h-px w-6 bg-vektrum-blue" />
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-300">Partner Integration</p>
            <div className="h-px w-6 bg-vektrum-blue" />
          </div>
          <h2 className="font-display text-2xl font-bold tracking-[-0.025em] text-white mb-4">
            Keep your payment process.<br />Add release enforcement.
          </h2>
          <p className="text-[14px] leading-relaxed text-white/60 max-w-xl mx-auto mb-8">
            If you manage construction disbursements through title, escrow, treasury, banking, or
            internal lender workflows, Vektrum can sit before execution and enforce whether a draw
            is allowed to release.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center print:hidden">
            <Link
              href={BOOK_CALL_URL}
              {...(BOOK_CALL_EXTERNAL ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-vektrum-blue px-7 py-3 text-[14px] font-semibold text-white shadow-lg shadow-vektrum-blue/25 hover:bg-vektrum-blue-hover transition-all"
            >
              Talk to us about partner integration
            </Link>
            <a
              href="mailto:operations@vektrum.io"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/[0.10] bg-transparent px-7 py-3 text-[14px] font-medium text-white/55 hover:text-white hover:border-white/[0.20] transition-all"
            >
              operations@vektrum.io
            </a>
          </div>
          {/* Print-only contact */}
          <p className="hidden print:block text-[13px] text-white/55 mt-4">
            operations@vektrum.io · vektrum.io
          </p>
        </div>

        {/* ── Footer note ────────────────────────────────────────────────────── */}
        <div className="border-t border-white/[0.06] pt-5 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-white/60">
            Vektrum is authorization infrastructure — not a bank, lender, payment processor, or money transmitter.
            Vektrum does not hold or custody funds.
          </p>
          <div className="flex items-center gap-4 print:hidden">
            <Link href="/partners/docs" className="text-[11px] text-white/60 hover:text-white transition-colors">
              Partner API reference →
            </Link>
            <Link href="/security" className="text-[11px] text-white/60 hover:text-white transition-colors">
              Security →
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}
