import Link from 'next/link'
import { BOOK_CALL_URL, BOOK_CALL_EXTERNAL } from '@/lib/book-call'
import {
  ArrowRight,
  HelpCircle,
  Shield,
  Banknote,
  FileText,
  Users,
  AlertCircle,
  Lock,
} from 'lucide-react'

export const metadata = {
  title: 'Help — Vektrum',
  description:
    'Frequently asked questions about Vektrum construction payment governance. Learn how milestone payments, the release gate, disputes, and Stripe Connect work.',
}

interface FaqItem {
  q: string
  a: string
}

const TRUST_FAQ: FaqItem[] = [
  {
    q: 'Is Vektrum a payment processor?',
    a: 'No. Vektrum is conditional authorization infrastructure — a release-control layer. Payment execution happens through Stripe Connect or the customer\'s existing title, escrow, treasury, or banking process. Vektrum is not a money transmitter, bank, lender, or escrow company.',
  },
  {
    q: 'Does Vektrum hold funds?',
    a: 'No. Vektrum does not hold funds in its own account. For Stripe Connect releases, funds are held in Stripe-managed accounts — not by Vektrum. For external/manual releases, funds never touch Vektrum infrastructure; your bank, title company, escrow company, or treasury executes payment through its existing process.',
  },
  {
    q: 'Does Vektrum replace title, escrow, banks, or lenders?',
    a: 'No. Vektrum adds a release-control and audit layer before your existing payment process executes. Title companies, escrow companies, banks, and lenders keep their current payment infrastructure and workflows. Vektrum enforces conditions and records proof. Keep your payment process — add release enforcement.',
  },
  {
    q: 'Who can authorize and release funds?',
    a: 'Only the deal funder — the authorized release party — can trigger a milestone release. Admins cannot release funds. Contractors cannot self-approve or self-release. Partners cannot bypass the gate. Every release is funder-triggered and enforced against the 10-condition gate.',
  },
  {
    q: 'Does AI approve releases?',
    a: 'No. AI-assisted review flags missing documents, conflicts, and risk signals — it informs the funder\'s review. It cannot approve a release. The funder triggers release, and the deterministic release gate enforces whether release is allowed. AI informs; the gate decides.',
  },
  {
    q: 'How does Vektrum get paid on external/manual rails?',
    a: 'External/manual rail customers are invoiced directly by Vektrum for platform access, authorized releases, and deal volume. Vektrum does not deduct fees from contractor disbursements — your rail executes payment in full. The governance fee is a separate invoice from Vektrum to the funder or institutional partner.',
  },
  {
    q: 'What does "tamper-evident audit trail" mean?',
    a: 'Every approval, release, status change, and override is appended to a server-side log with a UTC timestamp and actor identity. Each record\'s hash is computed from the previous record\'s hash — any deletion or modification breaks the chain. Records cannot be deleted or modified by the application. Vektrum uses the term "tamper-evident" because application-level modification is blocked; we make no broader claim about sophisticated infrastructure-level attacks, which remain theoretically possible.',
  },
  {
    q: 'Does every customer need to use Stripe?',
    a: 'No. Stripe Connect is available for automated execution on direct/private lending workflows. Institutional customers with licensed payment infrastructure use the external/manual rail — your existing bank, title company, escrow company, or treasury executes payment.',
  },
  {
    q: 'Can admins release funds?',
    a: 'No. Admins cannot trigger milestone releases. Privileged admin actions require AAL2 MFA, justification, and audit logging.',
  },
  {
    q: 'What happens if a condition fails?',
    a: 'The release is blocked until the issue is resolved. The failed gate evaluation is recorded in the audit log for visibility. Failed conditions are shown to the funder so they can take corrective action.',
  },
  {
    q: 'What happens if Vektrum shuts down?',
    a: 'Payment execution remains with Stripe Connect or the customer-controlled payment process. Vektrum\'s role is authorization, audit, and recordkeeping. Customers can export deal and audit records at any time.',
  },
]

const FAQ: FaqItem[] = [
  {
    q: 'What is Vektrum?',
    a: 'Vektrum is conditional authorization infrastructure for construction disbursements. Vektrum verifies whether a milestone release is allowed — 10 server-side conditions must all pass simultaneously — then the selected payment rail executes. Stripe Connect or the customer\'s existing title, escrow, treasury, or banking infrastructure handles execution. Vektrum records authorization, proof, audit evidence, and reconciliation state. Vektrum does not hold funds or act as escrow.',
  },
  {
    q: 'How does payment execution work?',
    a: 'After Vektrum authorizes a release, payment runs on one of two rails. Stripe Connect rail: Vektrum triggers a Stripe Connect transfer; funds are held in Stripe-managed accounts, not by Vektrum. External/manual rail: Vektrum fires a signed authorization signal to the institutional partner; the funder\'s bank, title company, escrow company, or treasury executes payment through its existing process. Stripe is not required for institutional customers.',
  },
  {
    q: 'What is the difference between the Stripe Connect rail and the external/manual rail?',
    a: 'Stripe Connect (automated rail) is best for direct/private lenders without existing payment infrastructure — Vektrum triggers the Stripe transfer after authorization. External/manual rail is for banks, credit unions, title companies, construction loan servicers, and fund managers with licensed payment infrastructure — Vektrum issues an authorization signal and your existing rail executes payment. You retain full control of how funds move.',
  },
  {
    q: 'Does Vektrum hold my money?',
    a: 'No. Vektrum does not hold funds in its own account or act as escrow. For Stripe Connect releases, funds are held in Stripe-managed accounts — not by Vektrum. For external/manual releases, funds never touch Vektrum infrastructure; your bank, title company, escrow company, or treasury partner executes payment through its existing process.',
  },
  {
    q: 'How does Vektrum work with institutional payment partners?',
    a: 'For deals using an institutional partner (title company, escrow company, construction loan servicer, or treasury team), the partner executes payment through its existing process. Vektrum authorizes or blocks the release and records confirmation, reference, proof, actor, timestamp, and audit trail. Stripe Connect is not required for these deals.',
  },
  {
    q: 'What is the 10-condition release gate?',
    a: 'Before any milestone payment releases, 10 server-side conditions must all be true simultaneously: (1) milestone approved by the funder, (2) milestone cleared and eligible for release, (3) sufficient funded balance including the platform fee, (4) contractor payment account verified and active where required, (5) contractor onboarding complete, (6) no duplicate release on this milestone, (7) no pending change orders, (8) a fully-signed contract on file, (9) sequential-release ordering and explicit prerequisites satisfied (where required), and (10) an approved conditional lien waiver on file (where required). A separate AI-assisted draw review precondition runs independently before the gate.',
  },
  {
    q: 'Can contractors start a project and invite the funder?',
    a: 'Yes. Contractors can create a deal workspace, enter project details, and invite the funder via a secure link. The funder verifies terms, confirms retainage, reviews and approves milestones, and manages release authorization. Contractors cannot self-approve, self-release, or control retainage. The funder is the release authority.',
  },
  {
    q: 'Who controls retainage?',
    a: 'The funder and contract terms control retainage. Contractors can view withheld amounts per milestone and the running total, but cannot release retainage. Only the funder or authorized release party can release retainage once project completion conditions are met.',
  },
  {
    q: 'What documents should contractors upload?',
    a: 'Supporting evidence helps the funder and the AI pre-review assess whether draw conditions are met. Suggested evidence includes: invoice or pay application, inspection report or site visit summary, site photos, receipts or supplier invoices, and change order backup (if applicable). Upload requirements may vary by contract, funder review, and release-gate settings. Uploading evidence is not itself a gate condition, but missing evidence may cause a funder to withhold approval.',
  },
  {
    q: 'How does dispute isolation work?',
    a: 'Each milestone is an independent financial unit. If a dispute is raised on one milestone, only that milestone is locked. All other milestones in the deal continue to flow normally — a single disputed draw does not freeze the project.',
  },
  {
    q: 'What happens when there is a dispute or change order?',
    a: 'Disputes: the disputed milestone is locked and enters Vektrum dispute management. Both parties can submit evidence. The dispute is isolated — it does not affect other milestones in the deal. Change orders: if a contractor submits a change order on a milestone, the release gate blocks release on that milestone until the funder approves or rejects it. Approved change orders update the milestone amount; rejected ones allow the release process to proceed.',
  },
  {
    q: 'Is Vektrum free for contractors?',
    a: 'Yes. Contractors always join free. No subscription, no per-milestone charge, no onboarding fee. The funder pays the Vektrum Compliance Review Fee when funds are disbursed.',
  },
  {
    q: 'How do funders get charged?',
    a: 'Vektrum uses a governance fee model: a per-release governance fee (Vektrum Compliance Review Fee) plus an optional annual retainer for institutional portfolio plans. Standalone (Stripe rail) projects have no retainer. External/manual rail customers are invoiced separately — Vektrum does not deduct fees from contractor disbursements.',
  },
  {
    q: 'How do I get started?',
    a: 'Sign up for a free account — it takes under a minute. Contractors can create an account anytime and get added to deals by their funder. Funders can create a standalone project immediately or contact us for institutional onboarding.',
  },
]

export default function HelpPage() {
  return (
    <div className="flex flex-col">
      {/* ─── Hero ──────────────────────────────────────────────────────────── */}
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
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-surface-2 px-4 py-1.5 shadow-sm mb-8">
            <HelpCircle size={14} className="text-blue-300" />
            <span className="text-[12px] font-medium text-white/55 tracking-wide">
              Help center
            </span>
          </div>

          <h1 className="font-display text-4xl font-bold tracking-[-0.035em] text-white sm:text-5xl text-balance">
            Frequently asked questions
          </h1>
          <p className="mt-4 mx-auto max-w-2xl text-[17px] leading-relaxed text-white/55">
            Everything you need to know about Vektrum, milestone payments, and
            construction payment governance.
          </p>
        </div>
      </section>

      {/* ─── FAQ ───────────────────────────────────────────────────────────── */}
      <section className="bg-[#0A1628] py-16 sm:py-20">
        <div className="max-w-3xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="space-y-4">
            {FAQ.map((item) => (
              <div
                key={item.q}
                className="rounded-xl border border-white/[0.08] bg-surface-2 p-6"
              >
                <h3 className="text-[15px] font-semibold text-white">{item.q}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-white/55">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Trust & Compliance FAQ ─────────────────────────────────────────── */}
      <section className="bg-surface-2 py-16 sm:py-20 border-t border-white/[0.08]">
        <div className="max-w-3xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="mb-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/65 mb-2">
              Trust &amp; Compliance
            </p>
            <h2 className="font-display text-xl font-bold tracking-[-0.02em] text-white">
              Common questions from institutional buyers
            </h2>
          </div>
          <div className="space-y-3">
            {TRUST_FAQ.map((item) => (
              <div
                key={item.q}
                className="rounded-xl border border-white/[0.08] bg-surface-3 p-6"
              >
                <h3 className="text-[14px] font-semibold text-white">{item.q}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-white/70">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Contact ───────────────────────────────────────────────────────── */}
      <section className="border-t border-white/[0.08] bg-surface-2 py-20 sm:py-24">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12 text-center">
          <h2 className="text-2xl font-bold tracking-[-0.025em] text-white sm:text-3xl text-balance">
            Still have questions?
          </h2>
          <p className="mt-4 mx-auto max-w-md text-[15px] text-white/55">
            Reach out to our team and we will get back to you.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
            <Link
              href={BOOK_CALL_URL}
              {...(BOOK_CALL_EXTERNAL ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="group inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-vektrum-blue px-7 py-3 text-[14px] font-semibold text-white shadow-lg shadow-vektrum-blue/30 hover:bg-vektrum-blue-hover transition-all"
            >
              Book a call
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/demo-live"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/[0.08] bg-surface-2 px-7 py-3 text-[14px] font-semibold text-white/55 shadow-sm hover:bg-surface-3 hover:border-vektrum-blue/40 transition-all"
            >
              Try the demo
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
