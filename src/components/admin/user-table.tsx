'use client'

// Advisor 10 (Adversarial): Admins see user data but cannot modify financial records.
// Advisor 8 (Ops): Search + filter by role is essential for support workflows.
// Advisor 4 (Security): Email display only — no ability to impersonate or modify auth.
// Admin promotion is intentionally removed from the UI.
// Use the CLI / owner-controlled process to create new admins.

import { useState } from 'react'
import Link from 'next/link'
import type { Profile, Deal } from '@/lib/types'
import { CheckCircle2, AlertCircle, Search } from 'lucide-react'
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
  contractor: 'bg-vektrum-blue/20 border-vektrum-blue/40 text-blue-300',
  funder:     'bg-emerald-500/[0.08] border-emerald-500/20 text-emerald-400',
  admin:      'bg-amber-500/[0.08] border-amber-500/20 text-amber-400',
}

export function UserTable({ profiles, deals, emailMap = {} }: UserTableProps) {
  const [search, setSearch]         = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-5 py-4 border-b border-white/[0.05] bg-white/[0.015]">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/65" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or company…"
            aria-label="Search users"
            className="w-full rounded-lg border border-white/[0.14] bg-surface-2 pl-8 pr-3 py-2 text-[13px] text-white placeholder:text-white/55 focus:outline-none focus:ring-2 focus:ring-vektrum-blue/50 focus:border-vektrum-blue transition-all"
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
                  : 'text-white/70 hover:text-white hover:bg-surface-3'
              )}
            >
              {role}
            </button>
          ))}
        </div>
      </div>

      {/* Column headers */}
      <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-white/[0.05]">
        {['User', 'Role', 'Stripe', 'Deals', 'Joined'].map((h) => (
          <p key={h} className="text-[10px] font-semibold uppercase tracking-widest text-white/65">{h}</p>
        ))}
      </div>

      {/* Rows */}
      {filtered.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm text-white/75">No users match your search.</p>
        </div>
      ) : (
        <div className="divide-y divide-vektrum-border-subtle max-h-[480px] overflow-y-auto">
          {filtered.map((profile) => {
            const dealCount = dealCountByUser[profile.id] ?? 0
            const stripeOk  = profile.stripe_payouts_enabled
            const hasStripe = !!profile.stripe_account_id

            return (
              <div
                key={profile.id}
                className="flex flex-col gap-2 md:grid md:grid-cols-[2fr_1fr_1fr_1fr_auto] md:items-center md:gap-4 px-5 py-3.5 hover:bg-white/[0.03] transition-colors"
              >
                {/* User info */}
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-white truncate max-w-[200px]">
                    {profile.full_name ?? 'No name'}
                  </p>
                  {emailMap[profile.id] && (
                    <p className="text-[11px] text-white/70 truncate max-w-[200px]">{emailMap[profile.id]}</p>
                  )}
                  {profile.company_name && (
                    <p className="text-[11px] text-white/65 truncate max-w-[200px]">{profile.company_name}</p>
                  )}
                </div>

                {/* Role badge — read-only */}
                <div>
                  <span className={cn(
                    'inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold capitalize',
                    ROLE_COLORS[profile.role] ?? 'bg-surface-3 border-white/[0.12] text-white/80'
                  )}>
                    {ROLE_LABELS[profile.role] ?? profile.role}
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
                      <span className="inline-block h-2 w-2 rounded-full bg-white/40" aria-hidden="true" />
                      <span className="text-[11px] text-white/65">Not connected</span>
                    </div>
                  )}
                </div>

                {/* Deal count */}
                <div>
                  <span className="text-[13px] font-semibold tabular-nums text-white">
                    {dealCount}
                  </span>
                  <span className="text-[11px] text-white/65 ml-1">deal{dealCount !== 1 ? 's' : ''}</span>
                </div>

                {/* Joined + view user link */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-white/65 whitespace-nowrap">
                    {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <Link
                    href={`/dashboard/admin/users/${profile.id}`}
                    className="text-[11px] font-medium text-blue-300 hover:text-blue-200 hover:underline whitespace-nowrap"
                  >
                    View user
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Footer count */}
      <div className="px-5 py-3 border-t border-white/[0.05] bg-white/[0.015]">
        <p className="text-[11px] text-white/65">
          Showing {filtered.length} of {profiles.length} users
        </p>
      </div>
    </div>
  )
}
