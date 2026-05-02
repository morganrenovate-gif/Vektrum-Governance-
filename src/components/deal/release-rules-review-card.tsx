'use client'

/**
 * Release-rules draft review card.
 *
 * Server-rendered draft payload comes in via props. Funder/admin sees:
 *   - SOV line items table with confidence + review_required badges
 *   - Retainage block (with source snippet + confidence)
 *   - Release conditions block (5 fields)
 *   - Evidence requirements table
 *   - Warnings + assumptions lists
 *   - Document-source diagnostic ("from signed PDF" / "from uploaded contract document")
 *   - Approve / Edit manually / Discard actions
 *
 * Contractor sees a read-only "under review" version with the same payload
 * but no actions.
 *
 * The Approve/Discard buttons PATCH `/api/deals/{dealId}/release-rules/{draftId}`
 * with { action: 'approve' | 'discard' }. On success we router.refresh()
 * the deal page so the parent flips to the post-review state.
 *
 * SAFETY: this component never authorizes release, never moves money, never
 * mutates SOV/milestones. The Approve action only flips the draft status —
 * the funder must still create + approve SOV via the existing manual flow,
 * and the deterministic release gate continues to control release.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircle2, AlertTriangle, AlertCircle, FileText, Loader2,
  ListChecks, Lock, ArrowRight, X as XIcon,
} from 'lucide-react'

// ─── Types (mirror src/lib/engine/contract-release-rules.ts) ──────────────

interface FieldExtraction<T> {
  value:        T | null
  source_text:  string | null
  confidence:   number
}

interface SovLineItemDraft {
  name:            string
  description:     string | null
  amount:          number | null
  source_text:     string | null
  confidence:      number
  review_required: boolean
}

interface EvidenceRequirementDraft {
  condition:         string
  required_document: string
  applies_to:        string | null
  source_text:       string | null
  confidence:        number
  review_required:   boolean
}

export interface ReleaseRulesDraftPayload {
  project_name:    string | null
  contract_total:  number | null
  currency:        string
  retainage: {
    percentage:  number | null
    source_text: string | null
    confidence:  number
  }
  sov_line_items: SovLineItemDraft[]
  release_conditions: {
    sequential_release_required:    FieldExtraction<boolean>
    lien_waiver_required:           FieldExtraction<boolean>
    inspection_required:            FieldExtraction<boolean>
    change_order_approval_required: FieldExtraction<boolean>
    funder_authorization_required:  FieldExtraction<true>
  }
  evidence_requirements: EvidenceRequirementDraft[]
  warnings:    string[]
  assumptions: string[]
}

interface ReleaseRulesReviewCardProps {
  dealId:   string
  draft: {
    id:                 string
    status:             'draft' | 'reviewed' | 'accepted' | 'discarded'
    payload:            ReleaseRulesDraftPayload
    warnings_count:     number
    created_at:         string
    /** Optional source label from the extraction diagnostic. Helps reviewers
     *  know whether the draft came from the signed DocuSign PDF or the
     *  original uploaded contract (transparent fallback). */
    document_source?:   'signed' | 'original' | null
  }
  /** Funder/admin gets approve/discard actions; contractor sees the read-only
   *  "under review" variant. */
  viewerRole: 'funder' | 'contractor' | 'admin'
}

// ─── Component ──────────────────────────────────────────────────────────

export function ReleaseRulesReviewCard({
  dealId,
  draft,
  viewerRole,
}: ReleaseRulesReviewCardProps) {
  const router = useRouter()
  const [pending, setPending] = useState<null | 'approve' | 'discard'>(null)
  const [error, setError]     = useState<string | null>(null)

  const isContractor = viewerRole === 'contractor'
  const canAct       = viewerRole === 'funder' || viewerRole === 'admin'
  const isTerminal   = draft.status === 'accepted' || draft.status === 'discarded'

  async function transition(action: 'approve' | 'discard') {
    if (pending || isTerminal) return
    setPending(action)
    setError(null)
    try {
      const res = await fetch(
        `/api/deals/${dealId}/release-rules/${draft.id}`,
        {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ action }),
        },
      )
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Could not record the action. Please try again.')
        return
      }
      router.refresh()
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setPending(null)
    }
  }

  const p = draft.payload
  const lineItemTotal = p.sov_line_items.reduce(
    (s, i) => s + (typeof i.amount === 'number' ? i.amount : 0), 0,
  )
  const totalMatches =
    p.contract_total !== null &&
    Math.abs(lineItemTotal - p.contract_total) < 0.5

  return (
    <section
      aria-label={isContractor ? 'Release rules under review' : 'Review draft release rules'}
      className="rounded-2xl border border-vektrum-blue/25 bg-vektrum-blue/[0.04] overflow-hidden"
    >
      {/* Header */}
      <div className="border-b border-vektrum-blue/15 px-5 py-4 flex items-start gap-3">
        <ListChecks size={15} className="text-blue-300 mt-0.5 flex-shrink-0" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-white">
            {isContractor ? 'Release rules under review' : 'Review draft release rules'}
          </p>
          <p className="mt-1 text-[12px] text-white/60 leading-relaxed">
            {isContractor
              ? 'The funder is reviewing the draft SOV and release rules. Milestone releases cannot proceed until the rules are approved and all release-gate conditions pass.'
              : 'These rules were generated from the contract document and require review before they control release readiness.'}
          </p>
          {/* Document-source diagnostic — optional but helpful */}
          {draft.document_source && (
            <p className="mt-2 text-[11px] text-white/45">
              Source: {draft.document_source === 'signed'
                ? 'signed DocuSign PDF'
                : 'uploaded contract document (signed PDF unavailable)'}
            </p>
          )}
        </div>
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
          draft.status === 'draft'      ? 'bg-blue-500/[0.10] text-blue-300 border-blue-500/30' :
          draft.status === 'reviewed'   ? 'bg-amber-500/[0.10] text-amber-300 border-amber-500/30' :
          draft.status === 'accepted'   ? 'bg-emerald-500/[0.10] text-emerald-400 border-emerald-500/30' :
                                          'bg-white/[0.06] text-white/45 border-white/[0.10]'
        }`}>
          {draft.status}
        </span>
      </div>

      <div className="px-5 py-5 space-y-5">

        {/* Top-level fields */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Project name" value={p.project_name ?? '—'} />
          <Field
            label="Contract total"
            value={p.contract_total !== null ? formatMoney(p.contract_total) : '—'}
          />
          <Field
            label="Line-item total"
            value={formatMoney(lineItemTotal)}
            tone={p.contract_total !== null ? (totalMatches ? 'ok' : 'warn') : undefined}
            hint={
              p.contract_total !== null && !totalMatches
                ? `Differs from contract total by ${formatMoney(
                    Math.abs(lineItemTotal - p.contract_total),
                  )}`
                : null
            }
          />
        </div>

        {/* SOV line items */}
        {p.sov_line_items.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45 mb-2">
              SOV line items ({p.sov_line_items.length})
            </p>
            <ul className="rounded-lg border border-white/[0.06] divide-y divide-white/[0.04] overflow-hidden">
              {p.sov_line_items.map((item, i) => (
                <li key={i} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <p className="text-[13px] font-semibold text-white truncate">
                      {item.name}
                    </p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <ConfidencePill confidence={item.confidence} />
                      {item.review_required && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/[0.10] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-300">
                          <AlertTriangle size={9} aria-hidden="true" />
                          Review
                        </span>
                      )}
                    </div>
                  </div>
                  {item.description && (
                    <p className="text-[12px] text-white/60 leading-relaxed">{item.description}</p>
                  )}
                  <div className="mt-1.5 flex items-center gap-3 text-[11px] text-white/55">
                    <span>{item.amount !== null ? formatMoney(item.amount) : '—'}</span>
                    {item.source_text && (
                      <span className="italic text-white/40 truncate" title={item.source_text}>
                        “{shorten(item.source_text, 80)}”
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Retainage */}
        <DetailRow
          icon={Lock}
          label="Retainage"
          value={p.retainage.percentage !== null ? `${p.retainage.percentage}%` : '—'}
          confidence={p.retainage.confidence}
          source_text={p.retainage.source_text}
        />

        {/* Release conditions */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45 mb-2">
            Release conditions
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ['Sequential release',     p.release_conditions.sequential_release_required],
                ['Lien waiver',            p.release_conditions.lien_waiver_required],
                ['Inspection',             p.release_conditions.inspection_required],
                ['Change order approval',  p.release_conditions.change_order_approval_required],
                ['Funder authorization',   p.release_conditions.funder_authorization_required],
              ] as const
            ).map(([label, field]) => (
              <li key={label} className="rounded-lg border border-white/[0.06] bg-surface-3 px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[12px] font-semibold text-white/85">{label}</span>
                  <span className={`text-[11px] font-semibold ${
                    field.value === true  ? 'text-emerald-300' :
                    field.value === false ? 'text-white/45' : 'text-amber-300'
                  }`}>
                    {field.value === true ? 'Required' : field.value === false ? 'Not required' : 'Unclear'}
                  </span>
                </div>
                {field.source_text && (
                  <p className="mt-1 text-[10px] italic text-white/40 leading-snug truncate" title={field.source_text}>
                    “{shorten(field.source_text, 120)}”
                  </p>
                )}
                <div className="mt-1.5">
                  <ConfidencePill confidence={field.confidence} />
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Evidence requirements */}
        {p.evidence_requirements.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45 mb-2">
              Evidence requirements ({p.evidence_requirements.length})
            </p>
            <ul className="rounded-lg border border-white/[0.06] divide-y divide-white/[0.04] overflow-hidden">
              {p.evidence_requirements.map((ev, i) => (
                <li key={i} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2 mb-0.5">
                    <p className="text-[12.5px] font-semibold text-white">
                      {ev.condition} → {ev.required_document}
                    </p>
                    <ConfidencePill confidence={ev.confidence} />
                  </div>
                  {ev.applies_to && (
                    <p className="text-[11px] text-white/55">Applies to: {ev.applies_to}</p>
                  )}
                  {ev.source_text && (
                    <p className="mt-0.5 text-[10px] italic text-white/40 leading-snug truncate" title={ev.source_text}>
                      “{shorten(ev.source_text, 120)}”
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Warnings */}
        {p.warnings.length > 0 && (
          <ListBlock
            tone="warn"
            icon={AlertTriangle}
            label={`Warnings (${p.warnings.length})`}
            items={p.warnings}
          />
        )}

        {/* Assumptions */}
        {p.assumptions.length > 0 && (
          <ListBlock
            tone="info"
            icon={FileText}
            label={`Assumptions (${p.assumptions.length})`}
            items={p.assumptions}
          />
        )}

        {/* Action row — funder/admin only, only while not in a terminal state */}
        {canAct && !isTerminal && (
          <div className="border-t border-white/[0.06] pt-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
              <button
                type="button"
                onClick={() => transition('approve')}
                disabled={pending !== null}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-[13px] font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {pending === 'approve'
                  ? <Loader2     size={13} className="animate-spin" aria-hidden="true" />
                  : <CheckCircle2 size={13} aria-hidden="true" />
                }
                {pending === 'approve' ? 'Approving…' : 'Approve draft release rules'}
              </button>

              <Link
                href="#sov"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.10] bg-surface-3 px-4 py-2.5 text-[13px] font-semibold text-white/75 hover:text-white hover:bg-white/[0.06] hover:border-white/[0.18] transition-colors"
              >
                Edit manually
                <ArrowRight size={13} aria-hidden="true" />
              </Link>

              <button
                type="button"
                onClick={() => transition('discard')}
                disabled={pending !== null}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/25 bg-red-500/[0.06] px-4 py-2.5 text-[13px] font-semibold text-red-300 hover:text-red-200 hover:bg-red-500/[0.12] hover:border-red-500/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {pending === 'discard'
                  ? <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                  : <XIcon  size={13} aria-hidden="true" />
                }
                {pending === 'discard' ? 'Discarding…' : 'Discard draft'}
              </button>
            </div>
            <p className="text-[11px] text-white/45 leading-relaxed">
              Approving the draft does not authorize release. The deterministic release
              gate and funder authorization still control release. SOV must be created
              and approved separately via the manual flow before releases can proceed.
            </p>
            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2.5 max-w-md">
                <AlertCircle size={12} className="text-red-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
                <p className="text-[12px] text-red-400 leading-relaxed">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* Contractor / terminal state — read-only footer */}
        {(isContractor || isTerminal) && (
          <p className="border-t border-white/[0.06] pt-4 text-[11px] text-white/45 leading-relaxed">
            Draft rules do not control release readiness. The deterministic release
            gate and funder authorization still control release.
          </p>
        )}
      </div>
    </section>
  )
}

// ─── Inline subcomponents ──────────────────────────────────────────────

function Field({
  label, value, tone, hint,
}: { label: string; value: string; tone?: 'ok' | 'warn'; hint?: string | null }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-surface-3 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">{label}</p>
      <p className={`mt-1 text-[14px] font-semibold tabular-nums ${
        tone === 'warn' ? 'text-amber-300' :
        tone === 'ok'   ? 'text-emerald-300' :
                          'text-white'
      }`}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[10px] text-amber-300/80 leading-snug">{hint}</p>}
    </div>
  )
}

function DetailRow({
  icon: Icon, label, value, confidence, source_text,
}: {
  icon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>
  label: string
  value: string
  confidence: number
  source_text: string | null
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-white/[0.06] bg-surface-3 px-3 py-2.5">
      <Icon size={13} className="text-white/55 mt-0.5 flex-shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] font-semibold text-white/85">{label}</p>
          <p className="text-[12px] font-semibold text-white tabular-nums">{value}</p>
        </div>
        {source_text && (
          <p className="mt-0.5 text-[10px] italic text-white/40 leading-snug truncate" title={source_text}>
            “{shorten(source_text, 120)}”
          </p>
        )}
        <div className="mt-1">
          <ConfidencePill confidence={confidence} />
        </div>
      </div>
    </div>
  )
}

function ConfidencePill({ confidence }: { confidence: number }) {
  const tone = confidence >= 0.8 ? 'high' : confidence >= 0.6 ? 'med' : 'low'
  const cls =
    tone === 'high' ? 'bg-emerald-500/[0.10] text-emerald-300 border-emerald-500/25' :
    tone === 'med'  ? 'bg-amber-500/[0.10]   text-amber-300   border-amber-500/25'   :
                      'bg-white/[0.04]       text-white/45    border-white/[0.10]'
  return (
    <span
      className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${cls}`}
      title={`Model confidence: ${(confidence * 100).toFixed(0)}%`}
    >
      {(confidence * 100).toFixed(0)}%
    </span>
  )
}

function ListBlock({
  tone, icon: Icon, label, items,
}: {
  tone: 'warn' | 'info'
  icon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>
  label: string
  items: string[]
}) {
  const cls = tone === 'warn'
    ? 'border-amber-500/20 bg-amber-500/[0.05] text-amber-200'
    : 'border-white/[0.08] bg-surface-3 text-white/70'
  return (
    <div className={`rounded-lg border px-4 py-3 ${cls}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] mb-1.5 flex items-center gap-1.5">
        <Icon size={11} aria-hidden="true" />
        {label}
      </p>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="text-[12px] leading-relaxed">{it}</li>
        ))}
      </ul>
    </div>
  )
}

function formatMoney(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function shorten(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '…'
}
