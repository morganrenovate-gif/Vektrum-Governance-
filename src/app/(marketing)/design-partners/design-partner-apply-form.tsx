'use client'

/**
 * DesignPartnerApplyForm — qualifying application form for the design-partner cohort.
 *
 * Pure client component. No DB writes, no API call, no auth, no cookies.
 * On submit:
 *   1. Fires trackMetaEvent('Lead', { content_name: 'Design Partner Application' })
 *      so Meta Ads can attribute the conversion. Single fire — guarded by a ref
 *      so React StrictMode / accidental double clicks cannot double-count.
 *   2. Shows a thank-you state with a UTM-tagged Cal.com fit-call booking link.
 *
 * No production release/payment/auth/SOV/RLS logic is touched.
 */

import { useRef, useState } from 'react'
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react'
import { trackMetaEvent } from '@/lib/meta-pixel'
import { BOOK_CALL_URL, BOOK_CALL_EXTERNAL } from '@/lib/book-call'

const ROLE_OPTIONS = [
  'Lender',
  'Title / escrow',
  'Builder',
  'Developer',
  'Fund control',
  'Contractor',
  'Other',
]

const DRAW_OPTIONS = [
  'Yes',
  'No',
  'Not directly, but my team does',
]

function withUtm(url: string): string {
  const utm = 'utm_source=design_partner_page&utm_medium=site&utm_campaign=design_partner'
  if (!url) return url
  return url.includes('?') ? `${url}&${utm}` : `${url}?${utm}`
}

export function DesignPartnerApplyForm() {
  const fired = useRef(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitting || submitted) return
    setSubmitting(true)

    // Fire the conversion event exactly once per session.
    if (!fired.current) {
      fired.current = true
      trackMetaEvent('Lead', { content_name: 'Design Partner Application' })
    }

    // Demo-only — no API. Show thank-you state immediately.
    setTimeout(() => {
      setSubmitting(false)
      setSubmitted(true)
    }, 250)
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.05] p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <CheckCircle2 size={20} className="text-emerald-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <div>
            <p className="text-[16px] font-semibold text-white">Application received.</p>
            <p className="mt-1.5 text-[13px] text-white/70 leading-relaxed">
              Qualified applicants will be invited to a 30-minute design-partner fit call.
              You can also grab a slot directly:
            </p>
            <div className="mt-4">
              <a
                href={withUtm(BOOK_CALL_URL)}
                {...(BOOK_CALL_EXTERNAL ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="inline-flex items-center gap-1.5 rounded-xl bg-vektrum-blue px-5 py-3 text-[13px] font-semibold text-white hover:bg-vektrum-blue-hover transition-all"
              >
                Book your fit call
                <ArrowRight size={14} aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-white/[0.08] bg-surface-2 p-6 sm:p-8 space-y-5"
      aria-label="Design partner application form"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required>
          <input
            name="name"
            type="text"
            required
            autoComplete="name"
            className="w-full rounded-lg border border-white/[0.10] bg-surface-3 px-3 py-2.5 text-[14px] text-white placeholder-white/35 focus:border-vektrum-blue focus:outline-none focus:ring-1 focus:ring-vektrum-blue"
            placeholder="Your name"
          />
        </Field>
        <Field label="Company" required>
          <input
            name="company"
            type="text"
            required
            autoComplete="organization"
            className="w-full rounded-lg border border-white/[0.10] bg-surface-3 px-3 py-2.5 text-[14px] text-white placeholder-white/35 focus:border-vektrum-blue focus:outline-none focus:ring-1 focus:ring-vektrum-blue"
            placeholder="Your company"
          />
        </Field>
        <Field label="Role" required>
          <input
            name="title"
            type="text"
            required
            autoComplete="organization-title"
            className="w-full rounded-lg border border-white/[0.10] bg-surface-3 px-3 py-2.5 text-[14px] text-white placeholder-white/35 focus:border-vektrum-blue focus:outline-none focus:ring-1 focus:ring-vektrum-blue"
            placeholder="VP Capital Markets, Draw Admin, etc."
          />
        </Field>
        <Field label="Email" required>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-lg border border-white/[0.10] bg-surface-3 px-3 py-2.5 text-[14px] text-white placeholder-white/35 focus:border-vektrum-blue focus:outline-none focus:ring-1 focus:ring-vektrum-blue"
            placeholder="you@company.com"
          />
        </Field>
      </div>

      <Field label="Which best describes you?" required>
        <select
          name="audience"
          required
          defaultValue=""
          className="w-full rounded-lg border border-white/[0.10] bg-surface-3 px-3 py-2.5 text-[14px] text-white focus:border-vektrum-blue focus:outline-none focus:ring-1 focus:ring-vektrum-blue"
        >
          <option value="" disabled>Select one…</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </Field>

      <Field label="Do you deal with construction draws, lien waivers, inspections, or release approvals?" required>
        <select
          name="draw_exposure"
          required
          defaultValue=""
          className="w-full rounded-lg border border-white/[0.10] bg-surface-3 px-3 py-2.5 text-[14px] text-white focus:border-vektrum-blue focus:outline-none focus:ring-1 focus:ring-vektrum-blue"
        >
          <option value="" disabled>Select one…</option>
          {DRAW_OPTIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </Field>

      <Field label="What is the biggest draw-release bottleneck you see today?" required>
        <input
          name="bottleneck"
          type="text"
          required
          maxLength={240}
          className="w-full rounded-lg border border-white/[0.10] bg-surface-3 px-3 py-2.5 text-[14px] text-white placeholder-white/35 focus:border-vektrum-blue focus:outline-none focus:ring-1 focus:ring-vektrum-blue"
          placeholder="One sentence is fine."
        />
      </Field>

      <button
        type="submit"
        disabled={submitting}
        className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-vektrum-blue px-6 py-3 text-[14px] font-semibold text-white shadow-lg shadow-vektrum-blue/30 hover:bg-vektrum-blue-hover transition-all disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {submitting ? (
          <>
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            Submitting…
          </>
        ) : (
          <>
            Apply to become a design partner
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </>
        )}
      </button>

      <p className="text-[12px] text-white/55 text-center leading-relaxed">
        Qualified applicants will be invited to a 30-minute design-partner fit call.
      </p>
    </form>
  )
}

function Field({
  label, required = false, children,
}: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[12px] font-semibold text-white/80 mb-1.5">
        {label}{required && <span className="text-blue-300 ml-0.5" aria-hidden="true">*</span>}
      </span>
      {children}
    </label>
  )
}
