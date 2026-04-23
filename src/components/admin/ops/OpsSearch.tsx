'use client'

import { useState, useCallback, useRef } from 'react'
import {
  Search, Loader2, FileText, User, ArrowUpRight, X, DollarSign,
} from 'lucide-react'
import { formatMoney } from '@/lib/utils'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DealResult {
  id:              string
  title:           string
  description:     string | null
  total_amount:    number
  status:          string
  created_at:      string
  contractor_name: string
  contractor_id:   string | null
  funder_name:     string
  funder_id:       string | null
}

interface ProfileResult {
  id:                     string
  display_name:           string
  full_name:              string | null
  company_name:           string | null
  email:                  string | null
  role:                   string
  stripe_account_id:      string | null
  stripe_payouts_enabled: boolean
  onboarding_complete:    boolean
  created_at:             string
}

interface ReleaseResult {
  id:                 string
  milestone_id:       string
  deal_id:            string
  amount:             number
  stripe_transfer_id: string | null
  transfer_status:    string
  released_at:        string
  failure_code:       string | null
  failure_message:    string | null
  failed_at:          string | null
  milestone_title:    string | null
  deal_title:         string | null
}

interface SearchResults {
  query:   string
  total:   number
  results: {
    deals:    DealResult[]
    profiles: ProfileResult[]
    releases: ReleaseResult[]
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  active:     'text-emerald-400',
  completed:  'text-blue-400',
  disputed:   'text-red-400',
  draft:      'text-white/40',
  cancelled:  'text-white/25',
  pending:    'text-amber-400',
  confirmed:  'text-emerald-400',
  failed:     'text-red-400',
  reversed:   'text-red-400',
}

const ROLE_COLORS: Record<string, string> = {
  admin:      'bg-purple-500/15 text-purple-400 border border-purple-500/20',
  funder:     'bg-blue-500/15 text-blue-400 border border-blue-500/20',
  contractor: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionLabel({ icon: Icon, label, count }: {
  icon: React.ElementType; label: string; count: number
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.03] border-b border-white/[0.04]">
      <Icon size={12} className="text-white/30" />
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">
        {label} ({count})
      </p>
    </div>
  )
}

// ─── Deal result ──────────────────────────────────────────────────────────────

function DealRow({ d }: { d: DealResult }) {
  return (
    <Link
      href={`/dashboard/admin?highlight=${d.id}`}
      className="flex items-center gap-4 px-4 py-3 hover:bg-white/[0.04] transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-white/80 truncate group-hover:text-white transition-colors">
          {d.title}
        </p>
        <p className="text-[11px] text-white/35 truncate mt-0.5">
          {d.contractor_name} → {d.funder_name}
        </p>
      </div>

      <span className={`text-[11px] font-medium flex-shrink-0 capitalize ${STATUS_COLORS[d.status] ?? 'text-white/40'}`}>
        {d.status}
      </span>

      <p className="text-[13px] font-mono text-white/50 flex-shrink-0">
        {formatMoney(d.total_amount)}
      </p>

      <ArrowUpRight size={13} className="text-white/20 group-hover:text-white/50 flex-shrink-0 transition-colors" />
    </Link>
  )
}

// ─── Profile result ───────────────────────────────────────────────────────────

function ProfileRow({ p }: { p: ProfileResult }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-white/[0.04] transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-white/80 truncate">
          {p.display_name}
        </p>
        <p className="text-[11px] text-white/35 truncate mt-0.5">
          {p.email ?? 'No email'} · ID: {p.id.slice(0, 8)}…
        </p>
      </div>

      <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0 ${ROLE_COLORS[p.role] ?? ''}`}>
        {p.role}
      </span>

      <div className="flex gap-1.5 flex-shrink-0">
        {!p.stripe_payouts_enabled && p.role === 'contractor' && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/15">
            No payouts
          </span>
        )}
        {!p.onboarding_complete && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/30 border border-white/[0.08]">
            Incomplete
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Release result ───────────────────────────────────────────────────────────

function ReleaseRow({ r }: { r: ReleaseResult }) {
  const isFailed = r.transfer_status === 'failed' || r.transfer_status === 'reversed'
  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-white/[0.04] transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-mono text-white/60 truncate">
          {r.stripe_transfer_id ?? r.id.slice(0, 16) + '…'}
        </p>
        <p className="text-[11px] text-white/35 truncate mt-0.5">
          {r.milestone_title ?? 'Milestone'} · {r.deal_title ?? 'Deal'}
          {isFailed && r.failure_code ? ` · ${r.failure_code}` : ''}
        </p>
      </div>

      <span className={`text-[11px] font-medium flex-shrink-0 capitalize ${STATUS_COLORS[r.transfer_status] ?? 'text-white/40'}`}>
        {r.transfer_status}
      </span>

      <p className="text-[13px] font-mono text-white/50 flex-shrink-0">
        {formatMoney(r.amount)}
      </p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function OpsSearch() {
  const [query,     setQuery]     = useState('')
  const [results,   setResults]   = useState<SearchResults | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults(null); return }
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/admin/ops/search?q=${encodeURIComponent(q)}`)
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Search failed.'); return }
      setResults(json as SearchResults)
    } catch {
      setError('Network error.')
    } finally {
      setLoading(false)
    }
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 400)
  }

  function clear() {
    setQuery('')
    setResults(null)
    setError(null)
  }

  const hasResults = results && results.total > 0
  const isEmpty    = results && results.total === 0

  return (
    <div className="space-y-3">
      {/* ── Search input ──────────────────────────────────────────────── */}
      <div className="relative">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
          {loading
            ? <Loader2 size={15} className="animate-spin text-white/30" />
            : <Search size={15} className="text-white/30" />
          }
        </div>

        <input
          type="text"
          value={query}
          onChange={handleChange}
          placeholder="Search deals, users, emails, Stripe IDs…"
          className="w-full rounded-xl border border-white/[0.1] bg-white/[0.05] pl-10 pr-10 py-3 text-[13px] text-white/80 placeholder:text-white/25 focus:outline-none focus:border-vektrum-blue/50 focus:bg-white/[0.07] transition-all"
          autoComplete="off"
          spellCheck={false}
        />

        {query && (
          <button
            type="button"
            onClick={clear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/[0.08] px-4 py-2.5 text-[12px] text-red-400">
          {error}
        </div>
      )}

      {/* ── Results ─────────────────────────────────────────────────── */}
      {isEmpty && (
        <div className="rounded-xl border border-white/[0.06] bg-surface-2 px-5 py-6 text-center">
          <p className="text-[13px] text-white/40">
            No results for <span className="text-white/60 font-mono">"{query}"</span>
          </p>
          <p className="text-[11px] text-white/25 mt-1">
            Try a different name, email, deal title, or Stripe transfer ID.
          </p>
        </div>
      )}

      {hasResults && (
        <div className="rounded-xl border border-white/[0.08] bg-surface-2 shadow-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/[0.06]">
            <p className="text-[11px] text-white/30">
              {results.total} result{results.total !== 1 ? 's' : ''} for{' '}
              <span className="text-white/50 font-mono">"{results.query}"</span>
            </p>
          </div>

          {/* Deals */}
          {results.results.deals.length > 0 && (
            <>
              <SectionLabel icon={FileText} label="Deals" count={results.results.deals.length} />
              {results.results.deals.map((d) => <DealRow key={d.id} d={d} />)}
            </>
          )}

          {/* Profiles */}
          {results.results.profiles.length > 0 && (
            <>
              <SectionLabel icon={User} label="Users" count={results.results.profiles.length} />
              {results.results.profiles.map((p) => <ProfileRow key={p.id} p={p} />)}
            </>
          )}

          {/* Releases */}
          {results.results.releases.length > 0 && (
            <>
              <SectionLabel icon={DollarSign} label="Transfers" count={results.results.releases.length} />
              {results.results.releases.map((r) => <ReleaseRow key={r.id} r={r} />)}
            </>
          )}
        </div>
      )}
    </div>
  )
}
