export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { DollarSign, ArrowRight } from 'lucide-react'
import { formatMoney } from '@/lib/utils'
import type { Profile } from '@/lib/types'

export default async function ContractorPaymentsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login?next=/dashboard/contractor/payments')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawProfile } = await (supabase as any)
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  const profile = rawProfile as Pick<Profile, 'id' | 'role'> | null
  if (!profile || profile.role !== 'contractor') redirect('/dashboard')

  // Fetch releases for this contractor's deals
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: deals } = await (supabase as any)
    .from('deals')
    .select('id, title')
    .eq('contractor_id', user.id)

  const dealIds = (deals ?? []).map((d: { id: string }) => d.id)
  const dealMap = new Map((deals ?? []).map((d: { id: string; title: string }) => [d.id, d.title]))

  interface ReleaseRecord {
    id: string
    milestone_id: string
    deal_id: string
    amount: number
    released_at: string
    milestone?: { title: string } | null
  }

  let releases: ReleaseRecord[] = []

  if (dealIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rels } = await (supabase as any)
      .from('releases')
      .select('id, milestone_id, deal_id, amount, released_at, milestone:milestones!releases_milestone_id_fkey(title)')
      .in('deal_id', dealIds)
      .order('released_at', { ascending: false })

    releases = (rels ?? []) as ReleaseRecord[]
  }

  // Compute stats
  const totalEarned = releases.reduce((s, r) => s + r.amount, 0)

  // Pending release: milestones in approved status (not yet released)
  let pendingRelease = 0
  if (dealIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pendingMilestones } = await (supabase as any)
      .from('milestones')
      .select('amount')
      .in('deal_id', dealIds)
      .eq('status', 'approved')

    pendingRelease = (pendingMilestones ?? []).reduce(
      (s: number, m: { amount: number }) => s + m.amount,
      0,
    )
  }

  const lastPayment = releases.length > 0 ? releases[0] : null

  return (
    <div className="min-h-screen bg-[#0D1B2A]">
    <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-12 sm:py-16 space-y-8">
      <div>
        <div className="mb-3 flex items-center gap-3">
          <div className="h-px w-5 bg-vektrum-blue" />
          <p className="text-[11px] tracking-[0.12em] uppercase text-vektrum-blue font-semibold">Payments</p>
        </div>
        <h1 className="font-display text-[2.25rem] font-bold tracking-[-0.04em] text-white leading-[1.05]">Payment History</h1>
        <p className="mt-2 text-[15px] text-white/55">
          Track released milestone funds
        </p>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div
          className="rounded-2xl border border-white/[0.08] bg-[#111827] px-5 py-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/[0.14]"
          style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03)' }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">Total Earned</p>
          <p className="mt-2 font-display text-4xl font-bold tabular-nums text-white leading-none">{formatMoney(totalEarned)}</p>
        </div>
        <div
          className="rounded-2xl border border-white/[0.08] bg-[#111827] px-5 py-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/[0.14]"
          style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03)' }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">Pending Release</p>
          <p className="mt-2 font-display text-4xl font-bold tabular-nums text-vektrum-amber leading-none">{formatMoney(pendingRelease)}</p>
        </div>
        <div
          className="rounded-2xl border border-white/[0.08] bg-[#111827] px-5 py-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/[0.14]"
          style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03)' }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">Last Payment</p>
          <p className="mt-2 font-display text-4xl font-bold tabular-nums text-emerald-400 leading-none">
            {lastPayment ? formatMoney(lastPayment.amount) : '—'}
          </p>
          {lastPayment && (
            <p className="mt-1.5 text-[11px] text-white/30">
              {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(lastPayment.released_at))}
            </p>
          )}
        </div>
      </div>

      {releases.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-white/[0.08]">
          <DollarSign size={40} className="mx-auto text-white/20 mb-3" />
          <p className="text-white font-medium mb-1">No payments yet</p>
          <p className="text-white/50 text-sm mb-5">
            Payments will appear here once milestone funds are released.
          </p>
          <Link
            href="/dashboard"
            className="group inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-vektrum-blue px-6 py-2.5 text-[14px] font-semibold text-white shadow-lg shadow-vektrum-blue/30 transition-all hover:bg-vektrum-blue-hover hover:shadow-xl hover:shadow-vektrum-blue/40 hover:-translate-y-0.5"
          >
            Go to Dashboard
            <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      ) : (
        <div
          className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#111827]"
          style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03)' }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">Milestone</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">Deal</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">Amount</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">Date Released</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {releases.map((rel) => (
                <tr key={rel.id} className="hover:bg-white/[0.025] transition-colors">
                  <td className="px-4 py-3 font-medium text-white/80">{rel.milestone?.title ?? 'Unknown'}</td>
                  <td className="px-4 py-3 text-white/45">{(dealMap.get(rel.deal_id) as string) ?? 'Unknown Deal'}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums text-emerald-400">{formatMoney(rel.amount)}</td>
                  <td className="px-4 py-3 text-white/45">
                    {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(rel.released_at))}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                      Released
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
    </div>
  )
}
