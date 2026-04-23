'use client'

// Advisor 10 (Adversarial): Admins see user data but cannot modify financial records.
// Advisor 8 (Ops): Search + filter by role is essential for support workflows.
// Advisor 4 (Security): Email display only — no ability to impersonate or modify auth.

import { useState } from 'react'
import Link from 'next/link'
import type { Profile, Deal } from '@/lib/types'
import { CheckCircle2, AlertCircle, Search, ShieldPlus, X, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UserTableProps {
  profiles: (Profile & { company_name?: string | null })[]
  deals: Deal[]
  emailMap?: Record<string, string>
}

type RoleFilter = 'all' | 'contractor' | 'funder' | 'admin'

const ROLE_LABELS: Record<string, string> = {
  contractor: 'Contractor',
  funder:     'Funder',
  admin:      'Admin',
}

const ROLE_COLORS: Record<string, string> = {
  contractor: 'bg-vektrum-blue/10 border-vektrum-blue/20 text-vektrum-blue',
  funder:     'bg-emerald-500/[0.08] border-emerald-500/20 text-emerald-400',
  admin:      'bg-amber-500/[0.08] border-amber-500/20 text-amber-400',
}

export function UserTable({ profiles, deals, emailMap = {} }: UserTableProps) {
  const [search, setSearch]           = useState('')
  const [roleFilter, setRoleFilter]   = useState<RoleFilter>('all')
  const [promotingId, setPromotingId] = useState<string | null>(null)
  const [promotedIds, setPromotedIds] = useState<Set<string>>(new Set())
  const [promoteError, setPromoteError] = useState<string | null>(null)
  const [promoteTarget, setPromoteTarget] = useState<{ id: string; full_name: string } | null>(null)

  async function executePromote(userId: string) {
    setPromotingId(userId)
    setPromoteError(null)
    setPromoteTarget(null)

    try {
      const res = await fetch('/api/admin/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Request failed' }))
        setPromoteError(data.error ?? 'Failed to promote user.')
        return
      }

      setPromotedIds((prev) => new Set(prev).add(userId))
    } catch {
      setPromoteError('Network error. Please try again.')
    } finally {
      setPromotingId(null)
    }
  }

  const dealCountByUser = deals.reduce<Record<string, number>>((acc, deal) => {
    acc[deal.contractor_id] = (acc[deal.contractor_id] ?? 0) + 1
    if (deal.funder_id) acc[deal.funder_id] = (acc[deal.funder_id] ?? 0) + 1
    return acc
  }, {})

  const filtered = profiles.filter((p) => {
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      (p.full_name ?? '').toLowerCase().includes(q) ||
      (p.company_name ?? '').toLowerCase().includes(q)
    const matchRole = roleFilter === 'all' || p.role === roleFilter
    return matchSearch && matchRole
  })

  return (
    <div className="rounded-xl border border-white/[0.08] bg-surface-2 overflow-hidden shadow-sm">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-5 py-4 border-b border-white/[0.05] bg-vektrum-bg">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or company…"
            className="w-full rounded-lg border border-white/[0.08] bg-surface-2 pl-8 pr-3 py-2 text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-vektrum-blue/30 focus:border-vektrum-blue transition-all"
          />
        </div>

        {/* Role filter */}
        <div className="flex gap-1">
          {(['all', 'contractor', 'funder', 'admin'] as RoleFilter[]).map((role) => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all capitalize',
                roleFilter === role
                  ? 'bg-vektrum-blue text-white'
                  : 'text-white/55 hover:text-white hover:bg-surface-3'
              )}
            >
              {role}
            </button>
          ))}
        </div>
      </div>

      {/* Promote error banner */}
      {promoteError && (
        <div className="px-5 py-3 bg-red-50 border-b border-red-200">
          <p className="text-[12px] text-red-700">{promoteError}</p>
        </div>
      )}

      {/* Column headers */}
      <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_auto_auto] gap-4 px-5 py-3 border-b border-white/[0.05]">
        {['User', 'Role', 'Stripe', 'Deals', 'Joined', 'Actions'].map((h) => (
          <p key={h} className="text-[10px] font-semibold uppercase tracking-widest text-white/30">{h}</p>
        ))}
      </div>

      {/* Rows */}
      {filtered.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm text-white/55">No users match your search.</p>
        </div>
      ) : (
        <div className="divide-y divide-vektrum-border-subtle max-h-[480px] overflow-y-auto">
          {filtered.map((profile) => {
            const dealCount = dealCountByUser[profile.id] ?? 0
            const stripeOk  = profile.stripe_payouts_enabled
            const hasStripe = !!profile.stripe_account_id

            const isPromoted = promotedIds.has(profile.id)
            const effectiveRole = isPromoted ? 'admin' : profile.role

            return (
              <div
                key={profile.id}
                className="flex flex-col gap-2 md:grid md:grid-cols-[2fr_1fr_1fr_1fr_auto_auto] md:items-center md:gap-4 px-5 py-3.5 hover:bg-vektrum-bg transition-colors"
              >
                {/* User info */}
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-white truncate max-w-[200px]">
                    {profile.full_name ?? 'No name'}
                  </p>
                  {emailMap[profile.id] && (
                    <p className="text-[11px] text-white/30 truncate max-w-[200px]">{emailMap[profile.id]}</p>
                  )}
                  {profile.company_name && (
                    <p className="text-[11px] text-white/55 truncate max-w-[200px]">{profile.company_name}</p>
                  )}
                </div>

                {/* Role badge */}
                <div>
                  <span className={cn(
                    'inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold capitalize',
                    ROLE_COLORS[effectiveRole] ?? 'bg-surface-3 border-white/[0.08] text-white/55'
                  )}>
                    {ROLE_LABELS[effectiveRole] ?? effectiveRole}
                  </span>
                </div>

                {/* Stripe status */}
                <div>
                  {hasStripe ? (
                    <div className="flex items-center gap-1.5">
                      {stripeOk ? (
                        <CheckCircle2 size={12} className="text-emerald-400" aria-hidden="true" />
                      ) : (
                        <AlertCircle size={12} className="text-amber-400" aria-hidden="true" />
                      )}
                      <span className={`text-[11px] font-medium ${stripeOk ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {stripeOk ? 'Connected' : 'Pending'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-full bg-gray-300" />
                      <span className="text-[11px] text-white/30">Not connected</span>
                    </div>
                  )}
                </div>

                {/* Deal count */}
                <div>
                  <span className="text-[13px] font-semibold tabular-nums text-white">
                    {dealCount}
                  </span>
                  <span className="text-[11px] text-white/30 ml-1">deal{dealCount !== 1 ? 's' : ''}</span>
                </div>

                {/* Joined date + view deals */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-white/30 whitespace-nowrap">
                    {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  {dealCount > 0 && (
                    <Link
                      href={`/dashboard?userId=${profile.id}`}
                      className="text-[11px] font-medium text-vektrum-blue hover:underline whitespace-nowrap"
                    >
                      View deals
                    </Link>
                  )}
                </div>

                {/* Promote action */}
                <div>
                  {effectiveRole !== 'admin' ? (
                    <button
                      onClick={() => setPromoteTarget({ id: profile.id, full_name: profile.full_name ?? 'this user' })}
                      disabled={promotingId === profile.id}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-all',
                        promotingId === profile.id
                          ? 'border-white/[0.08] bg-surface-3 text-white/30 cursor-not-allowed'
                          : 'border-vektrum-blue/20 bg-vektrum-blue/10 text-vektrum-blue hover:bg-vektrum-blue hover:text-white'
                      )}
                    >
                      <ShieldPlus size={12} aria-hidden="true" />
                      {promotingId === profile.id ? 'Promoting…' : 'Promote'}
                    </button>
                  ) : (
                    <span className="text-[11px] text-white/30">—</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Footer count */}
      <div className="px-5 py-3 border-t border-white/[0.05] bg-vektrum-bg">
        <p className="text-[11px] text-white/30">
          Showing {filtered.length} of {profiles.length} users
        </p>
      </div>

      {/* Promote confirmation modal */}
      {promoteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setPromoteTarget(null)} />
          <div className="relative max-w-md w-full mx-4 rounded-xl bg-white shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Promote to Admin</h2>
              <button type="button" onClick={() => setPromoteTarget(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-700 mb-4">
              You are about to grant admin privileges to <strong>{promoteTarget.full_name}</strong>.
              This gives them full access to user management, audit logs, and platform oversight.
              This action will be logged.
            </p>
            <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 mb-5">
              <AlertTriangle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                Admin role grants access to all user data and audit records. Only promote trusted team members.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPromoteTarget(null)}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executePromote(promoteTarget.id)}
                className="flex-1 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 transition-colors"
              >
                Confirm Promotion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
