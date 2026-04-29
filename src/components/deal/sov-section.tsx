'use client'

import { useState } from 'react'
import { formatMoney } from '@/lib/utils'
import type { SovLineItem, SovLineItemStatus } from '@/lib/types'
import { AlertCircle, ChevronDown, ChevronRight, FileText, Plus, Upload } from 'lucide-react'
import { UploadContractTrigger } from './upload-contract-trigger'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SovTotals {
  scheduled_value:        number
  approved_change_orders: number
  revised_value:          number
  previous_released:      number
  current_requested:      number
  retainage_amount:       number
  balance_to_finish:      number
}

interface SovSectionProps {
  dealId:           string
  dealAmount:       number
  items:            SovLineItem[]
  totals:           SovTotals
  warnings:         string[]
  viewerRole:       'contractor' | 'funder' | 'admin'
  /** Deal status — contractors can only add items when deal is draft or active */
  dealStatus:       string
  /**
   * True when the deal has at least one non-voided contract on file.
   * When false, the SOV section shows a contract-first advisory.
   */
  hasContract?:     boolean
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function SovStatusBadge({ status }: { status: SovLineItemStatus }) {
  const styles: Record<SovLineItemStatus, string> = {
    draft:          'bg-white/[0.06] text-white/50 border-white/[0.08]',
    pending_review: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    approved:       'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    superseded:     'bg-white/[0.04] text-white/30 border-white/[0.06]',
  }
  const labels: Record<SovLineItemStatus, string> = {
    draft:          'Draft',
    pending_review: 'Pending Review',
    approved:       'Approved',
    superseded:     'Superseded',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border uppercase tracking-wide ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

// ─── Add Line Item Form ────────────────────────────────────────────────────────

function AddSovItemForm({
  dealId,
  onCreated,
  onCancel,
}: {
  dealId:    string
  onCreated: (item: SovLineItem) => void
  onCancel:  () => void
}) {
  const [desc,    setDesc]    = useState('')
  const [rawVal,  setRawVal]  = useState('')
  const [itemNum, setItemNum] = useState('')
  const [saving,  setSaving]  = useState(false)
  const [err,     setErr]     = useState<string | null>(null)

  const submit = async () => {
    setErr(null)
    if (!desc.trim()) { setErr('Description is required.'); return }

    // Parse the scheduled value robustly: strip locale commas, then parse.
    // parseFloat handles integers (50000 → 50000) and decimals (50000.50 → 50000.5).
    const cleaned = rawVal.trim().replace(/,/g, '')
    const sv = parseFloat(cleaned)
    if (isNaN(sv) || sv < 0) {
      setErr('Scheduled value must be a non-negative number (e.g. 50000 or 50000.00).')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/deals/${dealId}/sov`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          description:     desc.trim(),
          scheduled_value: sv,
          item_number:     itemNum.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErr(data.error ?? 'Failed to create line item.')
        return
      }
      onCreated(data.item as SovLineItem)
    } catch {
      setErr('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-surface-2 p-4 space-y-3">
      <p className="text-[12px] font-semibold text-white/80 uppercase tracking-[0.10em]">New SOV Line Item</p>
      {err && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2">
          <AlertCircle size={13} className="text-red-400 mt-0.5 flex-shrink-0" />
          <span className="text-[12px] text-red-400">{err}</span>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
        <input
          type="text"
          placeholder="Description (e.g. Framing, Electrical Rough-In)"
          value={desc}
          onChange={e => setDesc(e.target.value)}
          className="h-9 rounded-lg border border-white/[0.10] bg-surface-1 px-3 text-[13px] text-white placeholder:text-white/35 focus:outline-none focus:border-vektrum-blue/60 transition-colors"
        />
        <input
          type="text"
          placeholder="Item # (optional)"
          value={itemNum}
          onChange={e => setItemNum(e.target.value)}
          className="h-9 w-28 rounded-lg border border-white/[0.10] bg-surface-1 px-3 text-[13px] text-white placeholder:text-white/35 focus:outline-none focus:border-vektrum-blue/60 transition-colors"
        />
        <div className="flex flex-col gap-0.5">
          <input
            type="text"
            inputMode="decimal"
            placeholder="50000.00"
            value={rawVal}
            onChange={e => setRawVal(e.target.value)}
            className="h-9 w-36 rounded-lg border border-white/[0.10] bg-surface-1 px-3 text-[13px] text-white placeholder:text-white/35 focus:outline-none focus:border-vektrum-blue/60 transition-colors"
            aria-label="Approved contract value allocated to this scope"
          />
          <span className="text-[9px] text-white/30 leading-tight px-0.5">
            Approved contract value allocated to this scope.
          </span>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          disabled={saving}
          className="h-8 px-3 rounded-lg border border-white/[0.10] text-[12px] text-white/60 hover:bg-white/[0.06] transition-colors disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={saving}
          className="h-8 px-4 rounded-lg bg-vektrum-blue text-[12px] font-semibold text-white hover:bg-vektrum-blue-hover transition-colors disabled:opacity-40"
        >
          {saving ? 'Adding…' : 'Add Line Item'}
        </button>
      </div>
    </div>
  )
}

// ─── Approve button ───────────────────────────────────────────────────────────

function ApproveItemButton({
  dealId,
  itemId,
  onApproved,
}: {
  dealId:     string
  itemId:     string
  onApproved: (item: SovLineItem) => void
}) {
  const [loading, setLoading] = useState(false)
  const [err,     setErr]     = useState<string | null>(null)

  const approve = async () => {
    setErr(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/deals/${dealId}/sov/${itemId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'approve' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErr(data.error ?? 'Could not approve item.')
        return
      }
      onApproved(data.item as SovLineItem)
    } catch {
      setErr('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        onClick={approve}
        disabled={loading}
        className="h-6 px-2.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold uppercase tracking-wide hover:bg-emerald-500/20 transition-colors disabled:opacity-40"
      >
        {loading ? 'Approving…' : 'Approve'}
      </button>
      {err && <span className="text-[10px] text-red-400">{err}</span>}
    </div>
  )
}

// ─── Submit for review button ─────────────────────────────────────────────────

function SubmitForReviewButton({
  dealId,
  itemId,
  onSubmitted,
}: {
  dealId:      string
  itemId:      string
  onSubmitted: (item: SovLineItem) => void
}) {
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/deals/${dealId}/sov/${itemId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'submit' }),
      })
      if (res.ok) {
        const data = await res.json()
        onSubmitted(data.item as SovLineItem)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={submit}
      disabled={loading}
      className="h-6 px-2.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-semibold uppercase tracking-wide hover:bg-amber-500/20 transition-colors disabled:opacity-40"
    >
      {loading ? 'Submitting…' : 'Submit for Review'}
    </button>
  )
}

// ─── SOV Section ──────────────────────────────────────────────────────────────

export function SovSection({
  dealId,
  dealAmount,
  items: initialItems,
  totals: initialTotals,
  warnings: initialWarnings,
  viewerRole,
  dealStatus,
  hasContract = false,
}: SovSectionProps) {
  const [items,    setItems]    = useState<SovLineItem[]>(initialItems)
  const [totals,   setTotals]   = useState<SovTotals>(initialTotals)
  const [warnings, setWarnings] = useState<string[]>(initialWarnings)
  const [expanded, setExpanded] = useState(true)
  const [adding,   setAdding]   = useState(false)

  const canAddItems =
    (viewerRole === 'contractor' || viewerRole === 'admin') &&
    (dealStatus === 'draft' || dealStatus === 'active' || dealStatus === 'funded')

  // Re-derive totals and warnings after any mutation
  const refreshTotals = (newItems: SovLineItem[]) => {
    const t: SovTotals = {
      scheduled_value:        newItems.reduce((s, i) => s + i.scheduled_value, 0),
      approved_change_orders: newItems.reduce((s, i) => s + i.approved_change_orders, 0),
      revised_value:          newItems.reduce((s, i) => s + i.revised_value, 0),
      previous_released:      newItems.reduce((s, i) => s + i.previous_released, 0),
      current_requested:      newItems.reduce((s, i) => s + i.current_requested, 0),
      retainage_amount:       newItems.reduce((s, i) => s + i.retainage_amount, 0),
      balance_to_finish:      newItems.reduce((s, i) => s + i.balance_to_finish, 0),
    }
    setTotals(t)
    const w: string[] = []
    if (newItems.length > 0 && Math.abs(t.revised_value - dealAmount) > 0.01) {
      w.push(
        `SOV revised contract value (${formatMoney(t.revised_value)}) does not match deal contract amount (${formatMoney(dealAmount)}).`,
      )
    }
    setWarnings(w)
  }

  const handleCreated = (item: SovLineItem) => {
    const next = [...items, item]
    setItems(next)
    refreshTotals(next)
    setAdding(false)
  }

  const handleUpdated = (item: SovLineItem) => {
    const next = items.map(i => (i.id === item.id ? item : i))
    setItems(next)
    refreshTotals(next)
  }

  const visibleItems = items.filter(i => i.status !== 'superseded')

  return (
    <div className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden">
      {/* Section header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 border-b border-white/[0.06] hover:bg-white/[0.02] transition-colors"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <div className="h-px w-5 bg-vektrum-blue flex-shrink-0" aria-hidden="true" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-300">
            Schedule of Values
          </p>
          {items.length > 0 && (
            <span className="text-[10px] text-white/40">
              ({visibleItems.length} line item{visibleItems.length !== 1 ? 's' : ''})
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronDown size={14} className="text-white/40" />
        ) : (
          <ChevronRight size={14} className="text-white/40" />
        )}
      </button>

      {expanded && (
        <div className="p-4 space-y-4">

          {/* Advisory warnings — never block releases */}
          {warnings.map((w, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2"
            >
              <AlertCircle size={13} className="text-amber-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
              <span className="text-[12px] text-amber-300">{w}</span>
            </div>
          ))}

          {/* SOV table */}
          {visibleItems.length > 0 ? (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-[12px] border-collapse">
                <thead>
                  <tr className="text-white/40 text-[10px] uppercase tracking-[0.10em]">
                    <th className="text-left px-2 py-1.5 font-semibold">#</th>
                    <th className="text-left px-2 py-1.5 font-semibold">Description</th>
                    <th className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">Sched. Value</th>
                    <th className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">Approved COs</th>
                    <th className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">Revised Value</th>
                    <th className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">Prev. Released</th>
                    <th className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">Curr. Requested</th>
                    <th className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">Retainage</th>
                    <th className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">Bal. to Finish</th>
                    <th className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">% Complete</th>
                    <th className="text-left px-2 py-1.5 font-semibold">Status</th>
                    <th className="px-2 py-1.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {visibleItems.map((item, idx) => (
                    <tr key={item.id} className="group hover:bg-white/[0.02] transition-colors">
                      <td className="px-2 py-2 text-white/40">{item.item_number ?? idx + 1}</td>
                      <td className="px-2 py-2 text-white/90 max-w-[180px] truncate">{item.description}</td>
                      <td className="px-2 py-2 text-right text-white/75 tabular-nums font-mono">{formatMoney(item.scheduled_value)}</td>
                      <td className="px-2 py-2 text-right text-white/75 tabular-nums font-mono">
                        {item.approved_change_orders !== 0 ? formatMoney(item.approved_change_orders) : '—'}
                      </td>
                      <td className="px-2 py-2 text-right text-white tabular-nums font-mono font-semibold">{formatMoney(item.revised_value)}</td>
                      <td className="px-2 py-2 text-right text-white/60 tabular-nums font-mono">{formatMoney(item.previous_released)}</td>
                      <td className="px-2 py-2 text-right text-blue-300 tabular-nums font-mono">{formatMoney(item.current_requested)}</td>
                      <td className="px-2 py-2 text-right text-white/50 tabular-nums font-mono">
                        {item.retainage_amount > 0 ? formatMoney(item.retainage_amount) : '—'}
                      </td>
                      <td className="px-2 py-2 text-right text-white/60 tabular-nums font-mono">{formatMoney(item.balance_to_finish)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        <span className={item.percent_complete >= 100 ? 'text-emerald-400 font-semibold' : 'text-white/75'}>
                          {item.percent_complete.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <SovStatusBadge status={item.status} />
                      </td>
                      <td className="px-2 py-2 text-right">
                        {viewerRole === 'contractor' && item.status === 'draft' && (
                          <SubmitForReviewButton
                            dealId={dealId}
                            itemId={item.id}
                            onSubmitted={handleUpdated}
                          />
                        )}
                        {(viewerRole === 'funder' || viewerRole === 'admin') && item.status === 'pending_review' && (
                          <ApproveItemButton
                            dealId={dealId}
                            itemId={item.id}
                            onApproved={handleUpdated}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/* Totals row */}
                <tfoot>
                  <tr className="border-t border-white/[0.10] text-[11px] font-semibold">
                    <td className="px-2 py-2 text-white/40" colSpan={2}>Totals</td>
                    <td className="px-2 py-2 text-right text-white tabular-nums font-mono">{formatMoney(totals.scheduled_value)}</td>
                    <td className="px-2 py-2 text-right text-white tabular-nums font-mono">{formatMoney(totals.approved_change_orders)}</td>
                    <td className="px-2 py-2 text-right text-white tabular-nums font-mono">{formatMoney(totals.revised_value)}</td>
                    <td className="px-2 py-2 text-right text-white tabular-nums font-mono">{formatMoney(totals.previous_released)}</td>
                    <td className="px-2 py-2 text-right text-blue-300 tabular-nums font-mono">{formatMoney(totals.current_requested)}</td>
                    <td className="px-2 py-2 text-right text-white tabular-nums font-mono">{formatMoney(totals.retainage_amount)}</td>
                    <td className="px-2 py-2 text-right text-white tabular-nums font-mono">{formatMoney(totals.balance_to_finish)}</td>
                    <td className="px-2 py-2" />
                    <td className="px-2 py-2" />
                    <td className="px-2 py-2" />
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            // ── Empty state — explains contract/SOV relationship ───────────────
            <div className="space-y-4">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-5 text-center space-y-2">
                <FileText size={20} className="mx-auto text-white/25" aria-hidden="true" />
                <p className="text-[13px] text-white/60 font-medium">No Schedule of Values has been created yet.</p>
                <p className="text-[12px] text-white/35 max-w-sm mx-auto leading-relaxed">
                  Add line items from the approved contract or import from the contract document.
                  Each line item represents a cost category in the executed contract.
                </p>
              </div>

              {/* Setup actions — only for contractor/admin */}
              {canAddItems && !adding && (
                <div className="flex flex-wrap gap-2 justify-center">
                  <button
                    onClick={() => setAdding(true)}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-vektrum-blue/15 text-blue-300 border border-vektrum-blue/30 text-[12px] font-medium hover:bg-vektrum-blue/25 transition-colors"
                  >
                    <Plus size={12} aria-hidden="true" />
                    Add SOV Manually
                  </button>
                  <UploadContractTrigger className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-white/[0.10] text-[12px] text-white/55 hover:bg-white/[0.04] transition-colors">
                    <Upload size={12} aria-hidden="true" />
                    Upload Contract
                  </UploadContractTrigger>
                  <button
                    disabled
                    title="Contract extraction is not yet available"
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-white/[0.06] text-[12px] text-white/25 cursor-not-allowed"
                  >
                    <FileText size={12} aria-hidden="true" />
                    Import SOV from Contract
                    <span className="ml-1 text-[9px] uppercase tracking-wide text-white/20">Coming soon</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Milestone SOV link advisory — shown when items exist */}
          {viewerRole !== 'funder' && items.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <AlertCircle size={13} className="text-white/30 mt-0.5 flex-shrink-0" aria-hidden="true" />
              <span className="text-[11px] text-white/40">
                Link milestones to SOV line items to track draw requests against approved contract values.
              </span>
            </div>
          )}

          {/* Add line item inline form (when items already exist) */}
          {canAddItems && visibleItems.length > 0 && (
            adding ? (
              <AddSovItemForm
                dealId={dealId}
                onCreated={handleCreated}
                onCancel={() => setAdding(false)}
              />
            ) : (
              <button
                onClick={() => setAdding(true)}
                className="flex items-center gap-1.5 text-[12px] text-white/50 hover:text-blue-300 transition-colors"
              >
                <Plus size={13} aria-hidden="true" />
                Add SOV Line Item
              </button>
            )
          )}

          {/* Add form shown from empty-state "Add SOV Manually" button */}
          {canAddItems && visibleItems.length === 0 && adding && (
            <AddSovItemForm
              dealId={dealId}
              onCreated={handleCreated}
              onCancel={() => setAdding(false)}
            />
          )}

        </div>
      )}
    </div>
  )
}
