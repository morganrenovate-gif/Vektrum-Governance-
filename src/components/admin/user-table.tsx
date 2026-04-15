'use client'

// Advisor 10 (Adversarial): Admins see user data but cannot modify financial records.
// Advisor 8 (Ops): Search + filter by role is essential for support workflows.
// Advisor 4 (Security): Email display only — no ability to impersonate or modify auth.
// Display-only table. No mutation actions.

import { useState } from 'react'
import Link from 'next/link'
import type { Profile, Deal } from '@/lib/types'
import { CheckCircle2, AlertCircle, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UserTableProps {
  profiles: (Profile & { company_name?: string | null })[]
  deals: Deal[]
}

type RoleFilter = 'all' | 'contractor' | 'funder' | 'admin'

const ROLE_LABELS: Record<string, string> = {
  contractor: 'Contractor',
  funder:     'Funder',
  admin:      'Admin',
}

const ROLE_COLORS: Record<string, string> = {
  contractor: 'bg-vektrum-blue-subtle border-vektrum-blue-border text-vektrum-blue',
  funder:     'bg-vektrum-green-bg border-vektrum-green-border text-vektrum-green',
  admin:      'bg-vektrum-amber-bg border-vektrum-amber-border text-vektrum-amber',
}

export function UserTable({ profiles, deals }: UserTableProps) {
  const [search, setSearch]           = useState('')
  const [roleFilter, setRoleFilter]   = useState<RoleFilter>('all')

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
    <div className="rounded-xl border border-vektrum-border bg-vektrum-surface overflow-hidden shadow-sm">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-5 py-4 border-b border-vektrum-border-subtle bg-vektrum-bg">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-vektrum-faint" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or company…"
            className="w-full rounded-lg border border-vektrum-border bg-vektrum-surface pl-8 pr-3 py-2 text-[13px] text-vektrum-text placeholder:text-vektrum-faint focus:outline-none focus:ring-2 focus:ring-vektrum-blue/30 focus:border-vektrum-blue transition-all"
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
                  : 'text-vektrum-muted hover:text-vektrum-text hover:bg-vektrum-surface-alt'
              )}
            >
              {role}
            </button>
          ))}
        </div>
      </div>

      {/* Column headers */}
      <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-vektrum-border-subtle">
        {['User', 'Role', 'Stripe', 'Deals', 'Joined'].map((h) => (
          <p key={h} className="text-[10px] font-semibold uppercase tracking-widest text-vektrum-faint">{h}</p>
        ))}
      </div>

      {/* Rows */}
      {filtered.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm text-vektrum-muted">No users match your search.</p>
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
                className="flex flex-col gap-2 md:grid md:grid-cols-[2fr_1fr_1fr_1fr_auto] md:items-center md:gap-4 px-5 py-3.5 hover:bg-vektrum-bg transition-colors"
              >
                {/* User info */}
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-vektrum-text truncate">
                    {profile.full_name ?? 'No name'}
                  </p>
                  {profile.company_name && (
                    <p className="text-[11px] text-vektrum-muted truncate">{profile.company_name}</p>
                  )}
                </div>

                {/* Role badge */}
                <div>
                  <span className={cn(
                    'inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold capitalize',
                    ROLE_COLORS[profile.role] ?? 'bg-vektrum-surface-alt border-vektrum-border text-vektrum-muted'
                  )}>
                    {ROLE_LABELS[profile.role] ?? profile.role}
                  </span>
                </div>

                {/* Stripe status — contractors only */}
                <div>
                  {profile.role === 'contractor' ? (
                    hasStripe ? (
                      <div className="flex items-center gap-1.5">
                        {stripeOk ? (
                          <CheckCircle2 size={12} className="text-vektrum-green" aria-hidden="true" />
                        ) : (
                          <AlertCircle size={12} className="text-vektrum-amber" aria-hidden="true" />
                        )}
                        <span className={`text-[11px] font-medium ${stripeOk ? 'text-vektrum-green' : 'text-vektrum-amber'}`}>
                          {stripeOk ? 'Active' : 'Pending'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-vektrum-faint">Not connected</span>
                    )
                  ) : (
                    <span className="text-[11px] text-vektrum-faint">N/A</span>
                  )}
                </div>

                {/* Deal count */}
                <div>
                  <span className="text-[13px] font-semibold tabular-nums text-vektrum-text">
                    {dealCount}
                  </span>
                  <span className="text-[11px] text-vektrum-faint ml-1">deal{dealCount !== 1 ? 's' : ''}</span>
                </div>

                {/* Joined date + view deals */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-vektrum-faint whitespace-nowrap">
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
              </div>
            )
          })}
        </div>
      )}

      {/* Footer count */}
      <div className="px-5 py-3 border-t border-vektrum-border-subtle bg-vektrum-bg">
        <p className="text-[11px] text-vektrum-faint">
          Showing {filtered.length} of {profiles.length} users
        </p>
      </div>
    </div>
  )
}
