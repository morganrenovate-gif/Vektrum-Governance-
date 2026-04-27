import { AlertOctagon, AlertTriangle, Clock, FileWarning, Receipt, XCircle } from 'lucide-react'
import { formatMoney } from '@/lib/utils'

// ─── ExternalReleasesPanel ──────────────────────────────────────────────────
//
// Read-only operator view of external_manual rail releases. Renders six
// priority-ordered groups:
//
//   1. Overdue                        — pending past SLA (highest priority)
//   2. Awaiting confirmation          — pending within SLA
//   3. Confirmed, missing reference   — hard evidence gap
//   4. Confirmed, missing proof       — soft evidence gap
//   5. Failed                         — recent failure events (ops awareness)
//   6. Rail mismatches                — CHECK-violators (should be empty)
//
// READ-ONLY by design. No buttons, no forms, no fetch. The backend has no
// admin-MFA-justification confirm path today; adding any action here would
// require a new audited route. Per the operating doc: "Start read-only if safest."
//
// SECRET HANDLING: this component never renders partner.webhook_signing_secret,
// partner.api_key_hash, partner.webhook_url, or any Stripe key. It only consumes
// the projection produced by /api/admin/ops/external-releases (mirrored in-process
// by getExternalReleasesData on the admin page).

export interface ExternalReleaseRow {
  release_id:        string
  milestone_id:      string
  milestone_title:   string
  deal_id:           string
  deal_title:        string
  amount:            number
  created_at:        string
  age_hours:         number | null
  execution_status:  string | null
  payment_method:    string | null
  payment_reference: string | null
  executed_at:       string | null
  executed_by:       string | null
  proof_document_id: string | null
  contractor_name:   string
  funder_name:       string
  partner_name:      string | null
}

export interface ExternalReleasesData {
  scanned_at: string
  sla_hours:  number
  counts: {
    awaiting_confirmation:       number
    overdue:                     number
    confirmed_missing_reference: number
    confirmed_missing_proof:     number
    failed:                      number
    rail_mismatches:             number
  }
  awaiting_confirmation:       ExternalReleaseRow[]
  overdue:                     ExternalReleaseRow[]
  confirmed_missing_reference: ExternalReleaseRow[]
  confirmed_missing_proof:     ExternalReleaseRow[]
  failed:                      ExternalReleaseRow[]
  rail_mismatches:             ExternalReleaseRow[]
}

export interface ExternalReleasesPanelProps {
  data: ExternalReleasesData
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shortId(id: string): string {
  return id.length > 10 ? id.slice(0, 8) + '…' : id
}

function ageLabel(hours: number | null): string {
  if (hours === null) return '—'
  if (hours < 1)  return '<1h'
  if (hours < 48) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function flag(present: boolean): string { return present ? '✓' : '✗' }

// ─── Group section ───────────────────────────────────────────────────────────

interface GroupProps {
  label:   string
  tone:    'overdue' | 'pending' | 'gap' | 'failed' | 'mismatch'
  icon:    React.ReactNode
  rows:    ExternalReleaseRow[]
  empty:   string
}

function toneClasses(tone: GroupProps['tone']): { border: string; bg: string; text: string } {
  switch (tone) {
    case 'overdue':  return { border: 'border-rose-500/40',    bg: 'bg-rose-500/5',    text: 'text-rose-300' }
    case 'pending':  return { border: 'border-amber-500/30',   bg: 'bg-amber-500/5',   text: 'text-amber-300' }
    case 'gap':      return { border: 'border-yellow-500/30',  bg: 'bg-yellow-500/5',  text: 'text-yellow-300' }
    case 'failed':   return { border: 'border-white/[0.10]',   bg: 'bg-surface-2',     text: 'text-white/70' }
    case 'mismatch': return { border: 'border-rose-600/50',    bg: 'bg-rose-600/10',   text: 'text-rose-300' }
  }
}

function Group({ label, tone, icon, rows, empty }: GroupProps) {
  const t = toneClasses(tone)
  return (
    <div className={`rounded-xl border ${t.border} ${t.bg} shadow-card overflow-hidden`}>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
        <span className={`shrink-0 ${t.text}`}>{icon}</span>
        <div className="text-sm font-semibold text-white">{label}</div>
        <div className={`text-xs ${t.text}`}>{rows.length}</div>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-3 text-xs text-white/50">{empty}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-white/[0.03] text-white/60">
              <tr>
                <th className="text-left  px-3 py-2 font-medium">Release</th>
                <th className="text-left  px-3 py-2 font-medium">Deal</th>
                <th className="text-left  px-3 py-2 font-medium">Milestone</th>
                <th className="text-left  px-3 py-2 font-medium">Partner</th>
                <th className="text-right px-3 py-2 font-medium">Amount</th>
                <th className="text-left  px-3 py-2 font-medium">Status</th>
                <th className="text-center px-3 py-2 font-medium" title="External payment reference present">Ref</th>
                <th className="text-center px-3 py-2 font-medium" title="Proof document on file">Proof</th>
                <th className="text-right px-3 py-2 font-medium">Age</th>
                <th className="text-left  px-3 py-2 font-medium">Counterparties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {rows.map(r => (
                <tr key={r.release_id} className="text-white/80">
                  <td className="px-3 py-2 font-mono">{shortId(r.release_id)}</td>
                  <td className="px-3 py-2">{r.deal_title}</td>
                  <td className="px-3 py-2">{r.milestone_title}</td>
                  <td className="px-3 py-2">{r.partner_name ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(r.amount)}</td>
                  <td className="px-3 py-2">{r.execution_status ?? '—'}</td>
                  <td className="px-3 py-2 text-center">{flag(!!r.payment_reference)}</td>
                  <td className="px-3 py-2 text-center">{flag(!!r.proof_document_id)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{ageLabel(r.age_hours)}</td>
                  <td className="px-3 py-2 text-white/60">{r.contractor_name} · {r.funder_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Panel ───────────────────────────────────────────────────────────────────

export function ExternalReleasesPanel({ data }: ExternalReleasesPanelProps) {
  // Defensive: if every bucket is empty, render a single compact empty state
  // rather than six "no rows" cards stacked vertically.
  const totalRows =
    data.counts.awaiting_confirmation +
    data.counts.overdue +
    data.counts.confirmed_missing_reference +
    data.counts.confirmed_missing_proof +
    data.counts.failed +
    data.counts.rail_mismatches

  if (totalRows === 0) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-surface-2 p-4 shadow-card">
        <div className="text-sm font-semibold text-white">External-manual releases</div>
        <div className="mt-1 text-xs text-white/60">
          No external_manual releases on file. SLA threshold: {data.sla_hours}h.
          Ledger evidence is tamper-evident, append-only, and hash-chained — see the
          audit-chain badge above for verification status.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Group
        label="Overdue (past SLA)"
        tone="overdue"
        icon={<AlertOctagon className="h-4 w-4" aria-hidden />}
        rows={data.overdue}
        empty={`No overdue external releases (SLA ${data.sla_hours}h).`}
      />
      <Group
        label="Awaiting confirmation"
        tone="pending"
        icon={<Clock className="h-4 w-4" aria-hidden />}
        rows={data.awaiting_confirmation}
        empty="No external releases waiting on partner confirmation."
      />
      <Group
        label="Confirmed — missing payment reference"
        tone="gap"
        icon={<Receipt className="h-4 w-4" aria-hidden />}
        rows={data.confirmed_missing_reference}
        empty="All confirmed external releases carry a payment reference."
      />
      <Group
        label="Confirmed — missing proof document"
        tone="gap"
        icon={<FileWarning className="h-4 w-4" aria-hidden />}
        rows={data.confirmed_missing_proof}
        empty="All confirmed external releases have a proof document on file."
      />
      <Group
        label="Recent failures"
        tone="failed"
        icon={<XCircle className="h-4 w-4" aria-hidden />}
        rows={data.failed}
        empty="No external_manual failures recorded in the current window."
      />
      <Group
        label="Rail mismatches (should be empty — CHECK-constraint guarded)"
        tone="mismatch"
        icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
        rows={data.rail_mismatches}
        empty="No rail mismatches detected. The DB CHECK constraint is doing its job."
      />
    </div>
  )
}
