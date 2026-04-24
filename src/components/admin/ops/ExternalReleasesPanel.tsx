'use client'

// ─── ExternalReleasesPanel ─────────────────────────────────────────────────
//
// Ops-dashboard panel summarising external-rail (manual) release hygiene.
// Read-only; admin-only (parent page gates access). Data is fetched by the
// server component and passed as `initialData`.
//
// Five buckets rendered:
//   - overdue (pending past SLA)
//   - awaiting_confirmation (all pending)
//   - confirmed_missing_reference (hard evidence gap)
//   - confirmed_missing_proof (soft evidence gap)
//   - rail_mismatches (CHECK-constraint violation — should be empty)

import Link from 'next/link'
import { Clock, AlertCircle, FileX, ShieldAlert } from 'lucide-react'

interface ExternalRelease {
  release_id: string
  milestone_id: string
  milestone_title: string
  deal_id: string
  deal_title: string
  amount: number
  created_at: string
  age_hours: number | null
  execution_status: string | null
  payment_method: string | null
  payment_reference: string | null
  executed_at: string | null
  executed_by: string | null
  proof_document_id: string | null
  contractor_name: string
  funder_name: string
}

export interface ExternalReleasesData {
  scanned_at: string
  sla_hours: number
  counts: {
    awaiting_confirmation: number
    overdue: number
    confirmed_missing_reference: number
    confirmed_missing_proof: number
    failed: number
    rail_mismatches: number
  }
  awaiting_confirmation:       ExternalRelease[]
  overdue:                     ExternalRelease[]
  confirmed_missing_reference: ExternalRelease[]
  confirmed_missing_proof:     ExternalRelease[]
  failed:                      ExternalRelease[]
  rail_mismatches:             ExternalRelease[]
}

const fmtMoney = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

export function ExternalReleasesPanel({ initialData }: { initialData: ExternalReleasesData }) {
  const { counts, sla_hours, overdue, awaiting_confirmation, confirmed_missing_reference, confirmed_missing_proof, rail_mismatches } = initialData

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <MiniStat label={`Overdue (≥${sla_hours} h)`} value={counts.overdue} critical={counts.overdue > 0} icon={<AlertCircle size={12} />} />
        <MiniStat label="Awaiting" value={counts.awaiting_confirmation} warn={counts.awaiting_confirmation > 0} icon={<Clock size={12} />} />
        <MiniStat label="No reference" value={counts.confirmed_missing_reference} warn={counts.confirmed_missing_reference > 0} icon={<FileX size={12} />} />
        <MiniStat label="No proof" value={counts.confirmed_missing_proof} icon={<FileX size={12} />} />
        <MiniStat label="Rail mismatch" value={counts.rail_mismatches} critical={counts.rail_mismatches > 0} icon={<ShieldAlert size={12} />} />
      </div>

      {rail_mismatches.length > 0 && (
        <Section title="Rail mismatches (CHECK constraint violation)" tone="critical">
          <Table rows={rail_mismatches} />
        </Section>
      )}

      {overdue.length > 0 && (
        <Section title={`Overdue pending external payments (≥ ${sla_hours} h)`} tone="critical">
          <Table rows={overdue} />
        </Section>
      )}

      {awaiting_confirmation.length > 0 && (
        <Section title="All awaiting confirmation" tone="warn">
          <Table rows={awaiting_confirmation} />
        </Section>
      )}

      {confirmed_missing_reference.length > 0 && (
        <Section title="Confirmed but missing payment reference" tone="warn">
          <Table rows={confirmed_missing_reference} />
        </Section>
      )}

      {confirmed_missing_proof.length > 0 && (
        <Section title="Confirmed but missing proof attachment" tone="info">
          <Table rows={confirmed_missing_proof} />
        </Section>
      )}

      {counts.awaiting_confirmation === 0
        && counts.confirmed_missing_reference === 0
        && counts.confirmed_missing_proof === 0
        && counts.rail_mismatches === 0 && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-5 py-4 text-sm text-emerald-400">
            No external-rail hygiene issues detected.
          </div>
        )}
    </div>
  )
}

function MiniStat({
  label, value, warn, critical, icon,
}: {
  label: string
  value: number
  warn?: boolean
  critical?: boolean
  icon?: React.ReactNode
}) {
  const color = critical
    ? 'border-red-500/20 bg-red-500/[0.06] text-red-400'
    : warn
      ? 'border-amber-500/20 bg-amber-500/[0.06] text-amber-400'
      : 'border-white/[0.08] bg-white/[0.03] text-white/75'
  return (
    <div className={`rounded-lg border px-3 py-2 ${color}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest">{label}</span>
        {icon}
      </div>
      <p className="text-[16px] font-bold tabular-nums mt-0.5">{value}</p>
    </div>
  )
}

function Section({
  title, tone, children,
}: {
  title: string
  tone: 'critical' | 'warn' | 'info'
  children: React.ReactNode
}) {
  const colour =
    tone === 'critical' ? 'border-red-500/20'
    : tone === 'warn'   ? 'border-amber-500/20'
    : 'border-white/[0.08]'
  return (
    <div className={`rounded-xl border ${colour} bg-surface-2 overflow-hidden`}>
      <div className="px-4 py-2 border-b border-white/[0.06] text-[12px] font-semibold text-white/80">
        {title}
      </div>
      {children}
    </div>
  )
}

function Table({ rows }: { rows: ExternalRelease[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-[12px]">
        <thead className="bg-white/[0.02] text-[10px] uppercase tracking-widest text-white/65">
          <tr>
            <th className="px-3 py-2 text-left">Deal</th>
            <th className="px-3 py-2 text-left">Milestone</th>
            <th className="px-3 py-2 text-right">Amount</th>
            <th className="px-3 py-2 text-left">Funder</th>
            <th className="px-3 py-2 text-left">Contractor</th>
            <th className="px-3 py-2 text-right">Age (h)</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-left">Method / Ref</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.06] text-white/75">
          {rows.map((r) => (
            <tr key={r.release_id}>
              <td className="px-3 py-2">
                <Link href={`/dashboard/deals/${r.deal_id}`} className="hover:text-white">
                  {r.deal_title}
                </Link>
              </td>
              <td className="px-3 py-2">{r.milestone_title}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.amount)}</td>
              <td className="px-3 py-2">{r.funder_name}</td>
              <td className="px-3 py-2">{r.contractor_name}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.age_hours ?? '—'}</td>
              <td className="px-3 py-2">{r.execution_status ?? '—'}</td>
              <td className="px-3 py-2">
                {r.payment_method ?? '—'}
                {r.payment_reference ? ` · ${r.payment_reference}` : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
