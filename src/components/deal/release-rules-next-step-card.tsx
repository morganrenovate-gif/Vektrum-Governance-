<<<<<<< HEAD
/**
 * Post-approval next-step card for funder/admin.
 *
 * Two visual modes, gated by whether SOV draft rows exist for the
 * accepted release-rules draft:
 *
 *   1. accepted + SOV empty
 *      → "Create Schedule of Values" + Primary "Create SOV from accepted
 *        draft" + Secondary "Enter SOV manually". This is the rare case
 *        where the approve-time materialisation didn't run (insert error,
 *        ALTER TABLE not yet applied, etc). Both CTAs link to the
 *        existing SOV section so the user can manually author the rows
 *        from the accepted draft as the source of truth.
 *
 *   2. accepted + SOV draft rows present
 *      → "SOV draft pending approval" + "Review SOV draft" CTA
 *
 * Contractor / non-funder roles see nothing — the existing
 * <ReleaseRulesReviewCard> already shows the contractor-side
 * "Release rules under review" / accepted-state copy.
 *
 * SAFE COPY — pinned by tests:
 *   - "Draft rules must be reviewed and approved before they control
 *     release readiness."
 *   - "Release authorization remains separate."
 *   - "Selected rail executes disbursement."
 */

import Link from 'next/link'
import { ArrowRight, FileText, Eye } from 'lucide-react'

interface ReleaseRulesNextStepCardProps {
  /** True when an accepted release-rule draft exists for this contract. */
  releaseRulesAccepted: boolean
  /** True when at least one SOV line item exists for this deal. */
  hasSovItems:          boolean
  /** True when at least one SOV line item is `status='approved'`. */
  sovApproved:          boolean
  /** Funder / admin only — contractor view is handled in the review card. */
=======
import Link from 'next/link'
import { ArrowRight, CheckCircle2, Clock } from 'lucide-react'

interface ReleaseRulesNextStepCardProps {
  releaseRulesAccepted: boolean
  hasSovItems:          boolean
  sovApproved:          boolean
>>>>>>> origin/claude/lucid-dubinsky-5f21ed
  viewerRole:           'funder' | 'contractor' | 'admin'
}

export function ReleaseRulesNextStepCard({
  releaseRulesAccepted,
  hasSovItems,
  sovApproved,
  viewerRole,
}: ReleaseRulesNextStepCardProps) {
<<<<<<< HEAD
  // Hide the card unless the funder/admin needs the next step. Once SOV is
  // approved, the manual SOV approval workflow takes over.
  if (!releaseRulesAccepted) return null
  if (sovApproved)            return null
  if (viewerRole !== 'funder' && viewerRole !== 'admin') return null

  // Variant 1: accepted draft, SOV not yet created
  if (!hasSovItems) {
    return (
      <section
        aria-label="Create Schedule of Values"
        className="rounded-2xl border border-vektrum-blue/25 bg-vektrum-blue/[0.04] overflow-hidden"
      >
        <div className="border-b border-vektrum-blue/15 px-5 py-3.5 flex items-center gap-2.5">
          <FileText size={14} className="text-blue-300 flex-shrink-0" aria-hidden="true" />
          <p className="text-[12px] font-semibold text-blue-300">Create Schedule of Values</p>
          <span className="ml-auto text-[10px] uppercase tracking-[0.12em] text-blue-300/70 font-semibold">
=======
  if (!releaseRulesAccepted) return null

  // Variant A — SOV not yet created from the accepted draft
  if (!hasSovItems) {
    return (
      <section
        aria-label="Release rules accepted — next step Schedule of Values"
        className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] overflow-hidden"
      >
        <div className="border-b border-emerald-500/15 px-5 py-3.5 flex items-center gap-2.5">
          <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" aria-hidden="true" />
          <p className="text-[12px] font-semibold text-emerald-300">Draft accepted</p>
          <span className="ml-auto text-[10px] uppercase tracking-[0.12em] text-emerald-300/70 font-semibold">
            Next required step
          </span>
        </div>

        <div className="px-5 py-5 space-y-4">
          <p className="text-[13px] text-white/75 leading-relaxed">
            The draft release rules have been accepted. Create the Schedule of Values to
            unlock milestone release readiness.
          </p>

          {(viewerRole === 'funder' || viewerRole === 'admin') ? (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  href="#sov"
                  className="inline-flex items-center gap-1.5 self-start rounded-lg bg-vektrum-blue px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-vektrum-blue-hover transition-colors"
                >
                  Create SOV from accepted draft
                  <ArrowRight size={13} aria-hidden="true" />
                </Link>
                <Link
                  href="#sov"
                  className="inline-flex items-center gap-1.5 self-start rounded-lg border border-white/[0.10] bg-surface-3 px-4 py-2.5 text-[13px] font-semibold text-white/75 hover:text-white hover:bg-white/[0.06] hover:border-white/[0.18] transition-colors"
                >
                  Enter SOV manually
                  <ArrowRight size={13} aria-hidden="true" />
                </Link>
              </div>
              <p className="text-[11px] text-white/45 leading-relaxed">
                Release authorization remains separate from SOV setup. The deterministic
                release gate and funder authorization still control release.
              </p>
            </>
          ) : (
            // Contractor — read-only
            <div className="space-y-2">
              <p className="text-[14px] font-semibold text-white">
                Waiting for SOV setup
              </p>
              <p className="text-[12px] text-white/55 leading-relaxed">
                The funder is setting up the Schedule of Values from the accepted release
                rules. You will be notified when SOV line items are ready to link to your
                milestones.
              </p>
            </div>
          )}
        </div>
      </section>
    )
  }

  // Variant B — SOV exists but not yet approved (funder action pending)
  if (!sovApproved) {
    return (
      <section
        aria-label="SOV pending approval"
        className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] overflow-hidden"
      >
        <div className="border-b border-amber-500/15 px-5 py-3.5 flex items-center gap-2.5">
          <Clock size={14} className="text-amber-400 flex-shrink-0" aria-hidden="true" />
          <p className="text-[12px] font-semibold text-amber-300">SOV pending approval</p>
          <span className="ml-auto text-[10px] uppercase tracking-[0.12em] text-amber-300/70 font-semibold">
>>>>>>> origin/claude/lucid-dubinsky-5f21ed
            Next required step
          </span>
        </div>

        <div className="px-5 py-5 space-y-3">
          <p className="text-[13px] text-white/75 leading-relaxed">
<<<<<<< HEAD
            Draft release rules have been accepted. Create SOV line items from the
            accepted draft, then review and approve the SOV before milestone releases
            can proceed.
          </p>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Link
              href="#sov"
              className="inline-flex items-center gap-1.5 self-start rounded-lg bg-vektrum-blue px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-vektrum-blue-hover transition-colors"
            >
              Create SOV from accepted draft
              <ArrowRight size={13} aria-hidden="true" />
            </Link>
            <Link
              href="#sov"
              className="inline-flex items-center gap-1.5 self-start rounded-lg border border-white/[0.10] bg-surface-3 px-4 py-2.5 text-[13px] font-semibold text-white/75 hover:text-white hover:bg-white/[0.06] hover:border-white/[0.18] transition-colors"
            >
              Enter SOV manually
              <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </div>

          <p className="text-[11px] text-white/45 leading-relaxed">
            Draft rules must be reviewed and approved before they control release
            readiness. Release authorization remains separate. The selected rail
            executes disbursement.
          </p>
=======
            The Schedule of Values has been created. Approve line items to activate
            milestone release readiness.
          </p>

          {(viewerRole === 'funder' || viewerRole === 'admin') ? (
            <>
              <Link
                href="#sov"
                className="inline-flex items-center gap-1.5 self-start rounded-lg bg-vektrum-blue px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-vektrum-blue-hover transition-colors"
              >
                Review and approve SOV
                <ArrowRight size={13} aria-hidden="true" />
              </Link>
              <p className="text-[11px] text-white/45 leading-relaxed">
                Selected rail executes disbursement only after funder authorization and
                all release gate conditions are met.
              </p>
            </>
          ) : (
            <p className="text-[12px] text-white/55 leading-relaxed">
              Your funder is reviewing the Schedule of Values. You will be notified when
              line items are approved.
            </p>
          )}
>>>>>>> origin/claude/lucid-dubinsky-5f21ed
        </div>
      </section>
    )
  }

<<<<<<< HEAD
  // Variant 2: SOV draft rows exist, awaiting human approval
  return (
    <section
      aria-label="SOV draft pending approval"
      className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] overflow-hidden"
    >
      <div className="border-b border-amber-500/15 px-5 py-3.5 flex items-center gap-2.5">
        <Eye size={14} className="text-amber-400 flex-shrink-0" aria-hidden="true" />
        <p className="text-[12px] font-semibold text-amber-300">SOV draft pending approval</p>
        <span className="ml-auto text-[10px] uppercase tracking-[0.12em] text-amber-300/70 font-semibold">
          Review required
        </span>
      </div>

      <div className="px-5 py-5 space-y-3">
        <p className="text-[13px] text-white/75 leading-relaxed">
          Review the generated SOV line items before they become approved release setup.
        </p>

        <Link
          href="#sov"
          className="inline-flex items-center gap-1.5 self-start rounded-lg bg-vektrum-blue px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-vektrum-blue-hover transition-colors"
        >
          Review SOV draft
          <ArrowRight size={13} aria-hidden="true" />
        </Link>

        <p className="text-[11px] text-white/45 leading-relaxed">
          SOV approval is a separate human action and does not authorize release.
          The deterministic release gate and funder authorization still control release.
          The selected rail executes disbursement.
        </p>
      </div>
    </section>
  )
=======
  // SOV is approved — no next-step card needed here (release gate handles it)
  return null
>>>>>>> origin/claude/lucid-dubinsky-5f21ed
}
