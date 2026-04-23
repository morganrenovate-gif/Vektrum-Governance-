'use client'

import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/utils/format'
import { rateLabel } from '@/lib/engine/billing'
import type { BillingRecord } from '@/lib/types'

interface BillingSummaryProps {
  dealId: string
}

interface BillingData {
  deal_id:          string
  billing_rate_bps: number
  records:          BillingRecord[]
  totals: {
    gross_amount: number
    fee_amount:   number
    net_amount:   number
  }
}

export function BillingSummary({ dealId }: BillingSummaryProps) {
  const [data,    setData]    = useState<BillingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetch() {
      setLoading(true)
      setError(null)

      try {
        const res = await window.fetch(`/api/deals/${dealId}/billing`)

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? `HTTP ${res.status}`)
        }

        const json: BillingData = await res.json()
        if (!cancelled) setData(json)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load billing data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetch()
    return () => { cancelled = true }
  }, [dealId])

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
        <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
        <div className="h-3 bg-gray-200 rounded w-2/5" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Could not load billing data: {error}
      </div>
    )
  }

  if (!data || data.records.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center">
        <p className="text-sm text-gray-500">No milestone releases yet.</p>
        <p className="text-xs text-gray-400 mt-1">
          Platform fees will appear here after the first release.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Aggregate totals ──────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Billing Summary
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Plan rate: {rateLabel(data.billing_rate_bps)}
          </p>
        </div>
        <div className="divide-y divide-gray-100">
          <div className="px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-gray-600">Total released to contractor</p>
            <p className="text-sm font-semibold text-gray-900 tabular-nums">
              {formatCurrency(data.totals.gross_amount)}
            </p>
          </div>
          <div className="px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Platform fees ({rateLabel(data.billing_rate_bps)})
            </p>
            <p className="text-sm font-medium text-gray-700 tabular-nums">
              {formatCurrency(data.totals.fee_amount)}
            </p>
          </div>
          <div className="px-4 py-3 flex items-center justify-between bg-gray-50">
            <p className="text-sm font-semibold text-gray-700">Total charged to account</p>
            <p className="text-sm font-bold text-gray-900 tabular-nums">
              {formatCurrency(data.totals.gross_amount + data.totals.fee_amount)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Per-milestone breakdown ────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Release History
          </p>
        </div>
        <div className="divide-y divide-gray-100">
          {data.records.map((record, i) => (
            <div key={record.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs text-gray-400 tabular-nums">
                    Release {i + 1} &middot;{' '}
                    {new Date(record.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                  <p className="text-xs text-gray-400 font-mono mt-0.5 truncate">
                    {record.stripe_transfer_id}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-semibold text-gray-900 tabular-nums">
                    {formatCurrency(record.gross_amount)}
                  </p>
                  <p className="text-xs text-gray-400 tabular-nums">
                    + {formatCurrency(record.fee_amount)} fee
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
